import { db } from "@/lib/db";
import {
  tasks,
  workflows,
  documents,
  schedules,
  usageLedger,
  learnedContext,
  settings,
} from "@/lib/db/schema";
import { count, like, sql } from "drizzle-orm";
import type { AdoptionEntry } from "./types";

function toDepth(n: number): AdoptionEntry["depth"] {
  if (n === 0) return "none";
  if (n <= 3) return "light";
  return "deep";
}

function entry(n: number): AdoptionEntry {
  return { adopted: n > 0, depth: toDepth(n) };
}

/** Map each manifest section slug to DB evidence of adoption */
export async function getAdoptionMap(): Promise<Map<string, AdoptionEntry>> {
  const [
    taskCount,
    workflowCount,
    documentCount,
    scheduleCount,
    profileUsed,
    usageCount,
    learnedCount,
    permissionCount,
    providerCount,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(tasks)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(workflows)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(documents)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(schedules)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(tasks)
      .where(sql`${tasks.agentProfile} IS NOT NULL`)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(usageLedger)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(learnedContext)
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: count() })
      .from(settings)
      .where(like(settings.key, "permission:%"))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: sql<number>`COUNT(DISTINCT ${usageLedger.providerId})` })
      .from(usageLedger)
      .then((r) => Number(r[0]?.n ?? 0)),
  ]);

  const map = new Map<string, AdoptionEntry>();

  // Always adopted
  map.set("home-workspace", { adopted: true, depth: "deep" });
  map.set("settings", { adopted: true, depth: "deep" });

  // Feature sections
  map.set("dashboard-kanban", entry(taskCount));
  map.set("inbox-notifications", entry(taskCount)); // notifications come with tasks
  map.set("monitoring", entry(taskCount));
  map.set("projects", entry(taskCount)); // projects enable tasks
  map.set("workflows", entry(workflowCount));
  map.set("documents", entry(documentCount));
  map.set("profiles", entry(profileUsed));
  map.set("schedules", entry(scheduleCount));
  map.set("cost-usage", entry(usageCount));

  // Cross-cutting
  map.set(
    "provider-runtimes",
    providerCount > 1
      ? { adopted: true, depth: "deep" }
      : entry(usageCount > 0 ? 1 : 0)
  );
  map.set("agent-intelligence", entry(learnedCount));
  map.set("tool-permissions", entry(permissionCount));

  return map;
}
