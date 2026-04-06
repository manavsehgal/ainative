"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  FileText,
  DollarSign,
  Cpu,
  GitBranch,
  X,
} from "lucide-react";
import type { OptimizationSuggestion } from "@/lib/workflows/optimizer";

interface WorkflowOptimizerPanelProps {
  definition: Record<string, unknown> | null;
  workflowId?: string;
  onApplySuggestion?: (suggestion: {
    type: string;
    payload: Record<string, unknown>;
  }) => void;
}

const SUGGESTION_ICONS: Record<string, typeof FileText> = {
  document_binding: FileText,
  budget_estimate: DollarSign,
  runtime_recommendation: Cpu,
  pattern_insight: GitBranch,
};

const SUGGESTION_LABELS: Record<string, string> = {
  document_binding: "Documents",
  budget_estimate: "Budget",
  runtime_recommendation: "Runtime",
  pattern_insight: "Pattern",
};

export function WorkflowOptimizerPanel({
  definition,
  workflowId,
  onApplySuggestion,
}: WorkflowOptimizerPanelProps) {
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!definition) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/workflows/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition, workflowId }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setDismissed(new Set());
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [definition, workflowId]);

  // Debounced fetch on definition changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions();
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [fetchSuggestions]);

  const handleDismiss = (index: number) => {
    setDismissed((prev) => new Set(prev).add(index));
  };

  const handleApply = (suggestion: OptimizationSuggestion) => {
    if (suggestion.action && onApplySuggestion) {
      onApplySuggestion({
        type: suggestion.action.type,
        payload: suggestion.action.payload,
      });
    }
  };

  const visibleSuggestions = suggestions.filter(
    (_, i) => !dismissed.has(i)
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Optimizer</h3>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      )}

      {/* Empty state */}
      {!loading && visibleSuggestions.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Run a few workflows to get optimization suggestions
        </p>
      )}

      {/* Suggestion cards */}
      {!loading &&
        visibleSuggestions.map((suggestion, visibleIndex) => {
          const originalIndex = suggestions.indexOf(suggestion);
          const Icon = SUGGESTION_ICONS[suggestion.type] ?? Sparkles;
          const label = SUGGESTION_LABELS[suggestion.type] ?? suggestion.type;

          return (
            <div
              key={originalIndex}
              className="rounded-lg border border-border bg-background p-3 space-y-2"
            >
              {/* Type badge + dismiss */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {label}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(originalIndex)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Title */}
              <p className="text-sm font-medium leading-tight">
                {suggestion.title}
              </p>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {suggestion.description}
              </p>

              {/* Budget progress bar (budget_estimate type only) */}
              {suggestion.type === "budget_estimate" &&
                typeof suggestion.data.totalEstimatedCostUsd === "number" &&
                typeof suggestion.data.totalBudgetCapUsd === "number" &&
                (suggestion.data.totalBudgetCapUsd as number) > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          suggestion.data.overBudget
                            ? "bg-destructive"
                            : "bg-primary"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            ((suggestion.data.totalEstimatedCostUsd as number) /
                              (suggestion.data.totalBudgetCapUsd as number)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>
                        ${(suggestion.data.totalEstimatedCostUsd as number).toFixed(4)}
                      </span>
                      <span>
                        ${(suggestion.data.totalBudgetCapUsd as number).toFixed(2)} cap
                      </span>
                    </div>
                  </div>
                )}

              {/* Action button */}
              {suggestion.action && onApplySuggestion && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs w-full"
                  onClick={() => handleApply(suggestion)}
                >
                  {suggestion.action.label}
                </Button>
              )}
            </div>
          );
        })}
    </div>
  );
}
