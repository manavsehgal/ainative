import { homedir } from "os";
import { join } from "path";

export function getStagentDataDir(): string {
  return process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent");
}

export function getStagentDbPath(): string {
  return join(getStagentDataDir(), "stagent.db");
}

export function getStagentUploadsDir(): string {
  return join(getStagentDataDir(), "uploads");
}

export function getStagentBlueprintsDir(): string {
  return join(getStagentDataDir(), "blueprints");
}

export function getStagentScreenshotsDir(): string {
  return join(getStagentDataDir(), "screenshots");
}

export function getStagentSnapshotsDir(): string {
  return join(getStagentDataDir(), "snapshots");
}

export function getStagentOutputsDir(): string {
  return join(getStagentDataDir(), "outputs");
}

export function getStagentSessionsDir(): string {
  return join(getStagentDataDir(), "sessions");
}

export function getStagentLogsDir(): string {
  return join(getStagentDataDir(), "logs");
}

export function getStagentDocumentsDir(): string {
  return join(getStagentDataDir(), "documents");
}

export function getStagentCodexDir(): string {
  return join(getStagentDataDir(), "codex");
}

export function getStagentCodexConfigPath(): string {
  return join(getStagentCodexDir(), "config.toml");
}

export function getStagentCodexAuthPath(): string {
  return join(getStagentCodexDir(), "auth.json");
}

export function getStagentProfilesDir(): string {
  return join(getStagentDataDir(), "profiles");
}
