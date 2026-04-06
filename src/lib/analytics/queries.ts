/**
 * Analytics queries — all derived from existing tasks + usage_ledger tables.
 * Zero new data collection needed.
 */

import { db } from "@/lib/db";
import { tasks, usageLedger } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export interface OutcomeCount {
  completed: number;
  failed: number;
  total: number;
  successRate: number;
}

export interface ProfileStats {
  profileId: string;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
  totalCostMicros: number;
  avgDurationMs: number;
}

export interface TrendPoint {
  date: string; // ISO date
  completed: number;
  failed: number;
}

export interface CostTrendPoint {
  date: string;
  avgCostMicros: number;
  taskCount: number;
}

/** Get overall outcome counts for a time period */
export function getOutcomeCounts(sinceDaysAgo: number = 30): OutcomeCount {
  const cutoff = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000);

  const completed = db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(and(eq(tasks.status, "completed"), gte(tasks.updatedAt, cutoff)))
    .get()?.count ?? 0;

  const failed = db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(and(eq(tasks.status, "failed"), gte(tasks.updatedAt, cutoff)))
    .get()?.count ?? 0;

  const total = completed + failed;
  return {
    completed,
    failed,
    total,
    successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/** Get success rate trend over the past N days */
export function getSuccessRateTrend(days: number = 30): TrendPoint[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = db
    .select({
      date: sql<string>`date(${tasks.updatedAt} / 1000, 'unixepoch')`,
      status: tasks.status,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(
      and(
        gte(tasks.updatedAt, cutoff),
        sql`${tasks.status} IN ('completed', 'failed')`
      )
    )
    .groupBy(sql`date(${tasks.updatedAt} / 1000, 'unixepoch')`, tasks.status)
    .all();

  // Aggregate into daily points
  const byDate = new Map<string, { completed: number; failed: number }>();
  for (const row of rows) {
    const entry = byDate.get(row.date) ?? { completed: 0, failed: 0 };
    if (row.status === "completed") entry.completed = row.count;
    if (row.status === "failed") entry.failed = row.count;
    byDate.set(row.date, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Get cost-per-outcome trend over the past N days */
export function getCostPerOutcomeTrend(days: number = 30): CostTrendPoint[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = db
    .select({
      date: sql<string>`date(${usageLedger.startedAt} / 1000, 'unixepoch')`,
      avgCostMicros: sql<number>`avg(${usageLedger.costMicros})`,
      taskCount: sql<number>`count(distinct ${usageLedger.taskId})`,
    })
    .from(usageLedger)
    .where(gte(usageLedger.startedAt, cutoff))
    .groupBy(sql`date(${usageLedger.startedAt} / 1000, 'unixepoch')`)
    .all();

  return rows
    .map((r) => ({
      date: r.date,
      avgCostMicros: Math.round(r.avgCostMicros ?? 0),
      taskCount: r.taskCount ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Get per-profile leaderboard stats */
export function getProfileLeaderboard(sinceDaysAgo: number = 30): ProfileStats[] {
  const cutoff = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000);

  const rows = db
    .select({
      profileId: tasks.agentProfile,
      status: tasks.status,
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(
      and(
        gte(tasks.updatedAt, cutoff),
        sql`${tasks.agentProfile} IS NOT NULL`,
        sql`${tasks.status} IN ('completed', 'failed')`
      )
    )
    .groupBy(tasks.agentProfile, tasks.status)
    .all();

  // Aggregate by profile
  const byProfile = new Map<string, { completed: number; failed: number }>();
  for (const row of rows) {
    const id = row.profileId ?? "unknown";
    const entry = byProfile.get(id) ?? { completed: 0, failed: 0 };
    if (row.status === "completed") entry.completed = row.count;
    if (row.status === "failed") entry.failed = row.count;
    byProfile.set(id, entry);
  }

  // Get cost data per profile
  const costRows = db
    .select({
      profileId: sql<string>`(SELECT agent_profile FROM tasks WHERE tasks.id = ${usageLedger.taskId})`,
      totalCost: sql<number>`sum(${usageLedger.costMicros})`,
      avgDuration: sql<number>`avg((${usageLedger.finishedAt} - ${usageLedger.startedAt}) * 1000)`,
    })
    .from(usageLedger)
    .where(gte(usageLedger.startedAt, cutoff))
    .groupBy(sql`(SELECT agent_profile FROM tasks WHERE tasks.id = ${usageLedger.taskId})`)
    .all();

  const costByProfile = new Map<string, { totalCost: number; avgDuration: number }>();
  for (const row of costRows) {
    if (row.profileId) {
      costByProfile.set(row.profileId, {
        totalCost: row.totalCost ?? 0,
        avgDuration: Math.round(row.avgDuration ?? 0),
      });
    }
  }

  return Array.from(byProfile.entries())
    .map(([profileId, counts]) => {
      const total = counts.completed + counts.failed;
      const costs = costByProfile.get(profileId);
      return {
        profileId,
        ...counts,
        total,
        successRate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
        totalCostMicros: costs?.totalCost ?? 0,
        avgDurationMs: costs?.avgDuration ?? 0,
      };
    })
    .sort((a, b) => b.completed - a.completed);
}

/** Get total estimated hours saved (assuming 15 min avg per manual task) */
export function getEstimatedHoursSaved(sinceDaysAgo: number = 30): number {
  const cutoff = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000);

  const totalDurationMs = db
    .select({
      total: sql<number>`sum((${usageLedger.finishedAt} - ${usageLedger.startedAt}) * 1000)`,
    })
    .from(usageLedger)
    .where(gte(usageLedger.startedAt, cutoff))
    .get()?.total ?? 0;

  // Agent tasks take ~1/10th the time of manual work
  const estimatedManualMs = totalDurationMs * 10;
  const savedMs = estimatedManualMs - totalDurationMs;
  return Math.round((savedMs / (1000 * 60 * 60)) * 10) / 10; // Round to 1 decimal
}
