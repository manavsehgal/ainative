import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and, lt, isNotNull, inArray } from "drizzle-orm";

/**
 * Nullify sessionId on completed/failed tasks older than retention period.
 * Manual utility — not auto-scheduled.
 */
export function cleanupOldSessions(retentionDays = 7): number {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = db
    .update(tasks)
    .set({ sessionId: null })
    .where(
      and(
        isNotNull(tasks.sessionId),
        inArray(tasks.status, ["completed", "failed"]),
        lt(tasks.updatedAt, cutoff)
      )
    )
    .returning()
    .all();

  return result.length;
}
