import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schedules, tasks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { executeTaskWithRuntime } from "@/lib/agents/runtime";
import { claimSlot, countRunningScheduledSlots } from "@/lib/schedules/slot-claim";
import {
  getScheduleMaxConcurrent,
  getScheduleMaxRunDurationSec,
} from "@/lib/schedules/config";
import { randomUUID } from "crypto";

/**
 * Manually fire a schedule. Honors the global concurrency cap by default.
 * Use `?force=true` to bypass the cap (logged to usage_ledger as
 * "manual_force_bypass" for audit).
 *
 * Security note: force bypass is audit-logged synchronously before task
 * execution begins, so every bypass leaves a permanent record regardless of
 * task outcome.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scheduleId } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";

  const [schedule] = db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId))
    .all();
  if (!schedule) {
    return NextResponse.json({ error: "schedule_not_found" }, { status: 404 });
  }

  const taskId = randomUUID();
  const firingNumber = schedule.firingCount + 1;
  const now = new Date();

  db.insert(tasks)
    .values({
      id: taskId,
      projectId: schedule.projectId,
      workflowId: null,
      scheduleId: schedule.id,
      title: `${schedule.name} — manual firing #${firingNumber}`,
      description: schedule.prompt,
      status: "queued",
      assignedAgent: schedule.assignedAgent,
      agentProfile: schedule.agentProfile,
      priority: 2,
      sourceType: "scheduled",
      maxTurns: schedule.maxTurns,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const cap = getScheduleMaxConcurrent();
  const leaseSec = schedule.maxRunDurationSec ?? getScheduleMaxRunDurationSec();

  // When force=true, pass an effectively infinite cap so the subquery COUNT
  // can never exceed it. This lets `claimSlot` atomically transition the task
  // to "running" even when the real cap is full.
  const effectiveCap = force ? Number.MAX_SAFE_INTEGER : cap;
  const { claimed } = claimSlot(taskId, effectiveCap, leaseSec);

  if (!claimed) {
    db.delete(tasks).where(eq(tasks.id, taskId)).run();
    const slotEtaSec = 60;
    return NextResponse.json(
      {
        error: "capacity_full",
        message: `Swarm at capacity (${countRunningScheduledSlots()}/${cap}). Retry in ~${slotEtaSec}s or add ?force=true to bypass.`,
        slotEtaSec,
      },
      { status: 429 },
    );
  }

  // Audit log written synchronously before task execution so that a force
  // bypass is always recorded even if the task itself fails immediately.
  // We use a raw SQL insert because "manual_force_bypass" is not in the
  // Drizzle-typed enum (which covers metered activity types only).
  if (force) {
    const nowSec = Math.ceil(Date.now() / 1000);
    db.run(
      sql`INSERT INTO usage_ledger
            (id, task_id, schedule_id, project_id,
             activity_type, runtime_id, provider_id,
             status, cost_micros, started_at, finished_at)
          VALUES
            (${randomUUID()}, ${taskId}, ${schedule.id}, ${schedule.projectId},
             'manual_force_bypass', 'manual', 'manual',
             'completed', 0, ${nowSec}, ${nowSec})`,
    );
  }

  // Fire-and-forget: the route returns immediately with taskId; execution runs
  // in the background. Errors are logged but do not affect the 200 response.
  executeTaskWithRuntime(taskId).catch((err) => {
    console.error(`[api/schedules/execute] task ${taskId} failed:`, err);
  });

  return NextResponse.json({ taskId, forced: force });
}
