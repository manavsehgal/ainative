import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateAuthStatus, getAuthEnv } from "@/lib/settings/auth";
import { getExecution, removeExecution } from "@/lib/agents/execution-manager";
import { getProfile, listProfiles } from "@/lib/agents/profiles/registry";
import { resolveProfileRuntimePayload } from "@/lib/agents/profiles/compatibility";
import { executeClaudeTask, resumeClaudeTask } from "@/lib/agents/claude-agent";
import { getRuntimeCapabilities, getRuntimeCatalogEntry } from "./catalog";
import { buildClaudeSdkEnv } from "./claude-sdk";
import { getLaunchCwd } from "@/lib/environment/workspace-context";
import { getSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";
import type {
  AgentRuntimeAdapter,
  RuntimeConnectionResult,
  TaskAssistInput,
} from "./types";
import type { ProfileTestResult, ProfileTestReport } from "@/lib/agents/profiles/test-types";
import type { TaskAssistResponse } from "./task-assist-types";
import {
  extractUsageSnapshot,
  mergeUsageSnapshot,
  recordUsageLedgerEntry,
  type UsageSnapshot,
} from "@/lib/usage/ledger";

function buildTaskAssistSystemPrompt(profileIds: string[]): string {
  const profileList = profileIds.length > 0
    ? `Available agent profiles: ${profileIds.join(", ")}\nUse "auto" if unsure which profile fits a step.`
    : `No explicit profiles available. Use "auto" for suggestedProfile.`;

  return `You are an AI task definition assistant. Analyze the given task and return ONLY a JSON object (no markdown, no code fences) with:
- "improvedDescription": A clearer version of the task for an AI agent to execute
- "breakdown": Array of step objects if complex (empty array if simple). Each step: {title, description, suggestedProfile?, requiresApproval?, dependsOn?}
  - "suggestedProfile": one of the available profile IDs or "auto"
  - "requiresApproval": true if the step involves irreversible actions needing human review
  - "dependsOn": array of step indices (0-based) this step depends on (for parallel/swarm patterns)
- "recommendedPattern": one of "single", "sequence", "planner-executor", "checkpoint", "parallel", "loop", "swarm"
  - "sequence": steps run one after another in order
  - "planner-executor": first step plans, remaining steps execute the plan
  - "checkpoint": like sequence but certain steps pause for human approval
  - "parallel": independent steps run concurrently, a final synthesis step merges results (use dependsOn to mark the synthesis step)
  - "loop": a single step repeats iteratively until a goal is met (include suggestedLoopConfig)
  - "swarm": first step is the mayor (coordinator), middle steps are workers (run in parallel), last step is the refinery (merges results)
- "complexity": "simple", "moderate", or "complex"
- "needsCheckpoint": true if irreversible actions or needs human review
- "reasoning": Brief explanation of why you chose this pattern
- "suggestedLoopConfig": {maxIterations, timeBudgetMs?} — only for loop pattern
- "suggestedSwarmConfig": {workerConcurrencyLimit?} — only for swarm pattern

${profileList}

Pattern selection guide:
- Use "single" for simple, atomic tasks
- Use "sequence" for ordered multi-step work where each step builds on the previous
- Use "planner-executor" when the task needs analysis before action
- Use "checkpoint" when steps involve deployments, deletions, or other irreversible actions
- Use "parallel" when sub-tasks are independent and can run concurrently (research, analysis)
- Use "loop" for iterative refinement (code review cycles, optimization passes)
- Use "swarm" for complex tasks needing multiple specialized agents coordinated by a lead`;
}

async function collectResultText(
  response: AsyncIterable<Record<string, unknown>>
): Promise<{ resultText: string; usage: UsageSnapshot }> {
  let resultText = "";
  let usage: UsageSnapshot = {};

  for await (const raw of response) {
    usage = mergeUsageSnapshot(usage, extractUsageSnapshot(raw));

    if (raw.type === "content_block_delta") {
      const delta = raw.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        resultText += delta.text;
      }
    } else if (raw.type === "result" && "result" in raw) {
      if (raw.is_error) {
        throw new Error(typeof raw.result === "string" ? raw.result : "Agent SDK returned an error");
      }
      const result = raw.result;
      if (typeof result === "string" && result.length > 0) {
        resultText = result;
      }
      break;
    }
  }

  return { resultText, usage };
}

/** Read the user-configurable SDK timeout (in ms). Falls back to 60s. */
async function getSdkTimeout(): Promise<number> {
  const raw = await getSetting(SETTINGS_KEYS.SDK_TIMEOUT_SECONDS);
  const seconds = raw ? parseInt(raw, 10) : 60;
  return (isNaN(seconds) || seconds < 10 ? 60 : seconds) * 1000;
}

