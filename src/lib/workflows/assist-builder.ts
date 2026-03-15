import type { WorkflowDefinition, WorkflowStep, WorkflowPattern } from "./types";
import type { TaskAssistResponse, TaskAssistBreakdownStep } from "@/lib/agents/runtime/task-assist-types";
import { validateWorkflowDefinition } from "./definition-validation";

interface AssistBuilderInput {
  mainTask: {
    title: string;
    description: string;
    agentProfile?: string;
  };
  assistResponse: TaskAssistResponse;
  overrides?: {
    pattern?: WorkflowPattern;
    steps?: Partial<WorkflowStep>[];
    loopConfig?: { maxIterations?: number; timeBudgetMs?: number };
    swarmConfig?: { workerConcurrencyLimit?: number };
  };
}

function stepId(index: number): string {
  return `step_${index + 1}`;
}

function buildStep(
  index: number,
  name: string,
  prompt: string,
  options?: {
    agentProfile?: string;
    requiresApproval?: boolean;
    dependsOn?: string[];
  }
): WorkflowStep {
  return {
    id: stepId(index),
    name,
    prompt,
    agentProfile: options?.agentProfile,
    requiresApproval: options?.requiresApproval,
    dependsOn: options?.dependsOn,
  };
}

function resolveProfile(
  suggestedProfile: string | undefined,
  fallbackProfile: string | undefined
): string | undefined {
  const profile = suggestedProfile ?? fallbackProfile;
  if (!profile || profile === "auto") return undefined;
  return profile;
}

function breakdownToSteps(
  mainTask: AssistBuilderInput["mainTask"],
  breakdown: TaskAssistBreakdownStep[],
  pattern: WorkflowPattern
): WorkflowStep[] {
  const steps: WorkflowStep[] = [];

  // Step 1 is always the main task
  steps.push(
    buildStep(0, mainTask.title, mainTask.description, {
      agentProfile: resolveProfile(undefined, mainTask.agentProfile),
    })
  );

  // Remaining steps from breakdown
  for (let i = 0; i < breakdown.length; i++) {
    const sub = breakdown[i];
    const dependsOn = sub.dependsOn?.map((depIdx) => stepId(depIdx));
    steps.push(
      buildStep(i + 1, sub.title, sub.description, {
        agentProfile: resolveProfile(sub.suggestedProfile, undefined),
        requiresApproval: pattern === "checkpoint" ? sub.requiresApproval : undefined,
        dependsOn,
      })
    );
  }

  return steps;
}

function buildSequenceDefinition(
  mainTask: AssistBuilderInput["mainTask"],
  assist: TaskAssistResponse,
  pattern: "sequence" | "planner-executor" | "checkpoint"
): WorkflowDefinition {
  const steps = breakdownToSteps(mainTask, assist.breakdown, pattern);
  return { pattern, steps };
}

function buildParallelDefinition(
  mainTask: AssistBuilderInput["mainTask"],
  assist: TaskAssistResponse
): WorkflowDefinition {
  const breakdown = assist.breakdown;

  // Steps with no dependsOn are branches; steps with dependsOn are synthesis
  const hasSynthesis = breakdown.some((s) => s.dependsOn && s.dependsOn.length > 0);

  const steps: WorkflowStep[] = [];

  // Main task as first branch
  steps.push(
    buildStep(0, mainTask.title, mainTask.description, {
      agentProfile: resolveProfile(undefined, mainTask.agentProfile),
    })
  );

  // Add breakdown items as branches (no dependsOn) or synthesis (with dependsOn)
  for (let i = 0; i < breakdown.length; i++) {
    const sub = breakdown[i];
    const dependsOn = sub.dependsOn?.map((depIdx) => stepId(depIdx));
    steps.push(
      buildStep(i + 1, sub.title, sub.description, {
        agentProfile: resolveProfile(sub.suggestedProfile, undefined),
        dependsOn,
      })
    );
  }

  // Auto-generate synthesis step if none exists
  if (!hasSynthesis) {
    const branchIds = steps.map((s) => s.id);
    steps.push(
      buildStep(steps.length, "Synthesize results", "Combine and synthesize the results from all parallel branches into a coherent summary.", {
        dependsOn: branchIds,
      })
    );
  }

  return { pattern: "parallel", steps };
}

