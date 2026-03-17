/**
 * Learning Session — buffers context proposals during workflow execution.
 *
 * When a workflow starts, a session is opened. All context proposals generated
 * by tasks within that workflow are buffered instead of creating individual
 * notifications. When the workflow completes (or fails), the session is closed
 * and a single batch notification is created for all buffered proposals.
 */

import { db } from "@/lib/db";
import { learnedContext, notifications, tasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// In-memory session registry
// ---------------------------------------------------------------------------

/**
 * Active learning sessions, keyed by workflowId.
 * Each session accumulates proposal IDs (learnedContext row IDs) until closed.
 */
const activeSessions = new Map<
  string,
  {
    workflowId: string;
    proposalIds: string[];
    openedAt: Date;
  }
>();

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Open a learning session for a workflow. All proposals created during this
 * session will be buffered instead of generating individual notifications.
 */
export function openLearningSession(workflowId: string): void {
  activeSessions.set(workflowId, {
    workflowId,
    proposalIds: [],
    openedAt: new Date(),
  });
}

/**
 * Check if a learning session is active for a workflow.
 */
export function hasLearningSession(workflowId: string): boolean {
  return activeSessions.has(workflowId);
}

/**
 * Get the active session for a workflow (or null if none).
 */
export function getLearningSession(workflowId: string) {
  return activeSessions.get(workflowId) ?? null;
}

/**
 * Buffer a proposal ID into the active session.
 * Called by proposeContextAddition when it detects a workflow session.
 */
export function bufferProposal(
  workflowId: string,
  proposalRowId: string
): void {
  const session = activeSessions.get(workflowId);
  if (session) {
    session.proposalIds.push(proposalRowId);
  }
}

/**
 * Close the learning session and create a single batch notification
 * for all buffered proposals. Returns the batch notification ID,
 * or null if there were no proposals.
 */
export async function closeLearningSession(
  workflowId: string
): Promise<string | null> {
  const session = activeSessions.get(workflowId);
  activeSessions.delete(workflowId);

  if (!session || session.proposalIds.length === 0) {
    return null;
  }

  // Load all buffered proposal rows
  const proposals = [];
  for (const id of session.proposalIds) {
    const [row] = db
      .select()
      .from(learnedContext)
      .where(eq(learnedContext.id, id))
      .all();
    if (row) {
      proposals.push(row);
    }
  }

  if (proposals.length === 0) return null;

  // Group by profile for the notification body
  const byProfile = new Map<string, typeof proposals>();
  for (const p of proposals) {
    const group = byProfile.get(p.profileId) ?? [];
    group.push(p);
    byProfile.set(p.profileId, group);
  }

  // Build summary body
  const bodyLines: string[] = [];
  for (const [profileId, group] of byProfile) {
    bodyLines.push(`**${profileId}** (${group.length} proposal${group.length > 1 ? "s" : ""}):`);
    for (const p of group) {
      const preview = (p.proposedAdditions ?? p.diff ?? "").slice(0, 150);
      bodyLines.push(`  - ${preview}${preview.length >= 150 ? "..." : ""}`);
    }
  }

  const notificationId = crypto.randomUUID();

  await db.insert(notifications).values({
    id: notificationId,
    taskId: null,
    type: "context_proposal_batch",
    title: `Workflow learning: ${proposals.length} context proposal${proposals.length > 1 ? "s" : ""}`,
    body: bodyLines.join("\n").slice(0, 1000),
    toolName: "workflow-context-batch",
    toolInput: JSON.stringify({
      workflowId,
      proposalIds: session.proposalIds,
      profileIds: [...byProfile.keys()],
    }),
    createdAt: new Date(),
  });

  return notificationId;
}

// ---------------------------------------------------------------------------
// Task → Workflow mapping
// ---------------------------------------------------------------------------

/**
 * Resolve the workflowId for a given task. Returns null if the task is
 * not part of a workflow or the task doesn't exist.
 */
export function getTaskWorkflowId(taskId: string): string | null {
  try {
    const [row] = db
      .select({ workflowId: tasks.workflowId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .all();

    return row?.workflowId ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

/**
 * Approve all proposals in a batch by their IDs.
 */
export async function batchApproveProposals(
  proposalRowIds: string[]
): Promise<number> {
  // Import inline to avoid circular dependency
  const { approveProposal } = await import("./learned-context");

  let approved = 0;
  for (const rowId of proposalRowIds) {
    const [row] = db
      .select()
      .from(learnedContext)
      .where(
        and(
          eq(learnedContext.id, rowId),
          eq(learnedContext.changeType, "proposal")
        )
      )
      .all();

    if (row?.proposalNotificationId) {
      try {
        await approveProposal(row.proposalNotificationId);
        approved++;
      } catch {
        // Skip if already approved/rejected
      }
    }
  }
  return approved;
}

/**
 * Reject all proposals in a batch by their IDs.
 */
export async function batchRejectProposals(
  proposalRowIds: string[]
): Promise<number> {
  const { rejectProposal } = await import("./learned-context");

  let rejected = 0;
  for (const rowId of proposalRowIds) {
    const [row] = db
      .select()
      .from(learnedContext)
      .where(
        and(
          eq(learnedContext.id, rowId),
          eq(learnedContext.changeType, "proposal")
        )
      )
      .all();

    if (row?.proposalNotificationId) {
      try {
        await rejectProposal(row.proposalNotificationId);
        rejected++;
      } catch {
        // Skip if already approved/rejected
      }
    }
  }
  return rejected;
}
