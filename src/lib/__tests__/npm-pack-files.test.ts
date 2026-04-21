import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";

/**
 * M5 install-parity regression test: lock the npm publish contract so
 * that runtime-read directories stay in package.json's `files` array.
 *
 * Drift history (2026-04-21): `book/` and `ai-native-notes/` were missing
 * from the published tarball for multiple releases. The book UI + chapter
 * generator silently degraded on `npx ainative` installs — `existsSync`
 * returned false and the code fell back to stub content, so no crash
 * surfaced in CI. This test makes the drift loud.
 */
describe("M5: npm publish contract — runtime-read directories must ship", () => {
  const PROJECT_ROOT = resolve(__dirname, "..", "..", "..");
  const pkg = JSON.parse(
    readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")
  ) as { files: string[] };

  const filesSet = new Set(pkg.files);

  it("includes book/chapters/ — runtime-read by src/lib/book/content.ts", () => {
    expect(
      filesSet.has("book/chapters/") || filesSet.has("book/"),
      `package.json files must include "book/chapters/" or "book/" — read at runtime by src/lib/book/content.ts:204. Current files: ${JSON.stringify(pkg.files)}`
    ).toBe(true);
  });

  it("includes ai-native-notes/*.md — runtime-read by chapter-generator.ts", () => {
    const hasPattern = pkg.files.some(
      (f) =>
        f === "ai-native-notes/*.md" ||
        f === "ai-native-notes/" ||
        f === "ai-native-notes"
    );
    expect(
      hasPattern,
      `package.json files must include ai-native-notes markdown — read at runtime by src/lib/book/chapter-generator.ts:58,66. Current files: ${JSON.stringify(pkg.files)}`
    ).toBe(true);
  });

  it("includes dist/ and src/ — CLI entry + Next.js server code", () => {
    expect(filesSet.has("dist/")).toBe(true);
    expect(filesSet.has("src/")).toBe(true);
  });

  it("includes docs/ — published user-facing documentation", () => {
    expect(filesSet.has("docs/")).toBe(true);
  });

  it("runtime-read dirs actually exist in the working tree", () => {
    // If this test fails, the previous tests might be passing against
    // a non-existent directory (silent drift).
    expect(existsSync(join(PROJECT_ROOT, "book", "chapters"))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, "ai-native-notes"))).toBe(true);

    // Spot-check: at least one .md in each.
    const bookChapters = readdirSync(join(PROJECT_ROOT, "book", "chapters"));
    const notes = readdirSync(join(PROJECT_ROOT, "ai-native-notes"));
    expect(bookChapters.some((f) => f.endsWith(".md"))).toBe(true);
    expect(notes.some((f) => f.endsWith(".md"))).toBe(true);
  });
});
