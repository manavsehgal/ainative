import { licenseManager } from "@/lib/license/manager";
import { createTierLimitNotification } from "@/lib/license/notifications";

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

/**
 * Register a running execution. Checks the parallel workflow limit
 * for the current tier before allowing the execution to proceed.
 *
 * @throws {ParallelLimitError} if the concurrent execution limit is reached
 */
export function setExecution(taskId: string, execution: RunningExecution): void {
  const limit = licenseManager.getLimit("parallelWorkflows");
  const currentCount = executions.size;

  if (Number.isFinite(limit) && currentCount >= limit) {
    const tier = licenseManager.getTier();
    // Fire-and-forget notification
    createTierLimitNotification("parallelWorkflows", currentCount, limit, taskId).catch(() => {});
    throw new ParallelLimitError(currentCount, limit, tier);
  }

  executions.set(taskId, execution);
}

export class ParallelLimitError extends Error {
  public readonly current: number;
  public readonly limit: number;
  public readonly tier: string;

  constructor(current: number, limit: number, tier: string) {
    super(
      `Parallel workflow limit reached (${current}/${limit}) on ${tier} tier. Wait for a running task to complete or upgrade.`
    );
    this.name = "ParallelLimitError";
    this.current = current;
    this.limit = limit;
    this.tier = tier;
  }
}

export function removeExecution(taskId: string): void {
  executions.delete(taskId);
}

export function getAllExecutions(): Map<string, RunningExecution> {
  return executions;
}
