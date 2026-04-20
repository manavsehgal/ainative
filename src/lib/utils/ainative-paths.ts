import { homedir } from "os";
import { join } from "path";
import { getAppRoot } from "@/lib/utils/app-root";

export function getAinativeDataDir(): string {
  return process.env.AINATIVE_DATA_DIR || join(homedir(), ".ainative");
}

export function getAinativeDbPath(): string {
  return join(getAinativeDataDir(), "ainative.db");
}

export function getAinativeUploadsDir(): string {
  return join(getAinativeDataDir(), "uploads");
}

export function getAinativeBlueprintsDir(): string {
  return join(getAinativeDataDir(), "blueprints");
}

export function getAinativeScreenshotsDir(): string {
  return join(getAinativeDataDir(), "screenshots");
}

export function getAinativeSnapshotsDir(): string {
  return join(getAinativeDataDir(), "snapshots");
}

export function getAinativeOutputsDir(): string {
  return join(getAinativeDataDir(), "outputs");
}

export function getAinativeSessionsDir(): string {
  return join(getAinativeDataDir(), "sessions");
}

export function getAinativeLogsDir(): string {
  return join(getAinativeDataDir(), "logs");
}

export function getAinativeDocumentsDir(): string {
  return join(getAinativeDataDir(), "documents");
}

export function getAinativeCodexDir(): string {
  return join(getAinativeDataDir(), "codex");
}

export function getAinativeCodexConfigPath(): string {
  return join(getAinativeCodexDir(), "config.toml");
}

export function getAinativeCodexAuthPath(): string {
  return join(getAinativeCodexDir(), "auth.json");
}

export function getAinativeProfilesDir(): string {
  return join(getAinativeDataDir(), "profiles");
}

export function getAinativePluginsDir(): string {
  return join(getAinativeDataDir(), "plugins");
}

/**
 * Composition-bundle directory — where ainative-emitted apps (profile +
 * blueprint + table + schedule compositions) live, as distinct from
 * Kind 1 MCP plugins under plugins/. Consumed by classifyPluginTrust()
 * as a self-extension signal and by the future /apps registry.
 */
export function getAinativeAppsDir(): string {
  return join(getAinativeDataDir(), "apps");
}

/** Path to the plugins.lock file — sibling of the plugins/ directory. */
export function getAinativePluginsLockPath(): string {
  return join(getAinativeDataDir(), "plugins.lock");
}

export function getAinativeSchedulesDir(): string {
  return join(getAinativeDataDir(), "schedules");
}

/** Bundled example plugins shipped with the app (source tree, not data dir). */
export function getAinativePluginExamplesDir(): string {
  return join(
    getAppRoot(import.meta.dirname, 3),
    "src", "lib", "plugins", "examples"
  );
}
