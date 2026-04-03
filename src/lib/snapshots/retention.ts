/**
 * Snapshot retention policy — enforces max count and max age limits.
 * Deletes oldest snapshots first when either limit is exceeded.
 */

import { db } from "@/lib/db";
import { snapshots } from "@/lib/db/schema";
import { asc, eq, and, lte } from "drizzle-orm";
import { deleteSnapshot } from "./snapshot-manager";

/**
 * Enforce retention limits. Should be called after every snapshot creation.
 *
 * @param maxCount - Maximum number of snapshots to keep (0 = unlimited)
 * @param maxAgeWeeks - Maximum age in weeks (0 = unlimited)
 * @returns Number of snapshots deleted
 */
export async function enforceRetention(
  maxCount: number,
  maxAgeWeeks: number
): Promise<number> {
  let deleted = 0;

  // 1. Enforce max age — delete snapshots older than N weeks
  if (maxAgeWeeks > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeWeeks * 7);

    const expired = await db
      .select()
      .from(snapshots)
      .where(
        and(
          eq(snapshots.status, "completed"),
          lte(snapshots.createdAt, cutoff)
        )
      )
      .orderBy(asc(snapshots.createdAt));

    for (const row of expired) {
      await deleteSnapshot(row.id);
      deleted++;
    }
  }

  // 2. Enforce max count — delete oldest beyond the limit
  if (maxCount > 0) {
    const all = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.status, "completed"))
      .orderBy(asc(snapshots.createdAt));

    const excess = all.length - maxCount;
    if (excess > 0) {
      for (let i = 0; i < excess; i++) {
        await deleteSnapshot(all[i].id);
        deleted++;
      }
    }
  }

  return deleted;
}
