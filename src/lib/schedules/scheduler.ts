/**
 * Poll-based scheduler engine.
 *
 * Runs on a configurable interval (default 60s), checking for schedules whose
 * `nextFireAt` has passed. For each due schedule it creates a child task and
 * fires it via the provider runtime pipeline.
 *
 * Lifecycle:
 *   - `startScheduler()` — call once at server boot (idempotent)
 *   - `stopScheduler()`  — call on graceful shutdown
 *   - `tickScheduler()`  — exposed for testing; runs one poll cycle
 */

import { db } from "@/lib/db";
import { schedules, tasks, agentLogs, scheduleDocumentInputs, documents } from "@/lib/db/schema";
import { eq, and, lte, inArray, sql } from "drizzle-orm";
import { computeNextFireTime } from "./interval-parser";
import { executeTaskWithRuntime } from "@/lib/agents/runtime";
import { checkActiveHours } from "./active-hours";
import {
  buildHeartbeatPrompt,
  parseHeartbeatResponse,
  parseChecklist,
} from "./heartbeat-prompt";
import { sendToChannels } from "@/lib/channels/registry";
import type { ChannelMessage } from "@/lib/channels/types";
import { processHandoffs } from "@/lib/agents/handoff/bus";

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
      // Atomic claim: attempt to update nextFireAt to null as a lock.
      // Only the first tick to succeed (.changes > 0) proceeds with firing.
      const claimResult = db
        .update(schedules)
        .set({ nextFireAt: null, updatedAt: now })
        .where(
          and(
            eq(schedules.id, schedule.id),
            eq(schedules.status, "active"),
            lte(schedules.nextFireAt, now)
          )
        )
        .run();

      if (claimResult.changes === 0) {
        // Another tick already claimed this schedule
        continue;
      }

      // Branch on schedule type
      if (schedule.type === "heartbeat") {
        await fireHeartbeat(schedule, now);
      } else {
        await fireSchedule(schedule, now);
      }
    } catch (err) {
      console.error(`[scheduler] failed to fire schedule ${schedule.id}:`, err);
    }
  }

  // Process pending agent handoffs
  try {
    await processHandoffs();
  } catch (err) {
    console.error("[scheduler] handoff processing error:", err);
  }
}

async function fireSchedule(
  schedule: typeof schedules.$inferSelect,
  now: Date
): Promise<void> {
  // Concurrency guard: skip if a child task from this schedule is still running.
  // Escape SQL LIKE metacharacters (%, _) in schedule name to prevent false matches.
  const escapedName = schedule.name
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  const runningChildren = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        sql`${tasks.title} LIKE ${`${escapedName} — firing #%`} ESCAPE '\\'`,
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
    workflowId: null,
    scheduleId: schedule.id,
    title: `${schedule.name} — firing #${firingNumber}`,
    description: schedule.prompt,
    status: "queued",
    assignedAgent: schedule.assignedAgent,
    agentProfile: schedule.agentProfile,
    priority: 2,
    sourceType: "scheduled",
    createdAt: now,
    updatedAt: now,
  });

  // Link schedule's documents to the created task
  try {
    const schedDocs = await db
      .select({ documentId: scheduleDocumentInputs.documentId })
      .from(scheduleDocumentInputs)
      .where(eq(scheduleDocumentInputs.scheduleId, schedule.id));
    for (const { documentId } of schedDocs) {
      await db.update(documents)
        .set({ taskId, projectId: schedule.projectId, updatedAt: now })
        .where(eq(documents.id, documentId));
    }
  } catch (err) {
    console.error(`[scheduler] Document linking failed for schedule ${schedule.id}:`, err);
  }

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
  executeTaskWithRuntime(taskId).catch((err) => {
    console.error(
      `[scheduler] task execution failed for schedule ${schedule.id}, task ${taskId}:`,
      err
    );
  });

  console.log(
    `[scheduler] fired schedule "${schedule.name}" → task ${taskId} (firing #${firingNumber})`
  );

  // Deliver to configured channels
  if (schedule.deliveryChannels) {
    try {
      const channelIds = JSON.parse(schedule.deliveryChannels) as string[];
      if (channelIds.length > 0) {
        const message: ChannelMessage = {
          subject: `Schedule fired: ${schedule.name} (#${firingNumber})`,
          body: `Task "${schedule.name} — firing #${firingNumber}" has been created and queued for execution.\n\nPrompt: ${schedule.prompt.slice(0, 500)}`,
          format: "text",
          metadata: { scheduleId: schedule.id, taskId, firingNumber },
        };
        sendToChannels(channelIds, message).catch((err) => {
          console.error(`[scheduler] channel delivery failed for schedule ${schedule.id}:`, err);
        });
      }
    } catch {
      // Invalid JSON in deliveryChannels — skip
    }
  }
}

/**
 * Fire a heartbeat schedule: evaluate checklist, suppress or create action task.
 */
