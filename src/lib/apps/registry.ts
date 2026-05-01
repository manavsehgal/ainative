import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { getAinativeAppsDir } from "@/lib/utils/ainative-paths";

const AppArtifactRefSchema = z
  .object({
    id: z.string(),
    source: z.string().optional(),
  })
  .passthrough();

const AppTableRefSchema = z
  .object({
    id: z.string(),
    columns: z.array(z.string()).optional(),
    seed: z.string().optional(),
  })
  .passthrough();

const AppScheduleRefSchema = z
  .object({
    id: z.string(),
    cron: z.string().optional(),
    runs: z.string().optional(),
  })
  .passthrough();

export const AppManifestSchema = z
  .object({
    id: z.string(),
    version: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    persona: z.string().optional(),
    author: z.string().optional(),
    profiles: z.array(AppArtifactRefSchema).optional().default([]),
    blueprints: z.array(AppArtifactRefSchema).optional().default([]),
    tables: z.array(AppTableRefSchema).optional().default([]),
    schedules: z.array(AppScheduleRefSchema).optional().default([]),
    permissions: z
      .object({ preset: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type AppManifest = z.infer<typeof AppManifestSchema>;

export interface AppSummary {
  id: string;
  name: string;
  description: string | null;
  rootDir: string;
  primitivesSummary: string;
  profileCount: number;
  blueprintCount: number;
  tableCount: number;
  scheduleCount: number;
  scheduleHuman: string | null;
  createdAt: number;
  files: string[];
}

export interface AppDetail extends AppSummary {
  manifest: AppManifest;
}

export function parseAppManifest(yamlText: string): AppManifest | null {
  try {
    const parsed = yaml.load(yamlText);
    const result = AppManifestSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

const DOW: Record<string, string> = {
  "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
  "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday",
};

export function humanizeCron(cron: string): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;
  const h = Number.parseInt(hour, 10);
  const m = Number.parseInt(min, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
  if (dow !== "*" && DOW[dow]) return `${DOW[dow]} ${timeStr}`;
  if (dom === "*" && mon === "*") return `daily ${timeStr}`;
  return timeStr;
}

function pluralize(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

export function buildPrimitivesSummary(manifest: AppManifest): string {
  const parts: string[] = [];
  const profileCount = manifest.profiles.length;
  const blueprintCount = manifest.blueprints.length;
  const tableCount = manifest.tables.length;
  const scheduleCount = manifest.schedules.length;

  if (profileCount > 0) {
    parts.push(pluralize(profileCount, "Profile", "profiles"));
  }
  if (blueprintCount > 0) {
    parts.push(pluralize(blueprintCount, "Blueprint", "blueprints"));
  }
  if (tableCount > 0) {
    parts.push(pluralize(tableCount, "1 table", "tables"));
  }
  if (scheduleCount > 0) {
    const firstCron = manifest.schedules[0].cron;
    const human = firstCron ? humanizeCron(firstCron) : null;
    if (human) {
      parts.push(`${human} schedule`);
    } else {
      parts.push(pluralize(scheduleCount, "Schedule", "schedules"));
    }
  }
  return parts.join(" · ");
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function manifestToSummary(manifest: AppManifest, rootDir: string): AppSummary {
  const manifestPath = path.join(rootDir, "manifest.yaml");
  let createdAt = 0;
  try {
    createdAt = fs.statSync(manifestPath).mtimeMs;
  } catch {
    // leave 0
  }
  const firstCron = manifest.schedules[0]?.cron;
  const scheduleHuman = firstCron ? humanizeCron(firstCron) : null;
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description ?? null,
    rootDir,
    primitivesSummary: buildPrimitivesSummary(manifest),
    profileCount: manifest.profiles.length,
    blueprintCount: manifest.blueprints.length,
    tableCount: manifest.tables.length,
    scheduleCount: manifest.schedules.length,
    scheduleHuman,
    createdAt,
    files: collectFiles(rootDir).sort(),
  };
}

export function listApps(appsDir: string = getAinativeAppsDir()): AppSummary[] {
  if (!fs.existsSync(appsDir)) return [];
  const out: AppSummary[] = [];
  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rootDir = path.join(appsDir, entry.name);
    const manifestPath = path.join(rootDir, "manifest.yaml");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const text = fs.readFileSync(manifestPath, "utf-8");
      const manifest = parseAppManifest(text);
      if (!manifest) continue;
      out.push(manifestToSummary(manifest, rootDir));
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function getApp(
  id: string,
  appsDir: string = getAinativeAppsDir()
): AppDetail | null {
  const rootDir = path.join(appsDir, id);
  const manifestPath = path.join(rootDir, "manifest.yaml");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const text = fs.readFileSync(manifestPath, "utf-8");
    const manifest = parseAppManifest(text);
    if (!manifest) return null;
    return { ...manifestToSummary(manifest, rootDir), manifest };
  } catch {
    return null;
  }
}

export function deleteApp(
  id: string,
  appsDir: string = getAinativeAppsDir()
): boolean {
  const resolvedApps = path.resolve(appsDir);
  const rootDir = path.resolve(appsDir, id);
  if (!rootDir.startsWith(resolvedApps + path.sep)) return false;
  if (!fs.existsSync(rootDir)) return false;
  fs.rmSync(rootDir, { recursive: true, force: true });
  return true;
}

export interface DeleteAppCascadeResult {
  /** True if the manifest directory was successfully removed. */
  filesRemoved: boolean;
  /** True if a DB project with id === appId existed and its rows were cascaded. */
  projectRemoved: boolean;
}

export interface DeleteAppCascadeOptions {
  appsDir?: string;
  /** Injected for tests; defaults to the real DB-backed deleteProjectCascade. */
  deleteProjectFn?: (projectId: string) => boolean;
}

/**
 * Cascade-delete an app: removes its DB project (and all FK-dependent rows)
 * via deleteProjectCascade, then removes the manifest dir on disk.
 *
 * Both halves are independent — a missing DB project is not an error
 * (split-manifest case), and a missing dir is not an error (DB cleanup
 * already happened). The result reports which half succeeded.
 */
export async function deleteAppCascade(
  appId: string,
  options: DeleteAppCascadeOptions = {}
): Promise<DeleteAppCascadeResult> {
  const appsDir = options.appsDir ?? getAinativeAppsDir();

  const resolvedApps = path.resolve(appsDir);
  const rootDir = path.resolve(appsDir, appId);
  if (!rootDir.startsWith(resolvedApps + path.sep)) {
    return { filesRemoved: false, projectRemoved: false };
  }

  let projectRemoved = false;
  if (options.deleteProjectFn) {
    projectRemoved = options.deleteProjectFn(appId);
  } else {
    const mod = await import("@/lib/data/delete-project");
    projectRemoved = mod.deleteProjectCascade(appId);
  }

  const filesRemoved = deleteApp(appId, appsDir);

  return { projectRemoved, filesRemoved };
}
