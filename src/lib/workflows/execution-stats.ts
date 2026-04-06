import { db } from "@/lib/db";
import {
  workflows,
  usageLedger,
  agentLogs,
  workflowExecutionStats,
  workflowDocumentInputs,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { WorkflowDefinition } from "./types";

// ── Stats update ────────────────────────────────────────────────────

/**
 * Update aggregated execution stats after a workflow run completes or fails.
 * Keyed by (pattern, stepCount) bucket — running averages across multiple runs.
 */
export async function updateExecutionStats(workflowId: string): Promise<void> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (!workflow) return;

  const definition: WorkflowDefinition = JSON.parse(workflow.definition);
  const pattern = definition.pattern;
  const stepCount = definition.steps.length;
  const succeeded = workflow.status === "completed";

  // Query usage ledger for this workflow's run
  const usageEntries = await db
    .select()
    .from(usageLedger)
    .where(eq(usageLedger.workflowId, workflowId));

  const totalCostMicros = usageEntries.reduce(
    (sum, entry) => sum + (entry.costMicros ?? 0),
    0
  );
  const totalDurationMs = usageEntries.reduce((sum, entry) => {
    if (entry.startedAt && entry.finishedAt) {
      return sum + (entry.finishedAt.getTime() - entry.startedAt.getTime());
    }
    return sum;
  }, 0);

  const avgCostPerStep = stepCount > 0 ? Math.round(totalCostMicros / stepCount) : 0;
  const avgDurationPerStep = stepCount > 0 ? Math.round(totalDurationMs / stepCount) : 0;

  // Count documents per step
  const docBindings = await db
    .select()
    .from(workflowDocumentInputs)
    .where(eq(workflowDocumentInputs.workflowId, workflowId));
  const avgDocsPerStep = stepCount > 0 ? docBindings.length / stepCount : 0;

  // Collect runtime distribution
  const runtimeCounts: Record<string, number> = {};
  for (const entry of usageEntries) {
    runtimeCounts[entry.runtimeId] = (runtimeCounts[entry.runtimeId] ?? 0) + 1;
  }

  // Classify failure type from agent logs
  let failureType: string | null = null;
  if (!succeeded) {
    const failLogs = await db
      .select()
      .from(agentLogs)
      .where(
        and(
          eq(agentLogs.event, "workflow_failed"),
          sql`${agentLogs.payload} LIKE ${"%" + workflowId + "%"}`
        )
      );

    for (const log of failLogs) {
      const payload = log.payload ?? "";
      if (payload.includes("budget") || payload.includes("Budget")) {
        failureType = "budget_exceeded";
      } else if (payload.includes("timeout") || payload.includes("max turns")) {
        failureType = "timeout";
      } else if (payload.includes("connection") || payload.includes("rate limit")) {
        failureType = "transient";
      } else {
        failureType = "other";
      }
    }
  }

  // Upsert into stats table keyed by (pattern, stepCount)
  const bucketId = `${pattern}:${stepCount}`;
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(workflowExecutionStats)
    .where(eq(workflowExecutionStats.id, bucketId));

  if (existing) {
    const n = existing.sampleCount;
    const newN = n + 1;

    // Running average: newAvg = (oldAvg * n + newValue) / (n + 1)
    const newAvgCost = Math.round(
      ((existing.avgCostPerStepMicros ?? 0) * n + avgCostPerStep) / newN
    );
    const newAvgDuration = Math.round(
      ((existing.avgDurationPerStepMs ?? 0) * n + avgDurationPerStep) / newN
    );
    const newAvgDocs = ((existing.avgDocsPerStep ?? 0) * n + avgDocsPerStep) / newN;
    const newSuccessRate =
      ((existing.successRate ?? 0) * n + (succeeded ? 1 : 0)) / newN;

    // Merge common failures
    const existingFailures: Record<string, number> = existing.commonFailures
      ? JSON.parse(existing.commonFailures)
      : {};
    if (failureType) {
      existingFailures[failureType] = (existingFailures[failureType] ?? 0) + 1;
    }

    // Merge runtime breakdown (convert counts to rates)
    const existingRuntimes: Record<string, number> = existing.runtimeBreakdown
      ? JSON.parse(existing.runtimeBreakdown)
      : {};
    for (const [rtId, count] of Object.entries(runtimeCounts)) {
      existingRuntimes[rtId] = (existingRuntimes[rtId] ?? 0) + count;
    }

    await db
      .update(workflowExecutionStats)
      .set({
        avgCostPerStepMicros: newAvgCost,
        avgDurationPerStepMs: newAvgDuration,
        avgDocsPerStep: Math.round(newAvgDocs * 100) / 100,
        successRate: Math.round(newSuccessRate * 1000) / 1000,
        commonFailures: JSON.stringify(existingFailures),
        runtimeBreakdown: JSON.stringify(existingRuntimes),
        sampleCount: newN,
        lastUpdated: now,
      })
      .where(eq(workflowExecutionStats.id, bucketId));
  } else {
    await db.insert(workflowExecutionStats).values({
      id: bucketId,
      pattern,
      stepCount,
      avgDocsPerStep: Math.round(avgDocsPerStep * 100) / 100,
      avgCostPerStepMicros: avgCostPerStep,
      avgDurationPerStepMs: avgDurationPerStep,
      successRate: succeeded ? 1.0 : 0.0,
      commonFailures: failureType ? JSON.stringify({ [failureType]: 1 }) : "{}",
      runtimeBreakdown: JSON.stringify(runtimeCounts),
      sampleCount: 1,
      lastUpdated: now,
      createdAt: now,
    });
  }
}

