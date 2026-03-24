/**
 * One-time migration script: serialize CHAPTERS from content.ts to markdown files in docs/book/.
 *
 * Usage: npx tsx scripts/migrate-book-content.ts
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { CHAPTERS } from "../src/lib/book/content";
import type {
  ContentBlock,
  CodeBlock,
  CalloutBlock,
  ImageBlock,
  InteractiveLinkBlock,
  InteractiveCollapsibleBlock,
  BookChapter,
} from "../src/lib/book/types";

const BOOK_DIR = join(process.cwd(), "docs", "book");

/** Convert a chapter title to a filename slug */
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Serialize a single ContentBlock back to markdown */
function serializeBlock(block: ContentBlock): string {
  switch (block.type) {
    case "text":
      return block.markdown;

    case "code": {
      const cb = block as CodeBlock;
      const parts: string[] = [];
      if (cb.filename) {
        parts.push(`<!-- filename: ${cb.filename} -->`);
      }
      parts.push(`\`\`\`${cb.language}`);
      parts.push(cb.code);
      parts.push("```");
      return parts.join("\n");
    }

    case "callout": {
      const ca = block as CalloutBlock;
      const lines: string[] = [];
      lines.push(`> [!${ca.variant}]`);
      if (ca.title) {
        lines.push(`> **${ca.title}**`);
      }
      if (ca.markdown) {
        for (const ml of ca.markdown.split("\n")) {
          lines.push(ml ? `> ${ml}` : ">");
        }
      }
      if (ca.imageSrc) {
        lines.push(`> ![${ca.imageAlt || ""}](${ca.imageSrc})`);
      }
      if (ca.defaultCollapsed && ca.variant !== "authors-note") {
        // authors-note gets defaultCollapsed automatically, only emit marker for others
        lines.push(`> [collapsed]`);
      }
      return lines.join("\n");
    }

    case "image": {
      const img = block as ImageBlock;
      if (img.caption) {
        return `![${img.alt}](${img.src} "${img.caption}")`;
      }
      return `![${img.alt}](${img.src})`;
    }

    case "interactive": {
      if (block.interactiveType === "link") {
        const link = block as InteractiveLinkBlock;
        // Strip "Try: " prefix from label since the markdown format re-adds it
        const label = link.label.startsWith("Try: ")
          ? link.label.slice(5)
          : link.label;
        return `[Try: ${label}](${link.href})`;
      }
      if (block.interactiveType === "collapsible") {
        const col = block as InteractiveCollapsibleBlock;
        return `<details><summary>${col.label}</summary>\n\n${col.markdown}\n\n</details>`;
      }
      // Quiz or other interactive types — render as text fallback
      return `<!-- unsupported interactive block -->`;
    }

    default:
      return "";
  }
}

/** Serialize a chapter to a full markdown file with frontmatter */
function serializeChapter(chapter: BookChapter): string {
  const parts: string[] = [];

  // Frontmatter
  const relatedDocs = chapter.relatedDocs
    ? `[${chapter.relatedDocs.join(", ")}]`
    : "[]";
  const relatedJourney = chapter.relatedJourney || "null";

  parts.push("---");
  parts.push(`title: "${chapter.title}"`);
  parts.push(`subtitle: "${chapter.subtitle}"`);
  parts.push(`chapter: ${chapter.number}`);
  parts.push(`part: ${chapter.part.number}`);
  parts.push(`readingTime: ${chapter.readingTime}`);
  parts.push(`relatedDocs: ${relatedDocs}`);
  parts.push(`relatedJourney: ${relatedJourney}`);
  parts.push(`lastGeneratedBy: null`);
  parts.push("---");
  parts.push("");

  // Sections
  for (const section of chapter.sections) {
    parts.push(`## ${section.title}`);
    parts.push("");

    for (let i = 0; i < section.content.length; i++) {
      parts.push(serializeBlock(section.content[i]));
      parts.push("");
    }
  }

  return parts.join("\n");
}

// --- Main ---
function main() {
  mkdirSync(BOOK_DIR, { recursive: true });
  console.log(`Created directory: ${BOOK_DIR}`);

  for (const chapter of CHAPTERS) {
    const slug = titleToSlug(chapter.title);
    const filename = `ch-${chapter.number}-${slug}.md`;
    const filePath = join(BOOK_DIR, filename);
    const content = serializeChapter(chapter);

    writeFileSync(filePath, content, "utf-8");
    console.log(`Wrote: ${filePath} (${chapter.sections.length} sections)`);
  }

  console.log(`\nMigrated ${CHAPTERS.length} chapters to ${BOOK_DIR}`);
}

main();
