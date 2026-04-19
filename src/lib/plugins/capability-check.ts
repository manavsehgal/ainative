/**
 * capability-check.ts
 *
 * Canonical-form hash derivation over plugin.yaml content (TDR-035 §3) and
 * plugins.lock I/O (schema v1).
 *
 * Public API:
 *   deriveManifestHash(pluginYamlContent)
 *   readPluginsLock()
 *   writePluginsLock(pluginId, entry)
 *   removePluginsLockEntry(pluginId)
 *   isCapabilityAccepted(pluginId, currentHash)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { CAPABILITY_VALUES, type Capability } from "@/lib/plugins/sdk/types";
import {
  getAinativePluginsLockPath,
  getAinativeLogsDir,
} from "@/lib/utils/ainative-paths";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginsLockEntry {
  manifestHash: string;
  capabilities: Capability[];
  acceptedAt: string;   // ISO 8601
  acceptedBy: string;   // os.userInfo().username
}

export interface PluginsLockFile {
  version: 1;
  accepted: Record<string, PluginsLockEntry>;
}

// ---------------------------------------------------------------------------
// Zod schema for plugins.lock — used for "fails-closed" validation
// ---------------------------------------------------------------------------

const PluginsLockEntrySchema = z.object({
  manifestHash: z.string().startsWith("sha256:"),
  capabilities: z.array(z.enum(CAPABILITY_VALUES)),
  acceptedAt: z.string(),
  acceptedBy: z.string(),
});

const PluginsLockFileSchema = z.object({
  version: z.literal(1),
  accepted: z.record(z.string(), PluginsLockEntrySchema),
});

// ---------------------------------------------------------------------------
// Logging — duplicated inline per DRY Principle 6 (extract on 3rd use).
// When a third module needs this, extract to src/lib/plugins/plugin-logger.ts.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Canonical-form hash derivation (TDR-035 §3)
// ---------------------------------------------------------------------------

// Top-level cosmetic fields excluded from the hash. These are display-only
// and should not trigger a re-accept prompt when authors fix a typo.
const EXCLUDED_COSMETIC_FIELDS = new Set(["name", "description", "tags", "author"]);

/**
 * Recursively sort object keys lexicographically. Arrays are preserved
 * in declaration order — array order IS semantically meaningful for
 * capabilities (re-ordering is a re-accept event by design, since the
 * lock stores hashes not sets). This matches TDR-035 §3 step 3 which
 * says "sort object keys" without saying anything about arrays.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Preserve array order; recursively sort any nested objects inside.
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Derive a deterministic SHA-256 hash over the security-relevant subset of
 * a plugin.yaml file's content. Returns "sha256:<64-hex-chars>".
 *
 * Algorithm (TDR-035 §3):
 *  1. Parse YAML text into a JS object.
 *  2. Remove top-level cosmetic fields (name, description, tags, author).
 *  3. Sort all object keys recursively (array order preserved).
 *  4. JSON.stringify with no whitespace.
 *  5. SHA-256, output prefixed "sha256:".
 */
export function deriveManifestHash(pluginYamlContent: string): string {
  const raw = yaml.load(pluginYamlContent);

  // Guard: plugin.yaml must be a YAML mapping (object), not scalar, array, or null.
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `[capability-check] deriveManifestHash: plugin.yaml must be a YAML mapping, got ${raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw}`,
    );
  }

  // Remove cosmetic fields (top-level only per spec).
  const subset: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!EXCLUDED_COSMETIC_FIELDS.has(key)) {
      subset[key] = val;
    }
  }

  const sorted = sortKeysDeep(subset);
  const serialized = JSON.stringify(sorted);
  const hex = crypto.createHash("sha256").update(serialized, "utf-8").digest("hex");
  return `sha256:${hex}`;
}

// ---------------------------------------------------------------------------
// plugins.lock I/O
// ---------------------------------------------------------------------------

/**
 * Read plugins.lock. Fails closed:
 *  - Missing file → empty state (no error)
 *  - Invalid YAML → empty state + warning logged
 *  - Valid YAML but wrong schema → empty state + warning logged
 */
