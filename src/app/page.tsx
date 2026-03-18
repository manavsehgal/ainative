import { db } from "@/lib/db";
import { tasks, projects, agentLogs, notifications, workflows } from "@/lib/db/schema";
import { eq, count, gte, and, desc, sql, inArray } from "drizzle-orm";
import { parseWorkflowState } from "@/lib/workflows/engine";
import { Greeting } from "@/components/dashboard/greeting";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { PriorityQueue } from "@/components/dashboard/priority-queue";
import type { PriorityTask } from "@/components/dashboard/priority-queue";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import type { ActivityEntry } from "@/components/dashboard/activity-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentProjects } from "@/components/dashboard/recent-projects";
import type { RecentProject } from "@/components/dashboard/recent-projects";
import {
  getCompletionsByDay,
  getTaskCreationsByDay,
  getActiveProjectActivityByDay,
  getAgentActivityByHour,
  getNotificationsByDay,
} from "@/lib/queries/chart-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Run all DB queries in parallel
  const [
    [runningResult],
    [failedResult],
    [completedTodayResult],
    [completedAllTimeResult],
    [awaitingResult],
    [activeProjectsResult],
    priorityTasks,
    activeWorkflows,
    recentLogs,
    allProjects,
    recentActiveProjects,
    completionsByDay,
    taskCreationsByDay,
    projectCreationsByDay,
    agentActivityByHour,
    notificationsByDay,
  ] = await Promise.all([
    db.select({ count: count() }).from(tasks).where(eq(tasks.status, "running")),
    db.select({ count: count() }).from(tasks).where(eq(tasks.status, "failed")),
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.status, "completed"), gte(tasks.updatedAt, today))
    ),
    db.select({ count: count() }).from(tasks).where(eq(tasks.status, "completed")),
    db.select({ count: count() }).from(notifications).where(
      and(
        eq(notifications.read, false),
        inArray(notifications.type, [
          "permission_required",
          "agent_message",
          "budget_alert",
        ])
      )
    ),
    db.select({ count: count() }).from(projects).where(eq(projects.status, "active")),
    // Priority queue: failed + running tasks, sorted by priority
    db.select().from(tasks).where(
      inArray(tasks.status, ["failed", "running", "queued"])
    ).orderBy(tasks.priority, desc(tasks.updatedAt)).limit(5),
    // Active/failed workflows for priority queue
    db.select().from(workflows).where(
      inArray(workflows.status, ["active", "failed"])
    ).orderBy(desc(workflows.updatedAt)).limit(5),
    // Recent agent logs
    db.select().from(agentLogs).orderBy(desc(agentLogs.timestamp)).limit(6),
    // All projects for quick actions
    db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(projects.name),
    // Recent active projects with task counts
    db.select({
      id: projects.id,
      name: projects.name,
    }).from(projects)
      .where(eq(projects.status, "active"))
      .orderBy(desc(projects.updatedAt))
      .limit(3),
    // Chart data queries
    getCompletionsByDay(7),
    getTaskCreationsByDay(7),
    getActiveProjectActivityByDay(7),
    getAgentActivityByHour(),
    getNotificationsByDay(7),
  ]);

  // Build project name lookup for priority tasks
  const projectMap = new Map(allProjects.map((p) => [p.id, p.name]));

  // Serialize priority tasks (no more workflow linkage via parent task)
  const serializedPriorityTasks: PriorityTask[] = priorityTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    projectName: t.projectId ? projectMap.get(t.projectId) ?? undefined : undefined,
  }));

  // Build workflow priority items directly
  const workflowPriorityItems: PriorityTask[] = activeWorkflows.map((w) => {
    let workflowProgress: PriorityTask["workflowProgress"];

    try {
      const { definition: def, state } = parseWorkflowState(w.definition);
      if (state && def.steps) {
        const completed = state.stepStates.filter((s) => s.status === "completed").length;
        const running = state.stepStates.find((s) => s.status === "running");
        const runningStep = running
          ? def.steps.find((step) => step.id === running.stepId)
          : undefined;
        workflowProgress = {
          current: completed,
          total: def.steps.length,
          currentStepName: runningStep?.name,
          workflowId: w.id,
          workflowStatus: w.status,
        };
      }
    } catch { /* skip parse errors */ }

    return {
      id: w.id,
      title: w.name,
      status: w.status === "active" ? "running" : w.status,
      priority: 1, // Workflows always high priority in the attention queue
      projectName: w.projectId ? projectMap.get(w.projectId) ?? undefined : undefined,
      workflowProgress,
      isWorkflow: true,
    };
  });

  // Merge and limit to 5 items total
  const allPriorityItems = [...workflowPriorityItems, ...serializedPriorityTasks].slice(0, 5);

  // Get task titles for log entries
  const logTaskIds = [...new Set(recentLogs.filter((l) => l.taskId).map((l) => l.taskId!))];
  const logTasks = logTaskIds.length > 0
    ? await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, logTaskIds))
    : [];
  const taskTitleMap = new Map(logTasks.map((t) => [t.id, t.title]));

  const serializedLogs: ActivityEntry[] = recentLogs.map((l) => ({
    id: l.id,
    event: l.event,
    payload: l.payload,
    timestamp: l.timestamp.toISOString(),
    taskTitle: l.taskId ? taskTitleMap.get(l.taskId) ?? undefined : undefined,
  }));

  // Get task counts per project for recent projects
  const recentProjectData: RecentProject[] = await Promise.all(
    recentActiveProjects.map(async (p) => {
      const [total] = await db.select({ count: count() }).from(tasks).where(eq(tasks.projectId, p.id));
      const [completed] = await db.select({ count: count() }).from(tasks).where(
        and(eq(tasks.projectId, p.id), eq(tasks.status, "completed"))
      );
      return {
        id: p.id,
        name: p.name,
        totalTasks: total.count,
        completedTasks: completed.count,
      };
    })
  );

  return (
    <div className="gradient-morning-sky min-h-screen p-4 sm:p-6">
      <div className="surface-page surface-page-shell min-h-[calc(100dvh-2rem)] rounded-[30px] p-5 sm:p-6 lg:p-7">
        <Greeting
          runningCount={runningResult.count}
          awaitingCount={awaitingResult.count}
          failedCount={failedResult.count}
        />
        <StatsCards
          runningCount={runningResult.count}
          completedToday={completedTodayResult.count}
          completedAllTime={completedAllTimeResult.count}
          awaitingReview={awaitingResult.count}
          activeProjects={activeProjectsResult.count}
          sparklines={{
            completions: completionsByDay,
            creations: taskCreationsByDay,
            projects: projectCreationsByDay,
            notifications: notificationsByDay,
          }}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 mb-6">
          <div className="lg:col-span-3">
            <PriorityQueue tasks={allPriorityItems} />
          </div>
          <div className="lg:col-span-2">
            <ActivityFeed entries={serializedLogs} hourlyActivity={agentActivityByHour} />
          </div>
        </div>
        <QuickActions />
        <RecentProjects projects={recentProjectData} />
      </div>
    </div>
  );
}
