// src/lib/plugins/__tests__/api-version-window.test.ts
import { describe, it, expect } from "vitest";
import pkg from "../../../../package.json";
import { isSupportedApiVersion } from "../registry";

const [pkgMajor, pkgMinor] = pkg.version.split(".").map(Number);
const currentMinor = `${pkgMajor}.${pkgMinor}`;
const previousMinor = pkgMinor > 0 ? `${pkgMajor}.${pkgMinor - 1}` : null;

describe("apiVersion compatibility window enforces release discipline", () => {
  it(`accepts the current package MINOR (${currentMinor})`, () => {
    expect(isSupportedApiVersion(currentMinor)).toBe(true);
  });

  if (previousMinor) {
    it(`accepts the previous MINOR (${previousMinor}) so plugins survive release bumps`, () => {
      expect(isSupportedApiVersion(previousMinor)).toBe(true);
    });
  }

  it("rejects an apiVersion two MINORs back (deprecation horizon)", () => {
    if (pkgMinor < 2) return; // skip on early-MAJOR releases
    const tooOld = `${pkgMajor}.${pkgMinor - 2}`;
    expect(isSupportedApiVersion(tooOld)).toBe(false);
  });

  it("rejects a future MINOR that does not yet exist", () => {
    const future = `${pkgMajor + 99}.0`;
    expect(isSupportedApiVersion(future)).toBe(false);
  });
});
