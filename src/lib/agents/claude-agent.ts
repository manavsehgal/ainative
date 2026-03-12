import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import { tasks, projects, agentLogs, notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setExecution, removeExecution } from "./execution-manager";
import { MAX_RESUME_COUNT } from "@/lib/constants/task-status";
import { getAuthEnv, updateAuthStatus } from "@/lib/settings/auth";
import { buildDocumentContext } from "@/lib/documents/context-builder";
import {
  buildTaskOutputInstructions,
  prepareTaskOutputDirectory,
  scanTaskOutputDocuments,
} from "@/lib/documents/output-scanner";
import { getProfile } from "./profiles/registry";
import { resolveProfileRuntimePayload } from "./profiles/compatibility";
import type { CanUseToolPolicy } from "./profiles/types";
import { buildClaudeSdkEnv } from "./runtime/claude-sdk";
import {
  extractUsageSnapshot,
  mergeUsageSnapshot,
  recordUsageLedgerEntry,
  resolveUsageActivityType,
  type UsageActivityType,
  type UsageSnapshot,
} from "@/lib/usage/ledger";

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

interface TaskUsageState extends UsageSnapshot {
  activityType: UsageActivityType;
  startedAt: Date;
  taskId: string;
  projectId?: string | null;
  workflowId?: string | null;
  scheduleId?: string | null;
}

interface ToolPermissionResponse {
  behavior: "allow" | "deny";
  updatedInput?: unknown;
  message?: string;
}

const inFlightPermissionRequests = new Map<
  string,
  Promise<ToolPermissionResponse>
>();
const settledPermissionRequests = new Map<string, ToolPermissionResponse>();

function buildAllowedToolPermissionResponse(
  input: Record<string, unknown>
): ToolPermissionResponse {
  return {
    behavior: "allow",
    updatedInput: input,
  };
}

function normalizeToolPermissionResponse(
  response: ToolPermissionResponse,
  input: Record<string, unknown>
): ToolPermissionResponse {
  if (response.behavior !== "allow" || response.updatedInput !== undefined) {
    return response;
  }

  return {
    ...response,
    updatedInput: input,
  };
}

function createTaskUsageState(
  task: {
    id: string;
    projectId?: string | null;
    workflowId?: string | null;
    scheduleId?: string | null;
  },
  isResume = false
): TaskUsageState {
  return {
    taskId: task.id,
    projectId: task.projectId ?? null,
    workflowId: task.workflowId ?? null,
    scheduleId: task.scheduleId ?? null,
    activityType: resolveUsageActivityType({
      workflowId: task.workflowId,
      scheduleId: task.scheduleId,
      isResume,
    }),
    startedAt: new Date(),
  };
}

function applyUsageSnapshot(state: TaskUsageState, source: unknown) {
  Object.assign(state, mergeUsageSnapshot(state, extractUsageSnapshot(source)));
}

function buildPermissionCacheKey(
  taskId: string,
  toolName: string,
  input: Record<string, unknown>
): string {
  return `${taskId}::${toolName}::${JSON.stringify(input)}`;
}

function clearPermissionCache(taskId: string) {
  const prefix = `${taskId}::`;

  for (const key of inFlightPermissionRequests.keys()) {
    if (key.startsWith(prefix)) {
      inFlightPermissionRequests.delete(key);
    }
  }

  for (const key of settledPermissionRequests.keys()) {
    if (key.startsWith(prefix)) {
      settledPermissionRequests.delete(key);
    }
  }
}

