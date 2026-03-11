import { DEFAULT_AGENT_RUNTIME } from "@/lib/agents/runtime/catalog";
import { runProfileTestsWithRuntime } from "@/lib/agents/runtime";

export type { ProfileTestResult, ProfileTestReport } from "./test-types";

/**
 * Run behavioral smoke tests for a profile through the active runtime layer.
 * Default remains Claude until additional runtimes are wired into the UI.
 */
export async function runProfileTests(profileId: string) {
  return runProfileTestsWithRuntime(profileId, DEFAULT_AGENT_RUNTIME);
}
