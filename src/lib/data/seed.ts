import { db } from "@/lib/db";
import {
  projects,
  tasks,
  workflows,
  documents,
  agentLogs,
  notifications,
  schedules,
} from "@/lib/db/schema";
import { clearAllData } from "./clear";
import { createProjects } from "./seed-data/projects";
import { createTasks } from "./seed-data/tasks";
import { createWorkflows } from "./seed-data/workflows";
import { createDocuments } from "./seed-data/documents";
import { createLogs } from "./seed-data/logs";
import { createNotifications } from "./seed-data/notifications";
import { createSchedules } from "./seed-data/schedules";
import { upsertSampleProfiles } from "./seed-data/profiles";
import { processDocument } from "@/lib/documents/processor";

/**
 * Clear all data, then seed with realistic sample data.
 * Returns counts of seeded entities.
 */
export async function seedSampleData() {
  // 1. Clear everything first
  clearAllData();

  // 2. Seed sample custom profiles used by the newer profiles/schedules flows
  const profileCount = upsertSampleProfiles();

  // 3. Insert projects
  const projectSeeds = createProjects();
  for (const p of projectSeeds) {
    db.insert(projects).values(p).run();
  }
  const projectIds = projectSeeds.map((p) => p.id);

  // 4. Insert tasks
  const taskSeeds = createTasks(projectIds);
  for (const t of taskSeeds) {
    db.insert(tasks)
      .values({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        result: t.result,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })
      .run();
  }
  const taskIds = taskSeeds.map((t) => t.id);

  // 5. Insert workflows (one per project)
  const workflowSeeds = createWorkflows(projectIds);
  for (const w of workflowSeeds) {
    db.insert(workflows).values(w).run();
  }

  // 6. Insert schedules for recently added automation surfaces
  const scheduleSeeds = createSchedules(projectIds);
  for (const schedule of scheduleSeeds) {
    db.insert(schedules).values(schedule).run();
  }

  // 7. Write document files + insert records
  const docSeeds = await createDocuments(projectIds, taskIds);
  for (const d of docSeeds) {
    db.insert(documents).values(d).run();
  }

  // 8. Process all documents (text extraction)
  await Promise.all(docSeeds.map((d) => processDocument(d.id)));

  // 9. Insert agent logs
  const completedTaskIds = taskSeeds
    .filter((t) => t.status === "completed")
    .map((t) => t.id);
  const failedTaskIds = taskSeeds
    .filter((t) => t.status === "failed")
    .map((t) => t.id);
  const runningTaskIds = taskSeeds
    .filter((t) => t.status === "running")
    .map((t) => t.id);

  const logSeeds = createLogs({
    completed: completedTaskIds,
    failed: failedTaskIds,
    running: runningTaskIds,
  });
  for (const l of logSeeds) {
    db.insert(agentLogs).values(l).run();
  }

  // 10. Insert notifications
  const notifSeeds = createNotifications(taskIds);
  for (const n of notifSeeds) {
    db.insert(notifications).values(n).run();
  }

  return {
    profiles: profileCount,
    projects: projectSeeds.length,
    tasks: taskSeeds.length,
    workflows: workflowSeeds.length,
    schedules: scheduleSeeds.length,
    documents: docSeeds.length,
    agentLogs: logSeeds.length,
    notifications: notifSeeds.length,
  };
}
