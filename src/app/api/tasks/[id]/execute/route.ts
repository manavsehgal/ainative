import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeTaskWithAgent } from "@/lib/agents/router";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (task.status !== "queued") {
    return NextResponse.json(
      { error: `Task must be queued to execute, current status: ${task.status}` },
      { status: 400 }
    );
  }

  // Fire-and-forget
  executeTaskWithAgent(id, task.assignedAgent ?? "claude-code").catch(
    (err) => console.error(`Task ${id} execution error:`, err)
  );

  return NextResponse.json({ message: "Execution started" }, { status: 202 });
}
