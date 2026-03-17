/**
 * E2E: Parallel workflow execution.
 *
 * Tests that parallel workflows run branches concurrently and
 * synthesis steps wait for all dependencies before executing.
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
} from "./helpers";

beforeAll(async () => {
  await setupE2E();
});

afterAll(async () => {
  await teardownE2E();
});

describe("Parallel Workflow — Claude Code", () => {
  it.skipIf(!claudeAvailable)(
    "runs branches concurrently with synthesis",
    async () => {
      const { ok, data: workflow } = await createWorkflow({
        name: "E2E Parallel Test",
        projectId: testProjectId,
        definition: {
          pattern: "parallel",
          steps: [
            {
              id: "metrics",
              name: "Code Metrics",
              prompt:
                "Count the number of TypeScript files and total lines of code in the project.",
              agentProfile: "general",
            },
            {
              id: "deps",
              name: "Dependency Check",
              prompt:
                "List all dependencies and devDependencies from package.json with their versions.",
              agentProfile: "general",
            },
            {
              id: "synthesize",
              name: "Summary Report",
              prompt:
                "Combine the code metrics and dependency information into a brief project summary.",
              agentProfile: "document-writer",
              dependsOn: ["metrics", "deps"],
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

describe("Parallel Workflow — Codex", () => {
  it.skipIf(!codexAvailable)(
    "runs parallel branches via Codex runtime",
    async () => {
      const { ok, data: workflow } = await createWorkflow({
        name: "E2E Codex Parallel Test",
        projectId: testProjectId,
        definition: {
          pattern: "parallel",
          steps: [
            {
              id: "files",
              name: "List Files",
              prompt: "List all files in the project directory.",
              assignedAgent: "codex",
              agentProfile: "general",
            },
            {
              id: "structure",
              name: "Describe Structure",
              prompt: "Describe the project directory structure and purpose of each file.",
              assignedAgent: "codex",
              agentProfile: "general",
            },
            {
              id: "combine",
              name: "Combined Report",
              prompt:
                "Combine the file list and structure description into a single overview.",
              assignedAgent: "codex",
              agentProfile: "document-writer",
              dependsOn: ["files", "structure"],
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
