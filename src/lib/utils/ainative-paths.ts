import { homedir } from "os";
import { join } from "path";

export function getAinativeDataDir(): string {
  // STAGENT_DATA_DIR fallback is transitional for Phase 1 of the ainative rename,
  // so existing dev-mode overrides still work while migration runs. Removed in Phase 2.
  return process.env.AINATIVE_DATA_DIR || process.env.STAGENT_DATA_DIR || join(homedir(), ".ainative");
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
