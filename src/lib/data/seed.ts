import { db } from "@/lib/db";
import {
  projects,
  tasks,
  workflows,
  documents,
  agentLogs,
  notifications,
  schedules,
  conversations,
  chatMessages,
  learnedContext,
  views,
  profileTestResults,
  repoImports,
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
import { createUsageLedgerSeeds } from "./seed-data/usage-ledger";
import { recordUsageLedgerEntry } from "@/lib/usage/ledger";
import { createConversations } from "./seed-data/conversations";
import { createLearnedContext } from "./seed-data/learned-context";
import { createViews } from "./seed-data/views";
import { createProfileTestResults } from "./seed-data/profile-test-results";
import { createRepoImports } from "./seed-data/repo-imports";
import { createUserTables } from "./seed-data/user-tables";
import { createTable, addRows } from "@/lib/data/tables";

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

  // 4. Insert workflows BEFORE tasks (tasks reference workflowId)
  const workflowSeeds = createWorkflows(projectIds);
  for (const w of workflowSeeds) {
    db.insert(workflows).values(w).run();
  }
  const workflowIds = workflowSeeds.map((w) => w.id);

  // 5. Insert schedules BEFORE tasks (tasks reference scheduleId)
  const scheduleSeeds = createSchedules(projectIds);
  for (const schedule of scheduleSeeds) {
    db.insert(schedules).values(schedule).run();
  }
  const scheduleIds = scheduleSeeds.map((s) => s.id);

  // 6. Insert tasks (with workflow/schedule/profile references)
  const taskSeeds = createTasks(projectIds, workflowIds, scheduleIds);
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
        agentProfile: t.agentProfile,
        sourceType: t.sourceType,
        workflowId: t.workflowId,
        scheduleId: t.scheduleId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })
      .run();
  }
  const taskIds = taskSeeds.map((t) => t.id);

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

  // 11. Insert normalized usage ledger rows for governance and analytics surfaces
  const usageSeeds = createUsageLedgerSeeds({
    tasks: taskSeeds,
    workflows: workflowSeeds,
    schedules: scheduleSeeds,
  });
  for (const seed of usageSeeds) {
    await recordUsageLedgerEntry(seed);
  }

  // 12. Insert conversations and chat messages
  const { conversations: convSeeds, messages: msgSeeds } =
    createConversations(projectIds);
  for (const c of convSeeds) {
    db.insert(conversations).values(c).run();
  }
  for (const m of msgSeeds) {
    db.insert(chatMessages).values(m).run();
  }

  // 13. Insert learned context entries
  const learnedContextSeeds = createLearnedContext(completedTaskIds);
  for (const lc of learnedContextSeeds) {
    db.insert(learnedContext).values(lc).run();
  }

  // 14. Insert saved views
  const viewSeeds = createViews();
  for (const v of viewSeeds) {
    db.insert(views).values(v).run();
  }

  // 15. Insert profile test results
  const testResultSeeds = createProfileTestResults();
  for (const tr of testResultSeeds) {
    db.insert(profileTestResults).values(tr).run();
  }

  // 16. Insert repo import records
  const repoImportSeeds = createRepoImports();
  for (const ri of repoImportSeeds) {
    db.insert(repoImports).values(ri).run();
  }

  // 17. Insert user-created tables with columns and rows
  const userTableSeeds = createUserTables(projectIds);
  let totalTableRows = 0;
  for (const tableSeed of userTableSeeds) {
    await createTable({
      name: tableSeed.name,
      description: tableSeed.description,
      projectId: tableSeed.projectId,
      source: tableSeed.source,
      columns: tableSeed.columns.map((col, i) => ({
        name: col.name,
        displayName: col.displayName,
        dataType: col.dataType,
        position: i,
        required: col.required ?? false,
        config: col.config ?? undefined,
      })),
    });
    // createTable generates its own ID; retrieve it by name+project
    const { listTables } = await import("@/lib/data/tables");
    const tables = await listTables({ projectId: tableSeed.projectId });
    const created = tables.find((t) => t.name === tableSeed.name);
    if (created && tableSeed.rows.length > 0) {
      await addRows(
        created.id,
        tableSeed.rows.map((data) => ({ data }))
      );
      totalTableRows += tableSeed.rows.length;
    }
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
    usageLedger: usageSeeds.length,
    conversations: convSeeds.length,
    chatMessages: msgSeeds.length,
    learnedContext: learnedContextSeeds.length,
    views: viewSeeds.length,
    profileTestResults: testResultSeeds.length,
    repoImports: repoImportSeeds.length,
    userTables: userTableSeeds.length,
    userTableRows: totalTableRows,
  };
}
