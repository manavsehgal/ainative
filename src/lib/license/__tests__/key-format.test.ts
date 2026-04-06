import { describe, expect, it } from "vitest";
import { generateLicenseKey, validateLicenseKey, formatKeyInput } from "../key-format";

describe("key-format", () => {
  describe("generateLicenseKey", () => {
    it("generates a key in STAG-XXXX-XXXX-XXXX-XXXX format", () => {
      const key = generateLicenseKey();
      expect(key).toMatch(/^STAG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    });

    it("generates keys that pass validation", () => {
      for (let i = 0; i < 20; i++) {
        const key = generateLicenseKey();
        const result = validateLicenseKey(key);
        expect(result.valid, `Key ${key} should be valid`).toBe(true);
      }
    });

    it("generates unique keys", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 50; i++) {
        keys.add(generateLicenseKey());
      }
      expect(keys.size).toBe(50);
    });
  });

  describe("validateLicenseKey", () => {
    it("accepts a valid generated key", () => {
      const key = generateLicenseKey();
      expect(validateLicenseKey(key)).toEqual({ valid: true });
    });

    it("rejects empty string", () => {
      expect(validateLicenseKey("")).toEqual({
        valid: false,
        error: expect.stringContaining("Invalid format"),
      });
    });

    it("rejects wrong prefix", () => {
      expect(validateLicenseKey("XXXX-ABCD-EFGH-JKMN-PQRS")).toEqual({
        valid: false,
        error: expect.stringContaining("Invalid format"),
      });
    });

    it("rejects ambiguous characters (0, O, 1, I, L)", () => {
      expect(validateLicenseKey("STAG-0OIL-ABCD-EFGH-JKMN")).toEqual({
        valid: false,
        error: expect.stringContaining("Invalid format"),
      });
    });

    it("rejects a key with a bad checksum", () => {
      const key = generateLicenseKey();
      // Flip the last character
      const bad = key.slice(0, -1) + (key.slice(-1) === "A" ? "B" : "A");
      const result = validateLicenseKey(bad);
      expect(result.valid).toBe(false);
    });

    it("accepts lowercase input (case-insensitive)", () => {
      const key = generateLicenseKey();
      expect(validateLicenseKey(key.toLowerCase())).toEqual({ valid: true });
    });
  });

  describe("formatKeyInput", () => {
    it("adds dashes and STAG prefix", () => {
      expect(formatKeyInput("ABCD")).toBe("STAG-ABCD");
      expect(formatKeyInput("ABCDEFGH")).toBe("STAG-ABCD-EFGH");
    });

    it("strips invalid characters", () => {
      expect(formatKeyInput("AB!@CD")).toBe("STAG-ABCD");
    });

    it("converts to uppercase", () => {
      expect(formatKeyInput("abcd")).toBe("STAG-ABCD");
    });

    it("limits to 16 characters", () => {
      expect(formatKeyInput("ABCDEFGHJKMNPQRS")).toBe("STAG-ABCD-EFGH-JKMN-PQRS");
      expect(formatKeyInput("ABCDEFGHJKMNPQRSTUV")).toBe("STAG-ABCD-EFGH-JKMN-PQRS");
    });
  });
});
