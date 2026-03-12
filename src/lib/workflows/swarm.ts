import type { SwarmConfig, WorkflowDefinition, WorkflowStep } from "./types";

export const MIN_SWARM_WORKERS = 2;
export const MAX_SWARM_WORKERS = 5;
export const DEFAULT_SWARM_CONCURRENCY_LIMIT = 2;

export interface SwarmWorkflowStructure {
  mayorStep: WorkflowStep;
  workerSteps: WorkflowStep[];
  refineryStep: WorkflowStep;
  workerConcurrencyLimit: number;
}

export function getSwarmWorkflowStructure(
  definition: WorkflowDefinition
): SwarmWorkflowStructure | null {
  if (definition.pattern !== "swarm" || definition.steps.length < 4) {
    return null;
  }

  const mayorStep = definition.steps[0];
  const refineryStep = definition.steps.at(-1);

  if (!mayorStep || !refineryStep) {
    return null;
  }

  const workerSteps = definition.steps.slice(1, -1);
  if (workerSteps.length < MIN_SWARM_WORKERS) {
    return null;
  }

  return {
    mayorStep,
    workerSteps,
    refineryStep,
    workerConcurrencyLimit: normalizeSwarmConcurrencyLimit(
      definition.swarmConfig,
      workerSteps.length
    ),
  };
}

export function normalizeSwarmConcurrencyLimit(
  swarmConfig: SwarmConfig | undefined,
  workerCount: number
): number {
  const rawLimit =
    swarmConfig?.workerConcurrencyLimit ?? DEFAULT_SWARM_CONCURRENCY_LIMIT;

  return Math.max(1, Math.min(rawLimit, Math.max(workerCount, 1)));
}

export function buildSwarmWorkerPrompt(input: {
  mayorName: string;
  mayorResult: string;
  workerName: string;
  workerPrompt: string;
}): string {
  return [
    "You are one worker in a governed multi-agent swarm.",
    "",
    `${input.mayorName}:`,
    input.mayorResult.trim(),
    "",
    `${input.workerName} assignment:`,
    input.workerPrompt.trim(),
    "",
    "Complete only your assigned slice. Return concrete findings the refinery can merge.",
  ].join("\n");
}

export function buildSwarmRefineryPrompt(input: {
  mayorName: string;
  mayorResult: string;
  workerOutputs: Array<{ stepName: string; result: string }>;
  refineryPrompt: string;
}): string {
  const workerSections = input.workerOutputs.map(
    (worker, index) =>
      `Worker ${index + 1} - ${worker.stepName}:\n${worker.result.trim()}`
  );

  return [
    "You are the refinery for a governed multi-agent swarm.",
    "",
    `${input.mayorName}:`,
    input.mayorResult.trim(),
    "",
    "Worker outputs:",
    workerSections.join("\n\n---\n\n"),
    "",
    "---",
    "",
    input.refineryPrompt.trim(),
  ].join("\n");
}
