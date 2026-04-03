/**
 * Row version history — snapshots previous state before mutations.
 */

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { userTableRowHistory, userTableRows } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Snapshot a row's current data before updating it.
 * Called from row mutation code paths.
 */
export function snapshotBeforeUpdate(
  rowId: string,
  tableId: string,
  previousData: string,
  changedBy: string = "user"
): void {
  db.insert(userTableRowHistory)
    .values({
      id: randomUUID(),
      rowId,
      tableId,
      previousData,
      changedBy,
      changeType: "update",
      createdAt: new Date(),
    })
    .run();
}

/**
 * Snapshot a row's data before deleting it.
 */
export function snapshotBeforeDelete(
  rowId: string,
  tableId: string,
  previousData: string,
  changedBy: string = "user"
): void {
  db.insert(userTableRowHistory)
    .values({
      id: randomUUID(),
      rowId,
      tableId,
      previousData,
      changedBy,
      changeType: "delete",
      createdAt: new Date(),
    })
    .run();
}

/**
 * Get version history for a specific row.
 */
export function getRowHistory(rowId: string, limit: number = 50) {
  return db
    .select()
    .from(userTableRowHistory)
    .where(eq(userTableRowHistory.rowId, rowId))
    .orderBy(desc(userTableRowHistory.createdAt))
    .limit(limit)
    .all();
}

/**
 * Get recent history for an entire table.
 */
export function getTableHistory(tableId: string, limit: number = 100) {
  return db
    .select()
    .from(userTableRowHistory)
    .where(eq(userTableRowHistory.tableId, tableId))
    .orderBy(desc(userTableRowHistory.createdAt))
    .limit(limit)
    .all();
}

/**
 * Rollback a row to a previous version.
 * Restores the previousData from a history entry.
 */
export function rollbackRow(historyEntryId: string): boolean {
  const entry = db
    .select()
    .from(userTableRowHistory)
    .where(eq(userTableRowHistory.id, historyEntryId))
    .get();

  if (!entry) return false;

  // Snapshot current state before rollback
  const currentRow = db
    .select()
    .from(userTableRows)
    .where(eq(userTableRows.id, entry.rowId))
    .get();

  if (currentRow) {
    snapshotBeforeUpdate(entry.rowId, entry.tableId, currentRow.data, "rollback");
  }

  // Restore the previous data
  db.update(userTableRows)
    .set({
      data: entry.previousData,
      updatedAt: new Date(),
    })
    .where(eq(userTableRows.id, entry.rowId))
    .run();

  return true;
}
