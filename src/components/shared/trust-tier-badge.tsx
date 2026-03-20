"use client";

import { useEffect, useState } from "react";
import { Eye, GitBranch, BotIcon, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TrustTier = "observer" | "collaborator" | "autonomous" | "custom";

interface TierInfo {
  id: TrustTier;
  label: string;
  description: string;
  icon: typeof Eye;
  variant: "outline" | "secondary" | "destructive" | "default";
}

const TIERS: TierInfo[] = [
  {
    id: "observer",
    label: "Observer",
    description: "Read-only — agent can read but not modify",
    icon: Eye,
    variant: "outline",
  },
  {
    id: "collaborator",
    label: "Collaborator",
    description: "Git-safe — agent can edit files and use git",
    icon: GitBranch,
    variant: "secondary",
  },
  {
    id: "autonomous",
    label: "Autonomous",
    description: "Full auto — all tools approved automatically",
    icon: BotIcon,
    variant: "destructive",
  },
];

const presetToTier: Record<string, TrustTier> = {
  "read-only": "observer",
  "git-safe": "collaborator",
  "full-auto": "autonomous",
};

/**
 * TrustTierBadge — shows current trust level in sidebar footer.
 * Fetches active presets from API and maps to tier.
 */
export function TrustTierBadge() {
  const [tier, setTier] = useState<TrustTier>("observer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/presets")
      .then((res) => res.json())
      .then((data: { activePresets: string[] }) => {
        const presets = data.activePresets ?? [];
        // Highest tier wins
        if (presets.includes("full-auto")) setTier("autonomous");
        else if (presets.includes("git-safe")) setTier("collaborator");
        else if (presets.includes("read-only")) setTier("observer");
        else setTier("custom");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const info = TIERS.find((t) => t.id === tier) ?? {
    id: "custom" as TrustTier,
    label: "Custom",
    description: "Custom permission configuration",
    icon: Shield,
    variant: "outline" as const,
  };

  if (loading) return null;

  const Icon = info.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label={`Trust tier: ${info.label}`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span className="group-data-[collapsible=icon]:hidden">
            {info.label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{info.label}</span>
            <Badge variant={info.variant} className="text-xs ml-auto">
              Active
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{info.description}</p>
          <div className="space-y-1.5 pt-1 border-t border-border">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 text-xs py-1 ${
                  t.id === tier ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                <t.icon className="h-3 w-3" />
                <span>{t.label}</span>
                {t.id === tier && (
                  <span className="ml-auto text-primary">●</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
