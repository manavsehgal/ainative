import { db } from "@/lib/db";
import {
  agentLogs,
  notifications,
  documents,
  learnedContext,
  agentMemory,
  tasks,
  workflows,
  schedules,
  projects,
  usageLedger,
  views,
  environmentSyncOps,
  environmentCheckpoints,
  environmentArtifacts,
  environmentScans,
  environmentTemplates,
  chatMessages,
  conversations,
  readingProgress,
  bookmarks,
  profileTestResults,
  repoImports,
  channelBindings,
  channelConfigs,
  agentMessages,
  workflowDocumentInputs,
  scheduleDocumentInputs,
  projectDocumentDefaults,
  userTables,
  userTableColumns,
  userTableRows,
  userTableViews,
  userTableRelationships,
  userTableImports,
  userTableTemplates,
  userTableTriggers,
  userTableRowHistory,
  tableDocumentInputs,
  taskTableInputs,
  workflowTableInputs,
  scheduleTableInputs,
  workflowExecutionStats,
  scheduleFiringMetrics,
} from "@/lib/db/schema";
import { readdirSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { clearSampleProfiles } from "./seed-data/profiles";

const dataDir = process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent");
const uploadsDir = join(dataDir, "uploads");
const screenshotsDir = join(dataDir, "screenshots");

/**
 * Wipe all data tables (FK-safe order) and uploaded files.
 * Preserves the settings table (auth config) and the license table
 * (paid tier activation) — clearing operational data should never
 * silently downgrade a paid instance back to community.
 */
export function clearAllData() {
  const sampleProfilesDeleted = clearSampleProfiles();

  // Delete in FK-safe order: children before parents
  // Environment tables (sync_ops → checkpoints → artifacts → scans)
  const envSyncOpsDeleted = db.delete(environmentSyncOps).run().changes;
  const envCheckpointsDeleted = db.delete(environmentCheckpoints).run().changes;
  const envArtifactsDeleted = db.delete(environmentArtifacts).run().changes;
  const envScansDeleted = db.delete(environmentScans).run().changes;
  const envTemplatesDeleted = db.delete(environmentTemplates).run().changes;

  // Document junction tables — delete before documents (they reference documents).
  // Also referenced by projects/workflows/schedules, deleted later.
  const workflowDocInputsDeleted = db.delete(workflowDocumentInputs).run().changes;
  const scheduleDocInputsDeleted = db.delete(scheduleDocumentInputs).run().changes;
  const projectDocDefaultsDeleted = db.delete(projectDocumentDefaults).run().changes;

  // Documents reference conversations (documents.conversation_id) — must delete
  // before conversations to avoid FK violation when chat-attached documents exist.
  const documentsDeleted = db.delete(documents).run().changes;

  // Chat tables: channel_bindings + chat_messages + documents all reference
  // conversations — delete them before conversations.
  const channelBindingsDeleted = db.delete(channelBindings).run().changes;
  const chatMessagesDeleted = db.delete(chatMessages).run().changes;
  const conversationsDeleted = db.delete(conversations).run().changes;

  // Book tables (no FK dependencies)
  const bookmarksDeleted = db.delete(bookmarks).run().changes;
  const readingProgressDeleted = db.delete(readingProgress).run().changes;

  // Agent messages reference tasks — delete before tasks
  const agentMessagesDeleted = db.delete(agentMessages).run().changes;
  const channelConfigsDeleted = db.delete(channelConfigs).run().changes;

  // License table is intentionally preserved — clearing operational data
  // should never downgrade a paid instance back to community tier.

  // Snapshots are intentionally preserved — they are backups, not working data

  const repoImportsDeleted = db.delete(repoImports).run().changes;
  const profileTestResultsDeleted = db.delete(profileTestResults).run().changes;
  const viewsDeleted = db.delete(views).run().changes;
  const usageLedgerDeleted = db.delete(usageLedger).run().changes;
  const logsDeleted = db.delete(agentLogs).run().changes;
  const notificationsDeleted = db.delete(notifications).run().changes;

  // Table junction tables — delete before user_tables, tasks, workflows, schedules
  const tableDocInputsDeleted = db.delete(tableDocumentInputs).run().changes;
  const taskTableInputsDeleted = db.delete(taskTableInputs).run().changes;
  const workflowTableInputsDeleted = db.delete(workflowTableInputs).run().changes;
  const scheduleTableInputsDeleted = db.delete(scheduleTableInputs).run().changes;

  // Table children — delete before user_tables
  const userTableImportsDeleted = db.delete(userTableImports).run().changes;
  const userTableViewsDeleted = db.delete(userTableViews).run().changes;
  const userTableRelationshipsDeleted = db.delete(userTableRelationships).run().changes;
  const userTableRowsDeleted = db.delete(userTableRows).run().changes;
  const userTableRowHistoryDeleted = db.delete(userTableRowHistory).run().changes;
  const userTableTriggersDeleted = db.delete(userTableTriggers).run().changes;
  const userTableColumnsDeleted = db.delete(userTableColumns).run().changes;
  const userTablesDeleted = db.delete(userTables).run().changes;
  const userTableTemplatesDeleted = db.delete(userTableTemplates).run().changes;

  const agentMemoryDeleted = db.delete(agentMemory).run().changes;
  const learnedContextDeleted = db.delete(learnedContext).run().changes;
  const executionStatsDeleted = db.delete(workflowExecutionStats).run().changes;
  const tasksDeleted = db.delete(tasks).run().changes;
  const workflowsDeleted = db.delete(workflows).run().changes;
  const scheduleFiringMetricsDeleted = db.delete(scheduleFiringMetrics).run().changes;
  const schedulesDeleted = db.delete(schedules).run().changes;
  const projectsDeleted = db.delete(projects).run().changes;

  // Wipe uploaded files
  let filesDeleted = 0;
  mkdirSync(uploadsDir, { recursive: true });
  try {
    for (const file of readdirSync(uploadsDir)) {
      unlinkSync(join(uploadsDir, file));
      filesDeleted++;
    }
  } catch {
    // Directory may not exist yet — that's fine
  }

  // Wipe screenshot files
  let screenshotsDeleted = 0;
  try {
    mkdirSync(screenshotsDir, { recursive: true });
    for (const file of readdirSync(screenshotsDir)) {
      unlinkSync(join(screenshotsDir, file));
      screenshotsDeleted++;
    }
  } catch {
    // Directory may not exist yet — that's fine
  }

  return {
    sampleProfiles: sampleProfilesDeleted,
    views: viewsDeleted,
    projects: projectsDeleted,
    tasks: tasksDeleted,
    workflows: workflowsDeleted,
    scheduleFiringMetrics: scheduleFiringMetricsDeleted,
    schedules: schedulesDeleted,
    usageLedger: usageLedgerDeleted,
    agentLogs: logsDeleted,
    notifications: notificationsDeleted,
    documents: documentsDeleted,
    agentMemory: agentMemoryDeleted,
    learnedContext: learnedContextDeleted,
    environmentSyncOps: envSyncOpsDeleted,
    environmentCheckpoints: envCheckpointsDeleted,
    environmentArtifacts: envArtifactsDeleted,
    environmentScans: envScansDeleted,
    environmentTemplates: envTemplatesDeleted,
    chatMessages: chatMessagesDeleted,
    conversations: conversationsDeleted,
    bookmarks: bookmarksDeleted,
    readingProgress: readingProgressDeleted,
    repoImports: repoImportsDeleted,
    profileTestResults: profileTestResultsDeleted,
    agentMessages: agentMessagesDeleted,
    channelBindings: channelBindingsDeleted,
    channelConfigs: channelConfigsDeleted,
    workflowDocumentInputs: workflowDocInputsDeleted,
    scheduleDocumentInputs: scheduleDocInputsDeleted,
    projectDocumentDefaults: projectDocDefaultsDeleted,
    userTables: userTablesDeleted,
    userTableColumns: userTableColumnsDeleted,
    userTableRows: userTableRowsDeleted,
    userTableViews: userTableViewsDeleted,
    userTableRelationships: userTableRelationshipsDeleted,
    userTableImports: userTableImportsDeleted,
    userTableTemplates: userTableTemplatesDeleted,
    userTableTriggers: userTableTriggersDeleted,
    userTableRowHistory: userTableRowHistoryDeleted,
    tableDocumentInputs: tableDocInputsDeleted,
    taskTableInputs: taskTableInputsDeleted,
    workflowTableInputs: workflowTableInputsDeleted,
    scheduleTableInputs: scheduleTableInputsDeleted,
    files: filesDeleted,
    screenshots: screenshotsDeleted,
    workflowExecutionStats: executionStatsDeleted,
  };
}
