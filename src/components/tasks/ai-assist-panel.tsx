"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check, X } from "lucide-react";

interface TaskSuggestion {
  title: string;
  description: string;
}

interface AssistResult {
  improvedDescription: string;
  breakdown: TaskSuggestion[];
  recommendedPattern: string;
  complexity: string;
  needsCheckpoint: boolean;
  reasoning: string;
}

interface AIAssistPanelProps {
  title: string;
  description: string;
  assignedAgent?: string;
  onApplyDescription: (description: string) => void;
  onCreateSubtasks: (subtasks: TaskSuggestion[]) => void;
  onResultChange?: (hasResult: boolean) => void;
}

const patternLabels: Record<string, string> = {
  single: "Single Task",
  sequence: "Sequence",
  "planner-executor": "Planner → Executor",
  checkpoint: "Human Checkpoint",
};

const complexityColors: Record<string, string> = {
  simple: "text-complexity-simple",
  moderate: "text-complexity-moderate",
  complex: "text-complexity-complex",
};

export function AIAssistPanel({
  title,
  description,
  assignedAgent,
  onApplyDescription,
  onCreateSubtasks,
  onResultChange,
}: AIAssistPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descriptionApplied, setDescriptionApplied] = useState(false);

  async function analyze() {
    if (!title.trim() && !description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setDescriptionApplied(false);

    try {
      const res = await fetch("/api/tasks/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, assignedAgent }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "AI assist failed");
        return;
      }

      const data = await res.json();
      setResult(data);
      onResultChange?.(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!result) {
    return (
      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={analyze}
          disabled={loading || (!title.trim() && !description.trim())}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          {loading ? "Analyzing..." : "AI Assist"}
        </Button>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        <p className="text-xs text-muted-foreground text-center mt-1.5">
          Suggests improved descriptions, sub-task breakdowns, and workflow patterns
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2 space-y-3">
      {/* Header row — full width */}
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI Suggestions</span>
        <Badge variant="outline" className="text-xs">
          {patternLabels[result.recommendedPattern] ?? result.recommendedPattern}
        </Badge>
        <span className={`text-xs ${complexityColors[result.complexity] ?? ""}`}>
          {result.complexity}
        </span>
        {result.needsCheckpoint && (
          <Badge variant="secondary" className="text-xs">needs checkpoint</Badge>
        )}
      </div>

      {/* Two-column grid for cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Improved description */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Improved Description
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  onApplyDescription(result.improvedDescription);
                  setDescriptionApplied(true);
                }}
                disabled={descriptionApplied}
              >
                {descriptionApplied ? (
                  <><Check className="h-3 w-3 mr-1" /> Applied</>
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
            <p className="text-sm">{result.improvedDescription}</p>
          </CardContent>
        </Card>

        {/* Task breakdown */}
        {result.breakdown.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Suggested Breakdown ({result.breakdown.length} sub-tasks)
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onCreateSubtasks(result.breakdown)}
                >
                  Create All
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {result.breakdown.map((sub, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{sub.title}</span>
                    <p className="text-xs text-muted-foreground">{sub.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reasoning + Dismiss — full width */}
      <p className="text-xs text-muted-foreground">{result.reasoning}</p>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setResult(null);
          onResultChange?.(false);
        }}
        className="w-full"
      >
        <X className="h-3 w-3 mr-1" /> Dismiss
      </Button>
    </div>
  );
}
