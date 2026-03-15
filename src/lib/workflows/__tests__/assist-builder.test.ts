import { describe, it, expect } from "vitest";
import { buildWorkflowDefinitionFromAssist } from "../assist-builder";
import type { TaskAssistResponse } from "@/lib/agents/runtime/task-assist-types";

const MAIN_TASK = {
  title: "Build Auth System",
  description: "Implement authentication with OAuth2",
  agentProfile: "general",
};

function makeAssistResponse(
  overrides: Partial<TaskAssistResponse> = {}
): TaskAssistResponse {
  return {
    improvedDescription: "Build a complete auth system",
    breakdown: [
      { title: "Set up middleware", description: "Create auth middleware" },
      { title: "Create endpoints", description: "Build user API endpoints" },
      { title: "Write tests", description: "Integration tests for auth" },
    ],
    recommendedPattern: "sequence",
    complexity: "complex",
    needsCheckpoint: false,
    reasoning: "Multi-step ordered work",
    ...overrides,
  };
}

describe("buildWorkflowDefinitionFromAssist", () => {
  describe("sequence pattern", () => {
    it("creates a sequence workflow with main task as step 1", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse(),
      });

      expect(result.pattern).toBe("sequence");
      expect(result.steps).toHaveLength(4); // main + 3 breakdown
      expect(result.steps[0].name).toBe("Build Auth System");
      expect(result.steps[1].name).toBe("Set up middleware");
      expect(result.steps[3].name).toBe("Write tests");
    });

    it("assigns profiles from main task and suggestions", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({
          breakdown: [
            { title: "Research", description: "Research patterns", suggestedProfile: "researcher" },
            { title: "Code", description: "Write code" },
          ],
        }),
      });

      expect(result.steps[0].agentProfile).toBe("general"); // from mainTask
      expect(result.steps[1].agentProfile).toBe("researcher"); // from suggestion
      expect(result.steps[2].agentProfile).toBeUndefined(); // no suggestion = undefined
    });
  });

  describe("checkpoint pattern", () => {
    it("preserves requiresApproval on steps", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({
          recommendedPattern: "checkpoint",
          breakdown: [
            { title: "Plan", description: "Plan deployment", requiresApproval: true },
            { title: "Deploy", description: "Execute deployment" },
          ],
        }),
      });

      expect(result.pattern).toBe("checkpoint");
      expect(result.steps[1].requiresApproval).toBe(true);
      expect(result.steps[2].requiresApproval).toBeUndefined();
    });
  });

  describe("parallel pattern", () => {
    it("auto-generates synthesis step when none provided", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({
          recommendedPattern: "parallel",
          breakdown: [
            { title: "Branch A", description: "Research area A" },
            { title: "Branch B", description: "Research area B" },
          ],
        }),
      });

      expect(result.pattern).toBe("parallel");
      // main + 2 branches + auto-synthesis = 4
      expect(result.steps).toHaveLength(4);
      expect(result.steps[3].name).toBe("Synthesize results");
      expect(result.steps[3].dependsOn).toEqual(["step_1", "step_2", "step_3"]);
    });

    it("preserves explicit synthesis step with dependsOn", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({
          recommendedPattern: "parallel",
          breakdown: [
            { title: "Branch A", description: "Research A" },
            { title: "Merge", description: "Merge results", dependsOn: [0, 1] },
          ],
        }),
      });

      // main + Branch A + Merge = 3 (no auto-synthesis because dependsOn exists)
      expect(result.steps).toHaveLength(3);
      expect(result.steps[2].dependsOn).toEqual(["step_1", "step_2"]);
    });
  });

  describe("loop pattern", () => {
    it("creates single-step loop with config", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({
          recommendedPattern: "loop",
          suggestedLoopConfig: { maxIterations: 3, timeBudgetMs: 60000 },
        }),
      });

      expect(result.pattern).toBe("loop");
      expect(result.steps).toHaveLength(1);
      expect(result.loopConfig?.maxIterations).toBe(3);
      expect(result.loopConfig?.timeBudgetMs).toBe(60000);
    });

    it("defaults to 5 iterations", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({ recommendedPattern: "loop" }),
      });

      expect(result.loopConfig?.maxIterations).toBe(5);
    });

    it("applies loop config overrides", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({
          recommendedPattern: "loop",
          suggestedLoopConfig: { maxIterations: 3 },
        }),
        overrides: { loopConfig: { maxIterations: 10 } },
      });

      expect(result.loopConfig?.maxIterations).toBe(10);
    });
  });

  describe("swarm pattern", () => {
    it("creates mayor/workers/refinery structure", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({
          recommendedPattern: "swarm",
          breakdown: [
            { title: "Worker 1", description: "Task 1" },
            { title: "Worker 2", description: "Task 2" },
          ],
        }),
      });

      expect(result.pattern).toBe("swarm");
      // mayor + 2 workers + refinery = 4
      expect(result.steps).toHaveLength(4);
      expect(result.steps[0].name).toBe("Build Auth System"); // mayor
      expect(result.steps[3].name).toBe("Refine and merge results"); // refinery
      expect(result.swarmConfig?.workerConcurrencyLimit).toBe(2);
    });

    it("applies swarm config overrides", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({
          recommendedPattern: "swarm",
          breakdown: [
            { title: "W1", description: "T1" },
            { title: "W2", description: "T2" },
          ],
          suggestedSwarmConfig: { workerConcurrencyLimit: 1 },
        }),
        overrides: { swarmConfig: { workerConcurrencyLimit: 2 } },
      });

      expect(result.swarmConfig?.workerConcurrencyLimit).toBe(2);
    });
  });

  describe("pattern override", () => {
    it("overrides AI-recommended pattern", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse({ recommendedPattern: "sequence" }),
        overrides: { pattern: "checkpoint" },
      });

      expect(result.pattern).toBe("checkpoint");
    });
  });

  describe("step overrides", () => {
    it("applies partial step overrides", () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: MAIN_TASK,
        assistResponse: makeAssistResponse(),
        overrides: {
          steps: [
            undefined,
            { agentProfile: "code-reviewer" },
          ] as Partial<import("../types").WorkflowStep>[],
        },
      });

      expect(result.steps[1].agentProfile).toBe("code-reviewer");
    });
  });

  describe("validation", () => {
    it("throws on invalid definition", () => {
      expect(() =>
        buildWorkflowDefinitionFromAssist({
          mainTask: MAIN_TASK,
          assistResponse: makeAssistResponse({
            recommendedPattern: "loop",
            // Missing loopConfig
          }),
          overrides: { loopConfig: { maxIterations: 0 } },
        })
      ).toThrow("Invalid workflow definition");
    });
  });

  describe("auto profile handling", () => {
    it('treats "auto" suggestedProfile as undefined', () => {
      const result = buildWorkflowDefinitionFromAssist({
        mainTask: { ...MAIN_TASK, agentProfile: undefined },
        assistResponse: makeAssistResponse({
          breakdown: [
            { title: "Step", description: "Do thing", suggestedProfile: "auto" },
          ],
        }),
      });

      expect(result.steps[0].agentProfile).toBeUndefined();
      expect(result.steps[1].agentProfile).toBeUndefined();
    });
  });
});