export function readPluginsLock(): PluginsLockFile {
  const lockPath = getAinativePluginsLockPath();

  if (!fs.existsSync(lockPath)) {
    return { version: 1, accepted: {} };
  }

  let raw: unknown;
  try {
    raw = yaml.load(fs.readFileSync(lockPath, "utf-8"));
  } catch (err) {
    logToFile(
      `[capability-check] WARN: plugins.lock is not valid YAML — treating as empty. ` +
        `Error: ${err instanceof Error ? err.message : String(err)}`
    );
    return { version: 1, accepted: {} };
  }

  const parsed = PluginsLockFileSchema.safeParse(raw);
  if (!parsed.success) {
    logToFile(
      `[capability-check] WARN: plugins.lock failed schema validation — treating as empty. ` +
        `Issues: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
    return { version: 1, accepted: {} };
  }

  return parsed.data as PluginsLockFile;
}

/**
 * Atomically write a new or updated entry into plugins.lock.
 *
 * Write order (safe regardless of crash point):
 *  1. If primary exists: copy to plugins.lock.bak (0600).
 *  2. Write new content to a random temp file (0600).
 *  3. rename(tmp, primary) — atomic on POSIX same-filesystem.
 *  4. On rename failure: unlink tmp and re-throw.
 */
export function writePluginsLock(pluginId: string, entry: PluginsLockEntry): void {
  const lockPath = getAinativePluginsLockPath();
  const bakPath = lockPath + ".bak";

  // Ensure the parent directory exists (AINATIVE_DATA_DIR may be fresh).
  const lockDir = path.dirname(lockPath);
  fs.mkdirSync(lockDir, { recursive: true });

  // Read existing state (or empty).
  const current = readPluginsLock();
  current.accepted[pluginId] = entry;

  const newContent = yaml.dump(current, { lineWidth: -1 });

  // Step 1: backup primary before overwriting.
  if (fs.existsSync(lockPath)) {
    fs.copyFileSync(lockPath, bakPath);
    try {
      fs.chmodSync(bakPath, 0o600);
    } catch {
      /* non-POSIX — best effort */
    }
  }

  // Step 2 + 3: atomic tempfile → rename.
  const tmpPath = `${lockPath}.tmp-${crypto.randomBytes(6).toString("hex")}`;
  try {
    fs.writeFileSync(tmpPath, newContent, { mode: 0o600 });
    fs.renameSync(tmpPath, lockPath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
    throw err;
  }

  // Best-effort chmod on the primary (rename may inherit parent perms on some FS).
  try {
    fs.chmodSync(lockPath, 0o600);
  } catch {
    /* non-POSIX — best effort */
  }
}

/**
 * Remove a plugin entry from plugins.lock. No-op if the entry doesn't exist.
 * Uses the same atomic write pattern as writePluginsLock.
 */
export function removePluginsLockEntry(pluginId: string): void {
  const lockPath = getAinativePluginsLockPath();
  const bakPath = lockPath + ".bak";

  const current = readPluginsLock();
  if (!(pluginId in current.accepted)) return;

  delete current.accepted[pluginId];
  const newContent = yaml.dump(current, { lineWidth: -1 });

  const lockDir = path.dirname(lockPath);
  fs.mkdirSync(lockDir, { recursive: true });

  // Backup before overwriting.
  if (fs.existsSync(lockPath)) {
    fs.copyFileSync(lockPath, bakPath);
    try { fs.chmodSync(bakPath, 0o600); } catch { /* non-POSIX */ }
  }

  const tmpPath = `${lockPath}.tmp-${crypto.randomBytes(6).toString("hex")}`;
  try {
    fs.writeFileSync(tmpPath, newContent, { mode: 0o600 });
    fs.renameSync(tmpPath, lockPath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }

  try { fs.chmodSync(lockPath, 0o600); } catch { /* non-POSIX */ }
}

// ---------------------------------------------------------------------------
// Convenience: compare current hash against accepted state
// ---------------------------------------------------------------------------

/**
 * Check whether a plugin's capabilities have been accepted by the user.
 *
 * Returns:
 *   { accepted: true }  — entry exists and hash matches
 *   { accepted: false, reason: "not_accepted" }  — no entry in lock
 *   { accepted: false, reason: "hash_drift", acceptedHash: "sha256:..." }
 *     — entry exists but hash has changed (manifest was modified)
 */
export function isCapabilityAccepted(
  pluginId: string,
  currentHash: string
): { accepted: boolean; reason?: "not_accepted" | "hash_drift"; acceptedHash?: string } {
  const lock = readPluginsLock();
  const entry = lock.accepted[pluginId];

  if (!entry) {
    return { accepted: false, reason: "not_accepted" };
  }

  if (entry.manifestHash !== currentHash) {
    return { accepted: false, reason: "hash_drift", acceptedHash: entry.manifestHash };
  }

  return { accepted: true };
}

// Re-export for consumers that import everything from this module.
export { CAPABILITY_VALUES };
export type { Capability };
