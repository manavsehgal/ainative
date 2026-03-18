"use client";

import { useEffect, useState, useRef } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface PlaybookTocProps {
  body: string;
}

/** Extract ## and ### headings from markdown body */
function extractHeadings(body: string): TocItem[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(body)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    items.push({ id, text, level });
  }

  return items;
}

export function PlaybookToc({ body }: PlaybookTocProps) {
  const headings = extractHeadings(body);
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    for (const el of elements) {
      observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav className="space-y-1" aria-label="Table of contents">
      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        On this page
      </h4>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          className={`block text-sm py-0.5 transition-colors hover:text-foreground ${
            h.level === 3 ? "pl-3" : ""
          } ${
            activeId === h.id
              ? "text-primary font-medium"
              : "text-muted-foreground"
          }`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}
