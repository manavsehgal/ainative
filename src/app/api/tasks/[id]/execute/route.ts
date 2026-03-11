import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { executeTaskWithAgent, classifyTaskProfile } from "@/lib/agents/router";
import { DEFAULT_AGENT_RUNTIME } from "@/lib/agents/runtime/catalog";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Atomic check-and-claim: only one request can transition queued → running
  const claimed = db
    .update(tasks)
    .set({ status: "running", updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.status, "queued")))
    .returning()
    .all();

  if (claimed.length === 0) {
    // Either not found or not in queued status
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Task must be queued to execute, current status: ${task.status}` },
      { status: 400 }
    );
  }

  const task = claimed[0];

  // Auto-classify profile if none was set
  if (!task.agentProfile) {
    const autoProfile = classifyTaskProfile(task.title, task.description);
    db.update(tasks)
      .set({ agentProfile: autoProfile, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .run();
  }

  // Fire-and-forget — task already marked as running
  executeTaskWithAgent(id, task.assignedAgent ?? DEFAULT_AGENT_RUNTIME).catch(
    (err) => console.error(`Task ${id} execution error:`, err)
  );

  return NextResponse.json({ message: "Execution started" }, { status: 202 });
}
