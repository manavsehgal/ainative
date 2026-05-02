import { describe, expect, it } from "vitest";
import { formatKpi } from "../format-kpi";

describe("formatKpi — value to display string", () => {
  it("formats integers with thousand separators", () => {
    expect(formatKpi(1234, "int")).toBe("1,234");
    expect(formatKpi(0, "int")).toBe("0");
    expect(formatKpi(7, "int")).toBe("7");
  });

  it("formats currency with USD symbol and 2 decimals", () => {
    expect(formatKpi(12.5, "currency")).toBe("$12.50");
    expect(formatKpi(1234.5, "currency")).toBe("$1,234.50");
    expect(formatKpi(0, "currency")).toBe("$0.00");
  });

  it("formats percent values (0..1) as %", () => {
    expect(formatKpi(0.42, "percent")).toBe("42%");
    expect(formatKpi(1, "percent")).toBe("100%");
    expect(formatKpi(0, "percent")).toBe("0%");
  });

  it("formats duration values (seconds) as compact label", () => {
    expect(formatKpi(45, "duration")).toBe("45s");
    expect(formatKpi(125, "duration")).toBe("2m 5s");
    expect(formatKpi(3700, "duration")).toBe("1h 1m");
  });

  it("formats relative timestamps (epoch ms) as 'in 2h' / '3d ago'", () => {
    const now = Date.now();
    expect(formatKpi(now + 2 * 3_600_000, "relative")).toMatch(/in 2h/);
    expect(formatKpi(now - 3 * 86_400_000, "relative")).toMatch(/3d ago/);
  });

  it("returns string values unchanged when given a string", () => {
    expect(formatKpi("custom", "int")).toBe("custom");
  });

  it("renders null/undefined values as em dash", () => {
    expect(formatKpi(null, "int")).toBe("—");
    expect(formatKpi(undefined, "int")).toBe("—");
  });
});
