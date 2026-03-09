import { db } from "@/lib/db";
import {
  agentLogs,
  notifications,
  documents,
  tasks,
  workflows,
  projects,
} from "@/lib/db/schema";
import { readdirSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const uploadsDir = join(
  process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent"),
  "uploads"
);

/**
 * Wipe all data tables (FK-safe order) and uploaded files.
 * Preserves the settings table (auth config).
 */
export function clearAllData() {
  // Delete in FK-safe order: children before parents
  const logsDeleted = db.delete(agentLogs).run().changes;
  const notificationsDeleted = db.delete(notifications).run().changes;
  const documentsDeleted = db.delete(documents).run().changes;
  const tasksDeleted = db.delete(tasks).run().changes;
  const workflowsDeleted = db.delete(workflows).run().changes;
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
    projects: projectsDeleted,
    tasks: tasksDeleted,
    workflows: workflowsDeleted,
    agentLogs: logsDeleted,
    notifications: notificationsDeleted,
    documents: documentsDeleted,
    files: filesDeleted,
  };
}
