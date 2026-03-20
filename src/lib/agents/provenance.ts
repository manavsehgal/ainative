import { db } from "@/lib/db";
import { tasks, agentLogs, notifications, usageLedger } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface ProvenanceEntry {
  timestamp: string;
  type: "log" | "approval" | "cost";
  event: string;
  detail: string | null;
  status?: string;
}

export interface TaskProvenance {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  initiator: string;
  agentProfile: string | null;
  runtime: string | null;
  createdAt: string;
  completedAt: string | null;
  timeline: ProvenanceEntry[];
  totalCost: number;
  approvalCount: number;
  toolCallCount: number;
}

/**
 * Build a complete provenance record for a task.
 * Assembles data from agent_logs, notifications, and usage_ledger.
 */
export async function buildTaskProvenance(taskId: string): Promise<TaskProvenance | null> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return null;

  // Fetch all related data in parallel
  const [logs, approvals, costs] = await Promise.all([
    db.select()
      .from(agentLogs)
      .where(eq(agentLogs.taskId, taskId))
      .orderBy(desc(agentLogs.timestamp))
      .limit(100),
    db.select()
      .from(notifications)
      .where(
        and(
          eq(notifications.taskId, taskId),
          eq(notifications.type, "permission_required")
        )
      )
      .orderBy(desc(notifications.createdAt)),
    db.select()
      .from(usageLedger)
      .where(eq(usageLedger.taskId, taskId))
      .orderBy(desc(usageLedger.finishedAt)),
  ]);

  const timeline: ProvenanceEntry[] = [];

  // Add log entries
  for (const log of logs) {
    timeline.push({
      timestamp: log.timestamp.toISOString(),
      type: "log",
      event: log.event,
      detail: log.payload,
    });
  }

  // Add approval entries
  for (const approval of approvals) {
    timeline.push({
      timestamp: approval.createdAt.toISOString(),
      type: "approval",
      event: approval.type,
      detail: approval.body,
      status: approval.response ?? "pending",
    });
  }

  // Add cost entries
  for (const cost of costs) {
    timeline.push({
      timestamp: cost.finishedAt.toISOString(),
      type: "cost",
      event: "usage",
      detail: `${cost.inputTokens ?? 0} in / ${cost.outputTokens ?? 0} out tokens`,
    });
  }

  // Sort timeline by timestamp (newest first)
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const totalCost = costs.reduce((sum, c) => sum + ((c.costMicros ?? 0) / 1_000_000), 0);
  const toolCallCount = logs.filter((l) => l.event === "tool_start").length;

  return {
    taskId: task.id,
    taskTitle: task.title,
    taskStatus: task.status,
    initiator: "user",
    agentProfile: task.agentProfile,
    runtime: task.assignedAgent,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.status === "completed" ? task.updatedAt.toISOString() : null,
    timeline,
    totalCost,
    approvalCount: approvals.length,
    toolCallCount,
  };
}
