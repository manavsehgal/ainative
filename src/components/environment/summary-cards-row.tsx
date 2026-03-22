"use client";

import {
  Wrench,
  Plug,
  Shield,
  Server,
  FileText,
  Brain,
  BookOpen,
  Palette,
  Webhook,
  Scale,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

const CATEGORY_META: Record<string, { icon: LucideIcon; label: string }> = {
  skill: { icon: Wrench, label: "Skills" },
  plugin: { icon: Plug, label: "Plugins" },
  hook: { icon: Webhook, label: "Hooks" },
  "mcp-server": { icon: Server, label: "MCP Servers" },
  permission: { icon: Shield, label: "Permissions" },
  instruction: { icon: FileText, label: "Instructions" },
  memory: { icon: Brain, label: "Memory" },
  rule: { icon: Scale, label: "Rules" },
  reference: { icon: BookOpen, label: "References" },
  "output-style": { icon: Palette, label: "Output Styles" },
};

interface SummaryCardsRowProps {
  categoryCounts: Array<{ category: string; count: number }>;
  toolCounts: Array<{ tool: string; count: number }>;
  totalArtifacts: number;
  onCategoryClick: (category: string) => void;
}

export function SummaryCardsRow({
  categoryCounts,
  totalArtifacts,
  onCategoryClick,
}: SummaryCardsRowProps) {
  // Sort categories by count descending, show top categories
  const sorted = [...categoryCounts].sort((a, b) => b.count - a.count);

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {/* Total card */}
      <Card className="elevation-1 shrink-0 min-w-[120px]">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Total</p>
          <p className="text-2xl font-semibold mt-1">{totalArtifacts}</p>
        </CardContent>
      </Card>

      {sorted.map(({ category, count }) => {
        const meta = CATEGORY_META[category];
        if (!meta) return null;
        const Icon = meta.icon;

        return (
          <Card
            key={category}
            className="elevation-1 shrink-0 min-w-[120px] cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onCategoryClick(category)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCategoryClick(category);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium">{meta.label}</p>
              </div>
              <p className="text-2xl font-semibold mt-1">{count}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export { CATEGORY_META };
