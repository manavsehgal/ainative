/**
 * Poll-based scheduler engine.
 *
 * Runs on a configurable interval (default 60s), checking for schedules whose
 * `nextFireAt` has passed. For each due schedule it creates a child task and
 * fires it via the existing `executeClaudeTask` pipeline.
 *
 * Lifecycle:
 *   - `startScheduler()` — call once at server boot (idempotent)
 *   - `stopScheduler()`  — call on graceful shutdown
 *   - `tickScheduler()`  — exposed for testing; runs one poll cycle
 */

import { db } from "@/lib/db";
import { schedules, tasks } from "@/lib/db/schema";
import { eq, and, lte, like, inArray } from "drizzle-orm";
import { computeNextFireTime } from "./interval-parser";
import { executeClaudeTask } from "@/lib/agents/claude-agent";

const POLL_INTERVAL_MS = 60_000; // 60 seconds

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the scheduler singleton. Safe to call multiple times — subsequent
 * calls are no-ops if already running.
 */
export function startScheduler(): void {
  if (intervalHandle !== null) return;

  // Bootstrap: recompute nextFireAt for any active schedules that are missing it
  bootstrapNextFireTimes();

  intervalHandle = setInterval(() => {
    tickScheduler().catch((err) => {
      console.error("[scheduler] tick error:", err);
    });
  }, POLL_INTERVAL_MS);

  console.log("[scheduler] started — polling every 60s");
}

/**
 * Stop the scheduler.
 */
export function stopScheduler(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[scheduler] stopped");
  }
}

/**
 * Run one poll cycle: find due schedules and fire them.
 */
export async function tickScheduler(): Promise<void> {
  const now = new Date();

  const dueSchedules = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.status, "active"),
        lte(schedules.nextFireAt, now)
      )
    );

  for (const schedule of dueSchedules) {
    try {
      await fireSchedule(schedule, now);
    } catch (err) {
      console.error(`[scheduler] failed to fire schedule ${schedule.id}:`, err);
    }
  }
}

async function fireSchedule(
  schedule: typeof schedules.$inferSelect,
  now: Date
): Promise<void> {
  // Concurrency guard: skip if a child task from this schedule is still running
  const runningChildren = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        like(tasks.title, `${schedule.name} — firing #%`),
        inArray(tasks.status, ["queued", "running"])
      )
    );
  if (runningChildren.length > 0) {
    console.log(`[scheduler] skipping ${schedule.id} — previous firing still running`);
    return;
  }

  // Check expiry
  if (schedule.expiresAt && schedule.expiresAt <= now) {
    await db
      .update(schedules)
      .set({ status: "expired", updatedAt: now })
      .where(eq(schedules.id, schedule.id));
    return;
  }

  // Check max firings
  if (schedule.maxFirings && schedule.firingCount >= schedule.maxFirings) {
    await db
      .update(schedules)
      .set({ status: "expired", updatedAt: now })
      .where(eq(schedules.id, schedule.id));
    return;
  }

  // Create child task
  const taskId = crypto.randomUUID();
  const firingNumber = schedule.firingCount + 1;

  await db.insert(tasks).values({
    id: taskId,
    projectId: schedule.projectId,
    title: `${schedule.name} — firing #${firingNumber}`,
    description: schedule.prompt,
    status: "queued",
    agentProfile: schedule.agentProfile,
    priority: 2,
    createdAt: now,
    updatedAt: now,
  });

  // Update schedule counters
  const isOneShot = !schedule.recurs;
  const reachedMax =
    schedule.maxFirings !== null && firingNumber >= schedule.maxFirings;

  const nextStatus = isOneShot
    ? "completed"
    : reachedMax
      ? "expired"
      : "active";

  const nextFireAt =
    nextStatus === "active"
      ? computeNextFireTime(schedule.cronExpression, now)
      : null;

  await db
    .update(schedules)
    .set({
      firingCount: firingNumber,
      lastFiredAt: now,
      nextFireAt,
      status: nextStatus,
      updatedAt: now,
    })
    .where(eq(schedules.id, schedule.id));

  // Fire-and-forget task execution
  executeClaudeTask(taskId).catch((err) => {
    console.error(
      `[scheduler] task execution failed for schedule ${schedule.id}, task ${taskId}:`,
      err
    );
  });

  console.log(
    `[scheduler] fired schedule "${schedule.name}" → task ${taskId} (firing #${firingNumber})`
  );
}

/**
 * Recompute nextFireAt for active schedules that have it set to null.
 * Called once at startup to recover from unclean shutdowns.
 */
function bootstrapNextFireTimes(): void {
  const activeSchedules = db
    .select()
    .from(schedules)
    .where(eq(schedules.status, "active"))
    .all();

  const now = new Date();
  for (const schedule of activeSchedules) {
    if (!schedule.nextFireAt) {
      const nextFire = computeNextFireTime(schedule.cronExpression, now);
      db.update(schedules)
        .set({ nextFireAt: nextFire, updatedAt: now })
        .where(eq(schedules.id, schedule.id))
        .run();
    }
  }
}
