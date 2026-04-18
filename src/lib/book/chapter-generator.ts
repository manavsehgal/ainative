import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { CHAPTER_MAPPING, CHAPTER_SLUGS } from "./chapter-mapping";
import { getChapter } from "./content";
import { getAppRoot } from "../utils/app-root";

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
  caseStudyContents: string[];
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

  const appRoot = getAppRoot(import.meta.dirname, 3);

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

  // Read case study articles from ai-native-notes/
  const caseStudySlugs = mapping?.caseStudies ?? [];
  const caseStudyContents: string[] = [];
  for (const csSlug of caseStudySlugs) {
    const csPath = join(appRoot, "ai-native-notes", `${csSlug}.md`);
    if (existsSync(csPath)) {
      const content = readFileSync(csPath, "utf-8");
      caseStudyContents.push(`### Case Study: ${csSlug}\n${content}`);
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
    caseStudyContents,
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
    "3. **Code examples**: Include 'Building with ainative' TypeScript API examples showing how developers use the feature (realistic UUIDs, timestamps, async/await, comments on non-obvious lines)",
    "4. **Case studies**: Weave 2-4 case study references as `> [!case-study]` callout blocks. Name the company, describe their pattern, draw a parallel to ainative.",
    "5. **ainative sections**: Each chapter must include a 'ainative Today' section (current implementation) and a 'Roadmap Vision' section (future direction informed by case studies).",
    "6. **Narrative thread**: Reference the 'machine that builds machines' thesis — how ainative uses its own capabilities to build/maintain itself.",
    "7. **Originality**: Never copy phrases verbatim from case study material without quotation marks. Always credit authors by name in callouts. Synthesize from multiple sources rather than mirroring one article's structure. Make content ainative's own — connect every external concept to ainative's implementation.",
    "8. **Markdown format**: Use the conventions below for content blocks",
    "9. **Reading time**: Target approximately " + ctx.readingTime + " minutes",
    ...(isNew ? [] : ["10. **Preserve Author's Notes**: Keep any existing `> [!authors-note]` blocks unchanged"]),
    "",
    "## Tools Available",
    "",
    "You have access to **Read**, **Write**, and **Edit** tools.",
    "- Use **Read** to examine ainative source code files for real code examples",
    "- Use **Write** to create the final chapter file",
    "",
    "## Markdown Conventions",
    "",
    "- Sections: `## Section Title`",
    "- Code blocks: ` ```language ` with `<!-- filename: path -->` before the block",
    "- Callouts: `> [!tip]`, `> [!warning]`, `> [!info]`, `> [!lesson]`, `> [!authors-note]`, `> [!case-study]`",
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

  if (ctx.caseStudyContents.length > 0) {
    sections.push(
      "## Case Study Material",
      "",
      "Weave these case studies into the narrative as `> [!case-study]` callout blocks.",
      "Each callout should: name the company, describe their specific pattern, and draw a parallel to the ainative feature being discussed.",
      "Do NOT create a separate 'Case Studies' section — integrate them inline where relevant.",
      "",
      ...ctx.caseStudyContents.map(c => c.slice(0, 3000)), // Truncate each to manage context
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

/**
 * Build an agent prompt for the technical-writer profile to quality-review
 * a generated book chapter. This is a post-generation pass for consistency,
 * accuracy, and style.
 */
export function buildChapterQualityPrompt(chapterId: string): string {
  const ctx = gatherChapterContext(chapterId);
  if (!ctx.currentMarkdown) {
    throw new Error(`No chapter content found for ${chapterId} — generate it first`);
  }

  const sections: string[] = [
    `# Chapter Quality Review: ${ctx.title}`,
    "",
    `Review Chapter ${ctx.chapterNumber}: "${ctx.title}" — ${ctx.subtitle}`,
    "",
    "## Review Checklist",
    "",
    "1. **Terminology consistency** — verify consistent use of terms across the chapter (e.g., 'agent profile' not 'agent persona', 'workflow' not 'pipeline' when referring to ainative workflows)",
    "2. **API accuracy** — read referenced source files to confirm code examples use correct API paths, parameter names, and response shapes",
    "3. **Case study attribution** — every `> [!case-study]` callout must name the company, author (if known), and approximate date",
    "4. **Code example quality** — 'Building with ainative' examples should use realistic values (UUIDs, timestamps), async/await, and brief comments on non-obvious lines",
    "5. **Section presence** — verify the chapter contains 'ainative Today' and 'Roadmap Vision' sections",
    "6. **Grammar and style** — first-person plural voice ('we'), technical but approachable, no marketing fluff",
    "7. **Reading time** — content should match the target of ~" + ctx.readingTime + " minutes (~250 words/min)",
    "",
    "## Tools Available",
    "",
    "You have access to **Read**, **Grep**, **Glob**, **Write**, and **Edit** tools.",
    "- Use **Read** and **Grep** to verify API paths and source code references",
    "- Use **Edit** to make corrections directly in the chapter file",
    "",
    "## Chapter Content",
    "",
    "```markdown",
    ctx.currentMarkdown,
    "```",
    "",
    "## Output",
    "",
    `Edit the chapter file at: \`book/chapters/${ctx.slug}.md\``,
    "Make corrections in-place. Do not rewrite the entire chapter — only fix issues found in the review checklist.",
  ];

  return sections.join("\n");
}
