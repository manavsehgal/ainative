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
import { schedules, tasks, agentLogs, scheduleDocumentInputs, documents, workflows } from "@/lib/db/schema";
import { eq, and, lte, inArray, sql, asc, isNotNull } from "drizzle-orm";
import { resumeWorkflow } from "@/lib/workflows/engine";
import { computeNextFireTime } from "./interval-parser";
import { executeTaskWithRuntime } from "@/lib/agents/runtime";
import { getSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";
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
let draining = false;

/**
 * Drain queued schedule/heartbeat tasks after a firing completes.
 *
 * Background: schedule firings used to be fire-and-forget. When multiple
 * schedules collided on the same minute (e.g. three `*​/30 * * * *` schedules
 * all firing at :00), one task would execute and the others would sit in
 * "queued" until the next poll cycle 30+ minutes later. This drain hook walks
 * the queue immediately on completion so collisions resolve in seconds.
 *
 * Sequential by design: the executor processes one task at a time to avoid
 * concurrent agent costs and write conflicts. We use a module-level `draining`
 * flag to ensure only one drain loop runs even if multiple firings finish in
 * close succession.
 */
export async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    // Loop until the queue is empty so a single drain cycle clears all
    // collided tasks rather than only the next one.
    while (true) {
      const [nextQueued] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.status, "queued"),
            inArray(tasks.sourceType, ["scheduled", "heartbeat"])
          )
        )
        .orderBy(asc(tasks.createdAt))
        .limit(1);

      if (!nextQueued) return;

      console.log(`[scheduler] draining queue → executing task ${nextQueued.id}`);
      try {
        await executeTaskWithRuntime(nextQueued.id);
      } catch (err) {
        console.error(`[scheduler] drain task ${nextQueued.id} failed:`, err);
      }

      // Record health metrics for the schedule that owns this task (if any).
      try {
        const [taskRow] = await db
          .select({ scheduleId: tasks.scheduleId })
          .from(tasks)
          .where(eq(tasks.id, nextQueued.id));
        if (taskRow?.scheduleId) {
          await recordFiringMetrics(taskRow.scheduleId, nextQueued.id);
        }
      } catch (err) {
        console.error(`[scheduler] metrics recording failed for ${nextQueued.id}:`, err);
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * Build the turn-budget guidance header that prepends to schedule-spawned
 * task descriptions. Reads `runtime.maxTurns` so the agent sees the same
 * limit the runtime will enforce, and gives concrete batching guidance to
 * head off per-item loop patterns that exhaust turns.
 */
async function buildTurnBudgetHeader(): Promise<string> {
  const raw = await getSetting(SETTINGS_KEYS.MAX_TURNS);
  const maxTurns = raw ? Number.parseInt(raw, 10) || 50 : 50;
  return [
    `TURN BUDGET: You have ${maxTurns} turns maximum. Plan accordingly.`,
    `IMPORTANT: Batch operations to minimize turns.`,
    `- Use ONE web search with multiple keywords instead of per-item searches`,
    `- Read multiple tables in a single turn when possible`,
    `- Do NOT loop through items with individual tool calls`,
    ``,
    ``,
  ].join("\n");
}

/**
 * Detect a failure reason from a completed task by inspecting its result text.
 * Used by recordFiringMetrics to surface meaningful causes (turn limit, timeout,
 * generic) without needing additional schema columns on tasks.
 */
function detectFailureReason(result: string | null): string {
  if (!result) return "unknown";
  const lower = result.toLowerCase();
  if (lower.includes("turn") && (lower.includes("limit") || lower.includes("max"))) {
    return "turn_limit_exceeded";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "timeout";
  }
  if (lower.includes("budget")) return "budget_exceeded";
  return "error";
}

/**
 * Record per-firing health metrics on a schedule and auto-pause after
 * 3 consecutive failures. Uses an exponential moving average for turn count
 * so the metric reflects recent behavior more than ancient firings.
 */
export async function recordFiringMetrics(
  scheduleId: string,
  taskId: string
): Promise<void> {
  const [task] = await db
    .select({ status: tasks.status, result: tasks.result })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!task) return;

  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId));
  if (!schedule) return;

  const turnCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentLogs)
    .where(eq(agentLogs.taskId, taskId));
  const turns = Number(turnCountResult[0]?.count ?? 0);

  const prevAvg = schedule.avgTurnsPerFiring ?? turns;
  const newAvg = Math.round(prevAvg * 0.7 + turns * 0.3);

  const isFailure = task.status === "failed";
  const newStreak = isFailure ? (schedule.failureStreak ?? 0) + 1 : 0;
  const shouldAutoPause = isFailure && newStreak >= 3 && schedule.status === "active";

  await db
    .update(schedules)
    .set({
      lastTurnCount: turns,
      avgTurnsPerFiring: newAvg,
      failureStreak: newStreak,
      lastFailureReason: isFailure ? detectFailureReason(task.result) : null,
      status: shouldAutoPause ? "paused" : schedule.status,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId));

  if (shouldAutoPause) {
    console.warn(
      `[scheduler] auto-paused "${schedule.name}" after 3 consecutive failures`
    );
  }
}

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

  // Resume delayed workflows whose resume_at has passed. Uses the partial index
  // idx_workflows_resume_at (WHERE resume_at IS NOT NULL) for efficiency.
  // resumeWorkflow is idempotent via atomic status transition, so even if the
  // scheduler tick races a user's "Resume Now" click, exactly one resume wins.
  try {
    const nowMs = now.getTime();
    const dueDelayedWorkflows = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(
          eq(workflows.status, "paused"),
          isNotNull(workflows.resumeAt),
          lte(workflows.resumeAt, nowMs),
        ),
      );

    for (const wf of dueDelayedWorkflows) {
      resumeWorkflow(wf.id).catch((err) => {
        console.error(`[scheduler] failed to resume workflow ${wf.id}:`, err);
      });
    }
  } catch (err) {
    console.error("[scheduler] delayed-workflow check error:", err);
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

  // Prepend turn-budget guidance so the agent can plan batched tool calls
  // instead of per-item loops that exhaust maxTurns mid-task.
  const budgetHeader = await buildTurnBudgetHeader();

  await db.insert(tasks).values({
    id: taskId,
    projectId: schedule.projectId,
    workflowId: null,
    scheduleId: schedule.id,
    title: `${schedule.name} — firing #${firingNumber}`,
    description: budgetHeader + schedule.prompt,
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

  // Drain-aware task execution. We still don't await in fireSchedule (the
  // poll loop must keep claiming other due schedules), but on completion we
  // record metrics and trigger drainQueue() so any tasks queued by colliding
  // schedules execute immediately instead of waiting for the next poll.
  executeTaskWithRuntime(taskId)
    .catch((err) => {
      console.error(
        `[scheduler] task execution failed for schedule ${schedule.id}, task ${taskId}:`,
        err
      );
    })
    .then(() => recordFiringMetrics(schedule.id, taskId).catch(() => {}))
    .then(() => drainQueue().catch(() => {}));

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

  // Record health metrics and trigger drain (fire-and-forget — we still need
  // to finish heartbeat post-processing below before returning).
  recordFiringMetrics(schedule.id, evalTaskId)
    .catch(() => {})
    .then(() => drainQueue().catch(() => {}));

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
