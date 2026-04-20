/**
 * classify-trust.ts — Two-path plugin trust model (TDR-037)
 *
 * Classifies a plugin bundle into one of two paths at load time:
 *
 *   - "self"        — authored by ainative on the user's behalf, or by the
 *                     user themselves. Zero ceremony: no capability accept,
 *                     no lockfile writes, no hash-drift re-prompt.
 *                     Matches the Claude Code / Codex CLI "trust your own
 *                     code" posture habitual users expect.
 *
 *   - "third-party" — authored elsewhere, installed as foreign code.
 *                     Routes through the full M3 trust machinery:
 *                     click-accept, canonical hash pin, lockfile entry,
 *                     silent-swap guard, optional per-tool approval,
 *                     optional confinement wrap.
 *
 * Consumed by capability-check.ts (early-return for self-extension) and
 * mcp-loader.ts (skip pending_capability_accept state when classifier
 * returns "self"). Pure function — deterministic inputs, no I/O.
 *
 * The settings toggle `plugin-trust-model` ("auto" | "strict" | "off")
 * is resolved at the call site, not here — the classifier answers "which
 * path does this bundle belong on given the auto policy?" and callers
 * combine with the setting.
 *
 * See TDR-037 for the signal rationale and strategy §10 (refused
 * marketplace lane) for the authority this classifier upholds.
 */

import path from "node:path";
import os from "node:os";
import type { PluginManifest } from "./sdk/types";
import { getAinativeAppsDir } from "@/lib/utils/ainative-paths";

export type PluginTrustPath = "self" | "third-party";

export interface ClassifyTrustOptions {
  /**
   * User identity to match against manifest.author for the author-signal.
   * Defaults to `os.userInfo().username`. Pass the user email from Settings
   * if configured — liberal match (any hit → self).
   */
  userIdentity?: string;
  /**
   * Override the apps base dir (defaults to getAinativeAppsDir()). Primarily
   * for tests that want a custom AINATIVE_DATA_DIR-independent path.
   */
  appsBaseDir?: string;
}

/**
 * Classify a plugin bundle's trust path.
 *
 * Self-extension signals — ANY one flips the bundle to "self":
 *   1. manifest.origin === "ainative-internal"   (explicit signal set by
 *      ainative's own chat tools + ainative-app skill + create_plugin_spec)
 *   2. manifest.author === "ainative"            (builtin dogfood convention)
 *   3. manifest.author === userIdentity          (user authored it themselves)
 *   4. rootDir starts with getAinativeAppsDir()  (composition-bundle path)
 *   5. capabilities array is empty/missing       (nothing to gate regardless)
 *
 * When NONE of the above hold AND manifest.kind === "chat-tools" AND
 * capabilities is non-empty, returns "third-party" — the path that
 * justifies the full M3 machinery. In all other cases returns "self".
 *
 * Primitives-bundle plugins (kind: primitives-bundle) ALWAYS classify as
 * "self" in v1 because they have no executable surface beyond the loaders
 * that already validate via Zod. Strategy §10 Amendment II: MCP resource
 * providers absorbed the Kind 2 concern; primitives bundles can't ship
 * code. Only Kind 1 chat-tools plugins carry real risk.
 */
export function classifyPluginTrust(
  manifest: PluginManifest,
  rootDir: string,
  opts: ClassifyTrustOptions = {}
): PluginTrustPath {
  // Primitives-bundle → data-only → always self.
  if (manifest.kind === "primitives-bundle") return "self";

  // Signal 1: explicit origin field
  if (manifest.origin === "ainative-internal") return "self";

  // Signal 5 (cheap, evaluate early): empty or missing capabilities array
  // means nothing to gate. Kind 1 plugins with zero capabilities are
  // structurally equivalent to composition — trust path doesn't matter.
  if (!manifest.capabilities || manifest.capabilities.length === 0) {
    return "self";
  }

  // Signals 2 + 3: author match
  if (manifest.author) {
    if (manifest.author === "ainative") return "self";
    const currentUser = opts.userIdentity ?? os.userInfo().username;
    if (manifest.author === currentUser) return "self";
  }

  // Signal 4: bundle lives under the composition-apps path
  const appsBase = opts.appsBaseDir ?? getAinativeAppsDir();
  // Normalize both sides so trailing-slash or casing differences don't
  // break the prefix check on macOS/Windows. path.resolve collapses
  // trailing separators and resolves relative segments.
  const normalizedRoot = path.resolve(rootDir);
  const normalizedApps = path.resolve(appsBase);
  const sep = path.sep;
  if (
    normalizedRoot === normalizedApps ||
    normalizedRoot.startsWith(normalizedApps + sep)
  ) {
    return "self";
  }

  // Explicit origin or absence of any self-signal → third-party.
  // manifest.origin === "third-party" (explicit) falls through here.
  return "third-party";
}
