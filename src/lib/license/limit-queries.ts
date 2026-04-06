/**
 * Count queries for tier limit enforcement.
 *
 * Each function returns the current count for a specific resource,
 * used with checkLimit() to determine if an operation is allowed.
 */

import { db } from "@/lib/db";
import { agentMemory, learnedContext, schedules } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Count active (non-archived) memories for a profile.
 */
export function getMemoryCount(profileId: string): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(agentMemory)
    .where(
      and(
        eq(agentMemory.profileId, profileId),
        eq(agentMemory.status, "active")
      )
    )
    .get();
  return result?.count ?? 0;
}

/**
 * Count learned context versions for a profile.
 */
export function getContextVersionCount(profileId: string): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(learnedContext)
    .where(eq(learnedContext.profileId, profileId))
    .get();
  return result?.count ?? 0;
}

/**
 * Count active schedules (both scheduled and heartbeat types).
 */
export function getActiveScheduleCount(): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(schedules)
    .where(eq(schedules.status, "active"))
    .get();
  return result?.count ?? 0;
}
