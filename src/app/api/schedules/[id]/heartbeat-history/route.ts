import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentLogs, schedules, tasks } from "@/lib/db/schema";
import { eq, and, desc, inArray, like } from "drizzle-orm";

/**
 * GET /api/schedules/[id]/heartbeat-history
 *
 * Returns recent heartbeat evaluations — both action and suppressed entries.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id));

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  if (schedule.type !== "heartbeat") {
    return NextResponse.json({ error: "Not a heartbeat schedule" }, { status: 400 });
  }

  // Find heartbeat tasks for this schedule
  const heartbeatTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(like(tasks.title, `${schedule.name} — heartbeat #%`));

  if (heartbeatTasks.length === 0) {
    return NextResponse.json({ history: [], stats: getStats(schedule) });
  }

  const taskIds = heartbeatTasks.map((t) => t.id);

  // Fetch heartbeat log entries for these tasks
  const logs = await db
    .select()
    .from(agentLogs)
    .where(
      and(
        inArray(agentLogs.taskId, taskIds),
        inArray(agentLogs.event, ["heartbeat_action", "heartbeat_suppressed"])
      )
    )
    .orderBy(desc(agentLogs.timestamp))
    .limit(50);

  const history = logs.map((log) => ({
    id: log.id,
    taskId: log.taskId,
    event: log.event,
    payload: log.payload,
    timestamp: log.timestamp,
  }));

  return NextResponse.json({
    history,
    stats: getStats(schedule),
  });
}

function getStats(schedule: typeof schedules.$inferSelect) {
  return {
    suppressionCount: schedule.suppressionCount,
    lastActionAt: schedule.lastActionAt,
    firingCount: schedule.firingCount,
    heartbeatSpentToday: schedule.heartbeatSpentToday,
    heartbeatBudgetPerDay: schedule.heartbeatBudgetPerDay,
  };
}
