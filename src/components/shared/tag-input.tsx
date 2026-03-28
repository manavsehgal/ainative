"use client";

import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  id?: string;
}

/**
 * Comma-separated input with autocomplete dropdown and badge display.
 * Accepts freeform text; suggestions are optional helpers.
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  id,
}: TagInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Get the current token being typed (after the last comma)
  const getCurrentToken = useCallback(() => {
    const parts = value.split(",");
    return parts[parts.length - 1]?.trim().toLowerCase() ?? "";
  }, [value]);

  const filtered = (() => {
    const token = getCurrentToken();
    if (!token) return [];
    return suggestions
      .filter(
        (s) =>
          s.toLowerCase().includes(token) &&
          !parsed.some((p) => p.toLowerCase() === s.toLowerCase())
      )
      .slice(0, 8);
  })();

  const acceptSuggestion = (suggestion: string) => {
    const parts = value.split(",");
    parts[parts.length - 1] = ` ${suggestion}`;
    onChange(parts.join(",") + ", ");
    setShowSuggestions(false);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  };

  const removeTag = (index: number) => {
    const newParsed = parsed.filter((_, i) => i !== index);
    onChange(newParsed.join(", "));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filtered.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : filtered.length - 1
      );
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      acceptSuggestion(filtered[highlightIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
          setHighlightIndex(-1);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setShowSuggestions(false), 200);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />

      {/* Autocomplete dropdown */}
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((suggestion, i) => (
            <button
              key={suggestion}
              type="button"
              className={`w-full rounded-sm px-2 py-1.5 text-left text-sm ${
                i === highlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                acceptSuggestion(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Badge display */}
      {parsed.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1.5">
          {parsed.map((tag, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-xs gap-1 pr-1"
            >
              {tag}
              <button
                type="button"
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                onClick={() => removeTag(i)}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
