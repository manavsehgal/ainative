import { spawnSync } from "node:child_process";

type Logger = (msg: string) => void;

/**
 * Copy a macOS keychain service entry from oldName to newName, then delete
 * the old. Idempotent: if newName already exists, returns false (no-op).
 * Uses spawnSync with array args — no shell interpolation, no injection surface.
 * Returns true if migration happened, false if skipped. Throws only on
 * catastrophic failure of the `add` step (so the caller can record the error).
 */
export async function migrateKeychainService(
  oldName: string,
  newName: string,
  log: Logger,
): Promise<boolean> {
  if (process.platform !== "darwin") {
    return false;
  }

  // Check if new service already exists — if so, migration already happened
  const newCheck = spawnSync("security", ["find-generic-password", "-s", newName], {
    stdio: "ignore",
  });
  if (newCheck.status === 0) {
    return false;
  }

  // Read old password — if no old entry exists, nothing to migrate
  const oldRead = spawnSync("security", ["find-generic-password", "-s", oldName, "-w"], {
    encoding: "utf8",
  });
  if (oldRead.status !== 0) {
    return false;
  }
  const password = oldRead.stdout.trim();
  if (!password) {
    return false;
  }

  // Write new entry
  const addResult = spawnSync(
    "security",
    ["add-generic-password", "-s", newName, "-a", newName, "-w", password],
    { stdio: "ignore" },
  );
  if (addResult.status !== 0) {
    throw new Error(`security add-generic-password failed (status ${addResult.status})`);
  }

  // Delete old entry (best-effort — failure here is non-fatal)
  spawnSync("security", ["delete-generic-password", "-s", oldName], { stdio: "ignore" });

  log(`migrated keychain service ${oldName} -> ${newName}`);
  return true;
}
