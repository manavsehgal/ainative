import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import { tasks, projects, agentLogs, notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setExecution, removeExecution } from "./execution-manager";
import { MAX_RESUME_COUNT, DEFAULT_MAX_TURNS, DEFAULT_MAX_BUDGET_USD } from "@/lib/constants/task-status";
import { getAuthEnv, updateAuthStatus } from "@/lib/settings/auth";
import { buildDocumentContext } from "@/lib/documents/context-builder";
import { buildTableContext } from "@/lib/tables/context-builder";
import {
  buildTaskOutputInstructions,
  prepareTaskOutputDirectory,
  scanTaskOutputDocuments,
} from "@/lib/documents/output-scanner";
import { getProfile } from "./profiles/registry";
import { resolveProfileRuntimePayload, type ResolvedProfileRuntimePayload } from "./profiles/compatibility";
import type { CanUseToolPolicy } from "./profiles/types";
import { buildClaudeSdkEnv } from "./runtime/claude-sdk";
import { getActiveLearnedContext } from "./learned-context";
import { getLaunchCwd, getWorkspaceContext } from "@/lib/environment/workspace-context";
import { analyzeForLearnedPatterns } from "./pattern-extractor";
import { processSweepResult } from "./sweep";
import { getBrowserMcpServers, getExternalMcpServers } from "./browser-mcp";
import { createToolServer } from "@/lib/chat/stagent-tools";
import { persistScreenshot, SCREENSHOT_TOOL_NAMES } from "@/lib/screenshots/persist";
import {
  extractUsageSnapshot,
  mergeUsageSnapshot,
  recordUsageLedgerEntry,
  resolveUsageActivityType,
  type UsageActivityType,
  type UsageSnapshot,
} from "@/lib/usage/ledger";
import {
  handleToolPermission,
  clearPermissionCache,
} from "./tool-permissions";

/**
 * Classify an error into a machine-readable failure reason string.
 * Used by writeTerminalFailureReason and handleExecutionError.
 */
function classifyError(error: unknown): string {
  if (!(error instanceof Error)) return "sdk_error";
  if (error.name === "AbortError" || error.message.includes("aborted")) {
    return "aborted";
  }
  const lower = error.message.toLowerCase();
  if (
    lower.includes("turn") &&
    (lower.includes("limit") || lower.includes("exhausted") || lower.includes("max"))
  ) {
    return "turn_limit_exceeded";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) return "timeout";
  if (lower.includes("budget")) return "budget_exceeded";
  if (lower.includes("authentication") || lower.includes("oauth")) {
    return "auth_failed";
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "rate_limited";
  }
  return "sdk_error";
}

/**
 * Write an explicit failure_reason to tasks at terminal-state transitions.
 * Called from handleExecutionError and the execute/resume functions on known
 * error classes. Prefer this over reverse-engineering reasons from text via
 * detectFailureReason in scheduler.ts, which is fragile to SDK message changes.
 */
