"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  GitBranch,
  RefreshCw,
  ListOrdered,
  MessageSquare,
  ArrowDown,
  Brain,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { FormSectionCard } from "@/components/shared/form-section-card";
import type { WorkflowStep, WorkflowDefinition } from "@/lib/workflows/types";
import {
  type AgentRuntimeId,
  DEFAULT_AGENT_RUNTIME,
  listRuntimeCatalog,
} from "@/lib/agents/runtime/catalog";
import { profileSupportsRuntime } from "@/lib/agents/profiles/compatibility";
import type { AgentProfile } from "@/lib/agents/profiles/types";

interface WorkflowData {
  id: string;
  name: string;
  projectId: string | null;
  definition: string;
}

interface WorkflowFormViewProps {
  workflow?: WorkflowData;
  projects: { id: string; name: string }[];
  profiles: Pick<AgentProfile, "id" | "name" | "supportedRuntimes">[];
  clone?: boolean;
}

function createEmptyStep(): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    name: "",
    prompt: "",
    requiresApproval: false,
  };
}

function parseDefinition(json: string): WorkflowDefinition | null {
  try {
    return JSON.parse(json) as WorkflowDefinition;
  } catch {
    return null;
  }
}

const PATTERN_ICONS: Record<string, React.ReactNode> = {
  sequence: <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />,
  "planner-executor": <Brain className="h-3.5 w-3.5 text-muted-foreground" />,
  checkpoint: <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />,
  loop: <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />,
};

