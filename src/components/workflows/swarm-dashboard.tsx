"use client";

import { useState } from "react";
import { Brain, GitBranch, MessageSquareMore, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpandableResult } from "./shared/step-result";
import type { StepWithState, SwarmConfig } from "@/lib/workflows/types";

interface SwarmDashboardProps {
  workflowId: string;
  workflowStatus: string;
  steps: StepWithState[];
  swarmConfig?: SwarmConfig;
  onRefresh: () => void;
  stepStatusIcons: Record<string, React.ReactNode>;
}

export function SwarmDashboard({
  workflowId,
  workflowStatus,
  steps,
  swarmConfig,
  onRefresh,
  stepStatusIcons,
}: SwarmDashboardProps) {
  const [retryingStepId, setRetryingStepId] = useState<string | null>(null);

  const mayorStep = steps[0] ?? null;
  const refineryStep = steps.at(-1) ?? null;
  const workerSteps = steps.slice(1, -1);

  async function handleRetryStep(step: StepWithState) {
    setRetryingStepId(step.id);

    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/steps/${step.id}/retry`,
        {
          method: "POST",
        }
      );

      if (res.ok) {
        toast.success(`Retry started for ${step.name}`);
        onRefresh();
      } else {
        const error = await res.json().catch(() => null);
        toast.error(error?.error ?? "Failed to retry step");
      }
    } finally {
      setRetryingStepId(null);
    }
  }

  function renderStepCard(input: {
    step: StepWithState;
    icon: React.ReactNode;
    badgeLabel: string;
    hint: string;
  }) {
    const { step, icon, badgeLabel, hint } = input;
    const canRetry =
      workflowStatus !== "active" && step.state.status === "failed";

    return (
      <div
        key={step.id}
        className="surface-card-muted rounded-lg border border-border/50 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {stepStatusIcons[step.state.status] ?? stepStatusIcons.pending}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[11px]">
                {badgeLabel}
              </Badge>
              <span className="text-sm font-medium">{step.name}</span>
              <span className="text-muted-foreground">{icon}</span>
            </div>
            <p className="text-xs text-muted-foreground">{hint}</p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {step.prompt}
            </p>
            {step.state.error && (
              <p className="text-xs text-destructive">{step.state.error}</p>
            )}
            {step.state.result && step.state.status === "completed" && (
              <ExpandableResult result={step.state.result} />
            )}
            {canRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => handleRetryStep(step)}
                disabled={retryingStepId === step.id}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                {retryingStepId === step.id ? "Starting..." : "Retry"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!mayorStep || !refineryStep || workerSteps.length === 0) {
    return (
      <div className="surface-card-muted rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
        Swarm workflow data is incomplete.
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {workerSteps.length} worker{workerSteps.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Concurrency {swarmConfig?.workerConcurrencyLimit ?? 2}
          </Badge>
        </div>
        {renderStepCard({
          step: mayorStep,
          icon: <Brain className="h-4 w-4" />,
          badgeLabel: "MAYOR",
          hint: "Defines the swarm plan and allocates work across the worker pool.",
        })}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Worker Agents</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {workerSteps.map((step, index) =>
            renderStepCard({
              step,
              icon: <GitBranch className="h-4 w-4" />,
              badgeLabel: `W${index + 1}`,
              hint: "Runs one independent slice of the mayor plan in parallel.",
            })
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquareMore className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Refinery</p>
        </div>
        {renderStepCard({
          step: refineryStep,
          icon: <MessageSquareMore className="h-4 w-4" />,
          badgeLabel: "REFINERY",
          hint: "Waits for worker completion, then merges their outputs into one final result.",
        })}
      </section>
    </div>
  );
}
