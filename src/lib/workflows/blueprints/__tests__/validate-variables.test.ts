import { describe, it, expect } from "vitest";
import { validateVariables } from "../validate-variables";
import type { BlueprintVariable } from "../types";

describe("validateVariables", () => {
  it("returns no errors when all required fields filled", () => {
    const defs: BlueprintVariable[] = [
      { id: "asset", type: "text", label: "Asset", required: true },
      { id: "horizon", type: "select", label: "Horizon", required: false, options: [{ value: "short", label: "Short" }] },
    ];
    const values = { asset: "NVDA", horizon: "short" };
    expect(validateVariables(values, defs)).toEqual({ errors: {} });
  });

  it("flags missing required text fields", () => {
    const defs: BlueprintVariable[] = [
      { id: "asset", type: "text", label: "Asset", required: true },
    ];
    expect(validateVariables({ asset: "" }, defs)).toEqual({
      errors: { asset: "Asset is required" },
    });
  });

  it("flags missing required select fields", () => {
    const defs: BlueprintVariable[] = [
      { id: "horizon", type: "select", label: "Horizon", required: true,
        options: [{ value: "short", label: "Short" }] },
    ];
    expect(validateVariables({}, defs)).toEqual({
      errors: { horizon: "Horizon is required" },
    });
  });

  it("does not flag optional missing fields", () => {
    const defs: BlueprintVariable[] = [
      { id: "notes", type: "textarea", label: "Notes", required: false },
    ];
    expect(validateVariables({}, defs)).toEqual({ errors: {} });
  });

  it("number 0 is not treated as missing", () => {
    const defs: BlueprintVariable[] = [
      { id: "qty", type: "number", label: "Qty", required: true },
    ];
    expect(validateVariables({ qty: 0 }, defs)).toEqual({ errors: {} });
  });

  it("boolean false is not treated as missing", () => {
    const defs: BlueprintVariable[] = [
      { id: "enabled", type: "boolean", label: "Enabled", required: true },
    ];
    expect(validateVariables({ enabled: false }, defs)).toEqual({ errors: {} });
  });
});
