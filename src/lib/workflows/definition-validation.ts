import type { WorkflowDefinition } from "./types";
import {
  getParallelWorkflowStructure,
  MAX_PARALLEL_BRANCHES,
  MIN_PARALLEL_BRANCHES,
} from "./parallel";

export const VALID_WORKFLOW_PATTERNS = [
  "sequence",
  "planner-executor",
  "checkpoint",
  "loop",
  "parallel",
] as const;

export function validateWorkflowDefinition(
  definition: WorkflowDefinition
): string | null {
  if (!definition.pattern || !definition.steps?.length) {
    return "Definition must include pattern and at least one step";
  }

  if (!VALID_WORKFLOW_PATTERNS.includes(definition.pattern)) {
    return `Pattern must be one of: ${VALID_WORKFLOW_PATTERNS.join(", ")}`;
  }

  if (definition.pattern === "loop") {
    const loopConfig = definition.loopConfig;
    if (
      !loopConfig ||
      typeof loopConfig.maxIterations !== "number" ||
      loopConfig.maxIterations < 1
    ) {
      return "Loop pattern requires loopConfig with maxIterations >= 1";
    }
  }

  if (definition.pattern !== "parallel") {
    return null;
  }

  const structure = getParallelWorkflowStructure(definition);
  if (!structure) {
    return "Parallel pattern requires branch steps and exactly one synthesis step";
  }

  const { branchSteps, synthesisStep } = structure;
  if (branchSteps.length < MIN_PARALLEL_BRANCHES) {
    return `Parallel pattern requires at least ${MIN_PARALLEL_BRANCHES} branch steps`;
  }

  if (branchSteps.length > MAX_PARALLEL_BRANCHES) {
    return `Parallel pattern supports at most ${MAX_PARALLEL_BRANCHES} branch steps`;
  }

  if (branchSteps.some((step) => step.requiresApproval)) {
    return "Parallel branch steps cannot require approval in the first slice";
  }

  if (synthesisStep.requiresApproval) {
    return "Parallel synthesis steps cannot require approval in the first slice";
  }

  const dependencyIds = synthesisStep.dependsOn ?? [];
  const branchIds = branchSteps.map((step) => step.id);
  const uniqueDependencyIds = Array.from(new Set(dependencyIds));

  if (uniqueDependencyIds.length !== branchIds.length) {
    return "Parallel synthesis step must depend on every branch exactly once";
  }

  if (!branchIds.every((id) => uniqueDependencyIds.includes(id))) {
    return "Parallel synthesis step must depend on every branch exactly once";
  }

  if (uniqueDependencyIds.includes(synthesisStep.id)) {
    return "Parallel synthesis step cannot depend on itself";
  }

  return null;
}