/** Check if an error is an abort/timeout error from the SDK. */
function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  );
}

async function runSingleProfileTest(
  profileId: string,
  test: { task: string; expectedKeywords: string[] }
): Promise<ProfileTestResult> {
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }

  const payload = resolveProfileRuntimePayload(profile, "claude-code");
  if (!payload.supported) {
    throw new Error(payload.reason ?? `Profile "${profile.name}" is not supported on Claude Code`);
  }

  const prompt = `${payload.instructions}\n\n---\n\nTask: ${test.task}\n\nProvide a brief analysis (2-3 paragraphs max). Include specific terminology relevant to your domain.`;
  const authEnv = await getAuthEnv();
  const abortController = new AbortController();
  const sdkTimeoutMs = await getSdkTimeout();
  const timeout = setTimeout(() => abortController.abort(), sdkTimeoutMs);
  const startedAt = new Date();
  let usage: UsageSnapshot = {};
  let ledgerRecorded = false;

  try {
    const response = query({
      prompt,
      options: {
        abortController,
        includePartialMessages: true,
        env: buildClaudeSdkEnv(authEnv),
        allowedTools: [],
      },
    });

    let responseText = "";
    for await (const event of response as AsyncIterable<Record<string, unknown>>) {
      usage = mergeUsageSnapshot(usage, extractUsageSnapshot(event));
      if (event.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          responseText += delta.text;
        }
      } else if (event.type === "result") {
        const resultText = event.result;
        if (typeof resultText === "string") {
          responseText = resultText;
        }
      }
    }

    const lowerResponse = responseText.toLowerCase();
    const foundKeywords = test.expectedKeywords.filter((kw) =>
      lowerResponse.includes(kw.toLowerCase())
    );
    const missingKeywords = test.expectedKeywords.filter(
      (kw) => !lowerResponse.includes(kw.toLowerCase())
    );

    await recordUsageLedgerEntry({
      activityType: "profile_test",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: usage.modelId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      status: "completed",
      startedAt,
      finishedAt: new Date(),
    });
    ledgerRecorded = true;

    return {
      task: test.task,
      expectedKeywords: test.expectedKeywords,
      foundKeywords,
      missingKeywords,
      passed: missingKeywords.length === 0,
    };
  } catch {
    await recordUsageLedgerEntry({
      activityType: "profile_test",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: usage.modelId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      status: "failed",
      startedAt,
      finishedAt: new Date(),
    });
    ledgerRecorded = true;
    return {
      task: test.task,
      expectedKeywords: test.expectedKeywords,
      foundKeywords: [],
      missingKeywords: test.expectedKeywords,
      passed: false,
    };
  } finally {
    if (!ledgerRecorded && (abortController.signal.aborted || usage.modelId || usage.totalTokens != null)) {
      await recordUsageLedgerEntry({
        activityType: "profile_test",
        runtimeId: "claude-code",
        providerId: "anthropic",
        modelId: usage.modelId ?? null,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        totalTokens: usage.totalTokens ?? null,
        status: "failed",
        startedAt,
        finishedAt: new Date(),
      }).catch(() => {});
    }
    clearTimeout(timeout);
  }
}

async function runClaudeProfileTests(profileId: string): Promise<ProfileTestReport> {
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }

  const payload = resolveProfileRuntimePayload(profile, "claude-code");
  if (!payload.supported) {
    return {
      profileId,
      profileName: profile.name,
      runtimeId: "claude-code",
      results: [],
      totalPassed: 0,
      totalFailed: 0,
      unsupported: true,
      unsupportedReason: payload.reason,
    };
  }

  if (!payload.tests || payload.tests.length === 0) {
    return {
      profileId,
      profileName: profile.name,
      runtimeId: "claude-code",
      results: [],
      totalPassed: 0,
      totalFailed: 0,
    };
  }

  const results: ProfileTestResult[] = [];
  for (const test of payload.tests) {
    results.push(await runSingleProfileTest(profileId, test));
  }

  return {
    profileId,
    profileName: profile.name,
    runtimeId: "claude-code",
    results,
    totalPassed: results.filter((result) => result.passed).length,
    totalFailed: results.filter((result) => !result.passed).length,
  };
}

// ---------------------------------------------------------------------------
// Lightweight meta-completion (pattern extraction, context summarization, etc.)
// ---------------------------------------------------------------------------

