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
