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

const CATEGORY_META: Record<string, { icon: LucideIcon; label: string; desc: string }> = {
  skill: { icon: Wrench, label: "Skills", desc: "Reusable prompt workflows" },
  plugin: { icon: Plug, label: "Plugins", desc: "Installed extensions" },
  hook: { icon: Webhook, label: "Hooks", desc: "Event-triggered actions" },
  "mcp-server": { icon: Server, label: "MCP Servers", desc: "Connected tool servers" },
  permission: { icon: Shield, label: "Permissions", desc: "Allowed tool patterns" },
  instruction: { icon: FileText, label: "Instructions", desc: "CLAUDE.md & AGENTS.md" },
  memory: { icon: Brain, label: "Memory", desc: "Persistent context files" },
  rule: { icon: Scale, label: "Rules", desc: "Behavioral guardrails" },
  reference: { icon: BookOpen, label: "References", desc: "Captured documentation" },
  "output-style": { icon: Palette, label: "Output Styles", desc: "Response formatting" },
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
    <div className="grid grid-cols-4 gap-3">
      {/* Total card */}
      <Card className="elevation-1">
        <CardContent className="px-4 py-2.5">
          <p className="text-xs text-muted-foreground font-medium">Total</p>
          <p className="text-xl font-semibold mt-0.5">{totalArtifacts}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">All scanned artifacts</p>
        </CardContent>
      </Card>

      {sorted.map(({ category, count }) => {
        const meta = CATEGORY_META[category];
        if (!meta) return null;
        const Icon = meta.icon;

        return (
          <Card
            key={category}
            className="elevation-1 cursor-pointer hover:border-primary/50 transition-colors"
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
            <CardContent className="px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium">{meta.label}</p>
              </div>
              <p className="text-xl font-semibold mt-0.5">{count}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">{meta.desc}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export { CATEGORY_META };