async function waitForToolPermissionResponse(
  notificationId: string
): Promise<ToolPermissionResponse> {
  const deadline = Date.now() + 55_000;
  const pollInterval = 1500;

  while (Date.now() < deadline) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));

    if (notification?.response) {
      try {
        return JSON.parse(notification.response) as ToolPermissionResponse;
      } catch {
        return { behavior: "deny", message: "Invalid response format" };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return { behavior: "deny", message: "Permission request timed out" };
}

async function finalizeTaskUsage(
  state: TaskUsageState,
  status: "completed" | "failed" | "cancelled"
) {
  await recordUsageLedgerEntry({
    taskId: state.taskId,
    workflowId: state.workflowId ?? null,
    scheduleId: state.scheduleId ?? null,
    projectId: state.projectId ?? null,
    activityType: state.activityType,
    runtimeId: "claude-code",
    providerId: "anthropic",
    modelId: state.modelId ?? null,
    inputTokens: state.inputTokens ?? null,
    outputTokens: state.outputTokens ?? null,
    totalTokens: state.totalTokens ?? null,
    status,
    startedAt: state.startedAt,
    finishedAt: new Date(),
  });
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
  agentProfileId = "general",
  usageState: TaskUsageState
): Promise<void> {
  let sessionId: string | null = null;
  let receivedResult = false;

  for await (const raw of response) {
    const message = raw as AgentStreamMessage;
    applyUsageSnapshot(usageState, raw);

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

    // Handle result — skip if task was cancelled mid-stream
    if (message.type === "result" && "result" in raw) {
      if (abortController.signal.aborted) {
        await finalizeTaskUsage(usageState, "cancelled");
        return;
      }
      receivedResult = true;
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

      try {
        await scanTaskOutputDocuments(taskId);
      } catch (error) {
        await db.insert(agentLogs).values({
          id: crypto.randomUUID(),
          taskId,
          agentType: agentProfileId,
          event: "output_scan_failed",
          payload: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
          timestamp: new Date(),
        });
      }

      await finalizeTaskUsage(usageState, "completed");
    }
  }

  // Safety net: if stream ended without a result frame, fail the task
  // instead of leaving it stuck in "running" forever
  if (!receivedResult) {
    await db
      .update(tasks)
      .set({
        status: "failed",
        result: "Agent stream ended without producing a result",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      taskId,
      type: "task_failed",
      title: `Task failed: ${taskTitle}`,
      body: "Agent stream ended unexpectedly without a result",
      createdAt: new Date(),
    });

    await finalizeTaskUsage(usageState, "failed");
  }
}

export async function executeClaudeTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);
  const usageState = createTaskUsageState(task);

  const abortController = new AbortController();

  setExecution(taskId, {
    abortController,
    sessionId: null,
    taskId,
    startedAt: new Date(),
  });

  try {
    await prepareTaskOutputDirectory(taskId, { clearExisting: true });
    const profile = getProfile(task.agentProfile ?? "general");
    const payload = profile
      ? resolveProfileRuntimePayload(profile, "claude-code")
      : null;
    if (payload && !payload.supported) {
      throw new Error(payload.reason ?? `Profile "${profile?.name}" is not supported on Claude Code`);
    }
    const systemPrompt = payload?.instructions ?? "";
    const basePrompt = task.description || task.title;
    const docContext = await buildDocumentContext(taskId);
    const outputInstructions = buildTaskOutputInstructions(taskId);
    const prompt = [systemPrompt, docContext, outputInstructions, basePrompt]
      .filter(Boolean)
      .join("\n\n");

    // Resolve working directory: project's workingDirectory > process.cwd()
    let cwd = process.cwd();
    if (task.projectId) {
      const [project] = await db
        .select({ workingDirectory: projects.workingDirectory })
        .from(projects)
        .where(eq(projects.id, task.projectId));
      if (project?.workingDirectory) {
        cwd = project.workingDirectory;
      }
    }

    const policyForTask = payload?.canUseToolPolicy;
    const authEnv = await getAuthEnv();
    const response = query({
      prompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd,
        env: buildClaudeSdkEnv(authEnv),
        ...(payload?.allowedTools && { allowedTools: payload.allowedTools }),
        ...(payload?.mcpServers &&
          Object.keys(payload.mcpServers).length > 0 && {
            mcpServers: payload.mcpServers,
          }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input, policyForTask);
        },
      },
    });

    await processAgentStream(
      taskId,
      task.title,
      response as AsyncIterable<Record<string, unknown>>,
      abortController,
      task.agentProfile ?? "general",
      usageState
    );
  } catch (error: unknown) {
    await handleExecutionError(
      taskId,
      task.title,
      error,
      abortController,
      task.agentProfile ?? "general",
      usageState
    );
  } finally {
    clearPermissionCache(taskId);
    removeExecution(taskId);
  }
}