export async function runMetaCompletion(input: {
  prompt: string;
  activityType: string;
}): Promise<{ text: string; usage: UsageSnapshot }> {
  const authEnv = await getAuthEnv();
  const startedAt = new Date();
  let usage: UsageSnapshot = {};
  const abortController = new AbortController();
  const sdkTimeoutMs = await getSdkTimeout();
  const timeout = setTimeout(() => abortController.abort(), sdkTimeoutMs);

  try {
    const response = query({
      prompt: input.prompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd: getLaunchCwd(),
        env: buildClaudeSdkEnv(authEnv),
        allowedTools: [],
        maxTurns: 1,
      },
    });

    const collected = await collectResultText(
      response as AsyncIterable<Record<string, unknown>>
    );
    usage = collected.usage;

    await recordUsageLedgerEntry({
      activityType: input.activityType as import("@/lib/usage/ledger").UsageActivityType,
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: usage.modelId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      status: "completed",
      startedAt,
      finishedAt: new Date(),
    });

    return { text: collected.resultText, usage };
  } catch (error) {
    await recordUsageLedgerEntry({
      activityType: input.activityType as import("@/lib/usage/ledger").UsageActivityType,
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: usage.modelId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      status: "failed",
      startedAt,
      finishedAt: new Date(),
    });
    if (isAbortError(error)) {
      throw new Error("Request timed out. You can increase the timeout in Settings → Runtime.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runClaudeTaskAssist(
  input: TaskAssistInput
): Promise<TaskAssistResponse> {
  const userMessage = [
    input.title ? `Task title: ${input.title}` : "",
    input.description ? `Description: ${input.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const authEnv = await getAuthEnv();
  const profileIds = listProfiles().map((p) => p.id);
  const systemPrompt = buildTaskAssistSystemPrompt(profileIds);
  const prompt = `${systemPrompt}\n\n${userMessage}`;
  const startedAt = new Date();
  let usage: UsageSnapshot = {};

  const abortController = new AbortController();
  const sdkTimeoutMs = await getSdkTimeout();
  const timeout = setTimeout(() => abortController.abort(), sdkTimeoutMs);

  try {
    const response = query({
      prompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd: getLaunchCwd(),
        env: buildClaudeSdkEnv(authEnv),
        allowedTools: [],   // No tool use — pure text completion
        maxTurns: 1,        // Single turn only — no agentic loop
      },
    });

    const collected = await collectResultText(
      response as AsyncIterable<Record<string, unknown>>
    );
    usage = collected.usage;

    if (!collected.resultText) {
      throw new Error("No result from AI");
    }

    const jsonMatch = collected.resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as TaskAssistResponse;

    await recordUsageLedgerEntry({
      activityType: "task_assist",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: usage.modelId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      status: "completed",
      startedAt,
      finishedAt: new Date(),
    });

    return parsed;
  } catch (error) {
    await recordUsageLedgerEntry({
      activityType: "task_assist",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: usage.modelId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      status: "failed",
      startedAt,
      finishedAt: new Date(),
    });
    if (isAbortError(error)) {
      throw new Error("Request timed out. You can increase the timeout in Settings → Runtime.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function testClaudeConnection(): Promise<RuntimeConnectionResult> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);

  try {
    const authEnv = await getAuthEnv();
    const response = query({
      prompt: "Reply with exactly: OK",
      options: {
        abortController,
        maxTurns: 1,
        includePartialMessages: false,
        cwd: getLaunchCwd(),
        env: buildClaudeSdkEnv(authEnv),
      },
    });

    for await (const raw of response as AsyncIterable<Record<string, unknown>>) {
      const message = raw as {
        type?: string;
        subtype?: string;
        api_key_source?: string;
      };

      if (message.type === "system" && message.subtype === "init") {
        const source = (message.api_key_source ?? "unknown") as RuntimeConnectionResult["apiKeySource"];
        await updateAuthStatus(source ?? "unknown");
        abortController.abort();
        return { connected: true, apiKeySource: source ?? "unknown" };
      }
    }

    return { connected: true, apiKeySource: "unknown" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (abortController.signal.aborted && !message.includes("auth")) {
      return { connected: true, apiKeySource: "unknown" };
    }

    return { connected: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function cancelClaudeTask(taskId: string): Promise<void> {
  const execution = getExecution(taskId);
  if (execution) {
    execution.abortController.abort();
    removeExecution(taskId);
  }

  await db
    .update(tasks)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

export const claudeRuntimeAdapter: AgentRuntimeAdapter = {
  metadata: {
    ...getRuntimeCatalogEntry("claude-code"),
    capabilities: getRuntimeCapabilities("claude-code"),
  },
  executeTask(taskId: string) {
    return executeClaudeTask(taskId);
  },
  resumeTask(taskId: string) {
    return resumeClaudeTask(taskId);
  },
  cancelTask(taskId: string) {
    return cancelClaudeTask(taskId);
  },
  runTaskAssist(input: TaskAssistInput) {
    return runClaudeTaskAssist(input);
  },
  runProfileTests(profileId: string) {
    return runClaudeProfileTests(profileId);
  },
  testConnection() {
    return testClaudeConnection();
  },
};
