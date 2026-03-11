import { getProfile } from "./registry";
import type { AgentProfile } from "./types";

export interface ProfileTestResult {
  task: string;
  expectedKeywords: string[];
  foundKeywords: string[];
  missingKeywords: string[];
  passed: boolean;
}

export interface ProfileTestReport {
  profileId: string;
  profileName: string;
  results: ProfileTestResult[];
  totalPassed: number;
  totalFailed: number;
}

/**
 * Run behavioral smoke tests for a profile.
 *
 * Each profile can define tests in profile.yaml with task descriptions
 * and expected keywords. This runner executes each task through the
 * Agent SDK and validates the response contains expected keywords.
 *
 * Uses a lightweight query approach — imports executeClaudeTask would
 * create circular deps and side effects. Instead we use the SDK directly.
 */
export async function runProfileTests(
  profileId: string
): Promise<ProfileTestReport> {
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
    const result = await runSingleTest(profile, test);
    results.push(result);
  }

  return {
    profileId,
    profileName: profile.name,
    results,
    totalPassed: results.filter((r) => r.passed).length,
    totalFailed: results.filter((r) => !r.passed).length,
  };
}

async function runSingleTest(
  profile: AgentProfile,
  test: { task: string; expectedKeywords: string[] }
): Promise<ProfileTestResult> {
  try {
    // Import SDK and auth directly to avoid circular dependency with claude-agent
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const { getAuthEnv } = await import("@/lib/settings/auth");

    const systemPrompt = profile.skillMd || profile.systemPrompt || "";
    const prompt = `${systemPrompt}\n\n---\n\nTask: ${test.task}\n\nProvide a brief analysis (2-3 paragraphs max). Include specific terminology relevant to your domain.`;

    const authEnv = await getAuthEnv();
    // Build SDK env: strip CLAUDECODE to avoid nesting detection, merge auth env
    const { CLAUDECODE: _, ...cleanEnv } = process.env as Record<string, string>;
    const sdkEnv = { ...cleanEnv, ...authEnv };

    const abortController = new AbortController();

    // Set a 30-second timeout for test execution
    const timeout = setTimeout(() => abortController.abort(), 30_000);

    let responseText = "";
    try {
      const response = query({
        prompt,
        options: {
          abortController,
          includePartialMessages: true,
          env: sdkEnv,
          allowedTools: [], // No tools during smoke tests
        },
      });

      for await (const event of response as AsyncIterable<Record<string, unknown>>) {
        if (event.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            responseText += delta.text;
          }
        } else if (event.type === "result") {
          const resultText = (event as Record<string, unknown>).result;
          if (typeof resultText === "string") {
            responseText = resultText;
          }
        }
      }
    } finally {
      clearTimeout(timeout);
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
  } catch (err) {
    return {
      task: test.task,
      expectedKeywords: test.expectedKeywords,
      foundKeywords: [],
      missingKeywords: test.expectedKeywords,
      passed: false,
    };
  }
}
