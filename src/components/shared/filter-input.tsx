"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseFilterInput, type FilterClause } from "@/lib/filters/parse";
import { FilterHint } from "./filter-hint";

interface FilterInputProps {
  value: string;
  onChange: (next: { raw: string; clauses: FilterClause[]; rawQuery: string }) => void;
  placeholder?: string;
}

/**
 * FilterInput — free-text input that recognizes `#key:value` filter syntax.
 *
 * Renders parsed clauses as outline badges next to the input. Consumer
 * receives the raw string (for URL serialization) and the parsed breakdown
 * (for list filtering). Keeps the existing free-text search behavior — the
 * `rawQuery` is the text with filter clauses stripped.
 */
export function FilterInput({ value, onChange, placeholder }: FilterInputProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const parsed = parseFilterInput(local);

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[16rem]">
          <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={local}
            onChange={(e) => {
              const next = e.target.value;
              setLocal(next);
              const p = parseFilterInput(next);
              onChange({ raw: next, clauses: p.clauses, rawQuery: p.rawQuery });
            }}
            placeholder={placeholder ?? "#status:blocked or search…"}
            className="pl-7 h-8"
          />
        </div>
        {parsed.clauses.map((c, i) => (
          <Badge key={`${c.key}-${i}`} variant="outline" className="text-xs font-mono">
            #{c.key}:{c.value}
          </Badge>
        ))}
      </div>
      <FilterHint inputValue={local} storageKey="stagent.filter-hint.dismissed" />
    </div>
  );
}
