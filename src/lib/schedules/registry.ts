import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import {
  ScheduleSpecSchema,
  type ScheduleSpec,
} from "@/lib/validators/schedule-spec";
import { getAinativeSchedulesDir } from "@/lib/utils/ainative-paths";
import { getAppRoot } from "@/lib/utils/app-root";

/**
 * Schedule registry — mirrors src/lib/workflows/blueprints/registry.ts.
 *
 * Scans two locations for *.yaml / *.yml schedule specs:
 *   1. Built-ins: src/lib/schedules/builtins/  (empty in v1; resolve call
 *      stays so future builtins work without editing this file)
 *   2. User:      $AINATIVE_DATA_DIR/schedules/  (overrides builtins by id)
 *
 * Parsed through ScheduleSpecSchema (discriminated-union). Invalid files
 * are skipped with console.warn; valid siblings still load.
 *
 * Cache semantics mirror blueprints: a module-level Map is lazily built
 * by `ensureLoaded()` and invalidated via `reloadSchedules()`.
 *
 * KNOWN PATTERN: USER_DIR is captured once at module-load from
 * getAinativeSchedulesDir(). Tests that mutate AINATIVE_DATA_DIR must
 * call `vi.resetModules()` before re-importing this module, because
 * changing process.env after first import will NOT be picked up by the
 * already-captured USER_DIR constant. This matches blueprints/registry.ts.
 *
 * Plugin-injection surface: mergePluginSchedules, clearPluginSchedules,
 * clearAllPluginSchedules, listPluginScheduleIds — mirrors blueprints.
 */

const BUILTINS_DIR = path.resolve(
  getAppRoot(import.meta.dirname, 4),
  "src",
  "lib",
  "schedules",
  "builtins"
);

const USER_DIR = getAinativeSchedulesDir();

let scheduleCache: Map<string, ScheduleSpec> | null = null;
// Parallel index of ids that came from the builtins dir at load time.
// Populated by loadAll() alongside scheduleCache. Avoids re-reading the
// builtins directory on every isBuiltinSchedule() call, which matters
// once the builtins dir is non-empty (v2+). Cleared by reloadSchedules.
let builtinIdsCache: Set<string> | null = null;

function scanDirectory(dir: string): Map<string, ScheduleSpec> {
  const schedules = new Map<string, ScheduleSpec>();

  if (!fs.existsSync(dir)) return schedules;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;

    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const parsed = yaml.load(content);
      const result = ScheduleSpecSchema.safeParse(parsed);

      if (!result.success) {
        console.warn(
          `[schedules] Invalid schedule ${file}:`,
          result.error.issues.map((i) => i.message).join(", ")
        );
        continue;
      }

      schedules.set(result.data.id, result.data);
    } catch (err) {
      console.warn(`[schedules] Error loading ${file}:`, err);
    }
  }

  return schedules;
}

function loadAll(): Map<string, ScheduleSpec> {
  const all = new Map<string, ScheduleSpec>();

  // Built-ins first; remember their ids so isBuiltinSchedule avoids re-I/O.
  const builtins = scanDirectory(BUILTINS_DIR);
  builtinIdsCache = new Set(builtins.keys());
  for (const [id, s] of builtins) all.set(id, s);

  // User schedules override built-ins
  for (const [id, s] of scanDirectory(USER_DIR)) all.set(id, s);

  return all;
}

function ensureLoaded(): Map<string, ScheduleSpec> {
  if (!scheduleCache) {
    scheduleCache = loadAll();
  }
  return scheduleCache;
}

export function getSchedule(id: string): ScheduleSpec | undefined {
  return ensureLoaded().get(id);
}

export function listSchedules(): ScheduleSpec[] {
  return Array.from(ensureLoaded().values());
}

export function reloadSchedules(): void {
  scheduleCache = null;
  builtinIdsCache = null;
}

export function isBuiltinSchedule(id: string): boolean {
  ensureLoaded();
  return builtinIdsCache?.has(id) ?? false;
}

