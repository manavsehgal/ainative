import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, projects, schedules, settings } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

interface Milestone {
  id: string;
  label: string;
  completed: boolean;
}

/**
 * GET /api/onboarding/progress
 * Returns 6 milestones computed from existing DB data.
 */
export async function GET() {
  const taskCount = db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .get()?.count ?? 0;

  const completedTaskCount = db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.status, "completed"))
    .get()?.count ?? 0;

  const projectCount = db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .get()?.count ?? 0;

  const scheduleCount = db
    .select({ count: sql<number>`count(*)` })
    .from(schedules)
    .get()?.count ?? 0;

  const hasBudgetConfig = db
    .select({ count: sql<number>`count(*)` })
    .from(settings)
    .where(eq(settings.key, "usage.budgetPolicy"))
    .get()?.count ?? 0;

  const milestones: Milestone[] = [
    { id: "create-task", label: "Create a task", completed: taskCount > 0 },
    { id: "complete-task", label: "Run a task to completion", completed: completedTaskCount > 0 },
    { id: "create-project", label: "Create a project", completed: projectCount > 0 },
    { id: "create-schedule", label: "Schedule a workflow", completed: scheduleCount > 0 },
    { id: "run-three", label: "Run 3 tasks", completed: completedTaskCount >= 3 },
    { id: "configure-budget", label: "Configure a budget", completed: hasBudgetConfig > 0 },
  ];

  const completedCount = milestones.filter((m) => m.completed).length;

  return NextResponse.json({
    milestones,
    completedCount,
    totalCount: milestones.length,
  });
}
