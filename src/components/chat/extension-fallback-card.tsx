"use client";

import { useState } from "react";
import { AlertCircle, FolderOpen, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CreatePluginSpecInputForCard {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  transport: "stdio" | "inprocess";
  language: "python" | "node";
  tools: Array<{ name: string; description: string; inputSchema?: unknown }>;
}

export interface ScaffoldResultForCard {
  ok: true;
  id: string;
  pluginDir: string;
  tools: string[];
}

export interface ExtensionFallbackCardProps {
  explanation: string;
  composeAltPrompt: string;
  pluginSlug: string;
  pluginInputs: CreatePluginSpecInputForCard;
  onTryAlt: (prompt: string) => void;
  onScaffold: (
    inputs: CreatePluginSpecInputForCard
  ) => Promise<ScaffoldResultForCard>;
  initialState?: "prompt" | "scaffolded" | "failed";
  className?: string;
}

type CardState =
  | { kind: "prompt" }
  | { kind: "scaffolded"; pluginDir: string }
  | { kind: "failed"; message: string };

/**
 * Inline chat card rendered when the chat planner determines that
 * composition alone cannot fulfill the user's ask. Two paths only, not
 * three (frontend-designer §3): compose-alt OR scaffold a plugin.
 *
 * Phase 6 v1: renderable-only. Planner wiring — the logic that decides
 * WHEN to emit this card — lands in Phase 6.5, mirroring how
 * app-materialized-card.tsx shipped renderable-first.
 *
 * Scaffolded plugins carry author: "ainative" + origin: "ainative-internal"
 * so classifyPluginTrust() routes them to the self-extension path (no
 * capability-accept ceremony on load).
 */
export function ExtensionFallbackCard({
  explanation,
  composeAltPrompt,
  pluginSlug,
  pluginInputs,
  onTryAlt,
  onScaffold,
  initialState,
  className,
}: ExtensionFallbackCardProps) {
  const [state, setState] = useState<CardState>(() => {
    if (initialState === "scaffolded") {
      return {
        kind: "scaffolded",
        pluginDir: `~/.ainative/plugins/${pluginSlug}/`,
      };
    }
    if (initialState === "failed") {
      return { kind: "failed", message: "Previous scaffold failed." };
    }
    return { kind: "prompt" };
  });
  const [scaffolding, setScaffolding] = useState(false);

  const handleScaffold = async () => {
    if (scaffolding) return;
    setScaffolding(true);
    try {
      const result = await onScaffold(pluginInputs);
      setState({
        kind: "scaffolded",
        pluginDir: result.pluginDir.endsWith("/")
          ? result.pluginDir
          : result.pluginDir + "/",
      });
    } catch (e) {
      setState({
        kind: "failed",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setScaffolding(false);
    }
  };

  const handleRetry = () => {
    setState({ kind: "prompt" });
  };

  if (state.kind === "scaffolded") {
    return (
      <div
        className={cn(
          "rounded-xl border bg-card p-4 my-2 flex items-start gap-3",
          className
        )}
        data-slot="extension-fallback-card"
        data-state="scaffolded"
      >
        <Sparkles
          className="h-4 w-4 text-primary shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            Scaffolded{" "}
            <code className="text-xs font-mono">{pluginSlug}</code>.
          </p>
          <p className="text-xs text-muted-foreground">
            Edit{" "}
            <code className="font-mono">{state.pluginDir}server.py</code> to
            fill in logic, then reload ainative.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <div
        role="alert"
        className={cn(
          "rounded-xl border border-destructive/50 bg-card p-4 my-2 flex items-start gap-3",
          className
        )}
        data-slot="extension-fallback-card"
        data-state="failed"
      >
        <AlertCircle
          className="h-4 w-4 text-destructive shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Scaffold failed.</p>
          <p className="text-xs text-muted-foreground font-mono break-all">
            {state.message}
          </p>
          <Button size="sm" variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // prompt state
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 my-2 space-y-3",
        className
      )}
      data-slot="extension-fallback-card"
      data-state="prompt"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            I can't build this with composition alone
          </p>
          <p className="mt-1 text-xs text-muted-foreground italic">
            &ldquo;{explanation}&rdquo;
          </p>
        </div>
      </div>

      <div className="space-y-2 pl-7">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Closest compose-only version:
          </p>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm flex items-start gap-1.5 min-w-0 flex-1">
              <ArrowRight
                className="h-3 w-3 mt-1 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate">{composeAltPrompt}</span>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTryAlt(composeAltPrompt)}
            >
              Try this
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Scaffold a plugin for it:
          </p>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm flex items-start gap-1.5 min-w-0 flex-1">
              <ArrowRight
                className="h-3 w-3 mt-1 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="font-mono text-xs truncate">
                ~/.ainative/plugins/{pluginSlug}/
              </span>
            </p>
            <Button
              size="sm"
              variant="default"
              onClick={handleScaffold}
              disabled={scaffolding}
            >
              <FolderOpen
                className="h-3 w-3 mr-1.5"
                aria-hidden="true"
              />
              {scaffolding ? "Scaffolding…" : "Scaffold + open"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
