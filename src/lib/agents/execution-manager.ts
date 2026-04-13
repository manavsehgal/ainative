interface RunningExecution {
  abortController: AbortController;
  sessionId: string | null;
  taskId: string;
  startedAt: Date;
  interrupt?: () => Promise<void>;
  cleanup?: () => Promise<void>;
  metadata?: Record<string, unknown>;
}

const executions = new Map<string, RunningExecution>();

export function getExecution(taskId: string): RunningExecution | undefined {
  return executions.get(taskId);
}

export function setExecution(taskId: string, execution: RunningExecution): void {
  executions.set(taskId, execution);
}

export function removeExecution(taskId: string): void {
  executions.delete(taskId);
}

export function getAllExecutions(): Map<string, RunningExecution> {
  return executions;
}
