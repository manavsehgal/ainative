import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import { tasks, agentLogs, notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setExecution, removeExecution } from "./execution-manager";

export async function executeClaudeTask(taskId: string): Promise<void> {
  // Fetch the task
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);

  // Update status to running
  await db
    .update(tasks)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  const abortController = new AbortController();
  let sessionId: string | null = null;

  // Register in execution manager
  setExecution(taskId, {
    abortController,
    sessionId: null,
    taskId,
    startedAt: new Date(),
  });

  try {
    const prompt = task.description || task.title;
    const response = query({
      prompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd: process.cwd(),
        canUseTool: async (toolName: string, input: Record<string, unknown>) => {
          return handleToolPermission(taskId, toolName, input);
        },
      },
    });

    for await (const message of response) {
      // Capture session ID from init message
      if (
        message.type === "system" &&
        "subtype" in message &&
        message.subtype === "init" &&
        "session_id" in message
      ) {
        sessionId = message.session_id as string;
        await db
          .update(tasks)
          .set({ sessionId, updatedAt: new Date() })
          .where(eq(tasks.id, taskId));

        // Update execution manager with sessionId
        setExecution(taskId, {
          abortController,
          sessionId,
          taskId,
          startedAt: new Date(),
        });
      }

      // Log meaningful stream events
      if (message.type === "stream_event" && "event" in message) {
        const event = message.event as Record<string, unknown>;
        const eventType = event.type as string;

        // Filter to meaningful events
        if (
          eventType === "content_block_start" ||
          eventType === "content_block_delta" ||
          eventType === "message_start"
        ) {
          await db.insert(agentLogs).values({
            id: crypto.randomUUID(),
            taskId,
            agentType: "claude-code",
            event: eventType,
            payload: JSON.stringify(event),
            timestamp: new Date(),
          });
        }
      }

      // Handle assistant messages (tool use starts)
      if (message.type === "assistant" && "message" in message) {
        const msg = message.message as { content?: Array<{ type: string; name?: string; input?: unknown }> };
        if (msg.content) {
          for (const block of msg.content) {
            if (block.type === "tool_use") {
              await db.insert(agentLogs).values({
                id: crypto.randomUUID(),
                taskId,
                agentType: "claude-code",
                event: "tool_start",
                payload: JSON.stringify({
                  tool: block.name,
                  input: block.input,
                }),
                timestamp: new Date(),
              });
            }
          }
        }
      }

      // Handle result
      if ("result" in message && message.type === "result") {
        const resultText =
          typeof message.result === "string"
            ? message.result
            : JSON.stringify(message.result);

        await db
          .update(tasks)
          .set({
            status: "completed",
            result: resultText,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId));

        // Create completion notification
        await db.insert(notifications).values({
          id: crypto.randomUUID(),
          taskId,
          type: "task_completed",
          title: `Task completed: ${task.title}`,
          body: resultText.slice(0, 500),
          createdAt: new Date(),
        });

        await db.insert(agentLogs).values({
          id: crypto.randomUUID(),
          taskId,
          agentType: "claude-code",
          event: "completed",
          payload: JSON.stringify({ result: resultText.slice(0, 1000) }),
          timestamp: new Date(),
        });
      }
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Check if it was an abort
    if (abortController.signal.aborted) {
      await db
        .update(tasks)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
      return;
    }

    // Update task as failed
    await db
      .update(tasks)
      .set({
        status: "failed",
        result: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Create failure notification
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      taskId,
      type: "task_failed",
      title: `Task failed: ${task.title}`,
      body: errorMessage.slice(0, 500),
      createdAt: new Date(),
    });

    await db.insert(agentLogs).values({
      id: crypto.randomUUID(),
      taskId,
      agentType: "claude-code",
      event: "error",
      payload: JSON.stringify({ error: errorMessage }),
      timestamp: new Date(),
    });
  } finally {
    removeExecution(taskId);
  }
}

/**
 * Handle tool permission by inserting a notification and polling for response.
 * Uses database polling pattern — the Inbox UI writes the response.
 */
async function handleToolPermission(
  taskId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<{ behavior: "allow" | "deny"; updatedInput?: unknown; message?: string }> {
  const isQuestion = toolName === "AskUserQuestion";
  const notificationId = crypto.randomUUID();

  // Create notification
  await db.insert(notifications).values({
    id: notificationId,
    taskId,
    type: isQuestion ? "agent_message" : "permission_required",
    title: isQuestion
      ? "Agent has a question"
      : `Permission required: ${toolName}`,
    body: JSON.stringify(input).slice(0, 1000),
    toolName,
    toolInput: JSON.stringify(input),
    createdAt: new Date(),
  });

  // Poll for response with 55s timeout (5s buffer before SDK's 60s limit)
  const deadline = Date.now() + 55_000;
  const pollInterval = 1500;

  while (Date.now() < deadline) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));

    if (notification?.response) {
      try {
        return JSON.parse(notification.response);
      } catch {
        return { behavior: "deny", message: "Invalid response format" };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Timeout — auto-deny
  return { behavior: "deny", message: "Permission request timed out" };
}
