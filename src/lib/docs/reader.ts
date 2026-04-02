import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import type { DocManifest, ParsedDoc } from "./types";
import { getAppRoot } from "../utils/app-root";

/** Resolve the docs directory relative to this source file (npx-safe) */
function docsDir(): string {
  return join(getAppRoot(import.meta.dirname, 3), "docs");
}

/** Read and parse docs/manifest.json */
export function getManifest(): DocManifest {
  const manifestPath = join(docsDir(), "manifest.json");
  if (!existsSync(manifestPath)) {
    return {
      generated: "",
      version: 1,
      sections: [],
      journeys: [],
      metadata: { totalDocs: 0, totalScreengrabs: 0, featuresCovered: 0, appSections: 0 },
    };
  }
  const raw = readFileSync(manifestPath, "utf-8");
  return JSON.parse(raw) as DocManifest;
}

/** Parse a markdown file into frontmatter + body */
function parseMarkdown(content: string, slug: string): ParsedDoc {
  const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(fmRegex);

  if (!match) {
    return { frontmatter: {}, body: content, slug };
  }

  const frontmatter: Record<string, unknown> = {};
  const fmLines = match[1].split("\n");
  for (const line of fmLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Strip surrounding quotes
    if (
      typeof value === "string" &&
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value.slice(1, -1);
    }

    // Parse arrays: ["a", "b"] or YAML-style [a, b, c]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      try {
        value = JSON.parse(value);
      } catch {
        // YAML-style unquoted array: [a, b, c] → ["a", "b", "c"]
        value = (value as string)
          .slice(1, -1)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2], slug };
}

/** Read a single doc by slug (searches features/ then journeys/ then root) */
export function getDocBySlug(slug: string): ParsedDoc | null {
  const dirs = ["features", "journeys", ""];
  for (const dir of dirs) {
    const filePath = join(docsDir(), dir, `${slug}.md`);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8");
      return parseMarkdown(content, slug);
    }
  }
  return null;
}

/** Read all docs from features/ and journeys/ */
export function getAllDocs(): ParsedDoc[] {
  const docs: ParsedDoc[] = [];
  const subDirs = ["features", "journeys"];

  for (const dir of subDirs) {
    const dirPath = join(docsDir(), dir);
    if (!existsSync(dirPath)) continue;

    const files = readdirSync(dirPath).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = readFileSync(join(dirPath, file), "utf-8");
      const slug = basename(file, ".md");
      docs.push(parseMarkdown(content, slug));
    }
  }

  // Also check for getting-started.md at root
  const gsPath = join(docsDir(), "getting-started.md");
  if (existsSync(gsPath)) {
    const content = readFileSync(gsPath, "utf-8");
    docs.push(parseMarkdown(content, "getting-started"));
  }

  return docs;
}

/** Read the .last-generated timestamp */
export function getDocsLastGenerated(): string | null {
  const filePath = join(docsDir(), ".last-generated");
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8").trim();
}
