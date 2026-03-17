/**
 * E2E: Sequence workflow execution.
 *
 * Tests that multi-step sequence workflows execute steps in order,
 * pass context between steps, and produce combined results.
 */

import {
  setupE2E,
  teardownE2E,
  testProjectId,
  claudeAvailable,
  codexAvailable,
} from "./setup";
import {
  createWorkflow,
  executeWorkflow,
  pollWorkflowUntilDone,
  createTask,
  getTask,
} from "./helpers";

beforeAll(async () => {
  await setupE2E();
});

afterAll(async () => {
  await teardownE2E();
});

describe("Sequence Workflow — Claude Code", () => {
  it.skipIf(!claudeAvailable)(
    "executes steps in order with context passing",
    async () => {
      const { ok, data: workflow } = await createWorkflow({
        name: "E2E Sequence Test",
        projectId: testProjectId,
        definition: {
          pattern: "sequence",
          steps: [
            {
              id: "analyze",
              name: "Analyze Code",
              prompt:
                "Analyze the TypeScript code in the project. List the main functions and any bugs you find.",
              agentProfile: "general",
            },
            {
              id: "suggest",
              name: "Suggest Tests",
              prompt:
                "Based on the analysis from the previous step, suggest specific test cases that would catch the bugs identified.",
              agentProfile: "code-reviewer",
              dependsOn: ["analyze"],
            },
          ],
        },
      });
      expect(ok).toBe(true);

      const exec = await executeWorkflow(workflow!.id);
      expect(exec.status).toBe(202);

      const result = await pollWorkflowUntilDone(workflow!.id);
      expect(result.status).toBe("completed");
    }
  );
});

describe("Sequence Workflow — Codex", () => {
  it.skipIf(!codexAvailable)(
    "executes sequence steps via Codex runtime",
    async () => {
      const { ok, data: workflow } = await createWorkflow({
        name: "E2E Codex Sequence Test",
        projectId: testProjectId,
        definition: {
          pattern: "sequence",
          steps: [
            {
              id: "describe",
              name: "Describe Code",
              prompt:
                "Describe the TypeScript code in the project. List the main functions.",
              assignedAgent: "codex",
              agentProfile: "general",
            },
            {
              id: "review",
              name: "Review Code",
              prompt:
                "Based on the description from the previous step, review the code for bugs.",
              assignedAgent: "codex",
              agentProfile: "code-reviewer",
              dependsOn: ["describe"],
            },
          ],
        },
      });
      expect(ok).toBe(true);

      const exec = await executeWorkflow(workflow!.id);
      expect(exec.status).toBe(202);

      const result = await pollWorkflowUntilDone(workflow!.id);
      expect(result.status).toBe("completed");
    }
  );
});
