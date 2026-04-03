/**
 * Auto-backup timer — creates snapshots on a user-configurable interval.
 *
 * Lifecycle:
 *   - `startAutoBackup()` — call once at server boot (idempotent)
 *   - `stopAutoBackup()`  — call on graceful shutdown
 *   - `tickAutoBackup()`  — exposed for testing; runs one check cycle
 *
 * Each tick reads settings to check if auto-backup is enabled and whether
 * enough time has elapsed since the last snapshot. This allows users to
 * change settings without restarting the server.
 */

import { db } from "@/lib/db";
import { snapshots } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getSettingSync } from "@/lib/settings/helpers";
import { parseInterval } from "@/lib/schedules/interval-parser";
import { computeNextFireTime } from "@/lib/schedules/interval-parser";
import { createSnapshot, isSnapshotLocked } from "./snapshot-manager";
import { enforceRetention } from "./retention";

// Check every 60 seconds whether an auto-backup is due
const POLL_INTERVAL_MS = 60_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

// Settings keys
const SETTINGS = {
  enabled: "snapshot.autoBackup.enabled",
  interval: "snapshot.autoBackup.interval",
  maxCount: "snapshot.retention.maxCount",
  maxAgeWeeks: "snapshot.retention.maxAgeWeeks",
} as const;

/**
 * Start the auto-backup timer. Safe to call multiple times.
 */
export function startAutoBackup(): void {
  if (intervalHandle !== null) return;

  console.log("[auto-backup] Starting auto-backup timer (60s poll)");
  intervalHandle = setInterval(() => {
    tickAutoBackup().catch((err) => {
      console.error("[auto-backup] Tick error:", err);
    });
  }, POLL_INTERVAL_MS);

  // Run first check shortly after startup
  setTimeout(() => {
    tickAutoBackup().catch((err) => {
      console.error("[auto-backup] Initial tick error:", err);
    });
  }, 5_000);
}

/**
 * Stop the auto-backup timer.
 */
export function stopAutoBackup(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[auto-backup] Stopped auto-backup timer");
  }
}

/**
 * Run one auto-backup check cycle. Exposed for testing.
 */
export async function tickAutoBackup(): Promise<void> {
  // 1. Check if enabled
  const enabled = getSettingSync(SETTINGS.enabled);
  if (enabled !== "true") return;

  // 2. Skip if a snapshot operation is in progress
  if (isSnapshotLocked()) return;

  // 3. Get the configured interval
  const intervalStr = getSettingSync(SETTINGS.interval) || "1d";
  let cronExpr: string;
  try {
    cronExpr = parseInterval(intervalStr);
  } catch {
    console.warn(`[auto-backup] Invalid interval "${intervalStr}", skipping`);
    return;
  }

  // 4. Check if enough time has passed since last auto-backup
  const [lastAutoSnapshot] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.type, "auto"))
    .orderBy(desc(snapshots.createdAt))
    .limit(1);

  if (lastAutoSnapshot) {
    const lastTime = lastAutoSnapshot.createdAt;
    const nextFire = computeNextFireTime(cronExpr, lastTime);
    if (nextFire && nextFire > new Date()) {
      // Not due yet
      return;
    }
  }

  // 5. Create auto-backup snapshot
  console.log("[auto-backup] Creating auto-backup snapshot...");
  try {
    const now = new Date();
    const label = `Auto-backup ${now.toISOString().slice(0, 16).replace("T", " ")}`;
    await createSnapshot(label, "auto");
    console.log("[auto-backup] Auto-backup snapshot created successfully");
  } catch (err) {
    console.error("[auto-backup] Failed to create snapshot:", err);
    return;
  }

  // 6. Enforce retention after snapshot creation
  try {
    const maxCount = parseInt(getSettingSync(SETTINGS.maxCount) || "10", 10);
    const maxAgeWeeks = parseInt(
      getSettingSync(SETTINGS.maxAgeWeeks) || "4",
      10
    );
    const deleted = await enforceRetention(maxCount, maxAgeWeeks);
    if (deleted > 0) {
      console.log(`[auto-backup] Retention enforced: deleted ${deleted} old snapshot(s)`);
    }
  } catch (err) {
    console.error("[auto-backup] Retention enforcement failed:", err);
  }
}
