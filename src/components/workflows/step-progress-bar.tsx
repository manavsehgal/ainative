"use client";

import { cn } from "@/lib/utils";

type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "waiting_approval"
  | "waiting_dependencies";

interface StepProgressBarProps {
  steps: Array<{
    stepId: string;
    name: string;
    status: StepStatus;
  }>;
}

const statusClasses: Record<StepStatus, string> = {
  completed: "bg-[oklch(0.65_0.15_145)] text-white",
  running: "bg-[oklch(0.6_0.15_250)] text-white animate-pulse",
  failed: "bg-[oklch(0.6_0.2_25)] text-white",
  pending: "bg-[oklch(0.8_0_0)] text-[oklch(0.4_0_0)]",
  waiting_approval: "bg-[oklch(0.7_0.15_80)] text-white",
  waiting_dependencies: "bg-[oklch(0.7_0.15_80)] text-white",
};

const lineColor = (status: StepStatus): string => {
  if (status === "completed") return "bg-[oklch(0.65_0.15_145)]";
  return "bg-[oklch(0.85_0_0)]";
};

export function StepProgressBar({ steps }: StepProgressBarProps) {
  if (steps.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start min-w-max px-2 py-3">
        {steps.map((step, index) => (
          <div key={step.stepId} className="flex items-start">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  statusClasses[step.status]
                )}
              >
                {index + 1}
              </div>
              <span
                className="max-w-[72px] truncate text-center text-xs text-muted-foreground"
                title={step.name}
              >
                {step.name}
              </span>
            </div>

            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div className="flex items-center pt-4">
                <div
                  className={cn(
                    "mx-1 h-0.5 w-10",
                    lineColor(step.status)
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
