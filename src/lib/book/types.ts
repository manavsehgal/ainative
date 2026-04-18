/** Content block types for rich book content */
export type ContentBlock =
  | TextBlock
  | CodeBlock
  | ImageBlock
  | CalloutBlock
  | InteractiveBlock;

export interface TextBlock {
  type: "text";
  markdown: string;
}

export interface CodeBlock {
  type: "code";
  language: string;
  code: string;
  filename?: string;
  caption?: string;
}

export interface ImageBlock {
  type: "image";
  src: string;
  alt: string;
  caption?: string;
  width?: number;
}

export interface CalloutBlock {
  type: "callout";
  variant: "tip" | "warning" | "info" | "lesson" | "authors-note" | "case-study";
  title?: string;
  markdown: string;
  /** Image source for authors-note variant */
  imageSrc?: string;
  /** Image alt text for authors-note variant */
  imageAlt?: string;
  /** Start collapsed? Default false. Used by authors-note variant */
  defaultCollapsed?: boolean;
}

export interface InteractiveLinkBlock {
  type: "interactive";
  interactiveType: "link";
  label: string;
  description: string;
  /** Route within ainative to navigate to */
  href: string;
}

export interface InteractiveCollapsibleBlock {
  type: "interactive";
  interactiveType: "collapsible";
  label: string;
  /** Markdown content revealed on expand */
  markdown: string;
  /** Start expanded? Default false */
  defaultOpen?: boolean;
}

export interface InteractiveQuizBlock {
  type: "interactive";
  interactiveType: "quiz";
  question: string;
  options: string[];
  /** Zero-based index of the correct answer */
  correctIndex: number;
  /** Markdown explanation shown after answering */
  explanation?: string;
}

export type InteractiveBlock =
  | InteractiveLinkBlock
  | InteractiveCollapsibleBlock
  | InteractiveQuizBlock;

/** A section within a chapter */
export interface BookSection {
  id: string;
  title: string;
  content: ContentBlock[];
}

/** A chapter in the book */
export interface BookChapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  part: BookPart;
  sections: BookSection[];
  /** Estimated reading time in minutes */
  readingTime: number;
  /** Related Playbook feature doc slugs */
  relatedDocs?: string[];
  /** Related Playbook journey slug */
  relatedJourney?: string;
}

/** Three-part structure of the book */
export interface BookPart {
  number: number;
  title: string;
  description: string;
}

/** Reader display preferences */
export interface ReaderPreferences {
  fontSize: number; // 14–22
  lineHeight: number; // 1.5–2.0
  fontFamily: "sans" | "serif" | "mono";
  theme: "light" | "sepia" | "dark";
}

export const DEFAULT_READER_PREFS: ReaderPreferences = {
  fontSize: 17,
  lineHeight: 1.75,
  fontFamily: "serif",
  theme: "light",
};

/** The complete book */
export interface Book {
  title: string;
  subtitle: string;
  description: string;
  parts: BookPart[];
  chapters: BookChapter[];
  /** Total estimated reading time across all chapters */
  totalReadingTime: number;
}

/** Reading progress for a chapter */
export interface ReadingProgress {
  chapterId: string;
  /** Fraction 0–1 of scroll progress (high-water mark) */
  progress: number;
  /** Scroll position in pixels for restoring location */
  scrollPosition: number;
  lastReadAt: string;
}

/** A saved bookmark location in the book */
export interface Bookmark {
  id: string;
  chapterId: string;
  sectionId: string | null;
  scrollPosition: number;
  label: string;
  createdAt: string;
}
