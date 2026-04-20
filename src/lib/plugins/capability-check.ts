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
 *   setPluginToolApproval(pluginId, toolName, mode)   — T10 per-tool overlay
 *   getPluginToolApprovalMode(pluginId, toolName, defaultFromManifest?)
 *   resolvePluginToolApproval(toolName)               — T10 tool-name → mode
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { CAPABILITY_VALUES, type Capability, type PluginManifest } from "@/lib/plugins/sdk/types";
import { classifyPluginTrust } from "@/lib/plugins/classify-trust";
import {
  getAinativePluginsLockPath,
  getAinativePluginsDir,
  getAinativeLogsDir,
} from "@/lib/utils/ainative-paths";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolApprovalMode = "never" | "prompt" | "approve";

export interface PluginsLockEntry {
  manifestHash: string;
  capabilities: Capability[];
  acceptedAt: string;   // ISO 8601
  acceptedBy: string;   // os.userInfo().username
  /**
   * T10: Per-tool approval overrides. Keys are the full MCP-prefixed tool
   * name (e.g. "mcp__echo-server__echo"). Missing entries fall back to the
   * plugin manifest's `defaultToolApproval`, and finally to `"prompt"`.
   */
  toolApprovals?: Record<string, ToolApprovalMode>;
  /**
   * T11: Optional capability-acceptance expiry. ISO 8601 timestamp.
   * When set and `Date.now() >= Date.parse(expiresAt)`, the plugin is
   * treated as pending_capability_reaccept (same as hash drift). Absent
   * means no expiry — matches Claude Code / Codex default behavior.
   */
  expiresAt?: string;
}

export interface PluginsLockFile {
  version: 1;
  accepted: Record<string, PluginsLockEntry>;
}

// ---------------------------------------------------------------------------
// Zod schema for plugins.lock — used for "fails-closed" validation
// ---------------------------------------------------------------------------

const ToolApprovalModeSchema = z.enum(["never", "prompt", "approve"]);

