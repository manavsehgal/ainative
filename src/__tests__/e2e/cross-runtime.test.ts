/**
 * E2E: Cross-runtime comparison.
 *
 * Tests that the same task produces valid results on both Claude Code
 * and Codex runtimes, verifying runtime parity.
 */

import {
  setupE2E,
  teardownE2E,
  testProjectId,
  claudeAvailable,
  codexAvailable,
} from "./setup";
import {
  createTask,
  executeTask,
  pollTaskUntilDone,
  updateTask,
} from "./helpers";

beforeAll(async () => {
  await setupE2E();
});

afterAll(async () => {
  await teardownE2E();
});

describe("Cross-Runtime Comparison", () => {
  const bothAvailable = () => claudeAvailable && codexAvailable;

  it.skipIf(!bothAvailable())(
    "same task produces valid results on both runtimes",
    async () => {
      const taskPrompt =
        "Describe the TypeScript code in src/index.ts. List the exported functions and any bugs.";

      // Create and execute on Claude
      const { data: claudeTask } = await createTask({
        title: "Cross-runtime test (Claude)",
        description: taskPrompt,
        projectId: testProjectId,
        agentProfile: "general",
      });
      await updateTask(claudeTask!.id, { status: "queued" });
      await executeTask(claudeTask!.id);

      // Create and execute on Codex
      const { data: codexTask } = await createTask({
        title: "Cross-runtime test (Codex)",
        description: taskPrompt,
        projectId: testProjectId,
        assignedAgent: "codex",
        agentProfile: "general",
      });
      await updateTask(codexTask!.id, { status: "queued" });
      await executeTask(codexTask!.id);

      // Wait for both
      const [claudeResult, codexResult] = await Promise.all([
        pollTaskUntilDone(claudeTask!.id),
        pollTaskUntilDone(codexTask!.id),
      ]);

      // Both should complete
      expect(claudeResult.status).toBe("completed");
      expect(codexResult.status).toBe("completed");

      // Both should produce non-empty results
      expect(claudeResult.result).toBeTruthy();
      expect(codexResult.result).toBeTruthy();
      expect(claudeResult.result!.length).toBeGreaterThan(50);
      expect(codexResult.result!.length).toBeGreaterThan(50);
    }
  );
});
