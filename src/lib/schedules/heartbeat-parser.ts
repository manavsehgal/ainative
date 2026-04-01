/**
 * HEARTBEAT.md Parser
 *
 * Parses HEARTBEAT.md files into schedule specifications.
 * Each H2 heading is a natural language schedule expression,
 * and body items are checklist items with optional priority tags.
 *
 * Format:
 * ```markdown
 * ## Every weekday at 9am
 * - [high] Check if there are unread customer inquiries
 * - [medium] Review daily revenue metrics
 * - Check content calendar for overdue items
 * ```
 */

import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { parseNaturalLanguage } from "./nlp-parser";
import { parseInterval, computeNextFireTime } from "./interval-parser";

export interface HeartbeatFileSpec {
  /** Schedule name, derived from the H2 heading */
  name: string;
  /** The natural language expression from the heading */
  expression: string;
  /** Checklist items parsed from the body */
  checklist: Array<{
    id: string;
    instruction: string;
    priority: "high" | "medium" | "low";
  }>;
  /** Path to the source HEARTBEAT.md file */
  sourceFile: string;
}

/**
 * Parse a HEARTBEAT.md file into an array of schedule specs.
 *
 * Each H2 heading starts a new schedule. List items below it
 * become checklist items. Priority is specified with [high], [medium],
 * or [low] prefixes (default: medium).
 */
export function parseHeartbeatFile(
  content: string,
  filePath: string
): HeartbeatFileSpec[] {
  const specs: HeartbeatFileSpec[] = [];
  const lines = content.split("\n");

  let current: HeartbeatFileSpec | null = null;
  let itemCounter = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // H2 heading starts a new schedule
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match) {
      // Save previous spec if any
      if (current) specs.push(current);

      const expression = h2Match[1].trim();
      itemCounter = 0;
      current = {
        name: expression,
        expression,
        checklist: [],
        sourceFile: filePath,
      };
      continue;
    }

    // Skip if we haven't seen an H2 yet
    if (!current) continue;

    // List item: "- [priority] instruction" or "- instruction"
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (!listMatch) continue;

    let itemText = listMatch[1].trim();
    let priority: "high" | "medium" | "low" = "medium";

    // Check for priority tag
    const priorityMatch = itemText.match(
      /^\[(high|medium|low)\]\s+(.+)$/i
    );
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase() as "high" | "medium" | "low";
      itemText = priorityMatch[2].trim();
    }

    itemCounter++;
    current.checklist.push({
      id: `hb-${itemCounter}`,
      instruction: itemText,
      priority,
    });
  }

  // Don't forget the last spec
  if (current) specs.push(current);

  return specs;
}

/**
 * Reconcile file-defined heartbeat schedules against existing DB schedules.
 *
 * - Creates new schedules for specs not found in DB (by name match)
 * - Updates existing schedules whose checklist or expression changed
 * - Pauses DB schedules that are no longer in the file
 *
 * @returns Summary of changes made
 */
export async function reconcileHeartbeats(
  specs: HeartbeatFileSpec[],
  projectId: string | null
): Promise<{ created: number; updated: number; paused: number }> {
  const result = { created: 0, updated: 0, paused: 0 };

  // Fetch existing heartbeat schedules for this project
  const conditions = [eq(schedules.type, "heartbeat")];
  if (projectId) {
    conditions.push(eq(schedules.projectId, projectId));
  }

  const existing = await db
    .select()
    .from(schedules)
    .where(and(...conditions));

  const existingByName = new Map(existing.map((s) => [s.name, s]));
  const specNames = new Set(specs.map((s) => s.name));

  const now = new Date();

  for (const spec of specs) {
    // Resolve the expression to cron
    let cronExpression: string;
    const nlResult = parseNaturalLanguage(spec.expression);
    if (nlResult) {
      cronExpression = nlResult.cronExpression;
    } else {
      try {
        cronExpression = parseInterval(spec.expression);
      } catch {
        // Skip specs we can't parse
        continue;
      }
    }

    const checklistJson = JSON.stringify(spec.checklist);
    const match = existingByName.get(spec.name);

    if (match) {
      // Check if anything changed
      const existingChecklist = match.heartbeatChecklist ?? "[]";
      if (
        existingChecklist !== checklistJson ||
        match.cronExpression !== cronExpression
      ) {
        const updates: Record<string, unknown> = {
          heartbeatChecklist: checklistJson,
          cronExpression,
          updatedAt: now,
        };
        if (match.status === "active") {
          updates.nextFireAt = computeNextFireTime(cronExpression, now);
        }
        await db
          .update(schedules)
          .set(updates)
          .where(eq(schedules.id, match.id));
        result.updated++;
      }
    } else {
      // Create new heartbeat schedule
      const id = crypto.randomUUID();
      await db.insert(schedules).values({
        id,
        name: spec.name,
        prompt: `Heartbeat check: ${spec.name}`,
        cronExpression,
        projectId: projectId ?? null,
        assignedAgent: null,
        agentProfile: null,
        recurs: true,
        status: "active",
        maxFirings: null,
        firingCount: 0,
        expiresAt: null,
        nextFireAt: computeNextFireTime(cronExpression, now),
        type: "heartbeat",
        heartbeatChecklist: checklistJson,
        activeHoursStart: null,
        activeHoursEnd: null,
        activeTimezone: "UTC",
        suppressionCount: 0,
        lastActionAt: null,
        heartbeatBudgetPerDay: null,
        heartbeatSpentToday: 0,
        heartbeatBudgetResetAt: null,
        createdAt: now,
        updatedAt: now,
      });
      result.created++;
    }
  }

  // Pause heartbeat schedules that are no longer in the file
  for (const [name, schedule] of existingByName) {
    if (!specNames.has(name) && schedule.status === "active") {
      await db
        .update(schedules)
        .set({ status: "paused", nextFireAt: null, updatedAt: now })
        .where(eq(schedules.id, schedule.id));
      result.paused++;
    }
  }

  return result;
}
