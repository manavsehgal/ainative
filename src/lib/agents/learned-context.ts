import { db } from "@/lib/db";
import { learnedContext, notifications } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { LearnedContextRow } from "@/lib/db/schema";
import { runMetaCompletion } from "./runtime/claude";
import { getSettingSync } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

const DEFAULT_CONTEXT_CHAR_LIMIT = 8_000;
const SUMMARIZATION_RATIO = 0.75;

function getContextLimits(): {
  charLimit: number;
  summarizationThreshold: number;
} {
  const raw = getSettingSync(SETTINGS_KEYS.LEARNING_CONTEXT_CHAR_LIMIT);
  const parsed = raw ? parseInt(raw, 10) : DEFAULT_CONTEXT_CHAR_LIMIT;
  const charLimit =
    !isNaN(parsed) && parsed >= 2000 && parsed <= 32000
      ? parsed
      : DEFAULT_CONTEXT_CHAR_LIMIT;
  return {
    charLimit,
    summarizationThreshold: Math.floor(charLimit * SUMMARIZATION_RATIO),
  };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Get the latest approved context for a profile (returns content string or null) */
export function getActiveLearnedContext(profileId: string): string | null {
  const [row] = db
    .select({ content: learnedContext.content })
    .from(learnedContext)
    .where(
      and(
        eq(learnedContext.profileId, profileId),
        eq(learnedContext.changeType, "approved")
      )
    )
    .orderBy(desc(learnedContext.version))
    .limit(1)
    .all();

  return row?.content ?? null;
}

/** Get full version history for a profile */
export async function getContextHistory(
  profileId: string
): Promise<LearnedContextRow[]> {
  return db
    .select()
    .from(learnedContext)
    .where(eq(learnedContext.profileId, profileId))
    .orderBy(desc(learnedContext.version))
    .all();
}

/** Get the next version number for a profile */
function getNextVersion(profileId: string): number {
  const [row] = db
    .select({ version: learnedContext.version })
    .from(learnedContext)
    .where(eq(learnedContext.profileId, profileId))
    .orderBy(desc(learnedContext.version))
    .limit(1)
    .all();

  return (row?.version ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Proposal flow
// ---------------------------------------------------------------------------

/**
 * Insert a context proposal and optionally create a notification for human review.
 *
 * When `options.silent` is true, the proposal row is created but no notification
 * is generated. This is used by the learning session system to buffer proposals
 * during workflow execution — a batch notification is created when the session closes.
 *
 * Returns the learned_context row ID (not the notification ID) so callers can
 * reference the proposal regardless of whether a notification was created.
 */
export async function proposeContextAddition(
  profileId: string,
  taskId: string,
  additions: string,
  options?: { silent?: boolean }
): Promise<string> {

  const version = getNextVersion(profileId);
  const notificationId = options?.silent ? null : crypto.randomUUID();
  const rowId = crypto.randomUUID();
  const now = new Date();

  // Insert proposal row
  await db.insert(learnedContext).values({
    id: rowId,
    profileId,
    version,
    content: null, // not yet approved
    diff: additions,
    changeType: "proposal",
    sourceTaskId: taskId,
    proposalNotificationId: notificationId,
    proposedAdditions: additions,
    createdAt: now,
  });

  // Create notification for human review (unless silent)
  if (notificationId) {
    await db.insert(notifications).values({
      id: notificationId,
      taskId,
      type: "context_proposal",
      title: `Context proposal for ${profileId}`,
      body: additions.slice(0, 500),
      toolName: profileId,
      toolInput: JSON.stringify({ profileId, additions, learnedContextId: rowId }),
      createdAt: now,
    });
  }

  return rowId;
}

// ---------------------------------------------------------------------------
// Approval / Rejection / Rollback
// ---------------------------------------------------------------------------

/** Approve a proposal — merges additions into current context, creates approved version */
export async function approveProposal(
  notificationId: string,
  editedContent?: string
): Promise<void> {
  // Find the proposal row by notification ID
  const [proposal] = db
    .select()
    .from(learnedContext)
    .where(eq(learnedContext.proposalNotificationId, notificationId))
    .all();

  if (!proposal) throw new Error("Proposal not found");

  const currentContent = getActiveLearnedContext(proposal.profileId) ?? "";
  const additions = editedContent ?? proposal.proposedAdditions ?? "";
  const mergedContent = currentContent
    ? `${currentContent}\n\n${additions}`
    : additions;

  const version = getNextVersion(proposal.profileId);

  await db.insert(learnedContext).values({
    id: crypto.randomUUID(),
    profileId: proposal.profileId,
    version,
    content: mergedContent,
    diff: additions,
    changeType: "approved",
    sourceTaskId: proposal.sourceTaskId,
    proposalNotificationId: notificationId,
    proposedAdditions: additions,
    approvedBy: "human",
    createdAt: new Date(),
  });

  // Mark notification as responded
  await db
    .update(notifications)
    .set({
      response: JSON.stringify({ action: "approved" }),
      respondedAt: new Date(),
    })
    .where(eq(notifications.id, notificationId));

  // Check if we need to auto-summarize
  const sizeInfo = checkContextSize(proposal.profileId);
  if (sizeInfo.needsSummarization) {
    await summarizeContext(proposal.profileId);
  }
}

/** Reject a proposal */
export async function rejectProposal(notificationId: string): Promise<void> {
  const [proposal] = db
    .select()
    .from(learnedContext)
    .where(eq(learnedContext.proposalNotificationId, notificationId))
    .all();

  if (!proposal) throw new Error("Proposal not found");

  const version = getNextVersion(proposal.profileId);

  await db.insert(learnedContext).values({
    id: crypto.randomUUID(),
    profileId: proposal.profileId,
    version,
    content: getActiveLearnedContext(proposal.profileId),
    diff: proposal.proposedAdditions,
    changeType: "rejected",
    sourceTaskId: proposal.sourceTaskId,
    proposalNotificationId: notificationId,
    proposedAdditions: proposal.proposedAdditions,
    createdAt: new Date(),
  });

  // Mark notification as responded
  await db
    .update(notifications)
    .set({
      response: JSON.stringify({ action: "rejected" }),
      respondedAt: new Date(),
    })
    .where(eq(notifications.id, notificationId));
}

/** Rollback to a specific version — creates a new version with that version's content */
export async function rollbackToVersion(
  profileId: string,
  targetVersion: number
): Promise<void> {
  const [target] = db
    .select()
    .from(learnedContext)
    .where(
      and(
        eq(learnedContext.profileId, profileId),
        eq(learnedContext.version, targetVersion)
      )
    )
    .all();

  if (!target) throw new Error(`Version ${targetVersion} not found`);

  const version = getNextVersion(profileId);

  await db.insert(learnedContext).values({
    id: crypto.randomUUID(),
    profileId,
    version,
    content: target.content,
    diff: `Rolled back to version ${targetVersion}`,
    changeType: "rollback",
    createdAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Context size management
// ---------------------------------------------------------------------------

export function checkContextSize(profileId: string): {
  currentSize: number;
  limit: number;
  needsSummarization: boolean;
} {
  const { charLimit, summarizationThreshold } = getContextLimits();
  const content = getActiveLearnedContext(profileId);
  const currentSize = content?.length ?? 0;
  return {
    currentSize,
    limit: charLimit,
    needsSummarization: currentSize > summarizationThreshold,
  };
}

/** Auto-condense context via LLM when it grows too large */
export async function summarizeContext(profileId: string): Promise<void> {
  const { summarizationThreshold } = getContextLimits();
  const content = getActiveLearnedContext(profileId);
  if (!content || content.length <= summarizationThreshold) return;

  const { text } = await runMetaCompletion({
    prompt: `You are condensing learned context for an AI agent profile "${profileId}".
The current context has grown to ${content.length} characters and needs to be summarized to under ${summarizationThreshold} characters while preserving all key patterns, best practices, and important insights.

Current learned context:
---
${content}
---

Produce a condensed version that:
1. Preserves all actionable patterns and best practices
2. Merges related patterns into combined entries
3. Removes redundant or superseded information
4. Keeps the same format (bullet points or sections)
5. Stays under ${summarizationThreshold} characters

Output ONLY the condensed context, no preamble.`,
    activityType: "context_summarization",
  });

  const summarized = text.trim();

  if (!summarized || summarized.length >= content.length) return;

  const version = getNextVersion(profileId);

  await db.insert(learnedContext).values({
    id: crypto.randomUUID(),
    profileId,
    version,
    content: summarized,
    diff: `Summarized from ${content.length} to ${summarized.length} chars`,
    changeType: "summarization",
    createdAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Manual addition (direct approve, no LLM extraction)
// ---------------------------------------------------------------------------

/** Add context directly without going through the proposal flow */
export async function addDirectContext(
  profileId: string,
  additions: string
): Promise<void> {
  const currentContent = getActiveLearnedContext(profileId) ?? "";
  const mergedContent = currentContent
    ? `${currentContent}\n\n${additions}`
    : additions;

  const version = getNextVersion(profileId);

  await db.insert(learnedContext).values({
    id: crypto.randomUUID(),
    profileId,
    version,
    content: mergedContent,
    diff: additions,
    changeType: "approved",
    approvedBy: "human",
    createdAt: new Date(),
  });

  const sizeInfo = checkContextSize(profileId);
  if (sizeInfo.needsSummarization) {
    await summarizeContext(profileId);
  }
}
