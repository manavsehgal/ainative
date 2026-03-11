import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseInterval, computeNextFireTime } from "@/lib/schedules/interval-parser";
import { resolveAgentRuntime } from "@/lib/agents/runtime/catalog";

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
    };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!interval?.trim()) {
    return NextResponse.json({ error: "Interval is required" }, { status: 400 });
  }

  // Parse interval into cron expression
  let cronExpression: string;
  try {
    cronExpression = parseInterval(interval);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
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

  const id = crypto.randomUUID();
  const now = new Date();
  const nextFireAt = computeNextFireTime(cronExpression, now);
  const shouldRecur = recurs !== false; // default to true

  const expiresAt = expiresInHours
    ? new Date(now.getTime() + expiresInHours * 60 * 60 * 1000)
    : null;

  await db.insert(schedules).values({
    id,
    name: name.trim(),
    prompt: prompt.trim(),
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
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id));

  return NextResponse.json(created, { status: 201 });
}
