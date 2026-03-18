"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X, GitBranch, Info } from "lucide-react";

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
  onCreateWorkflow?: (result: AssistResult) => void;
}

const patternLabels: Record<string, string> = {
  single: "Single Task",
  sequence: "Sequence",
  "planner-executor": "Planner → Executor",
  checkpoint: "Human Checkpoint",
  parallel: "Parallel",
  loop: "Loop",
  swarm: "Swarm",
};

const complexityColors: Record<string, string> = {
  simple: "text-complexity-simple",
  moderate: "text-complexity-moderate",
  complex: "text-complexity-complex",
};

const ACTIVITY_MESSAGES = [
  "Connecting to AI...",
  "Analyzing task complexity...",
  "Generating suggestions...",
  "Finalizing...",
];

function ProgressBar({ loading }: { loading: boolean }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < ACTIVITY_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [loading]);

  if (!loading) return null;

  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full w-full rounded-full bg-primary animate-[progress-slide_1.5s_ease-in-out_infinite]" />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {ACTIVITY_MESSAGES[messageIndex]}
      </p>
    </div>
  );
}

export function AIAssistPanel({
  title,
  description,
  assignedAgent,
  onApplyDescription,
  onCreateSubtasks,
  onResultChange,
  onCreateWorkflow,
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
      <div className="pt-2 space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={analyze}
          disabled={loading || (!title.trim() && !description.trim())}
          className="w-full"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          AI Assist
        </Button>
        <ProgressBar loading={loading} />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        {!loading && (
          <p className="text-xs text-muted-foreground text-center mt-1.5">
            Suggests improved descriptions, sub-task breakdowns, and workflow patterns
          </p>
        )}
      </div>
    );
  }

  const showWorkflowCTA =
    onCreateWorkflow &&
    result.breakdown.length >= 2 &&
    result.recommendedPattern !== "single";

  return (
    <div className="p-4 space-y-4">
      {/* Header row */}
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

      {/* Improved description — full width */}
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

      {/* Reasoning + Workflow CTA combined callout */}
      {(result.reasoning || showWorkflowCTA) && (
        <div className="rounded-md border bg-muted/50 p-3 space-y-2.5">
          {result.reasoning && (
            <div className="flex gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {result.reasoning}
                {result.complexity === "complex" && result.recommendedPattern !== "single"
                  ? " Complex tasks benefit from workflow execution — each step builds on the previous result."
                  : ""}
              </p>
            </div>
          )}
          {showWorkflowCTA && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start h-auto py-2 border-primary/50 bg-background"
              onClick={() => onCreateWorkflow(result)}
            >
              <div className="text-left flex-1">
                <div className="flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" />
                  <span className="text-xs font-medium">Create as Workflow</span>
                  <Badge variant="default" className="text-[10px] h-4 px-1">
                    Recommended
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                  Runs as {patternLabels[result.recommendedPattern]?.toLowerCase() ?? result.recommendedPattern} — each step receives prior output
                </div>
              </div>
            </Button>
          )}
        </div>
      )}

      {/* Breakdown as flat numbered list */}
      {result.breakdown.length > 0 && (
        <>
          {/* "or" divider — only show when workflow CTA is present */}
          {showWorkflowCTA && (
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground">or create as individual tasks</span>
              <div className="flex-1 border-t" />
            </div>
          )}

          <div className="space-y-2.5">
            {result.breakdown.map((sub, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-xs font-medium text-muted-foreground mt-0.5 shrink-0 w-4 text-right">
                  {i + 1}.
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-medium">{sub.title}</span>
                  <p className="text-xs text-muted-foreground">{sub.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onCreateSubtasks(result.breakdown)}
          >
            Create {result.breakdown.length} Independent Tasks
          </Button>
        </>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setResult(null);
          onResultChange?.(false);
        }}
        className="w-full text-muted-foreground"
      >
        <X className="h-3 w-3 mr-1" /> Dismiss
      </Button>
    </div>
  );
}
