import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { CHAPTER_MAPPING, CHAPTER_SLUGS } from "./chapter-mapping";
import { getChapter } from "./content";

/** Shared context gathered from disk for prompt assembly */
interface ChapterContext {
  chapterId: string;
  chapterNumber: number;
  title: string;
  subtitle: string;
  partNumber: number;
  partTitle: string;
  readingTime: number;
  slug: string;
  relatedDocs: string[];
  relatedJourney: string | undefined;
  currentMarkdown: string | null;
  sourceContents: string[];
  strategy: string | null;
}

/** Gather all context needed for chapter generation from disk */
export function gatherChapterContext(chapterId: string): ChapterContext {
  const chapter = getChapter(chapterId);
  if (!chapter) {
    throw new Error(`Chapter not found: ${chapterId}`);
  }

  const mapping = CHAPTER_MAPPING[chapterId];
  const sourceDocSlugs = mapping?.docs ?? [];
  const slug = CHAPTER_SLUGS[chapterId] ?? chapterId;

  // Resolve paths relative to source file, not cwd (npx-safe)
  const appRoot = join(import.meta.dirname ?? __dirname, "..", "..", "..");

  // Read the current chapter markdown (if it exists)
  const chapterMdPath = join(appRoot, "book", "chapters", `${slug}.md`);
  const currentMarkdown = existsSync(chapterMdPath)
    ? readFileSync(chapterMdPath, "utf-8")
    : null;

  // Read related playbook docs for content
  const sourceContents: string[] = [];
  for (const docSlug of sourceDocSlugs) {
    const docPath = join(appRoot, "docs", "features", `${docSlug}.md`);
    if (existsSync(docPath)) {
      const content = readFileSync(docPath, "utf-8");
      sourceContents.push(`### Feature: ${docSlug}\n${content}`);
    }
  }

  // Read the book strategy document
  const strategyPath = join(appRoot, "ai-native-notes", "ai-native-book-strategy.md");
  const strategy = existsSync(strategyPath)
    ? readFileSync(strategyPath, "utf-8")
    : null;

  return {
    chapterId,
    chapterNumber: chapter.number,
    title: chapter.title,
    subtitle: chapter.subtitle,
    partNumber: chapter.part.number,
    partTitle: chapter.part.title,
    readingTime: chapter.readingTime,
    slug,
    relatedDocs: chapter.relatedDocs ?? [],
    relatedJourney: chapter.relatedJourney,
    currentMarkdown,
    sourceContents,
    strategy,
  };
}

/**
 * Build an agent prompt for generating or regenerating a book chapter.
 * Assembles context from the current chapter, source files,
 * and the book strategy document.
 */
export function buildChapterRegenerationPrompt(chapterId: string): string {
  const ctx = gatherChapterContext(chapterId);
  const isNew = ctx.currentMarkdown === null;
  const verb = isNew ? "generating" : "regenerating";
  const outputPath = `book/chapters/${ctx.slug}.md`;

  // Assemble the prompt
  const sections: string[] = [
    `# Chapter ${isNew ? "Generation" : "Regeneration"}: ${ctx.title}`,
    "",
    `You are ${verb} Chapter ${ctx.chapterNumber}: "${ctx.title}" — ${ctx.subtitle}`,
    `This chapter belongs to Part ${ctx.partNumber}: ${ctx.partTitle}.`,
    "",
    "## Instructions",
    "",
    `${isNew ? "Write" : "Regenerate"} this book chapter following these rules:`,
    "1. **Narrative voice**: Write in first-person plural ('we') with a technical-but-approachable tone",
    "2. **Structure**: Follow the Problem → Solution → Implementation → Lessons pattern",
    "3. **Code examples**: Include real code snippets from the Stagent codebase with filename comments",
    "4. **Markdown format**: Use the conventions below for content blocks",
    "5. **Reading time**: Target approximately " + ctx.readingTime + " minutes",
    ...(isNew ? [] : ["6. **Preserve Author's Notes**: Keep any existing `> [!authors-note]` blocks unchanged"]),
    "",
    "## Tools Available",
    "",
    "You have access to **Read**, **Write**, and **Edit** tools.",
    "- Use **Read** to examine Stagent source code files for real code examples",
    "- Use **Write** to create the final chapter file",
    "",
    "## Markdown Conventions",
    "",
    "- Sections: `## Section Title`",
    "- Code blocks: ` ```language ` with `<!-- filename: path -->` before the block",
    "- Callouts: `> [!tip]`, `> [!warning]`, `> [!info]`, `> [!lesson]`, `> [!authors-note]`",
    "- Interactive links: `[Try: label](href)`",
    "- Images: `![alt](src \"caption\")`",
    "",
  ];

  if (ctx.currentMarkdown) {
    sections.push(
      "## Current Chapter Content",
      "",
      "Update this content to reflect any changes in the source material:",
      "",
      "```markdown",
      ctx.currentMarkdown,
      "```",
      ""
    );
  }

  if (ctx.sourceContents.length > 0) {
    sections.push(
      "## Source Material (Playbook Feature Docs)",
      "",
      "Use these feature docs as the primary source of technical details:",
      "",
      ...ctx.sourceContents,
      ""
    );
  }

  if (ctx.strategy) {
    sections.push(
      "## Book Strategy Reference",
      "",
      "Follow the themes and narrative arc described here:",
      "",
      ctx.strategy.slice(0, 4000), // Truncate to avoid excessive context
      ""
    );
  }

  const now = new Date().toISOString();
  sections.push(
    "## Output",
    "",
    `Write the chapter to the file: \`${outputPath}\``,
    "",
    "The file must include this frontmatter at the top:",
    "",
    "```yaml",
    "---",
    `title: "${ctx.title}"`,
    `subtitle: "${ctx.subtitle}"`,
    `chapter: ${ctx.chapterNumber}`,
    `part: ${ctx.partNumber}`,
    `readingTime: ${ctx.readingTime}`,
    `lastGeneratedBy: "${now}"`,
    ...(ctx.relatedDocs.length > 0 ? [`relatedDocs: ${JSON.stringify(ctx.relatedDocs)}`] : []),
    ...(ctx.relatedJourney ? [`relatedJourney: "${ctx.relatedJourney}"`] : []),
    "---",
    "```",
    "",
    "After the frontmatter, write the chapter body starting with the first `## Section Title` heading.",
  );

  return sections.join("\n");
}