function buildLoopDefinition(
  mainTask: AssistBuilderInput["mainTask"],
  assist: TaskAssistResponse,
  overrides?: AssistBuilderInput["overrides"]
): WorkflowDefinition {
  const loopConfig = {
    maxIterations: overrides?.loopConfig?.maxIterations
      ?? assist.suggestedLoopConfig?.maxIterations
      ?? 5,
    timeBudgetMs: overrides?.loopConfig?.timeBudgetMs
      ?? assist.suggestedLoopConfig?.timeBudgetMs,
    agentProfile: resolveProfile(undefined, mainTask.agentProfile),
  };

  const steps: WorkflowStep[] = [
    buildStep(0, mainTask.title, mainTask.description, {
      agentProfile: resolveProfile(undefined, mainTask.agentProfile),
    }),
  ];

  return { pattern: "loop", steps, loopConfig };
}

function buildSwarmDefinition(
  mainTask: AssistBuilderInput["mainTask"],
  assist: TaskAssistResponse,
  overrides?: AssistBuilderInput["overrides"]
): WorkflowDefinition {
  const breakdown = assist.breakdown;
  const steps: WorkflowStep[] = [];

  // Step 1 = mayor (main task)
  steps.push(
    buildStep(0, mainTask.title, mainTask.description, {
      agentProfile: resolveProfile(undefined, mainTask.agentProfile),
    })
  );

  // Steps 2..N-1 = workers (from breakdown)
  for (let i = 0; i < breakdown.length; i++) {
    const sub = breakdown[i];
    steps.push(
      buildStep(i + 1, sub.title, sub.description, {
        agentProfile: resolveProfile(sub.suggestedProfile, undefined),
      })
    );
  }

  // Step N = refinery (auto-generated)
  steps.push(
    buildStep(steps.length, "Refine and merge results", "Review all worker outputs, resolve conflicts, and produce a unified final result.", {})
  );

  const swarmConfig = {
    workerConcurrencyLimit: overrides?.swarmConfig?.workerConcurrencyLimit
      ?? assist.suggestedSwarmConfig?.workerConcurrencyLimit
      ?? 2,
  };

  return { pattern: "swarm", steps, swarmConfig };
}

/**
 * Convert an AI Assist response into a validated WorkflowDefinition.
 * Pure function — no side effects.
 */
export function buildWorkflowDefinitionFromAssist(
  input: AssistBuilderInput
): WorkflowDefinition {
  const pattern = input.overrides?.pattern ?? input.assistResponse.recommendedPattern as WorkflowPattern;
  const { mainTask, assistResponse, overrides } = input;

  let definition: WorkflowDefinition;

  switch (pattern) {
    case "sequence":
    case "planner-executor":
    case "checkpoint":
      definition = buildSequenceDefinition(mainTask, assistResponse, pattern);
      break;
    case "parallel":
      definition = buildParallelDefinition(mainTask, assistResponse);
      break;
    case "loop":
      definition = buildLoopDefinition(mainTask, assistResponse, overrides);
      break;
    case "swarm":
      definition = buildSwarmDefinition(mainTask, assistResponse, overrides);
      break;
    default:
      // Fallback to sequence for unknown patterns
      definition = buildSequenceDefinition(mainTask, assistResponse, "sequence");
  }

  // Apply step-level overrides
  if (overrides?.steps) {
    for (let i = 0; i < overrides.steps.length && i < definition.steps.length; i++) {
      const stepOverride = overrides.steps[i];
      if (stepOverride) {
        Object.assign(definition.steps[i], stepOverride);
      }
    }
  }

  // Validate
  const validationError = validateWorkflowDefinition(definition);
  if (validationError) {
    throw new Error(`Invalid workflow definition: ${validationError}`);
  }

  return definition;
}

export type { AssistBuilderInput };
