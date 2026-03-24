import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { CHAPTER_MAPPING } from "./chapter-mapping";
import { getChapter } from "./content";

/**
 * Build an agent prompt for regenerating a book chapter.
 * Assembles context from the current chapter, source files,
 * and the book strategy document.
 */
export function buildChapterRegenerationPrompt(chapterId: string): string {
  const chapter = getChapter(chapterId);
  if (!chapter) {
    throw new Error(`Chapter not found: ${chapterId}`);
  }

  const mapping = CHAPTER_MAPPING[chapterId];
  const sourceDocSlugs = mapping?.docs ?? [];

  // Read the current chapter markdown (if it exists)
  const chapterSlug = chapterIdToSlug(chapterId);
  const chapterMdPath = join(process.cwd(), "docs", "book", `${chapterSlug}.md`);
  const currentMarkdown = existsSync(chapterMdPath)
    ? readFileSync(chapterMdPath, "utf-8")
    : null;

  // Read related playbook docs for content
  const sourceContents: string[] = [];
  for (const slug of sourceDocSlugs) {
    const docPath = join(process.cwd(), "docs", "features", `${slug}.md`);
    if (existsSync(docPath)) {
      const content = readFileSync(docPath, "utf-8");
      sourceContents.push(`### Feature: ${slug}\n${content}`);
    }
  }

  // Read the book strategy document
  const strategyPath = join(process.cwd(), "ai-native-notes", "ai-native-book-strategy.md");
  const strategy = existsSync(strategyPath)
    ? readFileSync(strategyPath, "utf-8")
    : null;

  // Assemble the prompt
  const sections: string[] = [
    `# Chapter Regeneration: ${chapter.title}`,
    "",
    `You are regenerating Chapter ${chapter.number}: "${chapter.title}" — ${chapter.subtitle}`,
    `This chapter belongs to Part ${chapter.part.number}: ${chapter.part.title}.`,
    "",
    "## Instructions",
    "",
    "Regenerate this book chapter following these rules:",
    "1. **Narrative voice**: Write in first-person plural ('we') with a technical-but-approachable tone",
    "2. **Structure**: Follow the Problem → Solution → Implementation → Lessons pattern",
    "3. **Code examples**: Include real code snippets from the Stagent codebase with filename comments",
    "4. **Markdown format**: Use the conventions below for content blocks",
    "5. **Reading time**: Target approximately " + chapter.readingTime + " minutes",
    "6. **Preserve Author's Notes**: Keep any existing `> [!authors-note]` blocks unchanged",
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

  if (currentMarkdown) {
    sections.push(
      "## Current Chapter Content",
      "",
      "Update this content to reflect any changes in the source material:",
      "",
      "```markdown",
      currentMarkdown,
      "```",
      ""
    );
  }

  if (sourceContents.length > 0) {
    sections.push(
      "## Source Material (Playbook Feature Docs)",
      "",
      "Use these feature docs as the primary source of technical details:",
      "",
      ...sourceContents,
      ""
    );
  }

  if (strategy) {
    sections.push(
      "## Book Strategy Reference",
      "",
      "Follow the themes and narrative arc described here:",
      "",
      strategy.slice(0, 4000), // Truncate to avoid excessive context
      ""
    );
  }

  sections.push(
    "## Output",
    "",
    "Return ONLY the markdown content for the chapter body (no frontmatter).",
    "Start with the first `## Section Title` heading."
  );

  return sections.join("\n");
}

/** Map chapter ID to markdown filename slug */
function chapterIdToSlug(chapterId: string): string {
  const slugMap: Record<string, string> = {
    "ch-1": "ch-1-project-management",
    "ch-2": "ch-2-task-execution",
    "ch-3": "ch-3-document-processing",
    "ch-4": "ch-4-workflow-orchestration",
    "ch-5": "ch-5-scheduled-intelligence",
    "ch-6": "ch-6-agent-self-improvement",
    "ch-7": "ch-7-multi-agent-swarms",
    "ch-8": "ch-8-human-in-the-loop",
    "ch-9": "ch-9-autonomous-organization",
  };
  return slugMap[chapterId] ?? chapterId;
}