export async function writeTerminalFailureReason(
  taskId: string,
  error: unknown,
): Promise<void> {
  const reason = classifyError(error);
  await db
    .update(tasks)
    .set({ failureReason: reason, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
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

export interface TaskUsageState extends UsageSnapshot {
  activityType: UsageActivityType;
  startedAt: Date;
  taskId: string;
  projectId?: string | null;
  workflowId?: string | null;
  scheduleId?: string | null;
}

export function createTaskUsageState(
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

export async function finalizeTaskUsage(
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
  let turnCount = 0;

  // Screenshot interception state
  const pendingScreenshotTools = new Set<string>();

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
      turnCount++;
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          // Track screenshot tool_use IDs for result interception
          const toolBlock = block as { type: string; id?: string; name?: string; input?: unknown };
          if (typeof toolBlock.name === "string" && SCREENSHOT_TOOL_NAMES.has(toolBlock.name) && typeof toolBlock.id === "string") {
            pendingScreenshotTools.add(toolBlock.id);
          }
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

    // Intercept tool results containing screenshot image data
    if (message.type === "user" && pendingScreenshotTools.size > 0) {
      const userMsg = (raw as Record<string, unknown>).message as Record<string, unknown> | undefined;
      const userContent = userMsg?.content as Array<Record<string, unknown>> | undefined;
      if (userContent) {
        for (const block of userContent) {
          if (block.type === "tool_result" && typeof block.tool_use_id === "string" && pendingScreenshotTools.has(block.tool_use_id)) {
            pendingScreenshotTools.delete(block.tool_use_id);
            const resultContent = block.content as Array<Record<string, unknown>> | undefined;
            if (resultContent) {
              for (const item of resultContent) {
                if (item.type === "image" && typeof item.source === "object" && item.source !== null) {
                  const source = item.source as Record<string, unknown>;
                  if (source.type === "base64" && typeof source.data === "string") {
                    const attachment = await persistScreenshot(source.data, {
                      taskId,
                      toolName: `screenshot_${block.tool_use_id}`,
                    });
                    if (attachment) {
                      await db.insert(agentLogs).values({
                        id: crypto.randomUUID(),
                        taskId,
                        agentType: agentProfileId,
                        event: "screenshot",
                        payload: JSON.stringify({
                          documentId: attachment.documentId,
                          thumbnailUrl: attachment.thumbnailUrl,
                          toolName: `screenshot_${block.tool_use_id}`,
                        }),
                        timestamp: new Date(),
                      });
                    }
                  }
                }
              }
            }
          }
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

      // Fire-and-forget sweep result processing
      if (agentProfileId === "sweep") {
        processSweepResult(taskId).catch((err) => {
          console.error("[sweep] result processing failed:", err);
        });
      }

      await finalizeTaskUsage(usageState, "completed");
    }
  }

  // Safety net: if stream ended without a result frame, fail the task
  // instead of leaving it stuck in "running" forever
  if (!receivedResult) {
    const errorDetail = turnCount > 0
      ? `Agent exhausted its turn limit (${turnCount} turns used) without producing a final result. The task may need fewer sub-queries or a higher maxTurns setting.`
      : "Agent stream ended without producing a result";

    const streamFailureReason = turnCount > 0 ? "turn_limit_exceeded" : "sdk_error";

    await db
      .update(tasks)
      .set({
        status: "failed",
        result: errorDetail,
        failureReason: streamFailureReason,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      taskId,
      type: "task_failed",
      title: `Task failed: ${taskTitle}`,
      body: errorDetail,
      createdAt: new Date(),
    });

    await finalizeTaskUsage(usageState, "failed");
  }
}

// ---------------------------------------------------------------------------
// Shared prompt & query context builder (F12: eliminate duplication)
// ---------------------------------------------------------------------------

export interface TaskQueryContext {
  /** User task content — goes into `prompt` */
  userPrompt: string;
  /** System instructions — goes into `options.systemPrompt` */
  systemInstructions: string;
  /** Resolved working directory */
  cwd: string;
  /** Profile payload (tools, MCP, policy) */
  payload: ResolvedProfileRuntimePayload | null;
  /** Profile's maxTurns or default */
  maxTurns: number;
  /** Profile's canUseToolPolicy */
  canUseToolPolicy?: CanUseToolPolicy;
}

export async function buildTaskQueryContext(
  task: { id: string; title: string; description?: string | null; projectId?: string | null },
  profileId: string
): Promise<TaskQueryContext> {
  const profile = getProfile(profileId);
  const payload = profile
    ? resolveProfileRuntimePayload(profile, "claude-code")
    : null;
  if (payload && !payload.supported) {
    throw new Error(payload.reason ?? `Profile "${profile?.name}" is not supported on Claude Code`);
  }

  const profileInstructions = payload?.instructions ?? "";
  const basePrompt = task.description || task.title;
  const docContext = await buildDocumentContext(task.id);
  const tableContext = await buildTableContext(task.id);
  const outputInstructions = buildTaskOutputInstructions(task.id);
  const learnedCtx = getActiveLearnedContext(profileId);
  const learnedCtxBlock = learnedCtx
    ? `## Learned Context\n<learned-context>\n${learnedCtx}\n</learned-context>`
    : "";

  // Resolve working directory: project's workingDirectory > launch cwd
  let cwd = getLaunchCwd();
  if (task.projectId) {
    const [project] = await db
      .select({ workingDirectory: projects.workingDirectory })
      .from(projects)
      .where(eq(projects.id, task.projectId));
    if (project?.workingDirectory) {
      cwd = project.workingDirectory;
    }
  }

  // Add worktree guidance when running inside a git worktree
  const ws = getWorkspaceContext();
  const worktreeNote = ws.isWorktree
    ? `## Workspace Note\nYou are operating inside a git worktree (branch: ${ws.gitBranch ?? "unknown"}). All file operations MUST use paths relative to the working directory: ${cwd}. Do NOT navigate to or create files in the main repository directory.`
    : "";

  // F1: Separate system instructions from user content
  const systemInstructions = [worktreeNote, profileInstructions, learnedCtxBlock, docContext, tableContext, outputInstructions]
    .filter(Boolean)
    .join("\n\n");

  // F9: Use profile maxTurns or fall back to default
  const maxTurns = profile?.maxTurns ?? DEFAULT_MAX_TURNS;

  return {
    userPrompt: basePrompt,
    systemInstructions,
    cwd,
    payload,
    maxTurns,
    canUseToolPolicy: payload?.canUseToolPolicy,
  };
}

export async function executeClaudeTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);
  const usageState = createTaskUsageState(task);

  const abortController = new AbortController();
  const agentProfileId = task.agentProfile ?? "general";

  setExecution(taskId, {
    abortController,
    sessionId: null,
    taskId,
    startedAt: new Date(),
  });

  try {
    await prepareTaskOutputDirectory(taskId, { clearExisting: true });
    const ctx = await buildTaskQueryContext(task, agentProfileId);

    // Per-schedule override: if the task carries its own maxTurns (set by
    // fireSchedule from schedules.maxTurns), it takes precedence over the
    // profile default. This is the runtime-enforced budget cap.
    const effectiveMaxTurns = task.maxTurns ?? ctx.maxTurns;

    // Merge browser + external MCP servers when enabled globally
    const [browserServers, externalServers] = await Promise.all([
      getBrowserMcpServers(),
      getExternalMcpServers(),
    ]);
    // Inject the in-process stagent MCP server so scheduled and manual tasks
    // have access to mcp__stagent__* tools (table CRUD, notifications, etc.).
    // Spread profile/browser/external first, then stagent — ensures no profile
    // can accidentally shadow our server under the `stagent` key.
    const stagentServer = createToolServer(task.projectId).asMcpServer();
    const profileMcpServers = ctx.payload?.mcpServers ?? {};
    const mergedMcpServers = {
      ...profileMcpServers,
      ...browserServers,
      ...externalServers,
      stagent: stagentServer,
    };

    const authEnv = await getAuthEnv();
    const response = query({
      prompt: ctx.userPrompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd: ctx.cwd,
        env: buildClaudeSdkEnv(authEnv),
        // F1: Use dedicated systemPrompt option with claude_code preset
        systemPrompt: ctx.systemInstructions
          ? { type: "preset" as const, preset: "claude_code" as const, append: ctx.systemInstructions }
          : { type: "preset" as const, preset: "claude_code" as const },
        // F9: Bounded turn limit from profile or default; per-schedule override wins
        maxTurns: effectiveMaxTurns,
        // F4: Per-execution budget cap — use task-specific override if set
        maxBudgetUsd: task.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
        // When the profile set an explicit allowedTools, prepend mcp__stagent__*
        // so the stagent tool registration is not filtered out. When the profile
        // has no allowedTools, fall through to the preset defaults (stagent tools
        // are still reachable because they're registered via mcpServers.stagent).
        ...(ctx.payload?.allowedTools && {
          allowedTools: Array.from(
            new Set(["mcp__stagent__*", ...ctx.payload.allowedTools])
          ),
        }),
        ...(Object.keys(mergedMcpServers).length > 0 && {
          mcpServers: mergedMcpServers,
        }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input, ctx.canUseToolPolicy);
        },
      },
    });

    await processAgentStream(
      taskId,
      task.title,
      response as AsyncIterable<Record<string, unknown>>,
      abortController,
      agentProfileId,
      usageState
    );

    try {
      await analyzeForLearnedPatterns(taskId, agentProfileId);
    } catch (err) {
      console.error("[self-improvement] pattern extraction failed:", err);
    }
  } catch (error: unknown) {
    await handleExecutionError(
      taskId,
      task.title,
      error,
      abortController,
      agentProfileId,
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
    const ctx = await buildTaskQueryContext(task, profileId);

    // Per-schedule override: if the task carries its own maxTurns (set by
    // fireSchedule from schedules.maxTurns), it takes precedence over the
    // profile default. This is the runtime-enforced budget cap.
    const effectiveMaxTurns = task.maxTurns ?? ctx.maxTurns;

    // Merge browser + external MCP servers when enabled globally
    const [browserServers, externalServers] = await Promise.all([
      getBrowserMcpServers(),
      getExternalMcpServers(),
    ]);
    const profileMcpServers = ctx.payload?.mcpServers ?? {};
    const mergedMcpServers = { ...profileMcpServers, ...browserServers, ...externalServers };

    const authEnv = await getAuthEnv();
    const response = query({
      prompt: ctx.userPrompt,
      options: {
        resume: task.sessionId,
        abortController,
        includePartialMessages: true,
        cwd: ctx.cwd,
        env: buildClaudeSdkEnv(authEnv),
        // F1: Use dedicated systemPrompt option with claude_code preset
        systemPrompt: ctx.systemInstructions
          ? { type: "preset" as const, preset: "claude_code" as const, append: ctx.systemInstructions }
          : { type: "preset" as const, preset: "claude_code" as const },
        // F9: Bounded turn limit from profile or default; per-schedule override wins
        maxTurns: effectiveMaxTurns,
        // F4: Per-execution budget cap — use task-specific override if set
        maxBudgetUsd: task.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
        ...(ctx.payload?.allowedTools && { allowedTools: ctx.payload.allowedTools }),
        ...(Object.keys(mergedMcpServers).length > 0 && {
          mcpServers: mergedMcpServers,
        }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input, ctx.canUseToolPolicy);
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

    try {
      await analyzeForLearnedPatterns(taskId, profileId);
    } catch (err) {
      console.error("[self-improvement] pattern extraction failed:", err);
    }
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
          failureReason: "auth_failed",
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

  const failureReason = classifyError(error);

  await db
    .update(tasks)
    .set({
      status: "failed",
      result: errorMessage,
      failureReason,
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

// handleToolPermission and clearPermissionCache imported from ./tool-permissions
