import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { expandCronMinutes } from "./interval-parser";

const BUCKET_SIZE_MIN = 5;
const COLLISION_THRESHOLD_TURNS = 3000;

export interface CronCollisionWarning {
  type: "cron_collision";
  overlappingSchedules: string[];
  overlappingMinutes: number[];
  estimatedConcurrentSteps: number;
}

/**
 * Check if a candidate cron collides with existing active schedules in the
 * same project inside a 5-minute bucket, weighted by the sum of their
 * avgTurnsPerFiring. Warns only when combined weight exceeds 3000 steps.
 *
 * Passing an excludeScheduleId skips that schedule (for PATCH/PUT flows where a
 * schedule should not collide with its own prior state).
 *
 * Deterministic — runs against nominal cron expansion, not chat-pressure
 * adjusted times.
 */
export function checkCollision(
  candidateCron: string,
  candidateAvgTurns: number,
  projectId: string | null,
  excludeScheduleId: string | null,
): CronCollisionWarning[] {
  let candidateMinutes: number[];
  try {
    candidateMinutes = expandCronMinutes(candidateCron);
  } catch {
    return [];
  }

  const candidateBuckets = new Set(
    candidateMinutes.map((m) => Math.floor(m / BUCKET_SIZE_MIN)),
  );

  const conditions = [eq(schedules.status, "active")];
  if (projectId !== null) {
    conditions.push(eq(schedules.projectId, projectId));
  }
  if (excludeScheduleId !== null) {
    conditions.push(ne(schedules.id, excludeScheduleId));
  }

  const others = db
    .select({
      id: schedules.id,
      name: schedules.name,
      cronExpression: schedules.cronExpression,
      avgTurnsPerFiring: schedules.avgTurnsPerFiring,
    })
    .from(schedules)
    .where(and(...conditions))
    .all();

  const overlappingNames: string[] = [];
  const overlappingMinutesSet = new Set<number>();
  let totalOtherTurns = 0;

  for (const other of others) {
    let otherMinutes: number[];
    try {
      otherMinutes = expandCronMinutes(other.cronExpression);
    } catch {
      continue;
    }
    const otherBuckets = new Set(
      otherMinutes.map((m) => Math.floor(m / BUCKET_SIZE_MIN)),
    );
    const sharedBuckets = [...otherBuckets].filter((b) =>
      candidateBuckets.has(b),
    );
    if (sharedBuckets.length > 0) {
      overlappingNames.push(other.name);
      totalOtherTurns += other.avgTurnsPerFiring ?? 0;
      for (const b of sharedBuckets) {
        overlappingMinutesSet.add(b * BUCKET_SIZE_MIN);
      }
    }
  }

  const combinedTurns = candidateAvgTurns + totalOtherTurns;
  if (
    overlappingNames.length === 0 ||
    combinedTurns < COLLISION_THRESHOLD_TURNS
  ) {
    return [];
  }

  return [
    {
      type: "cron_collision",
      overlappingSchedules: overlappingNames,
      overlappingMinutes: [...overlappingMinutesSet].sort((a, b) => a - b),
      estimatedConcurrentSteps: combinedTurns,
    },
  ];
}
