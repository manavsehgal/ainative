import { describe, expect, it } from "vitest";
import { parseDuration, formatDuration, checkDelayStep } from "../delay";

describe("parseDuration", () => {
  describe("valid inputs", () => {
    it("parses minutes", () => {
      expect(parseDuration("1m")).toBe(60_000);
      expect(parseDuration("30m")).toBe(30 * 60_000);
    });

    it("parses hours", () => {
      expect(parseDuration("1h")).toBe(60 * 60_000);
      expect(parseDuration("2h")).toBe(2 * 60 * 60_000);
    });

    it("parses days", () => {
      expect(parseDuration("1d")).toBe(24 * 60 * 60_000);
      expect(parseDuration("3d")).toBe(3 * 24 * 60 * 60_000);
    });

    it("parses weeks", () => {
      expect(parseDuration("1w")).toBe(7 * 24 * 60 * 60_000);
      expect(parseDuration("2w")).toBe(14 * 24 * 60 * 60_000);
    });
  });

  describe("bounds", () => {
    it("accepts minimum of 1 minute", () => {
      expect(parseDuration("1m")).toBe(60_000);
    });

    it("accepts maximum of 30 days", () => {
      expect(parseDuration("30d")).toBe(30 * 24 * 60 * 60_000);
    });

    it("rejects durations below 1 minute", () => {
      // Note: "0m" is syntactically valid but below minimum
      expect(() => parseDuration("0m")).toThrow(/minimum/i);
    });

    it("rejects durations above 30 days", () => {
      expect(() => parseDuration("31d")).toThrow(/maximum/i);
      expect(() => parseDuration("5w")).toThrow(/maximum/i);
    });
  });

  describe("invalid formats", () => {
    it("rejects empty string", () => {
      expect(() => parseDuration("")).toThrow(/invalid duration/i);
    });

    it("rejects missing unit", () => {
      expect(() => parseDuration("30")).toThrow(/invalid duration/i);
    });

    it("rejects missing number", () => {
      expect(() => parseDuration("m")).toThrow(/invalid duration/i);
    });

    it("rejects unsupported units", () => {
      expect(() => parseDuration("30s")).toThrow(/invalid duration/i);
      expect(() => parseDuration("1y")).toThrow(/invalid duration/i);
    });

    it("rejects compound durations", () => {
      expect(() => parseDuration("3d2h")).toThrow(/invalid duration/i);
      expect(() => parseDuration("1h30m")).toThrow(/invalid duration/i);
    });

    it("rejects decimal values", () => {
      expect(() => parseDuration("1.5h")).toThrow(/invalid duration/i);
    });

    it("rejects negative values", () => {
      expect(() => parseDuration("-1h")).toThrow(/invalid duration/i);
    });

    it("rejects whitespace", () => {
      expect(() => parseDuration(" 1h")).toThrow(/invalid duration/i);
      expect(() => parseDuration("1h ")).toThrow(/invalid duration/i);
      expect(() => parseDuration("1 h")).toThrow(/invalid duration/i);
    });

    it("rejects uppercase units", () => {
      // Strict format — users must use lowercase per the pattern hint
      expect(() => parseDuration("1H")).toThrow(/invalid duration/i);
    });
  });

  describe("error messages", () => {
    it("includes format hint in invalid-format errors", () => {
      expect(() => parseDuration("bogus")).toThrow(/30m, 2h, 3d, 1w/);
    });

    it("includes the minimum bound in too-small errors", () => {
      expect(() => parseDuration("0m")).toThrow(/1 minute|1m/i);
    });

    it("includes the maximum bound in too-large errors", () => {
      expect(() => parseDuration("31d")).toThrow(/30 day|30d/i);
    });
  });
});

describe("formatDuration", () => {
  it("formats exact minutes", () => {
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(30 * 60_000)).toBe("30m");
  });

  it("formats exact hours", () => {
    expect(formatDuration(60 * 60_000)).toBe("1h");
    expect(formatDuration(2 * 60 * 60_000)).toBe("2h");
  });

  it("formats exact days", () => {
    expect(formatDuration(24 * 60 * 60_000)).toBe("1d");
    expect(formatDuration(3 * 24 * 60 * 60_000)).toBe("3d");
  });

  it("formats exact weeks", () => {
    expect(formatDuration(7 * 24 * 60 * 60_000)).toBe("1w");
    expect(formatDuration(2 * 7 * 24 * 60 * 60_000)).toBe("2w");
  });

  it("prefers the largest exact unit", () => {
    // 7 days = 1w, not 7d
    expect(formatDuration(7 * 24 * 60 * 60_000)).toBe("1w");
    // 24 hours = 1d, not 24h
    expect(formatDuration(24 * 60 * 60_000)).toBe("1d");
    // 60 minutes = 1h, not 60m
    expect(formatDuration(60 * 60_000)).toBe("1h");
  });

  it("falls back to minutes when no larger unit divides cleanly", () => {
    // 90 minutes — not a clean hour
    expect(formatDuration(90 * 60_000)).toBe("90m");
    // 95 minutes — not a clean hour, day, or week
    expect(formatDuration(95 * 60_000)).toBe("95m");
  });

  it("uses hour level when minutes divide cleanly into hours but not days", () => {
    // 25 hours — divides cleanly as hours, but not as a day
    expect(formatDuration(25 * 60 * 60_000)).toBe("25h");
  });

  it("roundtrips with parseDuration for canonical forms", () => {
    const canonical = ["1m", "30m", "1h", "2h", "1d", "3d", "1w", "2w", "30d"];
    for (const input of canonical) {
      expect(formatDuration(parseDuration(input))).toBe(input);
    }
  });
});

describe("checkDelayStep", () => {
  const now = 1_700_000_000_000; // fixed epoch ms for deterministic tests

  it("returns type 'task' for a step without delayDuration", () => {
    expect(checkDelayStep({}, now)).toEqual({ type: "task" });
  });

  it("returns type 'task' when delayDuration is undefined explicitly", () => {
    expect(checkDelayStep({ delayDuration: undefined }, now)).toEqual({ type: "task" });
  });

  it("returns type 'delay' with resumeAt = now + duration for a valid delay", () => {
    const result = checkDelayStep({ delayDuration: "3d" }, now);
    expect(result).toEqual({
      type: "delay",
      resumeAt: now + 3 * 24 * 60 * 60_000,
    });
  });

  it("computes resumeAt correctly for each unit", () => {
    expect(checkDelayStep({ delayDuration: "30m" }, now)).toEqual({
      type: "delay",
      resumeAt: now + 30 * 60_000,
    });
    expect(checkDelayStep({ delayDuration: "2h" }, now)).toEqual({
      type: "delay",
      resumeAt: now + 2 * 60 * 60_000,
    });
    expect(checkDelayStep({ delayDuration: "1w" }, now)).toEqual({
      type: "delay",
      resumeAt: now + 7 * 24 * 60 * 60_000,
    });
  });

  it("throws when delayDuration is present but invalid (boundary responsibility)", () => {
    // The engine should call checkDelayStep AFTER blueprint validation, so invalid
    // formats reaching here are a programming error and must fail loudly.
    expect(() => checkDelayStep({ delayDuration: "bogus" }, now)).toThrow(
      /invalid duration/i,
    );
  });
});
