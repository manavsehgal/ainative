"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { WorkflowStep } from "@/lib/workflows/types";

interface ProfileOption {
  id: string;
  name: string;
}

interface WorkflowCreateDialogProps {
  projects: { id: string; name: string }[];
  onCreated: () => void;
}

function createEmptyStep(): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    name: "",
    prompt: "",
    requiresApproval: false,
  };
}

export function WorkflowCreateDialog({ projects, onCreated }: WorkflowCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState<string>("sequence");
  const [projectId, setProjectId] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([createEmptyStep()]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loop-specific state
  const [loopPrompt, setLoopPrompt] = useState("");
  const [maxIterations, setMaxIterations] = useState(5);
  const [timeBudgetMinutes, setTimeBudgetMinutes] = useState<number | "">("");
  const [loopAgentProfile, setLoopAgentProfile] = useState("");

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: ProfileOption[]) => setProfiles(data))
      .catch(() => {});
  }, []);

  function addStep() {
    setSteps((prev) => [...prev, createEmptyStep()]);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, updates: Partial<WorkflowStep>) {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const isLoop = pattern === "loop";

    if (isLoop) {
      if (!loopPrompt.trim()) {
        setError("Loop prompt is required");
        return;
      }
      if (maxIterations < 1 || maxIterations > 100) {
        setError("Max iterations must be between 1 and 100");
        return;
      }
    } else {
      if (steps.some((s) => !s.name.trim() || !s.prompt.trim())) {
        setError("All steps must have a name and prompt");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const definition = isLoop
        ? {
            pattern,
            steps: [{ id: crypto.randomUUID(), name: "Loop", prompt: loopPrompt.trim() }],
            loopConfig: {
              maxIterations,
              ...(timeBudgetMinutes ? { timeBudgetMs: Number(timeBudgetMinutes) * 60 * 1000 } : {}),
              ...(loopAgentProfile && loopAgentProfile !== "auto" ? { agentProfile: loopAgentProfile } : {}),
            },
          }
        : { pattern, steps };

      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          projectId: projectId || undefined,
          definition,
        }),
      });

      if (res.ok) {
        setName("");
        setPattern("sequence");
        setProjectId("");
        setSteps([createEmptyStep()]);
        setLoopPrompt("");
        setMaxIterations(5);
        setTimeBudgetMinutes("");
        setLoopAgentProfile("");
        setOpen(false);
        toast.success("Workflow created");
        onCreated();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed to create workflow (${res.status})`);
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Name</Label>
              <Input
                id="wf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Workflow name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Pattern</Label>
              <Select value={pattern} onValueChange={setPattern}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequence">Sequence</SelectItem>
                  <SelectItem value="planner-executor">Planner → Executor</SelectItem>
                  <SelectItem value="checkpoint">Human-in-the-Loop Checkpoint</SelectItem>
                  <SelectItem value="loop">Autonomous Loop</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {projects.length > 0 && (
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {pattern === "loop" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="loop-prompt">Loop Prompt</Label>
                <Textarea
                  id="loop-prompt"
                  value={loopPrompt}
                  onChange={(e) => setLoopPrompt(e.target.value)}
                  placeholder="The prompt the agent will iterate on. Each iteration receives the previous output as context."
                  rows={4}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-iterations">Max Iterations</Label>
                  <Input
                    id="max-iterations"
                    type="number"
                    min={1}
                    max={100}
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-budget">Time Budget (minutes, optional)</Label>
                  <Input
                    id="time-budget"
                    type="number"
                    min={1}
                    value={timeBudgetMinutes}
                    onChange={(e) =>
                      setTimeBudgetMinutes(e.target.value ? Number(e.target.value) : "")
                    }
                    placeholder="No limit"
                  />
                </div>
              </div>
              {profiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Agent Profile</Label>
                  <Select value={loopAgentProfile} onValueChange={setLoopAgentProfile}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Profile: Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Step
                </Button>
              </div>
              {steps.map((step, index) => (
                <div key={step.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <Input
                      value={step.name}
                      onChange={(e) => updateStep(index, { name: e.target.value })}
                      placeholder="Step name"
                      className="flex-1"
                    />
                    {steps.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeStep(index)}
                        aria-label={`Remove step ${index + 1}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={step.prompt}
                    onChange={(e) => updateStep(index, { prompt: e.target.value })}
                    placeholder="Agent prompt for this step"
                    rows={2}
                  />
                  {profiles.length > 0 && (
                    <Select
                      value={step.agentProfile ?? ""}
                      onValueChange={(v) => updateStep(index, { agentProfile: v || undefined })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Profile: Auto-detect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-detect</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {pattern === "checkpoint" && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`approval-${step.id}`}
                        checked={step.requiresApproval ?? false}
                        onCheckedChange={(checked) =>
                          updateStep(index, { requiresApproval: checked === true })
                        }
                      />
                      <Label htmlFor={`approval-${step.id}`} className="text-sm">
                        Requires human approval before proceeding
                      </Label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading || !name.trim()} className="w-full">
            {loading ? "Creating..." : "Create Workflow"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
