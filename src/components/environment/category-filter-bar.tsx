"use client";

import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "./summary-cards-row";

interface CategoryFilterBarProps {
  categoryCounts: Array<{ category: string; count: number }>;
  toolCounts: Array<{ tool: string; count: number }>;
  categoryFilter: string | null;
  toolFilter: string | null;
  scopeFilter: string | null;
  searchQuery: string;
  onCategoryChange: (value: string | null) => void;
  onToolChange: (value: string | null) => void;
  onScopeChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  shared: "Shared",
};

const SCOPE_LABELS: Record<string, string> = {
  user: "User",
  project: "Project",
};

export function CategoryFilterBar({
  categoryCounts,
  toolCounts,
  categoryFilter,
  toolFilter,
  scopeFilter,
  searchQuery,
  onCategoryChange,
  onToolChange,
  onScopeChange,
  onSearchChange,
}: CategoryFilterBarProps) {
  const hasActiveFilters = categoryFilter || toolFilter || scopeFilter || searchQuery;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Category chips */}
        {categoryCounts.map(({ category, count }) => {
          const meta = CATEGORY_META[category];
          if (!meta) return null;
          const isActive = categoryFilter === category;

          return (
            <Badge
              key={category}
              variant={isActive ? "default" : "outline"}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onCategoryChange(isActive ? null : category)}
            >
              {meta.label} ({count})
            </Badge>
          );
        })}

        <span className="w-px h-5 bg-border mx-1" />

        {/* Tool chips */}
        {toolCounts.map(({ tool, count }) => {
          const isActive = toolFilter === tool;
          return (
            <Badge
              key={tool}
              variant={isActive ? "default" : "secondary"}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onToolChange(isActive ? null : tool)}
            >
              {TOOL_LABELS[tool] || tool} ({count})
            </Badge>
          );
        })}

        <span className="w-px h-5 bg-border mx-1" />

        {/* Scope chips */}
        {["user", "project"].map((scope) => {
          const isActive = scopeFilter === scope;
          return (
            <Badge
              key={scope}
              variant={isActive ? "default" : "outline"}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onScopeChange(isActive ? null : scope)}
            >
              {SCOPE_LABELS[scope]}
            </Badge>
          );
        })}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              onCategoryChange(null);
              onToolChange(null);
              onScopeChange(null);
              onSearchChange("");
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search artifacts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-9"
        />
      </div>
    </div>
  );
}
