import { describe, it, expect } from "vitest";
import { migrateKeychainService } from "../keychain-migrate";

describe("migrateKeychainService", () => {
  it("returns false on non-darwin platforms", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });
    try {
      const result = await migrateKeychainService("old", "new", () => {});
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    }
  });

  it("returns false when no old service exists", async () => {
    if (process.platform !== "darwin") return;
    const unique = `ainative-test-${Date.now()}`;
    const result = await migrateKeychainService(`${unique}-nonexistent`, `${unique}-new`, () => {});
    expect(result).toBe(false);
  });
});
