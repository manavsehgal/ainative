import { db } from "@/lib/db";
import {
  agentLogs,
  notifications,
  documents,
  learnedContext,
  tasks,
  workflows,
  schedules,
  projects,
  usageLedger,
  views,
} from "@/lib/db/schema";
import { readdirSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { clearSampleProfiles } from "./seed-data/profiles";

const uploadsDir = join(
  process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent"),
  "uploads"
);

/**
 * Wipe all data tables (FK-safe order) and uploaded files.
 * Preserves the settings table (auth config).
 */
export function clearAllData() {
  const sampleProfilesDeleted = clearSampleProfiles();

  // Delete in FK-safe order: children before parents
  const viewsDeleted = db.delete(views).run().changes;
  const usageLedgerDeleted = db.delete(usageLedger).run().changes;
  const logsDeleted = db.delete(agentLogs).run().changes;
  const notificationsDeleted = db.delete(notifications).run().changes;
  const documentsDeleted = db.delete(documents).run().changes;
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
    learnedContext: learnedContextDeleted,
    files: filesDeleted,
  };
}
