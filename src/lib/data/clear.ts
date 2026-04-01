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
  channelConfigs,
  agentMessages,
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
 * Preserves the settings table (auth config).
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

  // Chat tables (messages before conversations — FK safety)
  const chatMessagesDeleted = db.delete(chatMessages).run().changes;
  const conversationsDeleted = db.delete(conversations).run().changes;

  // Book tables (no FK dependencies)
  const bookmarksDeleted = db.delete(bookmarks).run().changes;
  const readingProgressDeleted = db.delete(readingProgress).run().changes;

  // Agent messages reference tasks — delete before tasks
  const agentMessagesDeleted = db.delete(agentMessages).run().changes;
  const channelConfigsDeleted = db.delete(channelConfigs).run().changes;

  const repoImportsDeleted = db.delete(repoImports).run().changes;
  const profileTestResultsDeleted = db.delete(profileTestResults).run().changes;
  const viewsDeleted = db.delete(views).run().changes;
  const usageLedgerDeleted = db.delete(usageLedger).run().changes;
  const logsDeleted = db.delete(agentLogs).run().changes;
  const notificationsDeleted = db.delete(notifications).run().changes;
  const documentsDeleted = db.delete(documents).run().changes;
  const agentMemoryDeleted = db.delete(agentMemory).run().changes;
  const learnedContextDeleted = db.delete(learnedContext).run().changes;
  const tasksDeleted = db.delete(tasks).run().changes;
  const workflowsDeleted = db.delete(workflows).run().changes;
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
    channelConfigs: channelConfigsDeleted,
    files: filesDeleted,
    screenshots: screenshotsDeleted,
  };
}
