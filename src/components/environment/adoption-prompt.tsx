"use client";

import { useState } from "react";
import { X, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface AdoptionPromptProps {
  stage: "visibility" | "sync" | "orchestration";
  onDismiss?: () => void;
}

const STAGE_CONFIG = {
  visibility: {
    title: "See your full environment",
    description:
      "Scan your system to discover all CLI artifacts — skills, plugins, hooks, MCP servers, and more — in one dashboard.",
    action: "Open Environment",
    href: "/environment",
  },
  sync: {
    title: "Keep tools in sync",
    description:
      "Sync skills and configs between Claude Code and Codex. Changes are checkpointed for safe rollback.",
    action: "View Sync Options",
    href: "/environment",
  },
  orchestration: {
    title: "Orchestrate across tools",
    description:
      "Use environment templates to standardize project setups and compare configurations across projects.",
    action: "Explore Templates",
    href: "/environment",
  },
};

export function AdoptionPrompt({ stage, onDismiss }: AdoptionPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const config = STAGE_CONFIG[stage];

  if (dismissed) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex items-center gap-4">
        <Globe className="h-8 w-8 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{config.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {config.description}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={config.href}>
            <Button size="sm" variant="default">
              {config.action}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => {
              setDismissed(true);
              onDismiss?.();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
