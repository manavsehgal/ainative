/**
 * Handoff bus: create, process, and complete agent handoffs.
 */

import { db } from "@/lib/db";
import { agentMessages, tasks, notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { validateHandoff } from "./governance";
import type { HandoffRequest } from "./types";

/**
 * Send a handoff request from one agent profile to another.
 * Creates an agent_messages row and optionally a notification for approval.
 * Returns the message ID.
 */
export async function sendHandoff(request: HandoffRequest): Promise<string> {
  // Determine chain depth from parent message
  let chainDepth = 0;
  if (request.parentMessageId) {
    const [parent] = await db
      .select({ chainDepth: agentMessages.chainDepth })
      .from(agentMessages)
      .where(eq(agentMessages.id, request.parentMessageId));
    if (parent) {
      chainDepth = parent.chainDepth + 1;
    }
  }

  // Validate governance rules
  const validation = validateHandoff(request, chainDepth);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(agentMessages).values({
    id,
    fromProfileId: request.fromProfileId,
    toProfileId: request.toProfileId,
    taskId: request.sourceTaskId,
    subject: request.subject.trim(),
    body: request.body.trim(),
    priority: request.priority ?? 2,
    status: request.requiresApproval ? "pending" : "accepted",
    requiresApproval: request.requiresApproval ?? false,
    parentMessageId: request.parentMessageId ?? null,
    chainDepth,
    createdAt: now,
  });

  // Create a notification if approval is required
  if (request.requiresApproval) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      taskId: request.sourceTaskId,
      type: "agent_message",
      title: `Handoff approval: ${request.subject}`,
      body: `Agent "${request.fromProfileId}" wants to hand off to "${request.toProfileId}": ${request.body.slice(0, 200)}`,
      read: false,
      createdAt: now,
    });
  }

  return id;
}

/**
 * Process pending/accepted handoffs: create child tasks and mark as in_progress.
 */
export async function processHandoffs(): Promise<void> {
  const pending = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.status, "accepted"));

  const now = new Date();

  for (const msg of pending) {
    // Skip expired messages
    if (msg.expiresAt && msg.expiresAt <= now) {
      await db
        .update(agentMessages)
        .set({ status: "expired", respondedAt: now })
        .where(eq(agentMessages.id, msg.id));
      continue;
    }

    // Create a child task for the target profile
    const taskId = crypto.randomUUID();

    // Get the source task's project for context
    let projectId: string | null = null;
    if (msg.taskId) {
      const [sourceTask] = await db
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, msg.taskId));
      projectId = sourceTask?.projectId ?? null;
    }

    await db.insert(tasks).values({
      id: taskId,
      projectId,
      title: `Handoff: ${msg.subject}`,
      description: msg.body,
      status: "queued",
      agentProfile: msg.toProfileId,
      priority: msg.priority,
      sourceType: "manual",
      createdAt: now,
      updatedAt: now,
    });

    // Update the handoff message with the target task
    await db
      .update(agentMessages)
      .set({
        status: "in_progress",
        targetTaskId: taskId,
        respondedAt: now,
      })
      .where(eq(agentMessages.id, msg.id));

    // Fire-and-forget task execution
    try {
      const { startTaskExecution } = await import("@/lib/agents/task-dispatch");
      startTaskExecution(taskId).catch((err) => {
        console.error(`[handoff] task execution failed for message ${msg.id}:`, err);
      });
    } catch (err) {
      console.error(`[handoff] failed to start task for message ${msg.id}:`, err);
    }

    console.log(
      `[handoff] processed message ${msg.id}: ${msg.fromProfileId} -> ${msg.toProfileId} -> task ${taskId}`
    );
  }
}

/**
 * Mark a handoff as completed when the child task finishes.
 */
export async function completeHandoff(
  messageId: string,
  result: string
): Promise<void> {
  const now = new Date();

  await db
    .update(agentMessages)
    .set({
      status: "completed",
      respondedAt: now,
      attachments: JSON.stringify({ result }),
    })
    .where(
      and(
        eq(agentMessages.id, messageId),
        eq(agentMessages.status, "in_progress")
      )
    );
}
