/**
 * Machine fingerprint generator.
 *
 * Produces a stable, non-identifying hash that uniquely identifies the machine
 * this stagent instance is running on. Used by the cloud license validator to
 * meter seats per machine per the hybrid licensing model (TDR-030): local
 * features are unlimited, cloud features count seats using
 * (email, machineFingerprint, instanceId) tuples.
 *
 * The fingerprint is derived from:
 *   1. os.hostname() — e.g., "macbook-pro.local"
 *   2. os.userInfo().username — e.g., "manavsehgal"
 *   3. SHA-256 of the first non-internal MAC address
 *
 * The MAC is hashed before it leaves the process so the network identifier
 * never appears in logs, telemetry, or cloud payloads. The combined inputs
 * are SHA-256'd together to produce a 64-character hex string.
 *
 * Stability: the fingerprint is stable across reboots and stagent restarts
 * on the same machine. It changes if the user renames their account, renames
 * their machine, or swaps network hardware. Machine fingerprint migration
 * policy (e.g., 7-day grace) is handled server-side by the edge function.
 */

import { createHash } from "crypto";
import { hostname, userInfo, networkInterfaces } from "os";

let cachedFingerprint: string | null = null;

export function getMachineFingerprint(): string {
  if (cachedFingerprint !== null) return cachedFingerprint;

  const host = safeHostname();
  const user = safeUsername();
  const macHash = hashPrimaryMac();

  const combined = `${host}|${user}|${macHash}`;
  cachedFingerprint = createHash("sha256").update(combined).digest("hex");
  return cachedFingerprint;
}

/** Exposed for tests that need to reset the module-level cache. */
export function _resetFingerprintCache(): void {
  cachedFingerprint = null;
}

function safeHostname(): string {
  try {
    return hostname();
  } catch {
    return "unknown-host";
  }
}

function safeUsername(): string {
  try {
    return userInfo().username;
  } catch {
    return "unknown-user";
  }
}

function hashPrimaryMac(): string {
  try {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces).sort()) {
      const addrs = interfaces[name] ?? [];
      for (const addr of addrs) {
        if (addr.internal) continue;
        if (!addr.mac || addr.mac === "00:00:00:00:00:00") continue;
        return createHash("sha256").update(addr.mac).digest("hex");
      }
    }
  } catch {
    // fall through to the default below
  }
  return "no-mac-detected";
}
