import { describe, expect, it } from "vitest";
import { sanitizeTableData, generateSeedData, parseSeedCsv, writeSeedCsvs } from "../seed-generator";
import { getSanitizer, listSanitizers } from "../sanitizers";
import type { SeedDataConfig } from "../sanitizers";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("sanitizer registry", () => {
  it("lists all 7 strategies", () => {
    expect(listSanitizers().sort()).toEqual([
      "derive", "faker", "hash", "keep", "randomize", "redact", "shift",
    ]);
  });

  it("throws on unknown strategy", () => {
    expect(() => getSanitizer("unknown")).toThrow("Unknown sanitizer");
  });
});

describe("individual sanitizers", () => {
  const ctx = { columnName: "test", rowIndex: 0, otherColumns: {}, allValues: [] };

  it("keep returns value unchanged", () => {
    expect(getSanitizer("keep").sanitize("hello", {}, ctx)).toBe("hello");
    expect(getSanitizer("keep").sanitize(42, {}, ctx)).toBe(42);
    expect(getSanitizer("keep").sanitize(null, {}, ctx)).toBe(null);
  });

  it("redact returns null by default", () => {
    expect(getSanitizer("redact").sanitize("secret", {}, ctx)).toBe(null);
  });

  it("redact returns placeholder when provided", () => {
    expect(getSanitizer("redact").sanitize("secret", { placeholder: "[REDACTED]" }, ctx))
      .toBe("[REDACTED]");
  });

  it("randomize generates integer within range", () => {
    const result = getSanitizer("randomize").sanitize(0, { min: 10, max: 100, type: "int" }, ctx);
    expect(typeof result).toBe("number");
    expect(result as number).toBeGreaterThanOrEqual(10);
    expect(result as number).toBeLessThanOrEqual(100);
  });

  it("randomize generates float within range", () => {
    const result = getSanitizer("randomize").sanitize(0, { min: 1.0, max: 10.0, type: "float" }, ctx);
    expect(typeof result).toBe("number");
    expect(result as number).toBeGreaterThanOrEqual(1.0);
    expect(result as number).toBeLessThanOrEqual(10.0);
  });

  it("shift offsets a date", () => {
    const result = getSanitizer("shift").sanitize("2026-04-11", { offsetDays: -7 }, ctx);
    expect(result).toBe("2026-04-04");
  });

  it("shift handles null values", () => {
    expect(getSanitizer("shift").sanitize(null, {}, ctx)).toBe(null);
  });

  it("faker generates synthetic values", () => {
    const result = getSanitizer("faker").sanitize("John Doe", { fakerMethod: "person.firstName" }, ctx);
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  it("derive computes from other columns", () => {
    const derivCtx = { ...ctx, otherColumns: { shares: 10, price: 150.5 } };
    const result = getSanitizer("derive").sanitize(0, { formula: "shares * price" }, derivCtx);
    expect(result).toBe(1505);
  });

  it("hash produces consistent prefix + hex output", () => {
    const result = getSanitizer("hash").sanitize("test-value", { prefix: "ACCT-" }, ctx);
    expect(typeof result).toBe("string");
    expect((result as string).startsWith("ACCT-")).toBe(true);
    expect((result as string).length).toBe(13); // "ACCT-" + 8 hex chars
  });

  it("hash returns null for null input", () => {
    expect(getSanitizer("hash").sanitize(null, {}, ctx)).toBe(null);
  });
});

describe("sanitizeTableData", () => {
  const config: SeedDataConfig = {
    tables: {
      positions: {
        sanitize: {
          symbol: { strategy: "keep" },
          name: { strategy: "faker", params: { fakerMethod: "company.name" } },
          shares: { strategy: "randomize", params: { min: 10, max: 100, type: "int" } },
        },
      },
    },
  };

  const columns = ["symbol", "name", "shares", "notes"];
  const rows = [
    { symbol: "AAPL", name: "Apple Inc.", shares: 40, notes: "My real notes" },
    { symbol: "MSFT", name: "Microsoft", shares: 28, notes: "Private info" },
  ];

  it("applies per-column strategies", () => {
    const result = sanitizeTableData("positions", columns, rows, config);
    expect(result).toHaveLength(2);

    // 'keep' preserves original
    expect(result[0].symbol).toBe("AAPL");

    // 'faker' generates synthetic
    expect(result[0].name).not.toBe("Apple Inc.");
    expect(typeof result[0].name).toBe("string");

    // 'randomize' generates within range
    expect(result[0].shares).toBeGreaterThanOrEqual(10);
    expect(result[0].shares).toBeLessThanOrEqual(100);
  });

  it("defaults unlisted columns to redact", () => {
    const result = sanitizeTableData("positions", columns, rows, config);
    // 'notes' is not in config, defaults to redact (null)
    expect(result[0].notes).toBe(null);
  });
});

describe("generateSeedData", () => {
  it("runs the full pipeline and returns stats", () => {
    const result = generateSeedData({
      tables: {
        positions: {
          columns: ["symbol", "price"],
          rows: [
            { symbol: "AAPL", price: 173 },
            { symbol: "MSFT", price: 401 },
          ],
        },
      },
      config: {
        tables: {
          positions: {
            sanitize: {
              symbol: { strategy: "keep" },
              price: { strategy: "randomize", params: { min: 100, max: 500, type: "float" } },
            },
          },
        },
      },
    });

    expect(result.stats.tablesProcessed).toBe(1);
    expect(result.stats.totalRows).toBe(2);
    expect(result.tables.positions).toHaveLength(2);
    expect(result.tables.positions[0].symbol).toBe("AAPL");
  });
});

describe("CSV round-trip", () => {
  it("writes and parses CSV correctly", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "stagent-csv-"));
    try {
      const tables = {
        test: [
          { name: "Alice", score: 95 },
          { name: "Bob", score: 87 },
        ],
      };

      writeSeedCsvs(tempDir, tables as Record<string, Record<string, unknown>[]>);
      const csv = readFileSync(join(tempDir, "seed-data", "test.csv"), "utf-8");
      const parsed = parseSeedCsv(csv);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("Alice");
      expect(parsed[0].score).toBe("95");
      expect(parsed[1].name).toBe("Bob");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("handles commas and quotes in values", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "stagent-csv-escape-"));
    try {
      const tables = {
        test: [{ value: 'hello, "world"' }],
      };

      writeSeedCsvs(tempDir, tables as Record<string, Record<string, unknown>[]>);
      const csv = readFileSync(join(tempDir, "seed-data", "test.csv"), "utf-8");
      expect(csv).toContain('"hello, ""world"""');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
