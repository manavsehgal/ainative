import type { WorkflowDefinition } from "./types";
import {
  getParallelWorkflowStructure,
  MAX_PARALLEL_BRANCHES,
  MIN_PARALLEL_BRANCHES,
} from "./parallel";
import {
  getSwarmWorkflowStructure,
  MAX_SWARM_WORKERS,
  MIN_SWARM_WORKERS,
} from "./swarm";

export const VALID_WORKFLOW_PATTERNS = [
  "sequence",
  "planner-executor",
  "checkpoint",
  "loop",
  "parallel",
  "swarm",
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

  if (definition.pattern === "swarm") {
    const structure = getSwarmWorkflowStructure(definition);
    if (!structure) {
      return "Swarm pattern requires a mayor step, 2-5 worker steps, and a refinery step";
    }

    const { workerSteps, workerConcurrencyLimit } = structure;
    if (workerSteps.length < MIN_SWARM_WORKERS) {
      return `Swarm pattern requires at least ${MIN_SWARM_WORKERS} worker steps`;
    }

    if (workerSteps.length > MAX_SWARM_WORKERS) {
      return `Swarm pattern supports at most ${MAX_SWARM_WORKERS} worker steps`;
    }

    if (definition.steps.some((step) => step.requiresApproval)) {
      return "Swarm steps cannot require approval in the first slice";
    }

    if (definition.steps.some((step) => (step.dependsOn?.length ?? 0) > 0)) {
      return "Swarm steps use fixed mayor/worker/refinery ordering and cannot declare dependencies";
    }

    const rawLimit = definition.swarmConfig?.workerConcurrencyLimit;
    if (
      rawLimit !== undefined &&
      (rawLimit < 1 || rawLimit > workerSteps.length || rawLimit !== workerConcurrencyLimit)
    ) {
      return `Swarm worker concurrency limit must be between 1 and ${workerSteps.length}`;
    }

    return null;
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