export async function resumeClaudeTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);
  const usageState = createTaskUsageState(task, true);

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
    await prepareTaskOutputDirectory(taskId);
    const profile = getProfile(profileId);
    const payload = profile
      ? resolveProfileRuntimePayload(profile, "claude-code")
      : null;
    if (payload && !payload.supported) {
      throw new Error(payload.reason ?? `Profile "${profile?.name}" is not supported on Claude Code`);
    }
    const systemPrompt = payload?.instructions ?? "";
    const basePrompt = task.description || task.title;
    const docContext = await buildDocumentContext(taskId);
    const outputInstructions = buildTaskOutputInstructions(taskId);
    const prompt = [systemPrompt, docContext, outputInstructions, basePrompt]
      .filter(Boolean)
      .join("\n\n");

    // Resolve working directory: project's workingDirectory > process.cwd()
    let cwd = process.cwd();
    if (task.projectId) {
      const [project] = await db
        .select({ workingDirectory: projects.workingDirectory })
        .from(projects)
        .where(eq(projects.id, task.projectId));
      if (project?.workingDirectory) {
        cwd = project.workingDirectory;
      }
    }

    const policyForResume = payload?.canUseToolPolicy;
    const authEnv = await getAuthEnv();
    const response = query({
      prompt,
      options: {
        resume: task.sessionId,
        abortController,
        includePartialMessages: true,
        cwd,
        env: buildClaudeSdkEnv(authEnv),
        ...(payload?.allowedTools && { allowedTools: payload.allowedTools }),
        ...(payload?.mcpServers &&
          Object.keys(payload.mcpServers).length > 0 && {
            mcpServers: payload.mcpServers,
          }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input, policyForResume);
        },
      },
    });

    await processAgentStream(
      taskId,
      task.title,
      response as AsyncIterable<Record<string, unknown>>,
      abortController,
      profileId,
      usageState
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
      await finalizeTaskUsage(usageState, "failed");
      return;
    }

    await handleExecutionError(
      taskId,
      task.title,
      error,
      abortController,
      profileId,
      usageState
    );
  } finally {
    clearPermissionCache(taskId);
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
  agentProfileId = "general",
  usageState?: TaskUsageState
): Promise<void> {
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  if (abortController.signal.aborted) {
    await db
      .update(tasks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
    if (usageState) {
      await finalizeTaskUsage(usageState, "cancelled");
    }
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

  if (usageState) {
    await finalizeTaskUsage(usageState, "failed");
  }
}

/**
 * Handle tool permission by inserting a notification and polling for response.
 * Uses database polling pattern — the Inbox UI writes the response.
 */
async function handleToolPermission(
  taskId: string,
  toolName: string,
  input: Record<string, unknown>,
  canUseToolPolicy?: CanUseToolPolicy
): Promise<ToolPermissionResponse> {
  const isQuestion = toolName === "AskUserQuestion";

  // Layer 1: Profile-level canUseToolPolicy — fastest check, no I/O
  if (!isQuestion && canUseToolPolicy) {
    if (canUseToolPolicy.autoApprove?.includes(toolName)) {
      return buildAllowedToolPermissionResponse(input);
    }
    if (canUseToolPolicy.autoDeny?.includes(toolName)) {
      return { behavior: "deny", message: `Profile policy denies ${toolName}` };
    }
  }

  // Layer 2: Saved user permissions — skip notification for pre-approved tools
  if (!isQuestion) {
    const { isToolAllowed } = await import("@/lib/settings/permissions");
    if (await isToolAllowed(toolName, input)) {
      return buildAllowedToolPermissionResponse(input);
    }
  }

  if (!isQuestion) {
    const cacheKey = buildPermissionCacheKey(taskId, toolName, input);
    const settledResponse = settledPermissionRequests.get(cacheKey);
    if (settledResponse) {
      return normalizeToolPermissionResponse(settledResponse, input);
    }

    const pendingRequest = inFlightPermissionRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const requestPromise = (async () => {
      const notificationId = crypto.randomUUID();

      await db.insert(notifications).values({
        id: notificationId,
        taskId,
        type: "permission_required",
        title: `Permission required: ${toolName}`,
        body: JSON.stringify(input).slice(0, 1000),
        toolName,
        toolInput: JSON.stringify(input),
        createdAt: new Date(),
      });

      const response = normalizeToolPermissionResponse(
        await waitForToolPermissionResponse(notificationId),
        input
      );
      settledPermissionRequests.set(cacheKey, response);
      return response;
    })();

    inFlightPermissionRequests.set(cacheKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      inFlightPermissionRequests.delete(cacheKey);
    }
  }

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

  return waitForToolPermissionResponse(notificationId);
}
