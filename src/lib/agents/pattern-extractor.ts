import { db } from "@/lib/db";
import { tasks, agentLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getActiveLearnedContext,
  proposeContextAddition,
} from "./learned-context";
import { runMetaCompletion } from "./runtime/claude";
import {
  getTaskWorkflowId,
  hasLearningSession,
  bufferProposal,
} from "./learning-session";

export interface PatternEntry {
  title: string;
  description: string;
  category: "error_resolution" | "best_practice" | "shortcut" | "preference";
}

export interface PatternProposal {
  patterns: PatternEntry[];
}

/**
 * Analyze a completed task for patterns worth learning.
 * Routes through the Claude Agent SDK runtime (no direct Anthropic SDK usage).
 * Returns the notification ID if a proposal was created, null otherwise.
 */
export async function analyzeForLearnedPatterns(
  taskId: string,
  profileId: string
): Promise<string | null> {
  // Gather task data
  const [task] = await db
    .select({
      title: tasks.title,
      description: tasks.description,
      result: tasks.result,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!task) return null;

  // Get recent agent logs for this task (last 20)
  const logs = await db
    .select({ event: agentLogs.event, payload: agentLogs.payload })
    .from(agentLogs)
    .where(eq(agentLogs.taskId, taskId))
    .orderBy(desc(agentLogs.timestamp))
    .limit(20);

  const currentContext = getActiveLearnedContext(profileId);

  // Build a compact representation of logs
  const logSummary = logs
    .map((log) => {
      const payload = log.payload
        ? JSON.stringify(JSON.parse(log.payload)).slice(0, 200)
        : "";
      return `[${log.event}] ${payload}`;
    })
    .join("\n");

  const { text } = await runMetaCompletion({
    prompt: `Analyze this completed task for patterns worth learning for the "${profileId}" agent profile.

Return ONLY a JSON array (no markdown, no code fences):
[{"title": "...", "description": "...", "category": "error_resolution|best_practice|shortcut|preference"}]

Return an empty array [] if no noteworthy patterns.

## Task
Title: ${task.title}
Description: ${(task.description ?? "").slice(0, 500)}

## Result (truncated)
${(task.result ?? "No result").slice(0, 1500)}

## Recent Agent Logs
${logSummary.slice(0, 2000)}

## Currently Learned Context
${currentContext ?? "(none yet)"}

Extract ONLY genuinely useful patterns — things that would help this profile avoid mistakes or work more efficiently on similar future tasks. If this task was routine with nothing notable, return an empty patterns array. Do NOT repeat patterns already in the learned context.`,
    activityType: "pattern_extraction",
  });

  // Parse JSON array from response text
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const patterns: PatternEntry[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

  if (patterns.length === 0) return null;

  // Format patterns as text for the proposal
  const formattedAdditions = patterns
    .map(
      (p) =>
        `### ${p.title} [${p.category}]\n${p.description}`
    )
    .join("\n\n");

  // Check if this task is part of a workflow with an active learning session.
  // If so, buffer the proposal instead of creating an individual notification.
  const workflowId = getTaskWorkflowId(taskId);
  if (workflowId && hasLearningSession(workflowId)) {
    const rowId = await proposeContextAddition(
      profileId,
      taskId,
      formattedAdditions,
      { silent: true }
    );
    bufferProposal(workflowId, rowId);
    return rowId;
  }

  return proposeContextAddition(profileId, taskId, formattedAdditions);
}