// ── Optimization hints ──────────────────────────────────────────────

export interface OptimizationHints {
  budgetRecommendation: number | null;
  docBindingStrategy: "global" | "per-step";
  runtimeRecommendation: string | null;
  patternComparison: { pattern: string; successRate: number } | null;
  similarWorkflowStats: {
    avgCostPerStepMicros: number;
    avgDurationPerStepMs: number;
    successRate: number;
    sampleCount: number;
  } | null;
}

/**
 * Get optimization hints based on historical execution data.
 * Returns sensible defaults when no history exists (cold start).
 */
export async function getWorkflowOptimizationHints(
  pattern: string,
  stepCount: number,
  _docCount: number
): Promise<OptimizationHints> {
  const bucketId = `${pattern}:${stepCount}`;
  const [stats] = await db
    .select()
    .from(workflowExecutionStats)
    .where(eq(workflowExecutionStats.id, bucketId));

  if (!stats || stats.sampleCount === 0) {
    return {
      budgetRecommendation: null,
      docBindingStrategy: "global",
      runtimeRecommendation: null,
      patternComparison: null,
      similarWorkflowStats: null,
    };
  }

  // Budget recommendation: avg + 50% buffer
  const avgCostUsd = (stats.avgCostPerStepMicros ?? 0) / 1_000_000;
  const budgetRecommendation =
    Math.round(avgCostUsd * 1.5 * stepCount * 100) / 100;

  // Doc binding strategy: per-step if avg docs > 3
  const docBindingStrategy =
    (stats.avgDocsPerStep ?? 0) > 3 ? "per-step" : "global";

  // Runtime recommendation: pick highest success rate from breakdown
  let runtimeRecommendation: string | null = null;
  if (stats.runtimeBreakdown) {
    const breakdown: Record<string, number> = JSON.parse(stats.runtimeBreakdown);
    const totalRuns = Object.values(breakdown).reduce((a, b) => a + b, 0);
    if (totalRuns > 0) {
      runtimeRecommendation = Object.entries(breakdown).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0] ?? null;
    }
  }

  // Pattern comparison: check if alternative pattern has better success rate
  let patternComparison: { pattern: string; successRate: number } | null = null;
  const allStats = await db.select().from(workflowExecutionStats);
  for (const altStats of allStats) {
    if (
      altStats.pattern !== pattern &&
      altStats.sampleCount >= 3 &&
      (altStats.successRate ?? 0) > (stats.successRate ?? 0) + 0.2
    ) {
      patternComparison = {
        pattern: altStats.pattern,
        successRate: altStats.successRate ?? 0,
      };
      break;
    }
  }

  return {
    budgetRecommendation: budgetRecommendation > 0 ? budgetRecommendation : null,
    docBindingStrategy,
    runtimeRecommendation,
    patternComparison,
    similarWorkflowStats: {
      avgCostPerStepMicros: stats.avgCostPerStepMicros ?? 0,
      avgDurationPerStepMs: stats.avgDurationPerStepMs ?? 0,
      successRate: stats.successRate ?? 0,
      sampleCount: stats.sampleCount,
    },
  };
}
