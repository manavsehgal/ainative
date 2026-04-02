import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { CHAPTER_SLUGS, CHAPTER_MAPPING } from "../chapter-mapping";

const PROJECT_ROOT = resolve(__dirname, "..", "..", "..", "..");
const CHAPTERS_DIR = join(PROJECT_ROOT, "book", "chapters");

describe("book chapter slug consistency", () => {
  it("CHAPTER_SLUGS is the only slug map (no duplicates in other files)", () => {
    const bookDir = resolve(__dirname, "..");
    const files = readdirSync(bookDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const file of files) {
      if (file === "chapter-mapping.ts") continue; // canonical source
      const content = readFileSync(join(bookDir, file), "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        // Detect inline slug maps: object literals with "ch-N": "ch-N-..." patterns
        if (/["']ch-\d+["']\s*:\s*["']ch-\d+-/.test(lines[i])) {
          violations.push({ file, line: i + 1, text: lines[i].trim() });
        }
      }
    }

    expect(
      violations,
      `Found duplicate slug maps outside chapter-mapping.ts (use CHAPTER_SLUGS import instead):\n${violations
        .map((v) => `  ${v.file}:${v.line} → ${v.text}`)
        .join("\n")}`
    ).toEqual([]);
  });

  it("every CHAPTER_SLUGS entry has a corresponding markdown file", () => {
    const missing: string[] = [];

    for (const [chapterId, slug] of Object.entries(CHAPTER_SLUGS)) {
      const filePath = join(CHAPTERS_DIR, `${slug}.md`);
      if (!existsSync(filePath)) {
        missing.push(`${chapterId} → book/chapters/${slug}.md`);
      }
    }

    expect(
      missing,
      `Chapter markdown files missing for slug entries:\n  ${missing.join("\n  ")}`
    ).toEqual([]);
  });

  it("no orphan chapter files exist without a CHAPTER_SLUGS entry", () => {
    const validSlugs = new Set(Object.values(CHAPTER_SLUGS));
    const files = readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".md"));
    const orphans: string[] = [];

    for (const file of files) {
      const slug = file.replace(/\.md$/, "");
      if (!validSlugs.has(slug)) {
        orphans.push(file);
      }
    }

    expect(
      orphans,
      `Orphan chapter files found (not in CHAPTER_SLUGS — stale or misnamed):\n  ${orphans.join("\n  ")}`
    ).toEqual([]);
  });

  it("CHAPTER_SLUGS and CHAPTER_MAPPING cover the same chapter IDs", () => {
    const slugIds = new Set(Object.keys(CHAPTER_SLUGS));
    const mappingIds = new Set(Object.keys(CHAPTER_MAPPING));

    const inSlugsOnly = [...slugIds].filter((id) => !mappingIds.has(id));
    const inMappingOnly = [...mappingIds].filter((id) => !slugIds.has(id));

    expect(inSlugsOnly, `In CHAPTER_SLUGS but not CHAPTER_MAPPING`).toEqual([]);
    expect(inMappingOnly, `In CHAPTER_MAPPING but not CHAPTER_SLUGS`).toEqual([]);
  });
});
