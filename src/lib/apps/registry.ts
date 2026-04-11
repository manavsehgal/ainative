import { BUILTIN_APP_BUNDLES } from "./builtins";
import { appBundleSchema } from "./validation";
import type { AppBundle } from "./types";

const bundleCache = new Map<string, AppBundle>();

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
    }
  }

  return bundleCache;
}

export function listAppBundles(): AppBundle[] {
  return Array.from(ensureBundlesLoaded().values());
}

export function getAppBundle(appId: string): AppBundle | undefined {
  return ensureBundlesLoaded().get(appId);
}
