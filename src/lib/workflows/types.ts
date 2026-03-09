export interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  requiresApproval?: boolean;
  dependsOn?: string[];
  agentProfile?: string;
}

export interface WorkflowDefinition {
  pattern: "sequence" | "planner-executor" | "checkpoint";
  steps: WorkflowStep[];
}

export interface StepState {
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "waiting_approval";
  taskId?: string;
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowState {
  currentStepIndex: number;
  stepStates: StepState[];
  status: "running" | "completed" | "failed" | "paused";
  startedAt: string;
  completedAt?: string;
}

export function createInitialState(definition: WorkflowDefinition): WorkflowState {
  return {
    currentStepIndex: 0,
    stepStates: definition.steps.map((step) => ({
      stepId: step.id,
      status: "pending",
    })),
    status: "running",
    startedAt: new Date().toISOString(),
  };
}
