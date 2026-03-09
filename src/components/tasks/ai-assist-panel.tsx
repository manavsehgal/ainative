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
  onApplyDescription: (description: string) => void;
  onCreateSubtasks: (subtasks: TaskSuggestion[]) => void;
}

const patternLabels: Record<string, string> = {
  single: "Single Task",
  sequence: "Sequence",
  "planner-executor": "Planner → Executor",
  checkpoint: "Human Checkpoint",
};

const complexityColors: Record<string, string> = {
  simple: "text-green-500",
  moderate: "text-amber-500",
  complex: "text-red-500",
};

export function AIAssistPanel({
  title,
  description,
  onApplyDescription,
  onCreateSubtasks,
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
        body: JSON.stringify({ title, description }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "AI assist failed");
        return;
      }

      setResult(await res.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!result) {
    return (
      <div className="border-t pt-3 mt-3">
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
      </div>
    );
  }

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      <div className="flex items-center gap-2">
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
            <div className="space-y-1.5">
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

      {/* Reasoning */}
      <p className="text-xs text-muted-foreground">{result.reasoning}</p>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setResult(null)}
        className="w-full"
      >
        <X className="h-3 w-3 mr-1" /> Dismiss
      </Button>
    </div>
  );
}
