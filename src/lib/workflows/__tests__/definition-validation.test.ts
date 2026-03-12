import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "../types";
import { validateWorkflowDefinition } from "../definition-validation";

function createValidParallelDefinition(): WorkflowDefinition {
  return {
    pattern: "parallel",
    steps: [
      {
        id: "branch-a",
        name: "Market scan",
        prompt: "Research market trends.",
      },
      {
        id: "branch-b",
        name: "Customer scan",
        prompt: "Review customer feedback.",
      },
      {
        id: "join",
        name: "Synthesize",
        prompt: "Combine the findings.",
        dependsOn: ["branch-a", "branch-b"],
      },
    ],
  };
}

describe("validateWorkflowDefinition", () => {
  it("accepts a valid parallel fork/join definition", () => {
    expect(validateWorkflowDefinition(createValidParallelDefinition())).toBeNull();
  });

  it("rejects a parallel definition with too few branches", () => {
    const definition: WorkflowDefinition = {
      pattern: "parallel",
      steps: [
        {
          id: "branch-a",
          name: "Single branch",
          prompt: "Only one branch exists.",
        },
        {
          id: "join",
          name: "Synthesize",
          prompt: "Combine the findings.",
          dependsOn: ["branch-a"],
        },
      ],
    };

    expect(validateWorkflowDefinition(definition)).toBe(
      "Parallel pattern requires at least 2 branch steps"
    );
  });

  it("rejects a synthesis step that does not depend on every branch", () => {
    const definition = createValidParallelDefinition();
    definition.steps[2] = {
      ...definition.steps[2],
      dependsOn: ["branch-a"],
    };

    expect(validateWorkflowDefinition(definition)).toBe(
      "Parallel synthesis step must depend on every branch exactly once"
    );
  });

  it("keeps loop validation intact", () => {
    const definition: WorkflowDefinition = {
      pattern: "loop",
      steps: [{ id: "loop", name: "Loop", prompt: "Keep iterating." }],
    };

    expect(validateWorkflowDefinition(definition)).toBe(
      "Loop pattern requires loopConfig with maxIterations >= 1"
    );
  });
});