export function WorkflowFormView({
  workflow,
  projects,
  profiles,
  clone = false,
}: WorkflowFormViewProps) {
  const runtimeOptions = listRuntimeCatalog();
  const runtimeLabelMap = new Map(
    runtimeOptions.map((runtime) => [runtime.id, runtime.label])
  );
  const router = useRouter();
  const mode = workflow ? (clone ? "clone" : "edit") : "create";

  const [name, setName] = useState("");
  const [pattern, setPattern] = useState<string>("sequence");
  const [projectId, setProjectId] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([createEmptyStep()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loop-specific state
  const [loopPrompt, setLoopPrompt] = useState("");
  const [maxIterations, setMaxIterations] = useState(5);
  const [timeBudgetMinutes, setTimeBudgetMinutes] = useState<number | "">(
    ""
  );
  const [loopAssignedAgent, setLoopAssignedAgent] = useState("");
  const [loopAgentProfile, setLoopAgentProfile] = useState("");

  // Pre-populate form for edit/clone
  useEffect(() => {
    if (!workflow) return;

    const def = parseDefinition(workflow.definition);
    setName(clone ? `${workflow.name} (Copy)` : workflow.name);
    setProjectId(workflow.projectId ?? "");

    if (def) {
      setPattern(def.pattern);
      if (def.pattern === "loop") {
        setLoopPrompt(def.steps[0]?.prompt ?? "");
        setMaxIterations(def.loopConfig?.maxIterations ?? 5);
        setTimeBudgetMinutes(
          def.loopConfig?.timeBudgetMs
            ? def.loopConfig.timeBudgetMs / 60000
            : ""
        );
        setLoopAssignedAgent(def.loopConfig?.assignedAgent ?? "");
        setLoopAgentProfile(def.loopConfig?.agentProfile ?? "");
      } else {
        setSteps(
          clone
            ? def.steps.map((s) => ({ ...s, id: crypto.randomUUID() }))
            : def.steps
        );
      }
    }
  }, [workflow, clone]);

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

  function getProfileCompatibilityError(
    profileId?: string,
    runtimeId?: string
  ): string | null {
    if (!profileId) {
      return null;
    }

    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      return `Profile "${profileId}" was not found`;
    }

    const selectedRuntimeId = (runtimeId ||
      DEFAULT_AGENT_RUNTIME) as AgentRuntimeId;
    if (profileSupportsRuntime(profile, selectedRuntimeId)) {
      return null;
    }

    return `${profile.name} does not support ${
      runtimeLabelMap.get(selectedRuntimeId) ?? selectedRuntimeId
    }`;
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
      const loopCompatibilityError = getProfileCompatibilityError(
        loopAgentProfile || undefined,
        loopAssignedAgent || undefined
      );
      if (loopCompatibilityError) {
        setError(loopCompatibilityError);
        return;
      }
    } else {
      if (steps.some((s) => !s.name.trim() || !s.prompt.trim())) {
        setError("All steps must have a name and prompt");
        return;
      }
      for (const [index, step] of steps.entries()) {
        const compatibilityError = getProfileCompatibilityError(
          step.agentProfile,
          step.assignedAgent
        );
        if (compatibilityError) {
          setError(`Step ${index + 1}: ${compatibilityError}`);
          return;
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      const definition = isLoop
        ? {
            pattern,
            steps: [
              {
                id: crypto.randomUUID(),
                name: "Loop",
                prompt: loopPrompt.trim(),
              },
            ],
            loopConfig: {
              maxIterations,
              ...(timeBudgetMinutes
                ? { timeBudgetMs: Number(timeBudgetMinutes) * 60 * 1000 }
                : {}),
              ...(loopAssignedAgent ? { assignedAgent: loopAssignedAgent } : {}),
              ...(loopAgentProfile ? { agentProfile: loopAgentProfile }
                : {}),
            },
          }
        : { pattern, steps };

      const isEdit = mode === "edit" && workflow;

      const url = isEdit
        ? `/api/workflows/${workflow.id}`
        : "/api/workflows";

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          projectId: projectId || undefined,
          definition,
        }),
      });

      if (res.ok) {
        toast.success(
          mode === "edit"
            ? "Workflow updated"
            : mode === "clone"
              ? "Workflow cloned"
              : "Workflow created"
        );

        if (isEdit) {
          router.push(`/workflows/${workflow.id}`);
        } else {
          const data = await res.json().catch(() => null);
          if (data?.id) {
            router.push(`/workflows/${data.id}`);
          } else {
            router.push("/workflows");
          }
        }
      } else {
        const data = await res.json().catch(() => null);
        setError(
          data?.error ??
            `Failed to ${mode === "edit" ? "update" : "create"} workflow (${res.status})`
        );
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<string, string> = {
    create: "Create Workflow",
    edit: "Edit Workflow",
    clone: "Clone Workflow",
  };

  const submitLabels: Record<string, [string, string]> = {
    create: ["Creating...", "Create Workflow"],
    edit: ["Saving...", "Save Changes"],
    clone: ["Cloning...", "Clone Workflow"],
  };

  const isLoop = pattern === "loop";

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{titles[mode]}</h2>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
          {/* Left: Config sidebar */}
          <div className="space-y-4">
            <FormSectionCard icon={GitBranch} title="Workflow Identity">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wf-name">Name</Label>
                  <Input
                    id="wf-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Workflow name"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Short descriptive name</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Pattern</Label>
                  <Select
                    value={pattern}
                    onValueChange={setPattern}
                    disabled={mode === "edit"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequence">
                        <span className="flex items-center gap-1.5">
                          {PATTERN_ICONS.sequence}
                          Sequence
                        </span>
                      </SelectItem>
                      <SelectItem value="planner-executor">
                        <span className="flex items-center gap-1.5">
                          {PATTERN_ICONS["planner-executor"]}
                          Planner → Executor
                        </span>
                      </SelectItem>
                      <SelectItem value="checkpoint">
                        <span className="flex items-center gap-1.5">
                          {PATTERN_ICONS.checkpoint}
                          Checkpoint
                        </span>
                      </SelectItem>
                      <SelectItem value="loop">
                        <span className="flex items-center gap-1.5">
                          {PATTERN_ICONS.loop}
                          Autonomous Loop
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">How steps execute</p>
                </div>
                {projects.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Project</Label>
                    <Select
                      value={projectId || "none"}
                      onValueChange={(value) =>
                        setProjectId(value === "none" ? "" : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Associates working directory</p>
                  </div>
                )}
              </div>
            </FormSectionCard>

            {isLoop && (
              <FormSectionCard icon={RefreshCw} title="Loop Config">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Max Iterations</Label>
                      <Badge variant="secondary" className="tabular-nums text-xs">
                        {maxIterations}
                      </Badge>
                    </div>
                    <Slider
                      min={1}
                      max={100}
                      step={1}
                      value={[maxIterations]}
                      onValueChange={([v]) => setMaxIterations(v)}
                    />
                    <p className="text-xs text-muted-foreground">Safety limit for loops</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Time Budget (min)</Label>
                      <Badge variant="secondary" className="tabular-nums text-xs">
                        {timeBudgetMinutes || "None"}
                      </Badge>
                    </div>
                    <Slider
                      min={0}
                      max={120}
                      step={1}
                      value={[typeof timeBudgetMinutes === "number" ? timeBudgetMinutes : 0]}
                      onValueChange={([v]) => setTimeBudgetMinutes(v === 0 ? "" : v)}
                    />
                    <p className="text-xs text-muted-foreground">Optional time cap (0 = no limit)</p>
                  </div>
                  {profiles.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Agent Profile</Label>
                      <Select
                        value={loopAgentProfile || "auto"}
                        onValueChange={(value) =>
                          setLoopAgentProfile(value === "auto" ? "" : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Auto-detect" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto-detect</SelectItem>
                          {profiles.map((p) => (
                            <SelectItem
                              key={p.id}
                              value={p.id}
                              disabled={
                                !profileSupportsRuntime(
                                  p,
                                  loopAssignedAgent || DEFAULT_AGENT_RUNTIME
                                )
                              }
                            >
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Which agent to use per iteration</p>
                      {loopAgentProfile &&
                        getProfileCompatibilityError(
                          loopAgentProfile,
                          loopAssignedAgent || undefined
                        ) && (
                          <p className="text-xs text-destructive">
                            {getProfileCompatibilityError(
                              loopAgentProfile,
                              loopAssignedAgent || undefined
                            )}
                          </p>
                        )}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Runtime</Label>
                    <Select
                      value={loopAssignedAgent || "default"}
                      onValueChange={(value) =>
                        setLoopAssignedAgent(value === "default" ? "" : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Default runtime" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default runtime</SelectItem>
                        {runtimeOptions.map((runtime) => (
                          <SelectItem key={runtime.id} value={runtime.id}>
                            {runtime.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Which provider runtime to use per iteration
                    </p>
                  </div>
                </div>
              </FormSectionCard>
            )}

            {!isLoop && (
              <FormSectionCard icon={ListOrdered} title="Step Overview">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {steps.length} {steps.length === 1 ? "step" : "steps"}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addStep}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Step
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {steps.map((step, i) => (
                      <p key={step.id} className="text-xs text-muted-foreground truncate">
                        #{i + 1} {step.name || "(unnamed)"}
                      </p>
                    ))}
                  </div>
                </div>
              </FormSectionCard>
            )}
          </div>

          {/* Right: Main content */}
          <div className="space-y-4">
            {isLoop ? (
              <FormSectionCard icon={MessageSquare} title="Loop Prompt">
                <div className="space-y-1.5">
                  <Textarea
                    id="loop-prompt"
                    value={loopPrompt}
                    onChange={(e) => setLoopPrompt(e.target.value)}
                    placeholder="The prompt the agent will iterate on..."
                    rows={8}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Each iteration receives previous output as context
                  </p>
                </div>
              </FormSectionCard>
            ) : (
              steps.map((step, index) => (
                <FormSectionCard
                  key={step.id}
                  icon={ListOrdered}
                  title={`Step ${index + 1}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        #{index + 1}
                      </Badge>
                      <Input
                        value={step.name}
                        onChange={(e) =>
                          updateStep(index, { name: e.target.value })
                        }
                        placeholder="Step name"
                        className="flex-1"
                      />
                      {steps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeStep(index)}
                          aria-label={`Remove step ${index + 1}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Textarea
                        value={step.prompt}
                        onChange={(e) =>
                          updateStep(index, { prompt: e.target.value })
                        }
                        placeholder="Instructions for the agent"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">Agent prompt for this step</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {profiles.length > 0 && (
                        <div className="flex-1">
                          <Select
                            value={step.agentProfile || "auto"}
                            onValueChange={(v) =>
                              updateStep(index, {
                                agentProfile: v === "auto" ? undefined : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Profile: Auto-detect" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto-detect</SelectItem>
                              {profiles.map((p) => (
                                <SelectItem
                                  key={p.id}
                                  value={p.id}
                                  disabled={
                                    !profileSupportsRuntime(
                                      p,
                                      step.assignedAgent || DEFAULT_AGENT_RUNTIME
                                    )
                                  }
                                >
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {step.agentProfile &&
                            getProfileCompatibilityError(
                              step.agentProfile,
                              step.assignedAgent
                            ) && (
                              <p className="mt-1 text-xs text-destructive">
                                {getProfileCompatibilityError(
                                  step.agentProfile,
                                  step.assignedAgent
                                )}
                              </p>
                            )}
                        </div>
                      )}
                      <div className="flex-1">
                        <Select
                          value={step.assignedAgent || "default"}
                          onValueChange={(value) =>
                            updateStep(index, {
                              assignedAgent:
                                value === "default" ? undefined : value,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Runtime: Default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default runtime</SelectItem>
                            {runtimeOptions.map((runtime) => (
                              <SelectItem key={runtime.id} value={runtime.id}>
                                {runtime.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {pattern === "checkpoint" && (
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`approval-${step.id}`}
                            checked={step.requiresApproval ?? false}
                            onCheckedChange={(checked) =>
                              updateStep(index, {
                                requiresApproval: checked,
                              })
                            }
                          />
                          <Label
                            htmlFor={`approval-${step.id}`}
                            className="text-xs"
                          >
                            Requires approval
                          </Label>
                        </div>
                      )}
                    </div>
                  </div>
                </FormSectionCard>
              ))
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading || !name.trim()}
              >
                {loading ? submitLabels[mode][0] : submitLabels[mode][1]}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
