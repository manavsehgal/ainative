import { db } from "@/lib/db";
import {
  tasks,
  projects,
  workflows,
  schedules,
  usageLedger,
} from "@/lib/db/schema";
import { count, isNotNull } from "drizzle-orm";
import type { UsageStage } from "./types";

/** Compute the user's usage stage from DB state */
export async function getUsageStage(): Promise<UsageStage> {
  const [taskCount, projectCount, workflowCount, scheduleCount, profileUsed] =
    await Promise.all([
      db
        .select({ n: count() })
        .from(tasks)
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: count() })
        .from(projects)
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: count() })
        .from(workflows)
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: count() })
        .from(schedules)
        .then((r) => r[0]?.n ?? 0),
      db
        .select({ n: count() })
        .from(tasks)
        .where(isNotNull(tasks.agentProfile))
        .then((r) => r[0]?.n ?? 0),
    ]);

  // Power: has workflows + schedules + profiles
  if (workflowCount > 0 && scheduleCount > 0 && profileUsed > 0) {
    return "power";
  }

  // Active: 6+ tasks OR 3+ projects OR any workflows/schedules
  if (
    taskCount >= 6 ||
    projectCount >= 3 ||
    workflowCount > 0 ||
    scheduleCount > 0
  ) {
    return "active";
  }

  // Early: 1-5 tasks, <=2 projects
  if (taskCount >= 1 || projectCount >= 1) {
    return "early";
  }

  return "new";
}
