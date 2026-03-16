import { type ReactNode } from "react";

interface LightMarkdownProps {
  content: string;
  className?: string;
  maxHeight?: string;
  lineClamp?: number;
  textSize?: "xs" | "sm";
  stripBracketTags?: boolean;
}

/**
 * Lightweight markdown renderer for short agent output.
 * Handles: headers, bullet lists, paragraphs, **bold**, `code`.
 * For full markdown (tables, code fences, GFM), use ReactMarkdown instead.
 */
export function LightMarkdown({
  content,
  className = "",
  maxHeight,
  lineClamp,
  textSize = "xs",
  stripBracketTags = false,
}: LightMarkdownProps) {
  const sizeClass = textSize === "sm" ? "text-sm" : "text-xs";

  const blocks = content.split(/\n{2,}/);

  const rendered = blocks.map((block, i) => {
    let text = block.trim();
    if (!text) return null;

    if (stripBracketTags) {
      text = text.replace(/\s*\[.*?\]\s*/g, " ").trim();
    }

    // Header: ### Title
    const headerMatch = text.match(/^(#{1,4})\s+(.+)/);
    if (headerMatch) {
      return (
        <p key={i} className="font-semibold text-foreground">
          {formatInline(headerMatch[2])}
        </p>
      );
    }

    // Bullet list: lines starting with - or *
    const lines = text.split("\n");
    const isList = lines.every(
      (l) => /^\s*[-*]\s+/.test(l) || l.trim() === ""
    );
    if (isList && lines.some((l) => /^\s*[-*]\s+/.test(l))) {
      return (
        <ul key={i} className="list-disc pl-4 space-y-0.5 text-muted-foreground">
          {lines
            .filter((l) => /^\s*[-*]\s+/.test(l))
            .map((l, j) => (
              <li key={j}>{formatInline(l.replace(/^\s*[-*]\s+/, ""))}</li>
            ))}
        </ul>
      );
    }

    // Paragraph
    return (
      <p key={i} className="leading-relaxed text-muted-foreground">
        {formatInline(text)}
      </p>
    );
  });

  // Overflow / clamp styles
  let containerClass = `${sizeClass} space-y-2 ${className}`;
  const style: React.CSSProperties = {};

  if (lineClamp) {
    // Approximate: each "line" ~1.25rem at text-xs, ~1.5rem at text-sm
    const lineHeight = textSize === "sm" ? 1.5 : 1.25;
    style.maxHeight = `${lineClamp * lineHeight}rem`;
    style.overflow = "hidden";
  } else if (maxHeight) {
    containerClass += ` ${maxHeight} overflow-auto`;
  }

  return (
    <div className={containerClass} style={style}>
      {rendered}
    </div>
  );
}

/** Format inline **bold** and `code` spans */
function formatInline(text: string): ReactNode {
  // Split on **bold** and `code` patterns
  const parts: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // `code`
      parts.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {match[3]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : parts;
}
