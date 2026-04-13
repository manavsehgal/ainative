import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { BUILTIN_APP_BUNDLES } from "./builtins";
import { sapToBundleSync } from "./sap-converter";
import { appBundleSchema } from "./validation";
import type { AppBundle } from "./types";

const bundleCache = new Map<string, AppBundle>();
const bundleSourceMap = new Map<string, "builtin" | "sap">();
const failedSapLoads = new Map<string, string>();

function loadBundles(): Map<string, AppBundle> {
  const bundles = new Map<string, AppBundle>();

  for (const bundle of BUILTIN_APP_BUNDLES) {
    const parsed = appBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      throw new Error(
        `Invalid built-in app bundle "${bundle.manifest.id}": ${parsed.error.issues
          .map((issue) => issue.message)
          .join(", ")}`
      );
    }

    bundles.set(parsed.data.manifest.id, parsed.data);
  }

  return bundles;
}

function ensureBundlesLoaded(): Map<string, AppBundle> {
  if (bundleCache.size === 0) {
    for (const [id, bundle] of loadBundles()) {
      bundleCache.set(id, bundle);
      bundleSourceMap.set(id, "builtin");
    }
  }

  return bundleCache;
}

export function listAppBundles(): AppBundle[] {
  return Array.from(ensureBundlesLoaded().values());
}

export function getAppBundle(appId: string): AppBundle | undefined {
  const cache = ensureBundlesLoaded();
  let bundle = cache.get(appId);
  if (!bundle && !failedSapLoads.has(appId)) {
    bundle = tryLoadSapBundleSync(appId) ?? undefined;
    if (bundle) {
      cache.set(appId, bundle);
      bundleSourceMap.set(appId, "sap");
    }
  }
  return bundle;
}

/** JIT fallback: attempt to load a single SAP bundle from disk on cache miss. */
function tryLoadSapBundleSync(appId: string): AppBundle | null {
  try {
    const dataDir =
      process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent");
    const dir = join(dataDir, "apps", appId);
    const manifestPath = join(dir, "manifest.yaml");
    if (!existsSync(manifestPath)) return null;

    const bundle = sapToBundleSync(dir);
    const parsed = appBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      console.warn(
        `[apps] JIT SAP validation failed for "${appId}": ${issues}`,
      );
      failedSapLoads.set(appId, issues);
      return null;
    }
    return parsed.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[apps] JIT SAP load failed for ${appId}:`, msg);
    failedSapLoads.set(appId, msg);
    return null;
  }
}

/**
 * Register a dynamically created or loaded bundle in the runtime cache.
 * Validates against appBundleSchema before inserting.
 * @param source — origin tracking for listSapBundleIds() / getBundleSource()
 */
export function registerBundle(
  bundle: AppBundle,
  source?: "builtin" | "sap",
): void {
  ensureBundlesLoaded();
  const parsed = appBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    throw new Error(
      `Invalid app bundle "${bundle.manifest?.id ?? "unknown"}": ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`
    );
  }
  bundleCache.set(parsed.data.manifest.id, parsed.data);
  if (source) {
    bundleSourceMap.set(parsed.data.manifest.id, source);
  }
}

/**
 * Scan ~/.stagent/apps/ for .sap directories and register each as a bundle.
 * Non-fatal: corrupt directories are logged and skipped.
 */
export async function loadSapBundles(): Promise<number> {
  const dataDir =
    process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent");
  const appsDir = join(dataDir, "apps");

  if (!existsSync(appsDir)) return 0;

  const { sapToBundle } = await import("./sap-converter");

  let loaded = 0;
  const entries = readdirSync(appsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dir = join(appsDir, entry.name);
    const manifestPath = join(dir, "manifest.yaml");
    if (!existsSync(manifestPath)) continue;

    try {
      const bundle = await sapToBundle(dir);
      registerBundle(bundle);
      bundleSourceMap.set(bundle.manifest.id, "sap");
      loaded++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[apps] Failed to load .sap bundle from ${dir}:`, errMsg);
      failedSapLoads.set(entry.name, errMsg);
    }
  }

  if (loaded > 0) {
    console.log(`[apps] Loaded ${loaded} .sap bundle(s) from ${appsDir}`);
  }

  return loaded;
}

/** Return IDs of all SAP-loaded bundles (user-built apps). */
export function listSapBundleIds(): string[] {
  ensureBundlesLoaded();
  return Array.from(bundleSourceMap.entries())
    .filter(([, source]) => source === "sap")
    .map(([id]) => id);
}

/** Return how a bundle was loaded, or undefined if not in cache. */
export function getBundleSource(
  appId: string,
): "builtin" | "sap" | undefined {
  return bundleSourceMap.get(appId);
}

/** Remove a bundle from the runtime cache (used after SAP dir deletion). */
export function deregisterBundle(appId: string): boolean {
  bundleSourceMap.delete(appId);
  failedSapLoads.delete(appId);
  return bundleCache.delete(appId);
}

/** Clear a failed-load entry so the next getAppBundle() call retries JIT loading. */
export function clearFailedLoad(appId: string): void {
  failedSapLoads.delete(appId);
}

/** Return map of SAP directories that failed to load (appId → error message). */
export function getFailedSapLoads(): ReadonlyMap<string, string> {
  return failedSapLoads;
}
