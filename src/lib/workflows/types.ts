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
  /** Per-step budget override in USD — takes precedence over workflow and global settings */
  budgetUsd?: number;
  /** Per-step runtime override — takes precedence over workflow.runtimeId and global settings */
  runtimeId?: string;
  /**
   * If set, this step is a pure time delay (not a task). Format: Nm|Nh|Nd|Nw
   * (1 minute to 30 days). When the engine reaches a delay step, the workflow
   * is marked paused with resume_at = now + delayDuration. The scheduler tick
   * resumes the workflow when resume_at is reached. Delay steps must NOT have
   * a prompt/profile/runtime. See features/workflow-step-delays.md.
   */
  delayDuration?: string;
  /**
   * Optional declarative side-effect to apply after the step's task completes
   * successfully. Used by bulk row enrichment to write the agent's result back
   * into a user table cell. Discriminated union — `type` selects the variant.
   * See features/bulk-row-enrichment.md.
   */
  postAction?: StepPostAction;
}

/**
 * Declarative post-step side effect. Currently only `update_row` is supported;
 * adding new variants is purely additive (extend the union, add a dispatcher
 * branch). The `tableId` is informational/audit-only — `updateRow` finds the
 * row by `rowId`. The `rowId` field may contain `{{itemVariable.field}}`
 * placeholders that are resolved against the current loop iteration's row.
 */
export type StepPostAction = {
  type: "update_row";
  tableId: string;
  rowId: string;
  column: string;
};

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
  /**
   * Row-driven loop: when set, the loop iterates once per item instead of
   * looping autonomously until completionSignals fire. Each item is bound
   * into the prompt template under the name in `itemVariable` (default
   * "item"). Used by bulk row enrichment workflows. Iteration count is
   * still capped by `maxIterations`. See features/bulk-row-enrichment.md.
   */
  items?: unknown[];
  /** Variable name the current item is bound to (default "item"). */
  itemVariable?: string;
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
  | "waiting_dependencies"
  /** Step is a time delay and the workflow is paused waiting for resume_at. */
  | "delayed";

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
  /** Pre-flight cost estimate — advisory, populated before execution */
  costEstimate?: unknown;
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
