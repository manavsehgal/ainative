import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface SweepProposal {
  title: string;
  description: string;
  priority: number;
  suggestedProfile?: string;
}

/**
 * Process the result of a sweep task — parse the JSON output and create
 * improvement tasks in the database.
 */
export async function processSweepResult(taskId: string): Promise<void> {
  const [task] = await db
    .select({ result: tasks.result, projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!task?.result) return;

  // Try to extract JSON array from the result
  let proposals: SweepProposal[];
  try {
    // The result might have surrounding text — try to find JSON array
    const jsonMatch = task.result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;
    proposals = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[sweep] Failed to parse sweep result as JSON");
    return;
  }

  if (!Array.isArray(proposals) || proposals.length === 0) return;

  // Create improvement tasks
  const now = new Date();
  const values = proposals
    .filter(
      (p) =>
        p && typeof p.title === "string" && typeof p.description === "string"
    )
    .slice(0, 10) // Cap at 10 tasks
    .map((proposal) => ({
      id: crypto.randomUUID(),
      projectId: task.projectId,
      title: proposal.title.slice(0, 200),
      description: `[Sweep-generated] ${proposal.description}`,
      status: "planned" as const,
      priority: Math.min(Math.max(proposal.priority ?? 3, 1), 4),
      agentProfile: proposal.suggestedProfile ?? "general",
      resumeCount: 0,
      createdAt: now,
      updatedAt: now,
    }));

  if (values.length > 0) {
    await db.insert(tasks).values(values);
    console.log(
      `[sweep] Created ${values.length} improvement tasks from sweep ${taskId}`
    );
  }
}
