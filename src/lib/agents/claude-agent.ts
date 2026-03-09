import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import { tasks, agentLogs, notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setExecution, removeExecution } from "./execution-manager";
import { MAX_RESUME_COUNT } from "@/lib/constants/task-status";
import { getAuthEnv, updateAuthStatus } from "@/lib/settings/auth";
import { buildDocumentContext } from "@/lib/documents/context-builder";
import { getProfile } from "./profiles/registry";

/**
 * Build the environment for the Agent SDK subprocess.
 * Returns undefined when no changes are needed (SDK inherits process.env naturally).
 * Only intervenes when:
 *   - CLAUDECODE is set (nested session — must strip it to avoid exit code 1)
 *   - authEnv is provided (API key auth — must inject the key)
 */
function buildSdkEnv(authEnv?: Record<string, string>): Record<string, string> | undefined {
  const isNested = "CLAUDECODE" in process.env;
  if (!authEnv && !isNested) return undefined;
  const { CLAUDECODE, ...cleanEnv } = process.env as Record<string, string>;
  return { ...cleanEnv, ...authEnv };
}

/** Typed representation of messages from the Agent SDK stream */
interface AgentStreamMessage {
  type?: string;
  subtype?: string;
  session_id?: string;
  api_key_source?: string;
  event?: Record<string, unknown>;
  message?: {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  result?: unknown;
}

/**
 * Process the async message stream from the Agent SDK.
 * Shared between executeClaudeTask and resumeClaudeTask to avoid duplication.
 */
async function processAgentStream(
  taskId: string,
  taskTitle: string,
  response: AsyncIterable<Record<string, unknown>>,
  abortController: AbortController,
  agentProfileId = "general"
): Promise<void> {
  let sessionId: string | null = null;

  for await (const raw of response) {
    const message = raw as AgentStreamMessage;

    // Capture session ID from init message
    if (
      message.type === "system" &&
      message.subtype === "init" &&
      message.session_id
    ) {
      sessionId = message.session_id;
      await db
        .update(tasks)
        .set({ sessionId, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      // Capture auth source from init message
      if (message.api_key_source) {
        updateAuthStatus(message.api_key_source as "db" | "env" | "oauth" | "unknown");
      }

      // Update execution manager with sessionId
      setExecution(taskId, {
        abortController,
        sessionId,
        taskId,
        startedAt: new Date(),
      });
    }

    // Log meaningful stream events
    if (message.type === "stream_event" && message.event) {
      const event = message.event;
      const eventType = event.type as string;

      if (
        eventType === "content_block_start" ||
        eventType === "content_block_delta" ||
        eventType === "message_start"
      ) {
        await db.insert(agentLogs).values({
          id: crypto.randomUUID(),
          taskId,
          agentType: agentProfileId,
          event: eventType,
          payload: JSON.stringify(event),
          timestamp: new Date(),
        });
      }
    }

    // Handle assistant messages (tool use starts)
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          await db.insert(agentLogs).values({
            id: crypto.randomUUID(),
            taskId,
            agentType: agentProfileId,
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

    // Handle result
    if (message.type === "result" && "result" in raw) {
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

      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        taskId,
        type: "task_completed",
        title: `Task completed: ${taskTitle}`,
        body: resultText.slice(0, 500),
        createdAt: new Date(),
      });

      await db.insert(agentLogs).values({
        id: crypto.randomUUID(),
        taskId,
        agentType: agentProfileId,
        event: "completed",
        payload: JSON.stringify({ result: resultText.slice(0, 1000) }),
        timestamp: new Date(),
      });
    }
  }
}

export async function executeClaudeTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);

  const abortController = new AbortController();

  setExecution(taskId, {
    abortController,
    sessionId: null,
    taskId,
    startedAt: new Date(),
  });

  try {
    const profile = getProfile(task.agentProfile ?? "general");
    const systemPrompt = profile?.systemPrompt ?? "";
    const basePrompt = task.description || task.title;
    const docContext = await buildDocumentContext(taskId);
    const prompt = [systemPrompt, docContext, basePrompt].filter(Boolean).join("\n\n");

    const authEnv = await getAuthEnv();
    const response = query({
      prompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd: process.cwd(),
        env: buildSdkEnv(authEnv),
        ...(profile?.allowedTools && { allowedTools: profile.allowedTools }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input);
        },
      },
    });

