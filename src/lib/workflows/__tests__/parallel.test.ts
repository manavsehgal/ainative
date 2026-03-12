import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "../types";
import {
  buildParallelSynthesisPrompt,
  getParallelWorkflowStructure,
} from "../parallel";

describe("getParallelWorkflowStructure", () => {
  it("extracts branch and synthesis steps from a parallel workflow", () => {
    const definition: WorkflowDefinition = {
      pattern: "parallel",
      steps: [
        {
          id: "branch-a",
          name: "Competitor scan",
          prompt: "Research direct competitors.",
        },
        {
          id: "branch-b",
          name: "User interviews",
          prompt: "Review interview transcripts.",
        },
        {
          id: "join",
          name: "Synthesize",
          prompt: "Combine the branch findings into a recommendation.",
          dependsOn: ["branch-a", "branch-b"],
        },
      ],
    };

    const structure = getParallelWorkflowStructure(definition);

    expect(structure?.branchSteps.map((step) => step.id)).toEqual([
      "branch-a",
      "branch-b",
    ]);
    expect(structure?.synthesisStep.id).toBe("join");
  });

  it("returns null when a parallel workflow does not have exactly one synthesis step", () => {
    const definition: WorkflowDefinition = {
      pattern: "parallel",
      steps: [
        { id: "branch-a", name: "A", prompt: "A" },
        { id: "branch-b", name: "B", prompt: "B" },
      ],
    };

    expect(getParallelWorkflowStructure(definition)).toBeNull();
  });
});

describe("buildParallelSynthesisPrompt", () => {
  it("formats labeled branch outputs ahead of the synthesis prompt", () => {
    const prompt = buildParallelSynthesisPrompt({
      branchOutputs: [
        {
          stepName: "Competitor scan",
          result: "Competitors cluster around speed and reliability claims.",
        },
        {
          stepName: "Customer interviews",
          result: "Users mostly complain about setup complexity.",
        },
      ],
      synthesisPrompt: "Write a concise synthesis and recommendation.",
    });

    expect(prompt).toContain("Parallel branch outputs:");
    expect(prompt).toContain("Branch 1 - Competitor scan:");
    expect(prompt).toContain("Branch 2 - Customer interviews:");
    expect(prompt).toContain("Write a concise synthesis and recommendation.");
  });
});