async function fireHeartbeat(
  schedule: typeof schedules.$inferSelect,
  now: Date
): Promise<void> {
  // 1. Active hours check
  const hoursResult = checkActiveHours(
    schedule.activeHoursStart,
    schedule.activeHoursEnd,
    schedule.activeTimezone,
    now
  );

  if (!hoursResult.isActive) {
    // Reschedule to the next active window or next cron fire (whichever is later)
    const nextCronFire = computeNextFireTime(schedule.cronExpression, now);
    const nextFire = hoursResult.nextActiveAt && hoursResult.nextActiveAt > nextCronFire
      ? hoursResult.nextActiveAt
      : nextCronFire;

    await db
      .update(schedules)
      .set({ nextFireAt: nextFire, updatedAt: now })
      .where(eq(schedules.id, schedule.id));

    console.log(`[scheduler] heartbeat "${schedule.name}" skipped — outside active hours`);
    return;
  }

  // 2. Daily budget check
  if (schedule.heartbeatBudgetPerDay !== null && schedule.heartbeatBudgetPerDay > 0) {
    // Reset daily budget if we've crossed into a new day
    const resetAt = schedule.heartbeatBudgetResetAt;
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    if (!resetAt || resetAt < startOfToday) {
      db.update(schedules)
        .set({
          heartbeatSpentToday: 0,
          heartbeatBudgetResetAt: startOfToday,
          updatedAt: now,
        })
        .where(eq(schedules.id, schedule.id))
        .run();
      // Reset the in-memory value for the check below
      schedule = { ...schedule, heartbeatSpentToday: 0 };
    }

    if (schedule.heartbeatSpentToday >= (schedule.heartbeatBudgetPerDay ?? Infinity)) {
      // Budget exhausted — skip and reschedule to tomorrow
      const nextFire = computeNextFireTime(schedule.cronExpression, now);
      await db
        .update(schedules)
        .set({ nextFireAt: nextFire, updatedAt: now })
        .where(eq(schedules.id, schedule.id));

      console.log(`[scheduler] heartbeat "${schedule.name}" paused — daily budget exhausted`);
      return;
    }
  }

  // 3. Parse checklist
  const checklist = parseChecklist(schedule.heartbeatChecklist);
  if (checklist.length === 0) {
    console.warn(`[scheduler] heartbeat "${schedule.name}" has empty checklist — skipping`);
    const nextFire = computeNextFireTime(schedule.cronExpression, now);
    await db
      .update(schedules)
      .set({ nextFireAt: nextFire, updatedAt: now })
      .where(eq(schedules.id, schedule.id));
    return;
  }

  // 4. Create evaluation task
  const evalTaskId = crypto.randomUUID();
  const firingNumber = schedule.firingCount + 1;
  const heartbeatDescription = buildHeartbeatPrompt(checklist, schedule.name);

  await db.insert(tasks).values({
    id: evalTaskId,
    projectId: schedule.projectId,
    workflowId: null,
    scheduleId: schedule.id,
    title: `${schedule.name} — heartbeat #${firingNumber}`,
    description: heartbeatDescription,
    status: "queued",
    assignedAgent: schedule.assignedAgent,
    agentProfile: schedule.agentProfile,
    priority: 2,
    sourceType: "heartbeat",
    createdAt: now,
    updatedAt: now,
  });

  // Link schedule's documents to the heartbeat task
  try {
    const schedDocs = await db
      .select({ documentId: scheduleDocumentInputs.documentId })
      .from(scheduleDocumentInputs)
      .where(eq(scheduleDocumentInputs.scheduleId, schedule.id));
    for (const { documentId } of schedDocs) {
      await db.update(documents)
        .set({ taskId: evalTaskId, projectId: schedule.projectId, updatedAt: now })
        .where(eq(documents.id, documentId));
    }
  } catch (err) {
    console.error(`[scheduler] Document linking failed for heartbeat ${schedule.id}:`, err);
  }

  // 5. Execute and wait for result (with timeout)
  try {
    await executeTaskWithRuntime(evalTaskId);
  } catch (err) {
    console.error(`[scheduler] heartbeat evaluation failed for "${schedule.name}":`, err);
  }

  // 6. Read the completed task result
  const [evalTask] = await db
    .select({ result: tasks.result, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.id, evalTaskId));

  const evaluation = evalTask?.result
    ? parseHeartbeatResponse(evalTask.result)
    : null;

  // Default to action_needed=true if we can't parse the response (fail-open)
  const actionNeeded = evaluation?.action_needed ?? true;

  // 7. Log the heartbeat evaluation
  const logId = crypto.randomUUID();
  const logPayload = actionNeeded
    ? `Heartbeat action needed: ${evaluation?.items?.filter((i) => i.status === "action_needed").map((i) => i.summary).join("; ") ?? "parse failed, defaulting to action"}`
    : `Heartbeat OK — all items normal (suppression #${schedule.suppressionCount + 1})`;

  db.insert(agentLogs)
    .values({
      id: logId,
      taskId: evalTaskId,
      agentType: "heartbeat",
      event: actionNeeded ? "heartbeat_action" : "heartbeat_suppressed",
      payload: logPayload,
      timestamp: now,
    })
    .run();

  // 8. Update schedule counters and compute next fire
  const nextFire = computeNextFireTime(schedule.cronExpression, now);

  if (actionNeeded) {
    // Action path: reset suppression, update lastActionAt
    await db
      .update(schedules)
      .set({
        firingCount: firingNumber,
        lastFiredAt: now,
        lastActionAt: now,
        suppressionCount: 0,
        nextFireAt: nextFire,
        updatedAt: now,
      })
      .where(eq(schedules.id, schedule.id));

    console.log(
      `[scheduler] heartbeat "${schedule.name}" → ACTION NEEDED → task ${evalTaskId} (firing #${firingNumber})`
    );
  } else {
    // Suppression path: increment counter, no action task
    await db
      .update(schedules)
      .set({
        firingCount: firingNumber,
        lastFiredAt: now,
        suppressionCount: schedule.suppressionCount + 1,
        nextFireAt: nextFire,
        updatedAt: now,
      })
      .where(eq(schedules.id, schedule.id));

    console.log(
      `[scheduler] heartbeat "${schedule.name}" → OK (suppression #${schedule.suppressionCount + 1})`
    );
  }
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
