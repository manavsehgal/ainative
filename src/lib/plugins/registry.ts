// src/lib/plugins/registry.ts
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { PluginManifestSchema, type LoadedPlugin, type PluginManifest, type PluginTableTemplate } from "./sdk/types";
import { getAinativePluginsDir, getAinativeLogsDir } from "@/lib/utils/ainative-paths";
import {
  mergePluginProfiles,
  clearAllPluginProfiles,
  clearPluginProfiles,
  scanProfilesIntoMap,
} from "@/lib/agents/profiles/registry";
import type { AgentProfile } from "@/lib/agents/profiles/types";
import { BlueprintSchema } from "@/lib/validators/blueprint";
import {
  mergePluginBlueprints,
  clearAllPluginBlueprints,
  clearPluginBlueprints,
  validateBlueprintRefs,
} from "@/lib/workflows/blueprints/registry";
import type { WorkflowBlueprint } from "@/lib/workflows/blueprints/types";
import { installPluginTables, removePluginTables } from "@/lib/data/seed-data/table-templates";

// apiVersion compatibility window. A plugin's manifest.apiVersion must
// be in this set or the plugin is disabled with reason "apiVersion_mismatch".
//
// Bump checklist (every chore(release) MAJOR or MINOR commit):
//   1. When MINOR bumps (N → N+1): ADD the new MINOR string here.
//   2. Drop a MINOR only when ainative-business is 2 MINORs ahead of it.
//   3. NEVER drop a MINOR in the same release that adds the next one.
//
// Self-enforcing: api-version-window.test.ts reads package.json and
// asserts the current and previous MINOR are present. Drop a value or
// forget to widen on bump → test fails.
//
// Bridge note (0.13.x → 0.14.0): the package is currently 0.13.3 and M1
// will ship at 0.14.0. We list THREE MINORs ("0.14", "0.13", "0.12")
// during this transition so that:
//   - test fixtures and dogfood bundles already authored against the
//     M1 contract (apiVersion: "0.14") load on the 0.13.x dev branch, AND
//   - the self-enforcing window test (current=0.13, previous=0.12) passes.
// Once 0.14.0 ships, drop "0.12" and the set tightens to the standard
// 2-MINOR window ("0.14", "0.13"). When 0.15.0 ships, it becomes
// ("0.15", "0.14"), and so on.
const SUPPORTED_API_VERSIONS = new Set(["0.14", "0.13", "0.12"]);

/** Test-helper export so the window-enforcement test can read state. */
export function isSupportedApiVersion(apiVersion: string): boolean {
  return SUPPORTED_API_VERSIONS.has(apiVersion);
}

let pluginCache: LoadedPlugin[] | null = null;

// T9: Track the ids of plugins whose tables we installed in the most recent
// scan. The cache itself is invalidated lazily by `reloadPlugins()`, so we
// can't rely on `pluginCache` to know which DB rows to clear before re-scanning.
// This separate tracker survives `pluginCache = null` and lets the reload
// drop stale rows owned by bundles that were removed between scans.
let lastLoadedPluginIds: Set<string> = new Set();

function logToFile(line: string): void {
  try {
    const logsDir = getAinativeLogsDir();
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "plugins.log"),
      `${new Date().toISOString()} ${line}\n`
    );
  } catch {
    /* swallow log errors */
  }
}

function readManifest(rootDir: string): { manifest?: PluginManifest; error?: string } {
  const manifestPath = path.join(rootDir, "plugin.yaml");
  if (!fs.existsSync(manifestPath)) return { error: "missing plugin.yaml" };
  let raw: unknown;
  try {
    raw = yaml.load(fs.readFileSync(manifestPath, "utf-8"));
  } catch (err) {
    return { error: `yaml_parse: ${err instanceof Error ? err.message : String(err)}` };
  }
  const parsed = PluginManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { manifest: parsed.data };
}

function discoverBundleRoots(): string[] {
  const baseDir = getAinativePluginsDir();
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(baseDir, e.name))
    .sort();
}

/**
 * Scan a single bundle's profiles/ directory using the canonical profile
 * scanner with namespace support. Reusing the canonical scanner means
 * plugin profiles get IDENTICAL treatment to builtins (SKILL.md frontmatter
 * extraction, multi-runtime inference, origin classification, tests, etc).
 * Hand-rolling the construction here would silently drop these features.
 */
