import { sqlite } from "@/lib/db";

export interface ClaimResult {
  claimed: boolean;
}

// Module-level prepared statements. These are hot-path primitives called on
// every scheduler tick and drain pass, so we pay the SQL compilation cost once
// at module load rather than on every invocation.
const claimStmt = sqlite.prepare(
  "UPDATE tasks SET status = 'running', slot_claimed_at = ?, lease_expires_at = ?, updated_at = ? WHERE id = ? AND status = 'queued' AND source_type IN ('scheduled', 'heartbeat') AND (SELECT COUNT(*) FROM tasks WHERE status = 'running' AND source_type IN ('scheduled', 'heartbeat')) < ?",
);

const countRunningStmt = sqlite.prepare(
  "SELECT COUNT(*) AS n FROM tasks WHERE status = 'running' AND source_type IN ('scheduled', 'heartbeat')",
);

/**
 * Atomic slot claim: transitions a queued scheduled task to running IFF the
 * global cap of concurrent running scheduled tasks is not exceeded.
 *
 * Must be a single SQL statement — check-then-act would race between the
 * scheduler tick loop and the drain loop that scheduler.ts currently dispatches
 * concurrently. Using a subquery inside the WHERE clause guarantees SQLite
 * serializes the count and update under its write lock, so two concurrent
 * claim attempts cannot both succeed against the same cap.
 *
 * Returns `{ claimed: true }` when the task transitioned; `{ claimed: false }`
 * when either (a) the task is no longer in queued state (already claimed) or
 * (b) the global cap is full.
 *
 * @param cap — must be ≥ 0. Negative values refuse to claim (the SQL COUNT
 *   cannot be less than a negative number) — treat as an input error upstream.
 * @param leaseSec — must be > 0 for the lease to be meaningful. A lease of 0
 *   expires immediately and will be reaped on the next scheduler tick.
 */
export function claimSlot(
  taskId: string,
  cap: number,
  leaseSec: number,
): ClaimResult {
  // Drizzle integer({ mode: "timestamp" }) stores Unix seconds and deserializes
  // to Date(seconds * 1000). Pass seconds here so the round-trip is correct.
  // Use Math.ceil so slotClaimedAt.getTime() >= Date.now() captured just before
  // the call (sub-second precision would cause test assertions to fail with floor).
  const nowSec = Math.ceil(Date.now() / 1000);
  const leaseExpiresSec = nowSec + leaseSec;

  const result = claimStmt.run(nowSec, leaseExpiresSec, nowSec, taskId, cap);
  return { claimed: result.changes === 1 };
}

/**
 * Count currently running scheduled/heartbeat tasks — used by the drain loop,
 * manual-execute endpoint, and telemetry.
 */
export function countRunningScheduledSlots(): number {
  const row = countRunningStmt.get() as { n: number } | undefined;
  return row?.n ?? 0;
}
