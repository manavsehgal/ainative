/**
 * E2E: Blueprint instantiation and execution.
 *
 * Tests that blueprints can be listed, instantiated with variables,
 * and executed as workflows with variable resolution.
 */

import {
  setupE2E,
  teardownE2E,
  testProjectId,
  claudeAvailable,
} from "./setup";
import {
  listBlueprints,
  instantiateBlueprint,
  executeWorkflow,
  pollWorkflowUntilDone,
} from "./helpers";

beforeAll(async () => {
  await setupE2E();
});

afterAll(async () => {
  await teardownE2E();
});

describe("Blueprint — Gallery & Instantiation", () => {
  it("lists available blueprints", async () => {
    const { ok, data } = await listBlueprints();
    expect(ok).toBe(true);
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThan(0);
  });

  it.skipIf(!claudeAvailable)(
    "instantiates and executes documentation-generation blueprint",
    async () => {
      // Instantiate with variables
      const { ok: instOk, data: instData } = await instantiateBlueprint(
        "documentation-generation",
        {
          target: "src/index.ts and src/utils.ts",
          docType: "API Documentation",
        },
        testProjectId
      );
      expect(instOk).toBe(true);

      const workflow = instData?.workflow;
      expect(workflow).toBeTruthy();
      expect(workflow!.status).toBe("draft");

      // Execute the instantiated workflow
      const exec = await executeWorkflow(workflow!.id);
      expect(exec.status).toBe(202);

      const result = await pollWorkflowUntilDone(workflow!.id);
      expect(result.status).toBe("completed");
    }
  );
});