function scanBundleProfiles(
  rootDir: string,
  pluginId: string
): Array<{ namespacedId: string; profile: AgentProfile }> {
  const profilesDir = path.join(rootDir, "profiles");
  if (!fs.existsSync(profilesDir)) return [];
  const tmp = new Map<string, AgentProfile>();
  scanProfilesIntoMap(profilesDir, tmp, { namespace: pluginId });
  return Array.from(tmp.entries()).map(([id, profile]) => ({
    namespacedId: id,
    profile,
  }));
}

/**
 * Scan a single bundle's blueprints/ directory. Each YAML is namespaced
 * `<pluginId>/<localId>` and validated against BlueprintSchema. Cross-ref
 * validation (via validateBlueprintRefs) ensures profile references resolve
 * either to a builtin profile, a same-plugin sibling, or are rejected as
 * cross-plugin references.
 *
 * Skips (with log) on schema parse failure or unresolved ref. Bundle still
 * loads — only the offending blueprint is dropped.
 */
function scanBundleBlueprints(
  rootDir: string,
  pluginId: string,
  siblingProfileIds: Set<string>
): Array<{ namespacedId: string; blueprint: WorkflowBlueprint }> {
  const dir = path.join(rootDir, "blueprints");
  if (!fs.existsSync(dir)) return [];
  const out: Array<{ namespacedId: string; blueprint: WorkflowBlueprint }> = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    try {
      const raw = yaml.load(fs.readFileSync(path.join(dir, file), "utf-8"));
      const parsed = BlueprintSchema.safeParse(raw);
      if (!parsed.success) {
        logToFile(`skip blueprint ${pluginId}/${file}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
        continue;
      }
      const namespacedId = `${pluginId}/${parsed.data.id}`;
      const blueprint = { ...parsed.data, id: namespacedId, isBuiltin: false } as unknown as WorkflowBlueprint;
      const refs = validateBlueprintRefs(blueprint, { pluginId, siblingProfileIds });
      if (!refs.ok) {
        logToFile(`skip blueprint ${namespacedId}: ${refs.error}`);
        continue;
      }
      out.push({ namespacedId, blueprint });
    } catch (err) {
      logToFile(`skip blueprint ${pluginId}/${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

/**
 * YAML-parsing schema for plugin table templates. Distinct from the runtime
 * `PluginTableTemplate` type because it provides defaults for description and
 * icon — plugin authors may omit either, and the loader fills in safe values.
 * The parsed shape is a superset of the runtime type, so the cast at the
 * bottom is sound.
 */
const PluginTableSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string(),
  description: z.string().default(""),
  category: z.enum(["business", "personal", "pm", "finance", "content"]),
  icon: z.string().default("Table"),
  columns: z.array(z.object({
    name: z.string(),
    displayName: z.string(),
    dataType: z.string(),
    config: z.record(z.string(), z.unknown()).optional(),
  })),
  sampleRows: z.array(z.record(z.string(), z.unknown())).optional(),
});

/**
 * Scan a single bundle's tables/ directory. Each YAML is validated against
 * PluginTableSchema; failures are logged and the offending file is dropped
 * (the rest of the bundle still loads). Returns parsed templates ready for
 * `installPluginTables` — the loader is responsible for the DB upsert and
 * for prefixing the namespaced ids that surface on the LoadedPlugin record.
 */
function scanBundleTables(rootDir: string, pluginId: string): PluginTableTemplate[] {
  const dir = path.join(rootDir, "tables");
  if (!fs.existsSync(dir)) return [];
  const out: PluginTableTemplate[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    try {
      const raw = yaml.load(fs.readFileSync(path.join(dir, file), "utf-8"));
      const parsed = PluginTableSchema.safeParse(raw);
      if (!parsed.success) {
        logToFile(`skip table ${pluginId}/${file}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
        continue;
      }
      out.push(parsed.data as PluginTableTemplate);
    } catch (err) {
      logToFile(`skip table ${pluginId}/${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

/**
 * Per-bundle loader. Given an already-validated manifest + rootDir, runs the
 * profile/blueprint/table scan + merge + install steps and returns the
 * resulting `LoadedPlugin` record. Shared by `scanPlugins` (full scan) and
 * `reloadPlugin` (targeted single-bundle reload) so both paths produce
 * identical state — the only behavioral difference between them is which
 * bundles they iterate.
 *
 * Returns a "disabled" record (without touching primitive registries) when
 * apiVersion is unsupported. Manifest readability + duplicate-id dedupe are
 * the caller's responsibility.
 */
function loadOneBundle(rootDir: string, manifest: PluginManifest): LoadedPlugin {
  if (!isSupportedApiVersion(manifest.apiVersion)) {
    logToFile(`disabled ${manifest.id}: apiVersion_mismatch (${manifest.apiVersion})`);
    return {
      id: manifest.id, manifest, rootDir,
      profiles: [], blueprints: [], tables: [],
      status: "disabled", error: "apiVersion_mismatch",
    };
  }

  // T7: scan bundle profiles, merge into the canonical profile registry,
  // and surface their namespaced ids on the LoadedPlugin record.
  const scannedProfiles = scanBundleProfiles(rootDir, manifest.id);
  mergePluginProfiles(
    scannedProfiles.map((s) => ({ pluginId: manifest.id, profile: s.profile }))
  );

  // T8: scan bundle blueprints, validate cross-references against sibling
  // profiles + builtins, merge into the canonical blueprint registry under
  // namespaced ids.
  const siblingProfileIds = new Set(scannedProfiles.map((s) => s.namespacedId));
  const scannedBlueprints = scanBundleBlueprints(rootDir, manifest.id, siblingProfileIds);
  mergePluginBlueprints(
    scannedBlueprints.map((s) => ({ pluginId: manifest.id, blueprint: s.blueprint }))
  );

  // T9: tables. Clear any stale rows owned by this plugin first, then
  // install fresh. `installPluginTables` writes to user_table_templates
  // with a composite id (plugin:<pluginId>:<tableId>) and suffixes the
  // display name with the plugin id to disambiguate collisions with builtins.
  removePluginTables(manifest.id);
  const scannedTables = scanBundleTables(rootDir, manifest.id);
  installPluginTables(manifest.id, scannedTables);
  const tableIds = scannedTables.map((t) => `plugin:${manifest.id}:${t.id}`);

  logToFile(
    `loaded ${manifest.id}@${manifest.version}: ${scannedProfiles.length} profiles, ${scannedBlueprints.length} blueprints, ${tableIds.length} tables`
  );

  return {
    id: manifest.id, manifest, rootDir,
    profiles: scannedProfiles.map((s) => s.namespacedId),
    blueprints: scannedBlueprints.map((s) => s.namespacedId),
    tables: tableIds,
    status: "loaded",
  };
}

/**
 * Pure scan of the plugins dir. Does NOT touch the cache.
 * Used by both `loadPlugins()` (lazy, cached) and `reloadPlugins()` (eager).
 */
function scanPlugins(): LoadedPlugin[] {
  const seenIds = new Set<string>();
  const result: LoadedPlugin[] = [];
  const loadedIds = new Set<string>();

  for (const rootDir of discoverBundleRoots()) {
    const { manifest, error } = readManifest(rootDir);
    if (!manifest) {
      const fallbackId = path.basename(rootDir);
      result.push({
        id: fallbackId,
        manifest: { id: fallbackId, version: "0.0.0", apiVersion: "0.0", kind: "primitives-bundle" } as PluginManifest,
        rootDir,
        profiles: [],
        blueprints: [],
        tables: [],
        status: "disabled",
        error,
      });
      logToFile(`disabled ${rootDir}: ${error}`);
      continue;
    }

    if (seenIds.has(manifest.id)) {
      result.push({
        id: manifest.id, manifest, rootDir,
        profiles: [], blueprints: [], tables: [],
        status: "disabled", error: "duplicate_plugin_id",
      });
      logToFile(`disabled ${rootDir}: duplicate_plugin_id (${manifest.id})`);
      continue;
    }
    seenIds.add(manifest.id);

    const loaded = loadOneBundle(rootDir, manifest);
    result.push(loaded);
    if (loaded.status === "loaded") loadedIds.add(manifest.id);
  }

  // T9: record what we just loaded so the next reload knows which plugins'
  // table rows to drop, even when the cache has been invalidated in between.
  lastLoadedPluginIds = loadedIds;
  return result;
}

/**
 * Cached entry point. Scans the plugins dir on first call and on every
 * call after `reloadPlugins()` invalidates the cache.
 *
 * T7/T8/T9 add primitive integration to the scan loop body. T6 only
 * handles manifest validation + apiVersion compat + duplicate-id dedupe.
 */
export function loadPlugins(): LoadedPlugin[] {
  if (pluginCache) return pluginCache;
  pluginCache = scanPlugins();
  return pluginCache;
}

/**
 * T9 helper: drop the DB-resident table rows for every plugin that was
 * loaded in the most recent scan. Iterates `lastLoadedPluginIds` (which
 * survives `pluginCache = null`) so a bundle removed entirely from disk
 * between reloads still has its stale rows cleaned up.
 *
 * Belt-and-braces: the per-bundle `removePluginTables(manifest.id)` inside
 * scanPlugins also clears at scan time, but that path only fires for bundles
 * still on disk. Removed bundles rely on this helper for cleanup.
 */
function removeAllPluginTablesForCachedPlugins(): void {
  // Prefer the live cache when available (it's the authoritative current
  // state), but fall back to lastLoadedPluginIds when the cache is null —
  // which is the normal state after `reloadPlugins()` invalidates lazily.
  if (pluginCache) {
    for (const p of pluginCache) {
      if (p.status === "loaded") removePluginTables(p.id);
    }
    return;
  }
  for (const id of lastLoadedPluginIds) {
    removePluginTables(id);
  }
}

export function reloadPlugins(): LoadedPlugin[] {
  // T7: clear ALL plugin-injected profiles before re-scanning so that
  // removed bundles drop their profiles, and renamed/changed profiles
  // don't accumulate stale entries.
  //
  // Invalidate the cache lazily — the NEXT `loadPlugins()` call re-scans.
  // Returns a fresh scan for callers that want immediate state, but does
  // NOT use that scan to repopulate the cache. This preserves the
  //   reloadPlugins(); ...mutate plugins/...; loadPlugins();
  // pattern used by tests and by future hot-reload flows that write
  // bundle files between invalidation and observation.
  removeAllPluginTablesForCachedPlugins();
  clearAllPluginProfiles();
  clearAllPluginBlueprints();
  pluginCache = null;
  return scanPlugins();
}

export function listPlugins(): LoadedPlugin[] {
  return pluginCache ?? loadPlugins();
}

export function getPlugin(id: string): LoadedPlugin | null {
  return (pluginCache ?? loadPlugins()).find((p) => p.id === id) ?? null;
}

/**
 * T9b: Targeted single-plugin reload.
 *
 * Re-scans ONLY the named plugin's bundle, preserving every other plugin's
 * cached entry by object identity. Used by hot-reload flows where the agent
 * has just rewritten one bundle and a full `reloadPlugins()` would be
 * needlessly disruptive (it would re-run profile/blueprint/table merges for
 * every other bundle and invalidate downstream consumers).
 *
 * Returns the freshly-loaded plugin record, or `null` if the bundle no
 * longer exists on disk (or never did). The plugin's prior contributions
 * are cleared from all three primitive registries either way — so a "deleted
 * plugin" reload behaves as an unload.
 */
export function reloadPlugin(id: string): LoadedPlugin | null {
  // Step 1: Locate the plugin's rootDir from disk (the agent may have just
  // moved or renamed the directory, so we don't trust the cache).
  let foundDir: string | null = null;
  let foundManifest: PluginManifest | null = null;
  for (const rootDir of discoverBundleRoots()) {
    const { manifest } = readManifest(rootDir);
    if (manifest && manifest.id === id) {
      foundDir = rootDir;
      foundManifest = manifest;
      break;
    }
  }

  // Step 2: Clear THIS plugin's prior contributions from all three registries.
  // Other plugins' entries stay intact — that's the whole point.
  clearPluginProfiles(id);
  clearPluginBlueprints(id);
  removePluginTables(id);

  // Step 3: Drop just this entry from the cache (don't null pluginCache).
  // Force population first so downstream identity-preservation guarantees
  // hold even when the cache hasn't been hydrated yet.
  if (!pluginCache) loadPlugins();
  if (pluginCache) {
    pluginCache = pluginCache.filter((p) => p.id !== id);
  }
  // Keep the plugin-id tracker in sync with cache state — `lastLoadedPluginIds`
  // is the fallback used by `removeAllPluginTablesForCachedPlugins` when the
  // cache is null, and we don't want a deleted plugin's id lingering there.
  lastLoadedPluginIds.delete(id);

  // Step 4: If disk no longer has the plugin, we're done — it was deleted.
  if (!foundDir || !foundManifest) return null;

  // Step 5: Re-scan only this bundle and merge.
  const loaded = loadOneBundle(foundDir, foundManifest);
  if (pluginCache) pluginCache.push(loaded);
  if (loaded.status === "loaded") lastLoadedPluginIds.add(id);
  return loaded;
}
