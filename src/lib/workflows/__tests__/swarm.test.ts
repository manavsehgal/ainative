import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "../types";
import {
  buildSwarmRefineryPrompt,
  buildSwarmWorkerPrompt,
  getSwarmWorkflowStructure,
} from "../swarm";

function createValidSwarmDefinition(): WorkflowDefinition {
  return {
    pattern: "swarm",
    steps: [
      {
        id: "mayor",
        name: "Mayor plan",
        prompt: "Break the goal into worker assignments.",
      },
      {
        id: "worker-a",
        name: "Worker A",
        prompt: "Handle the customer research slice.",
      },
      {
        id: "worker-b",
        name: "Worker B",
        prompt: "Handle the competitor analysis slice.",
      },
      {
        id: "refinery",
        name: "Refine and merge",
        prompt: "Merge the swarm output into one recommendation.",
      },
    ],
    swarmConfig: {
      workerConcurrencyLimit: 1,
    },
  };
}

describe("getSwarmWorkflowStructure", () => {
  it("extracts mayor, workers, refinery, and concurrency from a swarm workflow", () => {
    const structure = getSwarmWorkflowStructure(createValidSwarmDefinition());

    expect(structure?.mayorStep.id).toBe("mayor");
    expect(structure?.workerSteps.map((step) => step.id)).toEqual([
      "worker-a",
      "worker-b",
    ]);
    expect(structure?.refineryStep.id).toBe("refinery");
    expect(structure?.workerConcurrencyLimit).toBe(1);
  });

  it("returns null when a swarm workflow does not have a mayor, workers, and refinery", () => {
    const definition: WorkflowDefinition = {
      pattern: "swarm",
      steps: [
        { id: "mayor", name: "Mayor", prompt: "Plan" },
        { id: "worker", name: "Worker", prompt: "Do one slice" },
        { id: "refinery", name: "Refinery", prompt: "Merge" },
      ],
    };

    expect(getSwarmWorkflowStructure(definition)).toBeNull();
  });
});

describe("swarm prompt builders", () => {
  it("formats a worker prompt with mayor context", () => {
    const prompt = buildSwarmWorkerPrompt({
      mayorName: "Mayor plan",
      mayorResult: "Worker A handles customers. Worker B handles competitors.",
      workerName: "Worker A",
      workerPrompt: "Analyze customer interviews.",
    });

    expect(prompt).toContain("Mayor plan:");
    expect(prompt).toContain("Worker A assignment:");
    expect(prompt).toContain("Analyze customer interviews.");
  });

  it("formats a refinery prompt with labeled worker outputs", () => {
    const prompt = buildSwarmRefineryPrompt({
      mayorName: "Mayor plan",
      mayorResult: "Split the work across two workers.",
      workerOutputs: [
        { stepName: "Worker A", result: "Customer pain points center on setup." },
        { stepName: "Worker B", result: "Competitors compete on speed." },
      ],
      refineryPrompt: "Produce one final recommendation.",
    });

    expect(prompt).toContain("Worker outputs:");
    expect(prompt).toContain("Worker 1 - Worker A:");
    expect(prompt).toContain("Worker 2 - Worker B:");
    expect(prompt).toContain("Produce one final recommendation.");
  });
});
