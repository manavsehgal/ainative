// src/lib/plugins/registry.ts
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { PluginManifestSchema, type LoadedPlugin, type PluginManifest } from "./sdk/types";
import { getAinativePluginsDir, getAinativeLogsDir } from "@/lib/utils/ainative-paths";
import {
  mergePluginProfiles,
  clearAllPluginProfiles,
  scanProfilesIntoMap,
} from "@/lib/agents/profiles/registry";
import type { AgentProfile } from "@/lib/agents/profiles/types";
import { BlueprintSchema } from "@/lib/validators/blueprint";
import {
  mergePluginBlueprints,
  clearAllPluginBlueprints,
  validateBlueprintRefs,
} from "@/lib/workflows/blueprints/registry";
import type { WorkflowBlueprint } from "@/lib/workflows/blueprints/types";

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
 * Pure scan of the plugins dir. Does NOT touch the cache.
 * Used by both `loadPlugins()` (lazy, cached) and `reloadPlugins()` (eager).
 */
function scanPlugins(): LoadedPlugin[] {
  const seenIds = new Set<string>();
  const result: LoadedPlugin[] = [];

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

    if (!isSupportedApiVersion(manifest.apiVersion)) {
      result.push({
        id: manifest.id, manifest, rootDir,
        profiles: [], blueprints: [], tables: [],
        status: "disabled", error: "apiVersion_mismatch",
      });
      logToFile(`disabled ${manifest.id}: apiVersion_mismatch (${manifest.apiVersion})`);
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

    // T7: scan bundle profiles, merge into the canonical profile registry,
    // and surface their namespaced ids on the LoadedPlugin record.
    // T8 adds blueprints; T9 will add tables alongside this in the same loop.
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

    result.push({
      id: manifest.id, manifest, rootDir,
      profiles: scannedProfiles.map((s) => s.namespacedId),
      blueprints: scannedBlueprints.map((s) => s.namespacedId),
      tables: [],
      status: "loaded",
    });
    logToFile(
      `loaded ${manifest.id}@${manifest.version}: ${scannedProfiles.length} profiles, ${scannedBlueprints.length} blueprints`
    );
  }

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

export function reloadPlugin(id: string): LoadedPlugin | null {
  // Skeleton implementation: full reload, return the requested plugin (or null).
  // True single-plugin reload (clear just one plugin, re-scan only its bundle)
  // is added in Task 9b once scanBundleProfiles/Blueprints/Tables exist.
  reloadPlugins();
  return getPlugin(id);
}
