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
import { eq, and, desc, isNull } from "drizzle-orm";

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
 *
 * Batch proposals are created with `silent: true`, so each proposal's
 * `proposalNotificationId` is null. We approve them directly by row ID
 * instead of going through the individual notification flow, then mark
 * the parent batch notification as responded.
 */
export async function batchApproveProposals(
  proposalRowIds: string[]
): Promise<number> {
  const { getActiveLearnedContext, checkContextSize, summarizeContext } =
    await import("./learned-context");

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

    if (!row) continue;

    const currentContent = getActiveLearnedContext(row.profileId) ?? "";
    const additions = row.proposedAdditions ?? "";
    const mergedContent = currentContent
      ? `${currentContent}\n\n${additions}`
      : additions;

    const nextVersion = getNextVersionForProfile(row.profileId);

    await db.insert(learnedContext).values({
      id: crypto.randomUUID(),
      profileId: row.profileId,
      version: nextVersion,
      content: mergedContent,
      diff: additions,
      changeType: "approved",
      sourceTaskId: row.sourceTaskId,
      proposalNotificationId: row.proposalNotificationId,
      proposedAdditions: additions,
      approvedBy: "human",
      createdAt: new Date(),
    });

    // Also mark individual notification if it exists
    if (row.proposalNotificationId) {
      await db
        .update(notifications)
        .set({
          response: JSON.stringify({ action: "approved" }),
          respondedAt: new Date(),
        })
        .where(eq(notifications.id, row.proposalNotificationId));
    }

    approved++;

    const sizeInfo = checkContextSize(row.profileId);
    if (sizeInfo.needsSummarization) {
      await summarizeContext(row.profileId);
    }
  }

  // Mark the batch notification as responded
  await markBatchNotificationResponded(proposalRowIds, "approved");

  return approved;
}

/**
 * Reject all proposals in a batch by their IDs.
 */
export async function batchRejectProposals(
  proposalRowIds: string[]
): Promise<number> {
  const { getActiveLearnedContext } = await import("./learned-context");

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

    if (!row) continue;

    const nextVersion = getNextVersionForProfile(row.profileId);

    await db.insert(learnedContext).values({
      id: crypto.randomUUID(),
      profileId: row.profileId,
      version: nextVersion,
      content: getActiveLearnedContext(row.profileId),
      diff: row.proposedAdditions,
      changeType: "rejected",
      sourceTaskId: row.sourceTaskId,
      proposalNotificationId: row.proposalNotificationId,
      proposedAdditions: row.proposedAdditions,
      createdAt: new Date(),
    });

    // Also mark individual notification if it exists
    if (row.proposalNotificationId) {
      await db
        .update(notifications)
        .set({
          response: JSON.stringify({ action: "rejected" }),
          respondedAt: new Date(),
        })
        .where(eq(notifications.id, row.proposalNotificationId));
    }

    rejected++;
  }

  // Mark the batch notification as responded
  await markBatchNotificationResponded(proposalRowIds, "rejected");

  return rejected;
}

/**
 * Find and mark the batch notification that contains these proposal IDs as responded.
 */
async function markBatchNotificationResponded(
  proposalRowIds: string[],
  action: "approved" | "rejected"
): Promise<void> {
  // Find batch notifications that reference these proposal IDs
  const batchRows = db
    .select({ id: notifications.id, toolInput: notifications.toolInput })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, "context_proposal_batch"),
        // Only unresolved batch notifications
        isNull(notifications.response)
      )
    )
    .all();

  for (const row of batchRows) {
    try {
      const parsed = JSON.parse(row.toolInput ?? "{}");
      const ids: string[] = parsed?.proposalIds ?? [];
      // If this batch notification contains any of the proposal IDs, mark it
      if (proposalRowIds.some((id) => ids.includes(id))) {
        await db
          .update(notifications)
          .set({
            response: JSON.stringify({ action }),
            respondedAt: new Date(),
          })
          .where(eq(notifications.id, row.id));
      }
    } catch {
      // Skip unparseable toolInput
    }
  }
}

/** Helper to get next version for a profile (avoids circular import) */
function getNextVersionForProfile(profileId: string): number {
  const [row] = db
    .select({ version: learnedContext.version })
    .from(learnedContext)
    .where(eq(learnedContext.profileId, profileId))
    .orderBy(desc(learnedContext.version))
    .limit(1)
    .all();

  return (row?.version ?? 0) + 1;
}
