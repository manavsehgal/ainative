import type { WorkflowDefinition, WorkflowStep } from "./types";

export const MIN_PARALLEL_BRANCHES = 2;
export const MAX_PARALLEL_BRANCHES = 5;
export const PARALLEL_BRANCH_CONCURRENCY_LIMIT = 3;

export interface ParallelWorkflowStructure {
  branchSteps: WorkflowStep[];
  synthesisStep: WorkflowStep;
}

export function getParallelWorkflowStructure(
  definition: WorkflowDefinition
): ParallelWorkflowStructure | null {
  if (definition.pattern !== "parallel") {
    return null;
  }

  const branchSteps = definition.steps.filter(
    (step) => !step.dependsOn || step.dependsOn.length === 0
  );
  const synthesisSteps = definition.steps.filter(
    (step) => step.dependsOn && step.dependsOn.length > 0
  );

  if (synthesisSteps.length !== 1) {
    return null;
  }

  return {
    branchSteps,
    synthesisStep: synthesisSteps[0],
  };
}

export function buildParallelSynthesisPrompt(input: {
  branchOutputs: Array<{ stepName: string; result: string }>;
  synthesisPrompt: string;
}): string {
  const sections = input.branchOutputs.map(
    (branch, index) =>
      `Branch ${index + 1} - ${branch.stepName}:\n${branch.result.trim()}`
  );

  return [
    "You are synthesizing the completed results of parallel research branches.",
    "",
    "Parallel branch outputs:",
    sections.join("\n\n---\n\n"),
    "",
    "---",
    "",
    input.synthesisPrompt,
  ].join("\n");
}