const PluginsLockEntrySchema = z.object({
  manifestHash: z.string().startsWith("sha256:"),
  capabilities: z.array(z.enum(CAPABILITY_VALUES)),
  acceptedAt: z.string(),
  acceptedBy: z.string(),
  toolApprovals: z.record(z.string(), ToolApprovalModeSchema).optional(),
  expiresAt: z.string().optional(),
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
 *   { accepted: true }  — entry exists, hash matches, and (if set) not expired
 *   { accepted: false, reason: "not_accepted" }  — no entry in lock
 *   { accepted: false, reason: "hash_drift", acceptedHash: "sha256:..." }
 *     — entry exists but hash has changed (manifest was modified).
 *     Takes precedence over expiry — a drifted manifest is the more
 *     actionable signal for the re-accept prompt.
 *   { accepted: false, reason: "expired", expiresAt: "..." }
 *     — T11: entry exists, hash matches, but `expiresAt` is in the past.
 */
/**
 * Optional inputs that activate the two-path trust model (TDR-037). When
 * `manifest` + `rootDir` are provided AND the classifier returns "self",
 * this function early-returns `{ accepted: true }` without touching the
 * lockfile — self-extension bundles never write to or read from
 * plugins.lock. Legacy callers that omit these inputs fall through to the
 * original lockfile-based check unchanged (backward-compatible).
 *
 * The `trustModelSetting` parameter lets the Settings toggle force a path:
 *   - "auto" (default): classifier decides
 *   - "strict": treat everything as third-party (forces lockfile path even
 *     for ainative-internal bundles — for users who want training wheels)
 *   - "off":    treat everything as self (trust-on-first-use for all)
 */
export interface CapabilityAcceptOpts {
  manifest?: PluginManifest;
  rootDir?: string;
  trustModelSetting?: "auto" | "strict" | "off";
  userIdentity?: string;
}

export function isCapabilityAccepted(
  pluginId: string,
  currentHash: string,
  opts: CapabilityAcceptOpts = {},
): {
  accepted: boolean;
  reason?: "not_accepted" | "hash_drift" | "expired";
  acceptedHash?: string;
  expiresAt?: string;
  /**
   * Populated with "self" ONLY when the self-extension fast-path fired
   * (TDR-037). Absent on lockfile-based returns so legacy callers that
   * compare shapes strictly are unaffected. UI/logs that need the
   * distinction check for `trustPath === "self"` explicitly.
   */
  trustPath?: "self";
} {
  // Two-path trust model (TDR-037). When manifest + rootDir are provided,
  // classify the bundle; if "self" and setting allows, bypass the lockfile.
  const setting = opts.trustModelSetting ?? "auto";
  if (setting !== "strict" && opts.manifest && opts.rootDir) {
    if (setting === "off") {
      return { accepted: true, trustPath: "self" };
    }
    const path_ = classifyPluginTrust(opts.manifest, opts.rootDir, {
      userIdentity: opts.userIdentity,
    });
    if (path_ === "self") {
      return { accepted: true, trustPath: "self" };
    }
  }

  const lock = readPluginsLock();
  const entry = lock.accepted[pluginId];

  if (!entry) {
    return { accepted: false, reason: "not_accepted" };
  }

  // Hash drift takes precedence over expiry — both are re-accept prompts,
  // but a drifted manifest is the more informative/actionable signal.
  if (entry.manifestHash !== currentHash) {
    return { accepted: false, reason: "hash_drift", acceptedHash: entry.manifestHash };
  }

  // T11: Expiry check (opt-in). Only applies when expiresAt is present.
  // DEPRECATED per TDR-037 §5 — scheduled for removal once set_plugin_accept_expiry
  // chat tool is retired. Behavior preserved until then for backward compat
  // with any hand-edited lockfiles that still set expiresAt.
  if (entry.expiresAt) {
    const expiresMs = Date.parse(entry.expiresAt);
    // Guard against invalid dates — treat an unparseable expiresAt as
    // "no expiry" rather than failing closed, since the user's intent
    // is ambiguous. The write path validates format, so this is a belt-
    // and-suspenders guard against hand-edited lock files.
    if (!Number.isNaN(expiresMs) && Date.now() >= expiresMs) {
      return { accepted: false, reason: "expired", expiresAt: entry.expiresAt };
    }
  }

  return { accepted: true };
}

// ---------------------------------------------------------------------------
// T10: Per-tool approval overlay
// ---------------------------------------------------------------------------

/**
 * Set a per-tool approval mode for a plugin's tool. Preserves existing entry
 * fields (manifestHash, capabilities, acceptedAt, acceptedBy, expiresAt) —
 * merges into `toolApprovals`. Throws if the plugin has no lockfile entry
 * (the plugin must be capability-accepted first).
 */
export function setPluginToolApproval(
  pluginId: string,
  toolName: string,
  mode: ToolApprovalMode,
): void {
  const lock = readPluginsLock();
  const existing = lock.accepted[pluginId];
  if (!existing) {
    throw new Error(
      `[capability-check] setPluginToolApproval: plugin "${pluginId}" is not in plugins.lock (must be capability-accepted first)`,
    );
  }

  const nextApprovals: Record<string, ToolApprovalMode> = {
    ...(existing.toolApprovals ?? {}),
    [toolName]: mode,
  };

  const nextEntry: PluginsLockEntry = {
    manifestHash: existing.manifestHash,
    capabilities: existing.capabilities,
    acceptedAt: existing.acceptedAt,
    acceptedBy: existing.acceptedBy,
    toolApprovals: nextApprovals,
    ...(existing.expiresAt !== undefined && { expiresAt: existing.expiresAt }),
  };

  writePluginsLock(pluginId, nextEntry);
}

/**
 * T11: Set an expiration date on a plugin's capability acceptance.
 *
 * Preserves existing entry fields (manifestHash, capabilities, acceptedAt,
 * acceptedBy, toolApprovals) — merges in `expiresAt`. Throws if the plugin
 * has no lockfile entry (the plugin must be capability-accepted first).
 *
 * Returns the computed ISO 8601 expiry timestamp for test/UI verifiability.
 */
export function setPluginAcceptExpiry(
  pluginId: string,
  days: 30 | 90 | 180 | 365,
): string {
  const lock = readPluginsLock();
  const existing = lock.accepted[pluginId];
  if (!existing) {
    throw new Error(
      `[capability-check] setPluginAcceptExpiry: plugin "${pluginId}" is not in plugins.lock (must be capability-accepted first)`,
    );
  }

  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

  const nextEntry: PluginsLockEntry = {
    manifestHash: existing.manifestHash,
    capabilities: existing.capabilities,
    acceptedAt: existing.acceptedAt,
    acceptedBy: existing.acceptedBy,
    ...(existing.toolApprovals !== undefined && { toolApprovals: existing.toolApprovals }),
    expiresAt,
  };

  writePluginsLock(pluginId, nextEntry);
  return expiresAt;
}

/**
 * Look up the effective per-tool approval mode for a plugin's tool.
 *
 * Resolution order:
 *   1. lockfile `toolApprovals[toolName]` override, if present
 *   2. manifest `defaultToolApproval`, if the caller provides one
 *   3. `"prompt"` (safe default)
 *
 * Returns null if the plugin is not in the lockfile (not capability-accepted).
 */
export function getPluginToolApprovalMode(
  pluginId: string,
  toolName: string,
  defaultFromManifest?: ToolApprovalMode,
): ToolApprovalMode | null {
  const lock = readPluginsLock();
  const entry = lock.accepted[pluginId];
  if (!entry) return null;

  const override = entry.toolApprovals?.[toolName];
  if (override) return override;

  if (defaultFromManifest) return defaultFromManifest;

  return "prompt";
}

/**
 * Read `plugin.yaml` for a plugin id and extract its optional
 * `defaultToolApproval` field. Returns undefined if the file is missing,
 * unparseable, or the field is absent.
 *
 * Kept intentionally inline (no shared `getPluginManifest` helper) per the
 * DRY-on-3rd-use rule. If a third reader emerges, promote to mcp-loader.
 */
function readManifestDefaultApproval(pluginId: string): ToolApprovalMode | undefined {
  try {
    const pluginYamlPath = path.join(getAinativePluginsDir(), pluginId, "plugin.yaml");
    if (!fs.existsSync(pluginYamlPath)) return undefined;
    const content = fs.readFileSync(pluginYamlPath, "utf-8");
    const raw = yaml.load(content);
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const record = raw as Record<string, unknown>;
    const value = record.defaultToolApproval;
    if (value === "never" || value === "prompt" || value === "approve") {
      return value;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Given a canonical MCP tool name of shape `mcp__<serverName>__<toolName>`,
 * find the matching plugin registration and return the effective approval
 * mode.
 *
 * Returns null if:
 *   - `toolName` doesn't match the `mcp__` prefix pattern
 *   - no registration matches (plugin not loaded / unknown server)
 *   - the plugin is not in plugins.lock (not capability-accepted)
 *
 * Dynamic import of `@/lib/plugins/mcp-loader` keeps this module decoupled
 * from the loader's validation chain (per TDR-032 discipline).
 */
export async function resolvePluginToolApproval(
  toolName: string,
): Promise<ToolApprovalMode | null> {
  if (!toolName.startsWith("mcp__")) return null;

  // Parse: mcp__<serverName>__<rest>. `rest` is the tool name as the MCP
  // server sees it; we only need the serverName to find the registration.
  const afterPrefix = toolName.slice("mcp__".length);
  const sepIdx = afterPrefix.indexOf("__");
  if (sepIdx <= 0) return null;
  const serverName = afterPrefix.slice(0, sepIdx);

  // Dynamic import per TDR-032 — mcp-loader pulls in transport-dispatch and
  // other modules we don't want to statically couple to the permission layer.
  const { listPluginMcpRegistrations } = await import("@/lib/plugins/mcp-loader");
  const registrations = await listPluginMcpRegistrations();

  const match = registrations.find(
    (r) => r.status === "accepted" && r.serverName === serverName,
  );
  if (!match) return null;

  const manifestDefault = readManifestDefaultApproval(match.pluginId);
  return getPluginToolApprovalMode(match.pluginId, toolName, manifestDefault);
}

// ---------------------------------------------------------------------------
// T12: Revocation flow
// ---------------------------------------------------------------------------

/**
 * Revoke a plugin's capabilities.
 *
 * Effects:
 *  - Removes the plugins.lock entry (future task runs treat it as not_accepted).
 *  - Busts Node's require.cache for any accepted in-process SDK registrations
 *    so the stale module is dropped when a revoke is immediately followed by
 *    re-install + re-accept.
 *  - Emits an Inbox notification (type: agent_message) confirming revocation
 *    and inviting re-acceptance.
 *  - Logs to plugins.log.
 *
 * Note on stdio children: M3's Option A model (see transport-dispatch.ts:18-20
 * and TDR-035 §5) does NOT maintain long-lived stdio children at the loader
 * level — adapters spawn per-request. Stdio children die naturally when the
 * SDK session ends; revoke does not kill them directly. The plan's original
 * wording of "SIGTERMs stdio child if running" was aspirational for a future
 * long-lived model and is intentionally out of scope for M3 Phase C.
 *
 * Graceful no-op: if the plugin has no lockfile entry, returns
 * { revoked: false, reason: "no_entry" } without throwing. Users may double-
 * click revoke; the spec explicitly allows this.
 *
 * All cross-module imports are dynamic per TDR-032 discipline to avoid
 * module-load cycles with @/lib/agents/runtime/catalog.ts.
 */
export async function revokePluginCapabilities(
  pluginId: string,
): Promise<
  | { revoked: true; bustedEntries: string[] }
  | { revoked: false; reason: "no_entry" }
> {
  // Step 1 — Check for existing entry. If none, no-op gracefully.
  const lock = readPluginsLock();
  if (!lock.accepted[pluginId]) {
    return { revoked: false, reason: "no_entry" };
  }

  // Step 2 — Collect in-process SDK entry paths for cache-bust BEFORE removing
  // the lock entry. `listAcceptedInProcessEntriesForPlugin` re-reads the lock
  // to determine "accepted" status, so removing first would give an empty list.
  let bustedEntries: string[] = [];
  try {
    const { listAcceptedInProcessEntriesForPlugin } = await import(
      "@/lib/plugins/mcp-loader"
    );
    bustedEntries = await listAcceptedInProcessEntriesForPlugin(pluginId);
  } catch (err) {
    // Cache-bust is best-effort — log and continue. Removing the lock entry
    // is the authoritative revoke effect; a stale require.cache only matters
    // if the plugin is immediately re-installed and re-accepted, in which
    // case the user can reload_plugin explicitly.
    logToFile(
      `[capability-check] WARN: failed to list in-process entries for ${pluginId} during revoke: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (bustedEntries.length > 0) {
    try {
      const { bustInProcessServerCache } = await import(
        "@/lib/plugins/transport-dispatch"
      );
      for (const entryPath of bustedEntries) {
        bustInProcessServerCache(entryPath);
      }
    } catch (err) {
      logToFile(
        `[capability-check] WARN: failed to bust require.cache for ${pluginId} during revoke: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Step 3 — Remove the lockfile entry. This is the authoritative effect.
  removePluginsLockEntry(pluginId);

  // Step 4 — Log the revocation.
  const username = (() => {
    try {
      return os.userInfo().username;
    } catch {
      return "unknown";
    }
  })();
  logToFile(
    `[capability-check] plugin ${pluginId} capabilities revoked by ${username}`,
  );

  // Step 5 — Emit an Inbox notification. DB insert is best-effort: if the
  // notifications table isn't available (e.g. running outside a Next.js
  // request context during tests that don't mock the DB), log and continue.
  try {
    const [{ db }, { notifications }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/db/schema"),
    ]);
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      taskId: null,
      type: "agent_message",
      title: `Plugin capabilities revoked: ${pluginId}`,
      body: JSON.stringify({
        pluginId,
        action: "revoked",
        reAcceptHint:
          "Use grant_plugin_capabilities to re-accept.",
      }),
      read: false,
      createdAt: new Date(),
    });
  } catch (err) {
    logToFile(
      `[capability-check] WARN: failed to insert revoke notification for ${pluginId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { revoked: true, bustedEntries };
}

// ---------------------------------------------------------------------------
// T15: Grant flow (inverse of T12 revoke)
// ---------------------------------------------------------------------------

/**
 * Grant capabilities to a Kind-1 plugin.
 *
 * Effects:
 *  - Reads plugin.yaml, parses the manifest, verifies kind: chat-tools.
 *  - Computes the current canonical manifest hash.
 *  - If `opts.expectedHash` is provided and differs from the current hash,
 *    rejects with `reason: "hash_drift"` — guards against silent-swap
 *    attacks where plugin.yaml is modified between a user reviewing it
 *    and clicking Accept.
 *  - Writes the plugins.lock entry pinning the current hash. Preserves any
 *    pre-existing `toolApprovals` and `expiresAt` so re-grant after a
 *    manifest update doesn't silently wipe per-tool overrides or expiry
 *    settings the user previously set.
 *  - Busts require.cache for any accepted in-process SDK registrations
 *    of this plugin (via reloadPluginMcpRegistrations), so a grant
 *    immediately following a manifest edit sees the fresh module code.
 *  - Emits an Inbox notification (type: agent_message) confirming the grant.
 *  - Logs to plugins.log.
 *
 * Graceful failure modes:
 *   - plugin.yaml missing → { granted: false, reason: "not_found" }
 *   - Manifest unparseable or wrong kind → { granted: false, reason: "not_chat_tools" }
 *   - Hash drift vs. expectedHash → { granted: false, reason: "hash_drift", currentHash }
 *
 * All cross-module imports are dynamic per TDR-032 discipline to avoid
 * module-load cycles with @/lib/agents/runtime/catalog.ts.
 */
export async function grantPluginCapabilities(
  pluginId: string,
  opts?: { expectedHash?: string },
): Promise<
  | { granted: true; hash: string; bustedInProcessEntries: string[] }
  | {
      granted: false;
      reason: "not_found" | "hash_drift" | "not_chat_tools";
      detail?: string;
      currentHash?: string;
    }
> {
  // Step 1 — Read plugin.yaml. Dynamic import of paths helper keeps this
  // module free of any static dependency that could grow a module-load
  // cycle later; see TDR-032.
  const { getAinativePluginsDir: getDir } = await import(
    "@/lib/utils/ainative-paths"
  );
  const pluginYamlPath = path.join(getDir(), pluginId, "plugin.yaml");

  if (!fs.existsSync(pluginYamlPath)) {
    return { granted: false, reason: "not_found" };
  }

  let content: string;
  try {
    content = fs.readFileSync(pluginYamlPath, "utf-8");
  } catch (err) {
    return {
      granted: false,
      reason: "not_found",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  // Step 2 — Parse manifest and verify kind.
  let raw: unknown;
  try {
    raw = yaml.load(content);
  } catch (err) {
    return {
      granted: false,
      reason: "not_chat_tools",
      detail: `plugin.yaml is not valid YAML: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      granted: false,
      reason: "not_chat_tools",
      detail: "plugin.yaml is not a YAML mapping",
    };
  }

  const manifestRecord = raw as Record<string, unknown>;
  if (manifestRecord.kind !== "chat-tools") {
    return {
      granted: false,
      reason: "not_chat_tools",
      detail: `plugin kind is "${String(manifestRecord.kind ?? "missing")}", expected "chat-tools"`,
    };
  }

  const capabilities = Array.isArray(manifestRecord.capabilities)
    ? (manifestRecord.capabilities.filter(
        (c): c is Capability =>
          typeof c === "string" &&
          (CAPABILITY_VALUES as readonly string[]).includes(c),
      ) as Capability[])
    : [];

  // Step 3 — Compute hash and check silent-swap guard.
  let currentHash: string;
  try {
    currentHash = deriveManifestHash(content);
  } catch (err) {
    return {
      granted: false,
      reason: "not_chat_tools",
      detail: `failed to derive manifest hash: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (opts?.expectedHash && opts.expectedHash !== currentHash) {
    return {
      granted: false,
      reason: "hash_drift",
      currentHash,
    };
  }

  // Step 4 — Preserve pre-existing toolApprovals / expiresAt from a prior
  // lockfile entry. Re-grant after a manifest update should not clobber
  // user-set per-tool overrides or expiry.
  const existing = readPluginsLock().accepted[pluginId];
  const username = (() => {
    try {
      return os.userInfo().username;
    } catch {
      return "unknown";
    }
  })();

  const nextEntry: PluginsLockEntry = {
    manifestHash: currentHash,
    capabilities,
    acceptedAt: new Date().toISOString(),
    acceptedBy: username,
    ...(existing?.toolApprovals !== undefined && {
      toolApprovals: existing.toolApprovals,
    }),
    ...(existing?.expiresAt !== undefined && {
      expiresAt: existing.expiresAt,
    }),
  };

  writePluginsLock(pluginId, nextEntry);

  // Step 5 — Transport-aware reload: bust require.cache for in-process SDK
  // registrations so a grant immediately after a manifest edit sees fresh
  // module code. Errors here are best-effort — the authoritative effect
  // (lockfile write) has already landed.
  let bustedInProcessEntries: string[] = [];
  try {
    const { reloadPluginMcpRegistrations } = await import(
      "@/lib/plugins/mcp-loader"
    );
    const reloaded = await reloadPluginMcpRegistrations(pluginId);
    bustedInProcessEntries = reloaded.bustedInProcessEntries;
  } catch (err) {
    logToFile(
      `[capability-check] WARN: failed to reload plugin ${pluginId} after grant: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Step 6 — Log the grant.
  logToFile(
    `[capability-check] plugin ${pluginId} capabilities granted by ${username}`,
  );

  // Step 7 — Emit Inbox notification. Best-effort — never fail the grant.
  try {
    const [{ db }, { notifications }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/db/schema"),
    ]);
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      taskId: null,
      type: "agent_message",
      title: `Plugin capabilities granted: ${pluginId}`,
      body: JSON.stringify({
        pluginId,
        action: "granted",
        hash: currentHash,
        capabilities,
      }),
      read: false,
      createdAt: new Date(),
    });
  } catch (err) {
    logToFile(
      `[capability-check] WARN: failed to insert grant notification for ${pluginId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { granted: true, hash: currentHash, bustedInProcessEntries };
}

// Re-export for consumers that import everything from this module.
export { CAPABILITY_VALUES };
export type { Capability };
