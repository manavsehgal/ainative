import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { BlueprintSchema } from "@/lib/validators/blueprint";
import { getAinativeBlueprintsDir } from "@/lib/utils/ainative-paths";
import { getAppRoot } from "@/lib/utils/app-root";
import type { WorkflowBlueprint } from "./types";

const BUILTINS_DIR = path.resolve(
  getAppRoot(import.meta.dirname, 4),
  "src", "lib", "workflows", "blueprints", "builtins"
);

const USER_BLUEPRINTS_DIR = getAinativeBlueprintsDir();

let blueprintCache: Map<string, WorkflowBlueprint> | null = null;

function scanDirectory(
  dir: string,
  isBuiltin: boolean
): Map<string, WorkflowBlueprint> {
  const blueprints = new Map<string, WorkflowBlueprint>();

  if (!fs.existsSync(dir)) return blueprints;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;

    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const parsed = yaml.load(content);
      const result = BlueprintSchema.safeParse(parsed);

      if (!result.success) {
        console.warn(
          `[blueprints] Invalid blueprint ${file}:`,
          result.error.issues.map((i) => i.message).join(", ")
        );
        continue;
      }

      blueprints.set(result.data.id, { ...result.data, isBuiltin });
    } catch (err) {
      console.warn(`[blueprints] Error loading ${file}:`, err);
    }
  }

  return blueprints;
}

function loadAll(): Map<string, WorkflowBlueprint> {
  const all = new Map<string, WorkflowBlueprint>();

  // Load built-ins first
  for (const [id, bp] of scanDirectory(BUILTINS_DIR, true)) {
    all.set(id, bp);
  }

  // User blueprints can override built-ins
  for (const [id, bp] of scanDirectory(USER_BLUEPRINTS_DIR, false)) {
    all.set(id, bp);
  }

  return all;
}

function ensureLoaded(): Map<string, WorkflowBlueprint> {
  if (!blueprintCache) {
    blueprintCache = loadAll();
  }
  return blueprintCache;
}

export function getBlueprint(id: string): WorkflowBlueprint | undefined {
  return ensureLoaded().get(id);
}

export function listBlueprints(): WorkflowBlueprint[] {
  return Array.from(ensureLoaded().values());
}

export function reloadBlueprints(): void {
  blueprintCache = null;
}

export function isBuiltinBlueprint(id: string): boolean {
  const bp = ensureLoaded().get(id);
  return bp?.isBuiltin ?? false;
}

export function createBlueprint(yamlContent: string): WorkflowBlueprint {
  const parsed = yaml.load(yamlContent);
  const result = BlueprintSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid blueprint: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  fs.mkdirSync(USER_BLUEPRINTS_DIR, { recursive: true });
  const filePath = path.join(USER_BLUEPRINTS_DIR, `${result.data.id}.yaml`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Blueprint "${result.data.id}" already exists`);
  }

  fs.writeFileSync(filePath, yamlContent);
  reloadBlueprints();
  return { ...result.data, isBuiltin: false };
}

export function deleteBlueprint(id: string): void {
  if (isBuiltinBlueprint(id)) {
    throw new Error("Cannot delete built-in blueprints");
  }

  const filePath = path.join(USER_BLUEPRINTS_DIR, `${id}.yaml`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Blueprint "${id}" not found`);
  }

  fs.unlinkSync(filePath);
  reloadBlueprints();
}

/** Get the user blueprints directory path */
export function getUserBlueprintsDir(): string {
  return USER_BLUEPRINTS_DIR;
}

// ---------------------------------------------------------------------------
// Plugin blueprint injection (Kind 5)
// ---------------------------------------------------------------------------

// Static import is intentional and safe: TDR-032's no-static-chat-tools-import
// rule applies to the @/lib/chat/ainative-tools cycle, not the
// workflows→profiles direction. Profile registry has zero static chat-tools
// dependency (verified by grep). This formalizes a layer dependency that
// already exists implicitly via workflows/engine.ts invoking profile-bound agents.
// Do NOT replace with a dynamic import "for safety" — that would defeat
// the sync loader simplicity for no actual cycle-prevention benefit.
import { getProfile } from "@/lib/agents/profiles/registry";

interface PluginBlueprintEntry {
  pluginId: string;
  blueprint: WorkflowBlueprint;
}

const pluginBlueprintIndex: Map<string, Set<string>> = new Map();

export function mergePluginBlueprints(entries: PluginBlueprintEntry[]): void {
  const cache = ensureLoaded();
  for (const entry of entries) {
    cache.set(entry.blueprint.id, entry.blueprint);
    if (!pluginBlueprintIndex.has(entry.pluginId)) {
      pluginBlueprintIndex.set(entry.pluginId, new Set());
    }
    pluginBlueprintIndex.get(entry.pluginId)!.add(entry.blueprint.id);
  }
}

export function clearPluginBlueprints(pluginId: string): void {
  const cache = blueprintCache;
  const ids = pluginBlueprintIndex.get(pluginId);
  if (!ids) return;
  if (cache) for (const id of ids) cache.delete(id);
  pluginBlueprintIndex.delete(pluginId);
}

export function clearAllPluginBlueprints(): void {
  for (const pluginId of Array.from(pluginBlueprintIndex.keys())) {
    clearPluginBlueprints(pluginId);
  }
}

export function listPluginBlueprintIds(pluginId: string): string[] {
  return Array.from(pluginBlueprintIndex.get(pluginId) ?? []);
}

export interface ValidateBlueprintRefsOptions {
  pluginId: string;
  /** namespaced profile ids declared by THIS plugin */
  siblingProfileIds: Set<string>;
}

export interface ValidateBlueprintRefsResult {
  ok: boolean;
  error?: string;
}

export function validateBlueprintRefs(
  bp: WorkflowBlueprint,
  opts: ValidateBlueprintRefsOptions
): ValidateBlueprintRefsResult {
  const steps = (bp as unknown as { steps?: Array<{ profileId?: string }> }).steps ?? [];
  for (const step of steps) {
    if (!step.profileId) continue;
    const ref = step.profileId;
    if (ref.includes("/")) {
      const [refPluginId] = ref.split("/");
      if (refPluginId !== opts.pluginId) {
        return { ok: false, error: `cross-plugin profile reference not allowed: ${ref}` };
      }
      if (!opts.siblingProfileIds.has(ref)) {
        return { ok: false, error: `unresolved sibling profile reference: ${ref}` };
      }
    } else {
      if (!getProfile(ref)) {
        return { ok: false, error: `unresolved profile reference: ${ref}` };
      }
    }
  }
  return { ok: true };
}
