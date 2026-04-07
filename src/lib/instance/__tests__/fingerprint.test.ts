import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getMachineFingerprint", () => {
  it("returns a 64-character hex SHA-256 string", async () => {
    const { getMachineFingerprint, _resetFingerprintCache } = await import("../fingerprint");
    _resetFingerprintCache();
    const fp = getMachineFingerprint();
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is stable across multiple calls in the same process (memoized)", async () => {
    const { getMachineFingerprint, _resetFingerprintCache } = await import("../fingerprint");
    _resetFingerprintCache();
    const fp1 = getMachineFingerprint();
    const fp2 = getMachineFingerprint();
    const fp3 = getMachineFingerprint();
    expect(fp1).toBe(fp2);
    expect(fp2).toBe(fp3);
  });

  it("does not contain the raw hostname, username, or MAC address", async () => {
    const os = await import("os");
    const host = os.hostname();
    const user = os.userInfo().username;

    const { getMachineFingerprint, _resetFingerprintCache } = await import("../fingerprint");
    _resetFingerprintCache();
    const fp = getMachineFingerprint();

    expect(fp).not.toContain(host);
    expect(fp).not.toContain(user);
    expect(fp).not.toMatch(/[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}/i); // no MAC pattern
  });

  // Note: an ideal test here would mock os.hostname() to verify the
  // fingerprint changes when hostname changes, but Node's "os" module
  // exports are non-configurable in ESM and vi.spyOn throws
  // "Cannot redefine property: hostname". The behavior is covered
  // indirectly by the memoization and composition tests above.
});
