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

function createValidSwarmDefinition(): WorkflowDefinition {
  return {
    pattern: "swarm",
    steps: [
      {
        id: "mayor",
        name: "Mayor",
        prompt: "Plan the swarm.",
      },
      {
        id: "worker-a",
        name: "Worker A",
        prompt: "Own the first slice.",
      },
      {
        id: "worker-b",
        name: "Worker B",
        prompt: "Own the second slice.",
      },
      {
        id: "refinery",
        name: "Refinery",
        prompt: "Merge the results.",
      },
    ],
    swarmConfig: {
      workerConcurrencyLimit: 2,
    },
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

  it("accepts a valid swarm definition", () => {
    expect(validateWorkflowDefinition(createValidSwarmDefinition())).toBeNull();
  });

  it("rejects a swarm definition with too few workers", () => {
    const definition: WorkflowDefinition = {
      pattern: "swarm",
      steps: [
        {
          id: "mayor",
          name: "Mayor",
          prompt: "Plan the swarm.",
        },
        {
          id: "worker-a",
          name: "Worker A",
          prompt: "Own the only slice.",
        },
        {
          id: "refinery",
          name: "Refinery",
          prompt: "Merge the results.",
        },
      ],
    };

    expect(validateWorkflowDefinition(definition)).toBe(
      "Swarm pattern requires a mayor step, 2-5 worker steps, and a refinery step"
    );
  });

  it("rejects swarm steps that declare dependencies", () => {
    const definition = createValidSwarmDefinition();
    definition.steps[1] = {
      ...definition.steps[1],
      dependsOn: ["mayor"],
    };

    expect(validateWorkflowDefinition(definition)).toBe(
      "Swarm steps use fixed mayor/worker/refinery ordering and cannot declare dependencies"
    );
  });

  it("rejects a swarm concurrency limit above worker count", () => {
    const definition = createValidSwarmDefinition();
    definition.swarmConfig = {
      workerConcurrencyLimit: 3,
    };

    expect(validateWorkflowDefinition(definition)).toBe(
      "Swarm worker concurrency limit must be between 1 and 2"
    );
  });
});
