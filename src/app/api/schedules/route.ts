import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseInterval, computeNextFireTime } from "@/lib/schedules/interval-parser";
import { parseNaturalLanguage } from "@/lib/schedules/nlp-parser";
import { resolveAgentRuntime } from "@/lib/agents/runtime/catalog";
import { validateRuntimeProfileAssignment } from "@/lib/agents/profiles/assignment-validation";

export async function GET() {
  const result = await db
    .select()
    .from(schedules)
    .orderBy(desc(schedules.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    prompt,
    interval,
    projectId,
    assignedAgent,
    agentProfile,
    recurs,
    maxFirings,
    expiresInHours,
    type,
    heartbeatChecklist,
    activeHoursStart,
    activeHoursEnd,
    activeTimezone,
    heartbeatBudgetPerDay,
  } =
    body as {
      name?: string;
      prompt?: string;
      interval?: string;
      projectId?: string;
      assignedAgent?: string;
      agentProfile?: string;
      recurs?: boolean;
      maxFirings?: number;
      expiresInHours?: number;
      type?: "scheduled" | "heartbeat";
      heartbeatChecklist?: Array<{ id: string; instruction: string; priority: string }>;
      activeHoursStart?: number;
      activeHoursEnd?: number;
      activeTimezone?: string;
      heartbeatBudgetPerDay?: number;
    };

  const scheduleType = type ?? "scheduled";

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!interval?.trim()) {
    return NextResponse.json({ error: "Interval is required" }, { status: 400 });
  }

  // Heartbeat-specific validation
  if (scheduleType === "heartbeat") {
    if (!heartbeatChecklist || heartbeatChecklist.length === 0) {
      return NextResponse.json(
        { error: "Heartbeat schedules require at least one checklist item" },
        { status: 400 }
      );
    }
    if (activeHoursStart !== undefined && (activeHoursStart < 0 || activeHoursStart > 23)) {
      return NextResponse.json(
        { error: "Active hours start must be 0-23" },
        { status: 400 }
      );
    }
    if (activeHoursEnd !== undefined && (activeHoursEnd < 0 || activeHoursEnd > 23)) {
      return NextResponse.json(
        { error: "Active hours end must be 0-23" },
        { status: 400 }
      );
    }
  }

  // For heartbeat type, prompt is optional (auto-generated from checklist)
  if (scheduleType === "scheduled" && !prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  // Parse interval into cron expression — try NLP first, then shorthand/cron
  let cronExpression: string;
  const nlResult = parseNaturalLanguage(interval);
  if (nlResult) {
    cronExpression = nlResult.cronExpression;
  } else {
    try {
      cronExpression = parseInterval(interval);
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 400 }
      );
    }
  }

  if (assignedAgent !== undefined && assignedAgent !== null && assignedAgent !== "") {
    try {
      resolveAgentRuntime(assignedAgent);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 }
      );
    }
  }

  const compatibilityError = validateRuntimeProfileAssignment({
    profileId: agentProfile,
    runtimeId: assignedAgent,
    context: "Schedule profile",
  });
  if (compatibilityError) {
    return NextResponse.json({ error: compatibilityError }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const nextFireAt = computeNextFireTime(cronExpression, now);
  const shouldRecur = recurs !== false; // default to true

  const expiresAt = expiresInHours
    ? new Date(now.getTime() + expiresInHours * 60 * 60 * 1000)
    : null;

  // For heartbeat schedules, use a placeholder prompt (actual prompt is built at runtime from checklist)
  const effectivePrompt = scheduleType === "heartbeat"
    ? (prompt?.trim() || `Heartbeat check: ${name?.trim()}`)
    : prompt!.trim();

  await db.insert(schedules).values({
    id,
    name: name.trim(),
    prompt: effectivePrompt,
    cronExpression,
    projectId: projectId || null,
    assignedAgent: assignedAgent || null,
    agentProfile: agentProfile || null,
    recurs: shouldRecur,
    status: "active",
    maxFirings: maxFirings ?? null,
    firingCount: 0,
    expiresAt,
    nextFireAt,
    type: scheduleType,
    heartbeatChecklist: heartbeatChecklist ? JSON.stringify(heartbeatChecklist) : null,
    activeHoursStart: activeHoursStart ?? null,
    activeHoursEnd: activeHoursEnd ?? null,
    activeTimezone: activeTimezone ?? "UTC",
    suppressionCount: 0,
    lastActionAt: null,
    heartbeatBudgetPerDay: heartbeatBudgetPerDay ?? null,
    heartbeatSpentToday: 0,
    heartbeatBudgetResetAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id));

  return NextResponse.json(created, { status: 201 });
}