export function getUserSchedulesDir(): string {
  return USER_DIR;
}

export function createScheduleFromYaml(yamlContent: string): ScheduleSpec {
  const parsed = yaml.load(yamlContent);
  const result = ScheduleSpecSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid schedule: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  fs.mkdirSync(USER_DIR, { recursive: true });
  const filePath = path.join(USER_DIR, `${result.data.id}.yaml`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Schedule "${result.data.id}" already exists`);
  }

  fs.writeFileSync(filePath, yamlContent);
  reloadSchedules();
  return result.data;
}

// ── Plugin-injection surface ───────────────────────────────────────────────
// Mirrors src/lib/workflows/blueprints/registry.ts lines 143–177 exactly,
// substituting WorkflowBlueprint → ScheduleSpec and blueprint → schedule.

interface PluginScheduleEntry {
  pluginId: string;
  schedule: ScheduleSpec;
}

const pluginScheduleIndex: Map<string, Set<string>> = new Map();

export function mergePluginSchedules(entries: PluginScheduleEntry[]): void {
  const cache = ensureLoaded();
  for (const entry of entries) {
    cache.set(entry.schedule.id, entry.schedule);
    if (!pluginScheduleIndex.has(entry.pluginId)) {
      pluginScheduleIndex.set(entry.pluginId, new Set());
    }
    pluginScheduleIndex.get(entry.pluginId)!.add(entry.schedule.id);
  }
}

export function clearPluginSchedules(pluginId: string): void {
  const cache = scheduleCache;
  const ids = pluginScheduleIndex.get(pluginId);
  if (!ids) return;
  if (cache) for (const id of ids) cache.delete(id);
  pluginScheduleIndex.delete(pluginId);
}

export function clearAllPluginSchedules(): void {
  for (const pluginId of Array.from(pluginScheduleIndex.keys())) {
    clearPluginSchedules(pluginId);
  }
}

export function listPluginScheduleIds(pluginId: string): string[] {
  return Array.from(pluginScheduleIndex.get(pluginId) ?? []);
}

// ── Cross-reference validator ──────────────────────────────────────────────
// Mirrors validateBlueprintRefs (src/lib/workflows/blueprints/registry.ts
// lines 190–215) with ONE deliberate deviation: dynamic `await import()` of
// the profile registry instead of a static import.

export async function validateScheduleRefs(
  spec: ScheduleSpec,
  opts: { pluginId: string; siblingProfileIds: Set<string> }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ref = spec.agentProfile ?? spec.assignedAgent;
  if (!ref) return { ok: true }; // no profile constraint = use default
  if (ref.includes("/")) {
    const [refPluginId] = ref.split("/");
    if (refPluginId !== opts.pluginId) {
      return { ok: false, error: `cross-plugin profile reference not allowed: ${ref}` };
    }
    if (!opts.siblingProfileIds.has(ref)) {
      return { ok: false, error: `unresolved sibling profile reference: ${ref}` };
    }
    return { ok: true };
  }
  // Unnamespaced — must resolve in the builtin profile registry
  // NOTE: dynamic import to avoid the TDR-032 cycle if this file is ever
  //       imported transitively from runtime modules. Blueprints use a
  //       static import here; schedules use dynamic because the schedules
  //       module IS in the boot path via installer.ts + the chat-tool.
  const { getProfile } = await import("@/lib/agents/profiles/registry");
  if (!getProfile(ref)) {
    return { ok: false, error: `unresolved profile reference: ${ref}` };
  }
  return { ok: true };
}

// ── User CRUD ──────────────────────────────────────────────────────────────

export function deleteSchedule(id: string): void {
  if (isBuiltinSchedule(id)) {
    throw new Error("Cannot delete built-in schedules");
  }

  const filePath = path.join(USER_DIR, `${id}.yaml`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Schedule "${id}" not found`);
  }

  fs.unlinkSync(filePath);
  reloadSchedules();
}
