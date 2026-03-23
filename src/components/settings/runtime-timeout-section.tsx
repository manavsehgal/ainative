"use client";

import { useEffect, useState, useCallback } from "react";
import { Timer, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { FormSectionCard } from "@/components/shared/form-section-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DEFAULT_TIMEOUT = 60;
const DEFAULT_MAX_TURNS = 10;

export function RuntimeTimeoutSection() {
  const [timeout, setTimeout_] = useState(DEFAULT_TIMEOUT);
  const [maxTurns, setMaxTurns] = useState(DEFAULT_MAX_TURNS);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/runtime");
      if (res.ok) {
        const data = await res.json();
        if (data.sdkTimeoutSeconds) setTimeout_(parseInt(data.sdkTimeoutSeconds, 10));
        if (data.maxTurns) setMaxTurns(parseInt(data.maxTurns, 10));
      }
    } catch {
      // Use defaults
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (field: "sdkTimeoutSeconds" | "maxTurns", value: number) => {
    setSaving(true);
    try {
      await fetch("/api/settings/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: String(value) }),
      });
      toast.success(field === "sdkTimeoutSeconds" ? "Timeout updated" : "Max turns updated");
    } catch {
      toast.error("Failed to save setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Runtime</CardTitle>
        <CardDescription>
          Configure runtime behavior for AI operations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <TooltipProvider>
          <FormSectionCard
            icon={Timer}
            title="SDK Timeout"
            hint="Maximum seconds to wait for AI responses."
          >
            <div className="space-y-3 w-full">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fast Response</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium tabular-nums cursor-help">
                      {timeout} seconds
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Lower values return faster but may cut off complex reasoning.
                    Higher values allow thorough analysis but increase wait time.
                  </TooltipContent>
                </Tooltip>
                <span className="text-muted-foreground">Thorough Analysis</span>
              </div>
              <div className="relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary/10"
                  style={{
                    left: `${((30 - 10) / (300 - 10)) * 100}%`,
                    width: `${((120 - 30) / (300 - 10)) * 100}%`,
                  }}
                />
                <Slider
                  value={[timeout]}
                  min={10}
                  max={300}
                  step={5}
                  disabled={saving}
                  onValueChange={(value) => setTimeout_(value[0])}
                  onValueCommit={(value) => handleSave("sdkTimeoutSeconds", value[0])}
                />
              </div>
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground">
                  Recommended: 30–120s
                </span>
              </div>
            </div>
          </FormSectionCard>

          <FormSectionCard
            icon={RotateCcw}
            title="Max Turns"
            hint="Maximum number of agent turns per task execution."
          >
            <div className="space-y-3 w-full">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quick Execution</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium tabular-nums cursor-help">
                      {maxTurns} turns
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Fewer turns limit agent actions for simple tasks.
                    More turns allow extended multi-step reasoning.
                  </TooltipContent>
                </Tooltip>
                <span className="text-muted-foreground">Extended Reasoning</span>
              </div>
              <div className="relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary/10"
                  style={{
                    left: `${((5 - 1) / (50 - 1)) * 100}%`,
                    width: `${((20 - 5) / (50 - 1)) * 100}%`,
                  }}
                />
                <Slider
                  value={[maxTurns]}
                  min={1}
                  max={50}
                  step={1}
                  disabled={saving}
                  onValueChange={(value) => setMaxTurns(value[0])}
                  onValueCommit={(value) => handleSave("maxTurns", value[0])}
                />
              </div>
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground">
                  Recommended: 5–20 turns
                </span>
              </div>
            </div>
          </FormSectionCard>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
