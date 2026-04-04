export type WorkflowPattern =
  | "sequence"
  | "planner-executor"
  | "checkpoint"
  | "loop"
  | "parallel"
  | "swarm";

export interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  requiresApproval?: boolean;
  dependsOn?: string[];
  assignedAgent?: string;
  agentProfile?: string;
  /** Document IDs from the project pool to inject as context for this step */
  documentIds?: string[];
}

/** Selector for auto-discovering documents from the project pool */
export interface DocumentSelector {
  fromWorkflowId?: string;
  fromWorkflowName?: string;
  category?: string;
  direction?: "input" | "output";
  mimeType?: string;
  namePattern?: string;
  /** Take only the N most recent matching documents */
  latest?: number;
}

export interface LoopConfig {
  maxIterations: number;
  timeBudgetMs?: number;
  assignedAgent?: string;
  agentProfile?: string;
  completionSignals?: string[];
}

export interface SwarmConfig {
  workerConcurrencyLimit?: number;
}

export interface WorkflowDefinition {
  pattern: WorkflowPattern;
  steps: WorkflowStep[];
  loopConfig?: LoopConfig;
  swarmConfig?: SwarmConfig;
  /** Parent task ID — set when workflow is created from AI assist, used to propagate document context */
  sourceTaskId?: string;
}

export type LoopStopReason =
  | "max_iterations"
  | "time_budget"
  | "agent_signaled"
  | "human_cancel"
  | "human_pause"
  | "error";

export interface IterationState {
  iteration: number;
  taskId: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface LoopState {
  currentIteration: number;
  iterations: IterationState[];
  status: "running" | "completed" | "paused" | "failed";
  stopReason?: LoopStopReason;
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
}

export function createInitialLoopState(): LoopState {
  return {
    currentIteration: 0,
    iterations: [],
    status: "running",
    startedAt: new Date().toISOString(),
  };
}

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "waiting_approval"
  | "waiting_dependencies";

export interface StepState {
  stepId: string;
  status: WorkflowStepStatus;
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
      stepId: step.id ?? crypto.randomUUID(),
      status: "pending",
    })),
    status: "running",
    startedAt: new Date().toISOString(),
  };
}