    await processAgentStream(
      taskId,
      task.title,
      response as AsyncIterable<Record<string, unknown>>,
      abortController,
      task.agentProfile ?? "general"
    );
  } catch (error: unknown) {
    await handleExecutionError(taskId, task.title, error, abortController, task.agentProfile ?? "general");
  } finally {
    removeExecution(taskId);
  }
}

export async function resumeClaudeTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);

  if (!task.sessionId) {
    throw new Error("No session to resume — use Retry instead");
  }

  if (task.resumeCount >= MAX_RESUME_COUNT) {
    throw new Error("Resume limit reached. Re-queue for fresh start.");
  }

  // Increment resume count
  await db
    .update(tasks)
    .set({ resumeCount: task.resumeCount + 1, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  const abortController = new AbortController();

  setExecution(taskId, {
    abortController,
    sessionId: task.sessionId,
    taskId,
    startedAt: new Date(),
  });

  const profileId = task.agentProfile ?? "general";

  await db.insert(agentLogs).values({
    id: crypto.randomUUID(),
    taskId,
    agentType: profileId,
    event: "session_resumed",
    payload: JSON.stringify({
      sessionId: task.sessionId,
      resumeCount: task.resumeCount + 1,
      profile: profileId,
    }),
    timestamp: new Date(),
  });

  try {
    const profile = getProfile(profileId);
    const systemPrompt = profile?.systemPrompt ?? "";
    const basePrompt = task.description || task.title;
    const docContext = await buildDocumentContext(taskId);
    const prompt = [systemPrompt, docContext, basePrompt].filter(Boolean).join("\n\n");

    const authEnv = await getAuthEnv();
    const response = query({
      prompt,
      options: {
        resume: task.sessionId,
        abortController,
        includePartialMessages: true,
        cwd: process.cwd(),
        env: buildSdkEnv(authEnv),
        ...(profile?.allowedTools && { allowedTools: profile.allowedTools }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input);
        },
      },
    });

    await processAgentStream(
      taskId,
      task.title,
      response as AsyncIterable<Record<string, unknown>>,
      abortController,
      profileId
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Detect session expiry from the SDK
    if (
      errorMessage.includes("session") &&
      (errorMessage.includes("expired") || errorMessage.includes("not found"))
    ) {
      await db
        .update(tasks)
        .set({
          status: "failed",
          result: "Session expired — re-queue for fresh start",
          sessionId: null,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        taskId,
        type: "task_failed",
        title: `Session expired: ${task.title}`,
        body: "The agent session has expired. Re-queue this task for a fresh start.",
        createdAt: new Date(),
      });
      return;
    }

    await handleExecutionError(taskId, task.title, error, abortController, profileId);
  } finally {
    removeExecution(taskId);
  }
}

/**
 * Shared error handler for both execute and resume paths.
 */
async function handleExecutionError(
  taskId: string,
  taskTitle: string,
  error: unknown,
  abortController: AbortController,
  agentProfileId = "general"
): Promise<void> {
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  if (abortController.signal.aborted) {
    await db
      .update(tasks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
    return;
  }

  await db
    .update(tasks)
    .set({
      status: "failed",
      result: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    taskId,
    type: "task_failed",
    title: `Task failed: ${taskTitle}`,
    body: errorMessage.slice(0, 500),
    createdAt: new Date(),
  });

  await db.insert(agentLogs).values({
    id: crypto.randomUUID(),
    taskId,
    agentType: agentProfileId,
    event: "error",
    payload: JSON.stringify({ error: errorMessage }),
    timestamp: new Date(),
  });
}

/**
 * Handle tool permission by inserting a notification and polling for response.
 * Uses database polling pattern — the Inbox UI writes the response.
 */
async function handleToolPermission(
  taskId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<{
  behavior: "allow" | "deny";
  updatedInput?: unknown;
  message?: string;
}> {
  const isQuestion = toolName === "AskUserQuestion";
  const notificationId = crypto.randomUUID();

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
