"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LightMarkdown } from "@/components/shared/light-markdown";
import { Badge } from "@/components/ui/badge";

interface SourceRow {
  id: string;
  values: Record<string, unknown>;
}

interface Citation {
  docId: string;
  sourceRowId: string;
  sourceLabel: string;
}

interface ResearchSplitViewProps {
  sources: SourceRow[];
  synthesis: string | null;
  citations: Citation[];
}

export function ResearchSplitView({
  sources,
  synthesis,
  citations,
}: ResearchSplitViewProps) {
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const knownIds = new Set(sources.map((s) => s.id));

  useEffect(() => {
    if (!highlightedRowId) return;
    const t = setTimeout(() => setHighlightedRowId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightedRowId]);

  useLayoutEffect(() => {
    if (!highlightedRowId || !tableRef.current) return;
    const row = tableRef.current.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(highlightedRowId)}"]`
    );
    if (row) {
      requestAnimationFrame(() => {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [highlightedRowId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,1fr)_2fr] gap-4">
      <aside
        className="border rounded-lg overflow-hidden"
        data-kit-pane="sources"
        aria-label="Research sources"
      >
        <table className="w-full text-sm" ref={tableRef}>
          <thead className="text-xs text-muted-foreground border-b">
            <tr>
              <th className="text-left py-2 px-3">Name</th>
              <th className="text-left py-2 px-3">URL</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={2}>
                  No sources yet
                </td>
              </tr>
            )}
            {sources.map((s) => {
              const highlighted = s.id === highlightedRowId;
              return (
                <tr
                  key={s.id}
                  data-row-id={s.id}
                  data-highlighted={highlighted ? "true" : "false"}
                  className={
                    highlighted
                      ? "bg-primary/10 transition-colors"
                      : "transition-colors"
                  }
                >
                  <td className="py-2 px-3">{String(s.values.name ?? s.id)}</td>
                  <td className="py-2 px-3 text-muted-foreground truncate max-w-[200px]">
                    {String(s.values.url ?? "")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </aside>

      <section
        className="border rounded-lg p-4 min-h-[300px] space-y-3"
        data-kit-pane="synthesis"
        aria-label="Synthesis"
      >
        {!synthesis ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">No synthesis yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Run the synthesis blueprint to produce a digest.
            </p>
          </div>
        ) : (
          <>
            <LightMarkdown content={synthesis} textSize="sm" />
            {citations.length > 0 && (
              <div
                className="flex flex-wrap gap-2 pt-3 border-t"
                aria-label="Citation sources"
              >
                {citations.map((c) => {
                  const stale = !knownIds.has(c.sourceRowId);
                  return (
                    <button
                      key={`${c.docId}:${c.sourceRowId}`}
                      type="button"
                      data-stale={stale ? "true" : "false"}
                      onClick={() => {
                        if (stale) return;
                        setHighlightedRowId(c.sourceRowId);
                      }}
                      className={
                        stale
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                      }
                    >
                      <Badge variant="outline">{c.sourceLabel}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
