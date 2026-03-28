"use client";

import { useEffect, useState, useCallback } from "react";
import { Brain } from "lucide-react";
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

const DEFAULT_LIMIT = 8000;

export function LearningContextSection() {
  const [contextLimit, setContextLimit] = useState(DEFAULT_LIMIT);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/learning");
      if (res.ok) {
        const data = await res.json();
        if (data.contextCharLimit)
          setContextLimit(parseInt(data.contextCharLimit, 10));
      }
    } catch {
      // Use defaults
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (value: number) => {
    setSaving(true);
    try {
      await fetch("/api/settings/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextCharLimit: String(value) }),
      });
      toast.success("Context memory limit updated");
    } catch {
      toast.error("Failed to save setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Self-Learning</CardTitle>
        <CardDescription>
          Configure how agents accumulate and manage learned context from task
          executions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <FormSectionCard
            icon={Brain}
            title="Context Memory Limit"
            hint="Maximum characters of learned context stored per agent profile."
          >
            <div className="space-y-3 w-full">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Focused</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium tabular-nums cursor-help">
                      {(contextLimit / 1000).toFixed(0)}K characters
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Lower limits keep context tight and focused on recent
                    patterns. Higher limits preserve more historical knowledge
                    but use more of the AI&apos;s context window.
                    Auto-summarization kicks in at 75% capacity.
                  </TooltipContent>
                </Tooltip>
                <span className="text-muted-foreground">Comprehensive</span>
              </div>
              <div className="relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary/10"
                  style={{
                    left: `${((4000 - 2000) / (32000 - 2000)) * 100}%`,
                    width: `${((16000 - 4000) / (32000 - 2000)) * 100}%`,
                  }}
                />
                <Slider
                  value={[contextLimit]}
                  min={2000}
                  max={32000}
                  step={1000}
                  disabled={saving}
                  onValueChange={(value) => setContextLimit(value[0])}
                  onValueCommit={(value) => handleSave(value[0])}
                />
              </div>
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground">
                  Recommended: 4K–16K characters
                </span>
              </div>
            </div>
          </FormSectionCard>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
