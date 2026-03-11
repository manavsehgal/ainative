import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateAuthStatus, getAuthEnv } from "@/lib/settings/auth";
import { getExecution, removeExecution } from "@/lib/agents/execution-manager";
import { getProfile } from "@/lib/agents/profiles/registry";
import { executeClaudeTask, resumeClaudeTask } from "@/lib/agents/claude-agent";
import { getRuntimeCapabilities, getRuntimeCatalogEntry } from "./catalog";
import { buildClaudeSdkEnv } from "./claude-sdk";
import type {
  AgentRuntimeAdapter,
  RuntimeConnectionResult,
  TaskAssistInput,
} from "./types";
import type { ProfileTestResult, ProfileTestReport } from "@/lib/agents/profiles/test-types";
import type { TaskAssistResponse } from "./task-assist-types";

const TASK_ASSIST_SYSTEM_PROMPT = `You are an AI task definition assistant. Analyze the given task and return ONLY a JSON object (no markdown, no code fences) with:
- "improvedDescription": A clearer version of the task for an AI agent to execute
- "breakdown": Array of {title, description} sub-tasks if complex (empty array if simple)
- "recommendedPattern": "single", "sequence", "planner-executor", or "checkpoint"
- "complexity": "simple", "moderate", or "complex"
- "needsCheckpoint": true if irreversible actions or needs human review
- "reasoning": Brief explanation`;

async function collectResultText(
  response: AsyncIterable<Record<string, unknown>>
): Promise<string> {
  let resultText = "";

  for await (const raw of response) {
    if (raw.type === "result" && "result" in raw) {
      resultText =
        typeof raw.result === "string"
          ? raw.result
          : JSON.stringify(raw.result);
      break;
    }
  }

  return resultText;
}

async function runSingleProfileTest(
  profileId: string,
  test: { task: string; expectedKeywords: string[] }
): Promise<ProfileTestResult> {
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }

  const systemPrompt = profile.skillMd || profile.systemPrompt || "";
  const prompt = `${systemPrompt}\n\n---\n\nTask: ${test.task}\n\nProvide a brief analysis (2-3 paragraphs max). Include specific terminology relevant to your domain.`;
  const authEnv = await getAuthEnv();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);

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

    return {
      task: test.task,
      expectedKeywords: test.expectedKeywords,
      foundKeywords,
      missingKeywords,
      passed: missingKeywords.length === 0,
    };
  } catch {
    return {
      task: test.task,
      expectedKeywords: test.expectedKeywords,
      foundKeywords: [],
      missingKeywords: test.expectedKeywords,
      passed: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runClaudeProfileTests(profileId: string): Promise<ProfileTestReport> {
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Profile "${profileId}" not found`);
  }

  if (!profile.tests || profile.tests.length === 0) {
    return {
      profileId,
      profileName: profile.name,
      results: [],
      totalPassed: 0,
      totalFailed: 0,
    };
  }

  const results: ProfileTestResult[] = [];
  for (const test of profile.tests) {
    results.push(await runSingleProfileTest(profileId, test));
  }

  return {
    profileId,
    profileName: profile.name,
    results,
    totalPassed: results.filter((result) => result.passed).length,
    totalFailed: results.filter((result) => !result.passed).length,
  };
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
  const prompt = `${TASK_ASSIST_SYSTEM_PROMPT}\n\n${userMessage}`;
  const response = query({
    prompt,
    options: {
      cwd: process.cwd(),
      env: buildClaudeSdkEnv(authEnv),
    },
  });

  const resultText = await collectResultText(
    response as AsyncIterable<Record<string, unknown>>
  );

  if (!resultText) {
    throw new Error("No result from AI");
  }

  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response");
  }

  return JSON.parse(jsonMatch[0]) as TaskAssistResponse;
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
        cwd: process.cwd(),
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
