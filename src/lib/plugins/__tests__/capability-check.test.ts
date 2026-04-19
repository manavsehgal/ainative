/**
 * capability-check.test.ts — TDR-035 §3 canonical hash + plugins.lock I/O
 *
 * All 18 required assertions from the T2 plan.
 * Uses real fs (tmpdir) — no mocked fs.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  deriveManifestHash,
  readPluginsLock,
  writePluginsLock,
  removePluginsLockEntry,
  isCapabilityAccepted,
  type PluginsLockEntry,
} from "../capability-check";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "capability-check-"));
  process.env.AINATIVE_DATA_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AINATIVE_DATA_DIR;
});

const lockPath = () => path.join(tmpDir, "plugins.lock");
const bakPath = () => path.join(tmpDir, "plugins.lock.bak");
const logsPath = () => path.join(tmpDir, "logs", "plugins.log");

function makeEntry(overrides: Partial<PluginsLockEntry> = {}): PluginsLockEntry {
  return {
    manifestHash: "sha256:" + "a".repeat(64),
    capabilities: ["net"],
    acceptedAt: "2026-04-20T09:00:00Z",
    acceptedBy: "test-user",
    ...overrides,
  };
}

// A minimal valid plugin.yaml YAML string.
function makeYaml(overrides: Record<string, unknown> = {}): string {
  const base: Record<string, unknown> = {
    id: "gmail-triage",
    version: "1.0.0",
    apiVersion: "0.15",
    kind: "chat-tools",
    capabilities: ["net"],
    ...overrides,
  };
  // Produce YAML manually to control key order.
  return Object.entries(base)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}`;
      return `${k}: ${v}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Section 1: deriveManifestHash
// ---------------------------------------------------------------------------

describe("capability-check — deriveManifestHash", () => {
  // 1. Determinism: same content → same hash across multiple calls
  it("1. Returns same hash for the same YAML content (determinism across 10 calls)", () => {
    const yamlContent = makeYaml();
    const hashes = Array.from({ length: 10 }, () => deriveManifestHash(yamlContent));
    const unique = new Set(hashes);
    expect(unique.size).toBe(1);
  });

  // 2. Cosmetic-field exclusion: name/description/tags/author changes don't affect hash
  it("2. Produces same hash when only cosmetic fields differ (name, description, tags, author)", () => {
    const base = makeYaml();
    const withCosmeticA = makeYaml({
      name: "Gmail Triage v1",
      description: "First description",
      tags: ["email"],
      author: "alice",
    });
    const withCosmeticB = makeYaml({
      name: "Gmail Triage v2",
      description: "Corrected typo in description",
      tags: ["email", "ai"],
      author: "bob",
    });

    const hashBase = deriveManifestHash(base);
    const hashA = deriveManifestHash(withCosmeticA);
    const hashB = deriveManifestHash(withCosmeticB);

    expect(hashA).toBe(hashBase);
    expect(hashB).toBe(hashBase);
  });

  // 3. Security-field sensitivity: different capabilities → different hashes
  it("3. Produces different hashes when capabilities differ (same id+version)", () => {
    const withNet = makeYaml({ capabilities: ["net"] });
    const withFs = makeYaml({ capabilities: ["fs"] });
    const withBoth = makeYaml({ capabilities: ["net", "fs"] });

    expect(deriveManifestHash(withNet)).not.toBe(deriveManifestHash(withFs));
    expect(deriveManifestHash(withNet)).not.toBe(deriveManifestHash(withBoth));
    expect(deriveManifestHash(withFs)).not.toBe(deriveManifestHash(withBoth));
  });

  // 4. Array order matters: [net, fs] vs [fs, net] → different hashes
  it("4. Array order matters — [net, fs] vs [fs, net] produce different hashes", () => {
    const netFirst = makeYaml({ capabilities: ["net", "fs"] });
    const fsFirst = makeYaml({ capabilities: ["fs", "net"] });
    expect(deriveManifestHash(netFirst)).not.toBe(deriveManifestHash(fsFirst));
  });

  // 5. Key order doesn't matter: same semantic content in different YAML key order → same hash
  it("5. Key order in YAML doesn't affect hash (canonical form sorts keys)", () => {
    // Produce two YAML strings with the same fields but different key ordering.
    const orderA = [
      "id: gmail-triage",
      "version: 1.0.0",
      "apiVersion: \"0.15\"",
      "kind: chat-tools",
      "capabilities:",
      "  - net",
    ].join("\n");

    const orderB = [
      "kind: chat-tools",
      "capabilities:",
      "  - net",
      "id: gmail-triage",
      "apiVersion: \"0.15\"",
      "version: 1.0.0",
    ].join("\n");

    expect(deriveManifestHash(orderA)).toBe(deriveManifestHash(orderB));
  });

  // 6. Hash format: "sha256:" + 64 lowercase hex chars
  it("6. Output starts with 'sha256:' followed by 64 lowercase hex characters", () => {
    const hash = deriveManifestHash(makeYaml());
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// Section 2: readPluginsLock
// ---------------------------------------------------------------------------

describe("capability-check — readPluginsLock", () => {
  // 7. Absent file → empty state, no exception
  it("7. Returns empty state when plugins.lock does not exist", () => {
    const result = readPluginsLock();
    expect(result).toEqual({ version: 1, accepted: {} });
  });

  // 8. Corrupted YAML → empty state + warning in plugins.log
  it("8. Corrupted YAML → returns empty state and writes warning to plugins.log", () => {
    fs.writeFileSync(lockPath(), "not valid yaml: [[[\n");
    const result = readPluginsLock();
    expect(result).toEqual({ version: 1, accepted: {} });
    // Log file must exist with a warning line.
    expect(fs.existsSync(logsPath())).toBe(true);
    const log = fs.readFileSync(logsPath(), "utf-8");
    expect(log).toMatch(/WARN.*plugins\.lock/);
  });

  // 9. Valid YAML but wrong schema → empty state + log
  it("9. Valid YAML with wrong schema → returns empty state and writes warning to plugins.log", () => {
    // Write valid YAML that doesn't match PluginsLockFileSchema.
    fs.writeFileSync(lockPath(), "version: 99\naccepted: {}\n");
    const result = readPluginsLock();
    expect(result).toEqual({ version: 1, accepted: {} });
    expect(fs.existsSync(logsPath())).toBe(true);
    const log = fs.readFileSync(logsPath(), "utf-8");
    expect(log).toMatch(/WARN.*plugins\.lock/);
  });
});

// ---------------------------------------------------------------------------
// Section 3: writePluginsLock + round-trip
// ---------------------------------------------------------------------------

describe("capability-check — writePluginsLock", () => {
  // 10. Round-trip: write → read → deep equal
  it("10. Round-trips — writePluginsLock then readPluginsLock returns deep-equal entry", () => {
    const entry = makeEntry({ capabilities: ["net", "fs"] });
    writePluginsLock("gmail-triage", entry);
    const lock = readPluginsLock();
    expect(lock.version).toBe(1);
    expect(lock.accepted["gmail-triage"]).toEqual(entry);
  });

  // 11. .bak created on subsequent write (when primary already exists)
  it("11. plugins.lock.bak is created on a second write with prior content", () => {
    const entry1 = makeEntry({ capabilities: ["net"] });
    writePluginsLock("gmail-triage", entry1);

    const priorContent = fs.readFileSync(lockPath(), "utf-8");

    const entry2 = makeEntry({ capabilities: ["fs"] });
    writePluginsLock("gmail-triage", entry2);

    expect(fs.existsSync(bakPath())).toBe(true);
    const bakContent = fs.readFileSync(bakPath(), "utf-8");
    expect(bakContent).toBe(priorContent);
  });

  // 12. .bak NOT created on first write (nothing to back up)
  it("12. plugins.lock.bak is NOT created on first write (no prior file to back up)", () => {
    writePluginsLock("gmail-triage", makeEntry());
    expect(fs.existsSync(bakPath())).toBe(false);
  });

  // 13. No leftover tmp files after write
  it("13. No leftover .tmp-* files in dataDir after write", () => {
    writePluginsLock("gmail-triage", makeEntry());
    const files = fs.readdirSync(tmpDir);
    const strayTmp = files.filter((f) => f.startsWith("plugins.lock.tmp-"));
    expect(strayTmp).toHaveLength(0);
  });

  // 14. 0600 permissions on POSIX
  it("14. plugins.lock has mode 0600 after write (POSIX only)", () => {
    if (process.platform === "win32") return; // skip on Windows
    writePluginsLock("gmail-triage", makeEntry());
    const mode = fs.statSync(lockPath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

// ---------------------------------------------------------------------------
// Section 4: removePluginsLockEntry
// ---------------------------------------------------------------------------

describe("capability-check — removePluginsLockEntry", () => {
  // 15. Remove one entry, the other remains
  it("15. Removes only the specified entry — other entries survive", () => {
    writePluginsLock("a", makeEntry({ capabilities: ["net"] }));
    writePluginsLock("b", makeEntry({ capabilities: ["fs"] }));

    removePluginsLockEntry("a");

    const lock = readPluginsLock();
    expect(Object.keys(lock.accepted)).toEqual(["b"]);
    expect(lock.accepted["b"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Section 5: isCapabilityAccepted
// ---------------------------------------------------------------------------

describe("capability-check — isCapabilityAccepted", () => {
  const yamlContent = makeYaml({ capabilities: ["net"] });
  const currentHash = () => deriveManifestHash(yamlContent);

  // 16. No entry → not_accepted
  it("16. Returns not_accepted when no entry exists for pluginId", () => {
    const result = isCapabilityAccepted("gmail-triage", currentHash());
    expect(result).toEqual({ accepted: false, reason: "not_accepted" });
  });

  // 17. Hash matches → accepted: true
  it("17. Returns accepted: true when entry exists and hash matches", () => {
    const hash = currentHash();
    writePluginsLock("gmail-triage", makeEntry({ manifestHash: hash }));
    const result = isCapabilityAccepted("gmail-triage", hash);
    expect(result).toEqual({ accepted: true });
  });

  // 18. Hash drift → not_accepted + reason: hash_drift + acceptedHash
  it("18. Returns hash_drift when entry exists but hash has changed", () => {
    const oldHash = "sha256:" + "b".repeat(64);
    const newHash = currentHash();
    expect(oldHash).not.toBe(newHash); // sanity

    writePluginsLock("gmail-triage", makeEntry({ manifestHash: oldHash }));
    const result = isCapabilityAccepted("gmail-triage", newHash);

    expect(result).toEqual({
      accepted: false,
      reason: "hash_drift",
      acceptedHash: oldHash,
    });
  });
});
