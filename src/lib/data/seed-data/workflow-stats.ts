export interface WorkflowExecutionStatsSeed {
  id: string;
  pattern: string;
  stepCount: number;
  avgDocsPerStep: number | null;
  avgCostPerStepMicros: number | null;
  avgDurationPerStepMs: number | null;
  successRate: number | null;
  commonFailures: string | null; // JSON
  runtimeBreakdown: string | null; // JSON
  sampleCount: number;
  lastUpdated: string;
  createdAt: string;
}

export interface ScheduleFiringMetricSeed {
  id: string;
  scheduleId: string;
  taskId: string | null;
  firedAt: Date;
  slotClaimedAt: Date | null;
  completedAt: Date | null;
  slotWaitMs: number | null;
  durationMs: number | null;
  turnCount: number | null;
  maxTurnsAtFiring: number | null;
  eventLoopLagMs: number | null;
  peakRssMb: number | null;
  chatStreamsActive: number | null;
  concurrentSchedules: number | null;
  failureReason: string | null;
}

/**
 * Seed workflow execution rollups and per-firing schedule metrics.
 * Feeds the Analytics page (pattern comparison, cost/duration per step,
 * heartbeat suppression rate, firing latency, turn budget breaches).
 */
export function createWorkflowStats(): WorkflowExecutionStatsSeed[] {
  const now = new Date().toISOString();

  // Keyed by `${pattern}:${stepCount}` — same bucketing the engine uses.
  return [
    {
      id: "sequence:5",
      pattern: "sequence",
      stepCount: 5,
      avgDocsPerStep: 1.4,
      avgCostPerStepMicros: 18_400, // $0.0184 per step
      avgDurationPerStepMs: 24_500,
      successRate: 0.92,
      commonFailures: JSON.stringify({ timeout: 1, transient: 1 }),
      runtimeBreakdown: JSON.stringify({
        "claude-agent-sdk": 18,
        "codex-app-server": 4,
        "openai-direct": 2,
      }),
      sampleCount: 24,
      lastUpdated: now,
      createdAt: new Date(Date.now() - 28 * 86_400_000).toISOString(),
    },
    {
      id: "checkpoint:4",
      pattern: "checkpoint",
      stepCount: 4,
      avgDocsPerStep: 2.1,
      avgCostPerStepMicros: 26_800,
      avgDurationPerStepMs: 31_200,
      successRate: 0.88,
      commonFailures: JSON.stringify({ budget_exceeded: 2, timeout: 1 }),
      runtimeBreakdown: JSON.stringify({
        "claude-agent-sdk": 15,
        "codex-app-server": 2,
      }),
      sampleCount: 17,
      lastUpdated: now,
      createdAt: new Date(Date.now() - 22 * 86_400_000).toISOString(),
    },
    {
      id: "parallel:3",
      pattern: "parallel",
      stepCount: 3,
      avgDocsPerStep: 1.0,
      avgCostPerStepMicros: 14_200,
      avgDurationPerStepMs: 18_400,
      successRate: 0.81,
      commonFailures: JSON.stringify({
        transient: 3,
        budget_exceeded: 2,
        other: 1,
      }),
      runtimeBreakdown: JSON.stringify({
        "claude-agent-sdk": 10,
        "openai-direct": 5,
        "anthropic-direct": 1,
      }),
      sampleCount: 16,
      lastUpdated: now,
      createdAt: new Date(Date.now() - 19 * 86_400_000).toISOString(),
    },
    {
      id: "planner-executor:6",
      pattern: "planner-executor",
      stepCount: 6,
      avgDocsPerStep: 2.8,
      avgCostPerStepMicros: 32_100,
      avgDurationPerStepMs: 38_700,
      successRate: 0.94,
      commonFailures: JSON.stringify({ timeout: 1 }),
      runtimeBreakdown: JSON.stringify({
        "claude-agent-sdk": 22,
        "codex-app-server": 3,
      }),
      sampleCount: 25,
      lastUpdated: now,
      createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    },
    {
      id: "swarm:4",
      pattern: "swarm",
      stepCount: 4,
      avgDocsPerStep: 1.8,
      avgCostPerStepMicros: 41_200,
      avgDurationPerStepMs: 52_400,
      successRate: 0.72,
      commonFailures: JSON.stringify({
        budget_exceeded: 4,
        timeout: 2,
        transient: 1,
      }),
      runtimeBreakdown: JSON.stringify({
        "claude-agent-sdk": 9,
        "openai-direct": 4,
      }),
      sampleCount: 13,
      lastUpdated: now,
      createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    },
  ];
}

/**
 * Seed per-firing metrics for a handful of seed schedules.
 * Includes fast firings, slot contention, turn budget breaches, and one
 * timeout failure — full variety for the analytics drilldowns.
 */
export function createScheduleFiringMetrics(
  scheduleIds: string[],
  completedTaskIds: string[]
): ScheduleFiringMetricSeed[] {
  if (scheduleIds.length === 0) return [];
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;

  const pickTask = (idx: number) =>
    completedTaskIds.length > 0
      ? completedTaskIds[idx % completedTaskIds.length]
      : null;

  const metrics: ScheduleFiringMetricSeed[] = [];

  // Build 4 firings per schedule, most succeed, a few edge cases
  for (let i = 0; i < Math.min(scheduleIds.length, 6); i++) {
    const scheduleId = scheduleIds[i];
    for (let f = 0; f < 4; f++) {
      const firedAt = now - (i + 1) * DAY - f * 6 * HOUR;
      const slotWait = f === 1 && i === 0 ? 8_400 : 120 + f * 80;
      const durationMs = 12_000 + f * 4_500 + (i % 2) * 3_000;
      const turnCount = 4 + f + (i % 3);
      const maxTurns = 12;
      const isTurnBudgetBreach = i === 2 && f === 3;
      const isFailure = i === 1 && f === 2;

      metrics.push({
        id: crypto.randomUUID(),
        scheduleId,
        taskId: pickTask(i * 4 + f),
        firedAt: new Date(firedAt),
        slotClaimedAt: new Date(firedAt + slotWait),
        completedAt: isFailure
          ? null
          : new Date(firedAt + slotWait + durationMs),
        slotWaitMs: slotWait,
        durationMs: isFailure ? null : durationMs,
        turnCount: isTurnBudgetBreach ? maxTurns : turnCount,
        maxTurnsAtFiring: maxTurns,
        eventLoopLagMs: 4 + (f % 3) * 2.5,
        peakRssMb: 412 + i * 12 + f * 4,
        chatStreamsActive: f % 2,
        concurrentSchedules: 1 + (i % 3),
        failureReason: isFailure
          ? "timeout"
          : isTurnBudgetBreach
          ? "turn_limit_exceeded"
          : null,
      });
    }
  }

  return metrics;
}
