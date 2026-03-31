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
  Bot,
  ListOrdered,
  MessageSquare,
  ArrowDown,
  Brain,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { FormSectionCard } from "@/components/shared/form-section-card";
import type {
  WorkflowStep,
  WorkflowDefinition,
  WorkflowPattern,
} from "@/lib/workflows/types";
import {
  type AgentRuntimeId,
  DEFAULT_AGENT_RUNTIME,
  listRuntimeCatalog,
} from "@/lib/agents/runtime/catalog";
import { profileSupportsRuntime } from "@/lib/agents/profiles/compatibility";
import type { AgentProfile } from "@/lib/agents/profiles/types";
import { validateWorkflowDefinition } from "@/lib/workflows/definition-validation";
import {
  MAX_PARALLEL_BRANCHES,
  MIN_PARALLEL_BRANCHES,
} from "@/lib/workflows/parallel";
import {
  DEFAULT_SWARM_CONCURRENCY_LIMIT,
  MAX_SWARM_WORKERS,
  MIN_SWARM_WORKERS,
} from "@/lib/workflows/swarm";

interface WorkflowData {
  id: string;
  name: string;
  projectId: string | null;
  definition: string;
}

interface WorkflowFormViewProps {
  workflow?: WorkflowData;
  projects: { id: string; name: string }[];
  profiles: Pick<AgentProfile, "id" | "name" | "supportedRuntimes" | "origin" | "scope">[];
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

function createParallelBranchStep(index: number): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    name: `Research Branch ${index}`,
    prompt: "",
  };
}

function createParallelSynthesisStep(branchIds: string[]): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    name: "Synthesize findings",
    prompt: "",
    dependsOn: branchIds,
  };
}

function isSynthesisStep(step: WorkflowStep): boolean {
  return !!step.dependsOn?.length;
}

function buildParallelSteps(
  branches: WorkflowStep[],
  synthesis?: WorkflowStep
): WorkflowStep[] {
  const normalizedBranches = branches.map((branch) => ({
    ...branch,
    requiresApproval: false,
    dependsOn: undefined,
  }));
  const branchIds = normalizedBranches.map((branch) => branch.id);
  const joinStep = synthesis
    ? {
        ...synthesis,
        requiresApproval: false,
        dependsOn: branchIds,
      }
    : createParallelSynthesisStep(branchIds);

  return [...normalizedBranches, joinStep];
}

function createDefaultParallelSteps(): WorkflowStep[] {
  return buildParallelSteps(
    Array.from({ length: MIN_PARALLEL_BRANCHES }, (_, index) =>
      createParallelBranchStep(index + 1)
    )
  );
}

function normalizeParallelSteps(
  input: WorkflowStep[],
  options?: { cloneIds?: boolean }
): WorkflowStep[] {
  const rawBranches = input.filter((step) => !isSynthesisStep(step)).slice(
    0,
    MAX_PARALLEL_BRANCHES
  );
  const rawSynthesis = input.find(isSynthesisStep);

  const branches = [...rawBranches];
  while (branches.length < MIN_PARALLEL_BRANCHES) {
    branches.push(createParallelBranchStep(branches.length + 1));
  }

  const normalizedBranches = branches.map((branch, index) => ({
    ...branch,
    id: options?.cloneIds ? crypto.randomUUID() : branch.id,
    name: branch.name || `Research Branch ${index + 1}`,
  }));

  const normalizedSynthesis = rawSynthesis
    ? {
        ...rawSynthesis,
        id: options?.cloneIds ? crypto.randomUUID() : rawSynthesis.id,
        name: rawSynthesis.name || "Synthesize findings",
      }
    : undefined;

  return buildParallelSteps(normalizedBranches, normalizedSynthesis);
}

function getParallelParts(steps: WorkflowStep[]) {
  return {
    branchSteps: steps.filter((step) => !isSynthesisStep(step)),
    synthesisStep: steps.find(isSynthesisStep) ?? null,
  };
}

function createSwarmMayorStep(): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    name: "Mayor plan",
    prompt:
      "Break the goal into a concise swarm plan. Assign a distinct focus area to each worker by name, call out dependencies or overlap risks, and define what the refinery should merge at the end.",
  };
}

function createSwarmWorkerStep(index: number): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    name: `Worker ${index}`,
    prompt:
      "Own one slice of the mayor plan. Produce concrete findings, decisions, or deliverables the refinery can merge with sibling worker output.",
  };
}

function createSwarmRefineryStep(): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    name: "Refine and merge",
    prompt:
      "Merge the mayor plan and worker outputs into one final result. Resolve overlaps, call out conflicts, and produce the final deliverable with a short rationale.",
  };
}

function buildSwarmSteps(
  mayorStep: WorkflowStep,
  workerSteps: WorkflowStep[],
  refineryStep: WorkflowStep
): WorkflowStep[] {
  return [
    {
      ...mayorStep,
      requiresApproval: false,
      dependsOn: undefined,
    },
    ...workerSteps.map((worker) => ({
      ...worker,
      requiresApproval: false,
      dependsOn: undefined,
    })),
    {
      ...refineryStep,
      requiresApproval: false,
      dependsOn: undefined,
    },
  ];
}

function createDefaultSwarmSteps(): WorkflowStep[] {
  return buildSwarmSteps(
    createSwarmMayorStep(),
    Array.from({ length: MIN_SWARM_WORKERS }, (_, index) =>
      createSwarmWorkerStep(index + 1)
    ),
    createSwarmRefineryStep()
  );
}

function getSwarmParts(steps: WorkflowStep[]) {
  return {
    mayorStep: steps[0] ?? null,
    workerSteps: steps.length > 2 ? steps.slice(1, -1) : [],
    refineryStep: steps.length > 1 ? (steps.at(-1) ?? null) : null,
  };
}

function normalizeSwarmSteps(
  input: WorkflowStep[],
  options?: { cloneIds?: boolean }
): WorkflowStep[] {
  const { mayorStep, workerSteps, refineryStep } = getSwarmParts(input);

  const normalizedMayor = {
    ...(mayorStep ?? createSwarmMayorStep()),
    id:
      options?.cloneIds && mayorStep
        ? crypto.randomUUID()
        : (mayorStep?.id ?? crypto.randomUUID()),
    name: mayorStep?.name || "Mayor plan",
  };

  const nextWorkers = [...workerSteps].slice(0, MAX_SWARM_WORKERS);
  while (nextWorkers.length < MIN_SWARM_WORKERS) {
    nextWorkers.push(createSwarmWorkerStep(nextWorkers.length + 1));
  }

  const normalizedWorkers = nextWorkers.map((worker, index) => ({
    ...worker,
    id: options?.cloneIds ? crypto.randomUUID() : worker.id,
    name: worker.name || `Worker ${index + 1}`,
  }));

  const normalizedRefinery = {
    ...(refineryStep ?? createSwarmRefineryStep()),
    id:
      options?.cloneIds && refineryStep
        ? crypto.randomUUID()
        : (refineryStep?.id ?? crypto.randomUUID()),
    name: refineryStep?.name || "Refine and merge",
  };

  return buildSwarmSteps(
    normalizedMayor,
    normalizedWorkers,
    normalizedRefinery
  );
}

const PATTERN_ICONS: Record<string, React.ReactNode> = {
  sequence: <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />,
  "planner-executor": <Brain className="h-3.5 w-3.5 text-muted-foreground" />,
  checkpoint: <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />,
  loop: <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />,
  parallel: <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />,
  swarm: <Bot className="h-3.5 w-3.5 text-muted-foreground" />,
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
  const [pattern, setPattern] = useState<WorkflowPattern>("sequence");
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
  const [swarmConcurrencyLimit, setSwarmConcurrencyLimit] = useState(
    DEFAULT_SWARM_CONCURRENCY_LIMIT
  );

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
        if (def.pattern === "swarm") {
          setSwarmConcurrencyLimit(
            def.swarmConfig?.workerConcurrencyLimit ??
              DEFAULT_SWARM_CONCURRENCY_LIMIT
          );
        }

        setSteps(
          clone
            ? def.pattern === "parallel"
              ? normalizeParallelSteps(def.steps, { cloneIds: true })
              : def.pattern === "swarm"
                ? normalizeSwarmSteps(def.steps, { cloneIds: true })
              : def.steps.map((s) => ({ ...s, id: crypto.randomUUID() }))
            : def.pattern === "parallel"
              ? normalizeParallelSteps(def.steps)
              : def.pattern === "swarm"
                ? normalizeSwarmSteps(def.steps)
              : def.steps
        );
      }
    }
  }, [workflow, clone]);

  useEffect(() => {
    if (pattern !== "parallel") {
      return;
    }

    setSteps((prev) => {
      const { branchSteps, synthesisStep } = getParallelParts(prev);
      const hasValidShape =
        branchSteps.length >= MIN_PARALLEL_BRANCHES && synthesisStep !== null;

      return hasValidShape ? buildParallelSteps(branchSteps, synthesisStep) : createDefaultParallelSteps();
    });
  }, [pattern]);

  useEffect(() => {
    if (pattern !== "swarm") {
      return;
    }

    setSteps((prev) => {
      const { mayorStep, workerSteps, refineryStep } = getSwarmParts(prev);
      const hasValidShape =
        mayorStep !== null &&
        refineryStep !== null &&
        workerSteps.length >= MIN_SWARM_WORKERS;

      return hasValidShape
        ? buildSwarmSteps(mayorStep, workerSteps, refineryStep)
        : createDefaultSwarmSteps();
    });
  }, [pattern]);

  useEffect(() => {
    if (pattern !== "swarm") {
      return;
    }

    setSwarmConcurrencyLimit((prev) =>
      Math.min(Math.max(prev, 1), Math.max(getSwarmParts(steps).workerSteps.length, 1))
    );
  }, [pattern, steps]);

  function addStep() {
    setSteps((prev) => {
      if (pattern === "parallel") {
        const { branchSteps, synthesisStep } = getParallelParts(prev);
        if (branchSteps.length >= MAX_PARALLEL_BRANCHES) {
          return prev;
        }

        return buildParallelSteps(
          [...branchSteps, createParallelBranchStep(branchSteps.length + 1)],
          synthesisStep ?? undefined
        );
      }

      if (pattern === "swarm") {
        const { mayorStep, workerSteps, refineryStep } = getSwarmParts(prev);
        if (
          !mayorStep ||
          !refineryStep ||
          workerSteps.length >= MAX_SWARM_WORKERS
        ) {
          return prev;
        }

        return buildSwarmSteps(
          mayorStep,
          [...workerSteps, createSwarmWorkerStep(workerSteps.length + 1)],
          refineryStep
        );
      }

      return [...prev, createEmptyStep()];
    });
  }

  function removeStep(index: number) {
    setSteps((prev) => {
      if (pattern === "parallel") {
        const { branchSteps, synthesisStep } = getParallelParts(prev);
        if (index >= branchSteps.length || branchSteps.length <= MIN_PARALLEL_BRANCHES) {
          return prev;
        }

        return buildParallelSteps(
          branchSteps.filter((_, branchIndex) => branchIndex !== index),
          synthesisStep ?? undefined
        );
      }

      if (pattern === "swarm") {
        const { mayorStep, workerSteps, refineryStep } = getSwarmParts(prev);
        const workerIndex = index - 1;

        if (
          !mayorStep ||
          !refineryStep ||
          workerIndex < 0 ||
          workerIndex >= workerSteps.length ||
          workerSteps.length <= MIN_SWARM_WORKERS
        ) {
          return prev;
        }

        return buildSwarmSteps(
          mayorStep,
          workerSteps.filter((_, currentWorkerIndex) => currentWorkerIndex !== workerIndex),
          refineryStep
        );
      }

      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((_, i) => i !== index);
    });
  }

  function updateStep(index: number, updates: Partial<WorkflowStep>) {
    setSteps((prev) => {
      if (pattern === "parallel") {
        const { branchSteps, synthesisStep } = getParallelParts(prev);

        if (index < branchSteps.length) {
          const nextBranches = branchSteps.map((step, branchIndex) =>
            branchIndex === index
              ? { ...step, ...updates, dependsOn: undefined, requiresApproval: false }
              : step
          );
          return buildParallelSteps(nextBranches, synthesisStep ?? undefined);
        }

        if (synthesisStep) {
          return buildParallelSteps(branchSteps, {
            ...synthesisStep,
            ...updates,
            requiresApproval: false,
          });
        }
      }

      if (pattern === "swarm") {
        const { mayorStep, workerSteps, refineryStep } = getSwarmParts(prev);
        if (!mayorStep || !refineryStep) {
          return createDefaultSwarmSteps();
        }

        if (index === 0) {
          return buildSwarmSteps(
            {
              ...mayorStep,
              ...updates,
              dependsOn: undefined,
              requiresApproval: false,
            },
            workerSteps,
            refineryStep
          );
        }

        if (index === workerSteps.length + 1) {
          return buildSwarmSteps(mayorStep, workerSteps, {
            ...refineryStep,
            ...updates,
            dependsOn: undefined,
            requiresApproval: false,
          });
        }

        const workerIndex = index - 1;
        if (workerIndex >= 0 && workerIndex < workerSteps.length) {
          return buildSwarmSteps(
            mayorStep,
            workerSteps.map((worker, currentWorkerIndex) =>
              currentWorkerIndex === workerIndex
                ? {
                    ...worker,
                    ...updates,
                    dependsOn: undefined,
                    requiresApproval: false,
                  }
                : worker
            ),
            refineryStep
          );
        }
      }

      return prev.map((step, i) => (i === index ? { ...step, ...updates } : step));
    });
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
    const isParallel = pattern === "parallel";
    const isSwarm = pattern === "swarm";

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

      if (isParallel) {
        const { branchSteps } = getParallelParts(steps);
        if (branchSteps.length < MIN_PARALLEL_BRANCHES) {
          setError(
            `Parallel workflows require at least ${MIN_PARALLEL_BRANCHES} research branches`
          );
          return;
        }
      }

      if (isSwarm) {
        const { workerSteps } = getSwarmParts(steps);
        if (workerSteps.length < MIN_SWARM_WORKERS) {
          setError(
            `Swarm workflows require at least ${MIN_SWARM_WORKERS} worker agents`
          );
          return;
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedSwarmSteps = isSwarm ? normalizeSwarmSteps(steps) : null;
      const definition: WorkflowDefinition = isLoop
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
        : {
            pattern,
            steps: isParallel
              ? normalizeParallelSteps(steps)
              : isSwarm
                ? (normalizedSwarmSteps ?? normalizeSwarmSteps(steps))
                : steps,
            ...(isSwarm
              ? {
                  swarmConfig: {
                    workerConcurrencyLimit: Math.max(
                      1,
                      Math.min(
                        swarmConcurrencyLimit,
                        getSwarmParts(
                          normalizedSwarmSteps ?? normalizeSwarmSteps(steps)
                        ).workerSteps.length
                      )
                    ),
                  },
                }
              : {}),
          };

      const definitionError = validateWorkflowDefinition(definition);
      if (definitionError) {
        setError(definitionError);
        setLoading(false);
        return;
      }

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
  const isParallel = pattern === "parallel";
  const isSwarm = pattern === "swarm";
  const { branchSteps, synthesisStep } = getParallelParts(steps);
  const {
    mayorStep,
    workerSteps: swarmWorkerSteps,
    refineryStep,
  } = getSwarmParts(steps);

  function renderStepEditor(
    step: WorkflowStep,
    index: number,
    options?: {
      title: string;
      icon?: typeof ListOrdered;
      hint?: string;
      removable?: boolean;
      badgeLabel?: string;
    }
  ) {
    return (
      <FormSectionCard
        key={step.id}
        icon={options?.icon ?? ListOrdered}
        title={options?.title ?? `Step ${index + 1}`}
        hint={options?.hint}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs shrink-0">
              {options?.badgeLabel ?? `#${index + 1}`}
            </Badge>
            <Input
              value={step.name}
              onChange={(e) => updateStep(index, { name: e.target.value })}
              placeholder="Step name"
              className="flex-1"
            />
            {options?.removable && (
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
              onChange={(e) => updateStep(index, { prompt: e.target.value })}
              placeholder="Instructions for the agent"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Agent prompt for this step</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
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
                        <span className="flex items-center gap-1.5">
                          {p.name}
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${
                              p.scope === "project"
                                ? "bg-orange-500/60"
                                : p.scope === "builtin"
                                  ? "bg-primary/60"
                                  : p.origin === "environment"
                                    ? "bg-emerald-500/60"
                                    : "bg-muted-foreground/40"
                            }`}
                            title={
                              p.scope === "project"
                                ? "Project"
                                : p.scope === "builtin"
                                  ? "Built-in"
                                  : p.origin === "environment"
                                    ? "Discovered"
                                    : "Custom"
                            }
                          />
                        </span>
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
                    assignedAgent: value === "default" ? undefined : value,
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
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id={`approval-${step.id}`}
                  checked={step.requiresApproval ?? false}
                  onCheckedChange={(checked) =>
                    updateStep(index, {
                      requiresApproval: checked,
                    })
                  }
                />
                <Label htmlFor={`approval-${step.id}`} className="text-xs">
                  Requires approval
                </Label>
              </div>
            )}
          </div>
        </div>
      </FormSectionCard>
    );
  }

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
                    onValueChange={(value) =>
                      setPattern(value as WorkflowPattern)
                    }
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
                      <SelectItem value="parallel">
                        <span className="flex items-center gap-1.5">
                          {PATTERN_ICONS.parallel}
                          Parallel Research
                        </span>
                      </SelectItem>
                      <SelectItem value="swarm">
                        <span className="flex items-center gap-1.5">
                          {PATTERN_ICONS.swarm}
                          Multi-Agent Swarm
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
                              <span className="flex items-center gap-1.5">
                                {p.name}
                                <span
                                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                                    p.scope === "project"
                                      ? "bg-orange-500/60"
                                      : p.scope === "builtin"
                                        ? "bg-primary/60"
                                        : p.origin === "environment"
                                          ? "bg-emerald-500/60"
                                          : "bg-muted-foreground/40"
                                  }`}
                                />
                              </span>
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

            {isSwarm && (
              <FormSectionCard
                icon={Bot}
                title="Swarm Config"
                hint="Mayor runs first, workers fan out in parallel, then the refinery merges the results."
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Worker Concurrency</Label>
                    <Badge variant="secondary" className="tabular-nums text-xs">
                      {Math.max(
                        1,
                        Math.min(
                          swarmConcurrencyLimit,
                          Math.max(swarmWorkerSteps.length, 1)
                        )
                      )}
                    </Badge>
                  </div>
                  <Slider
                    min={1}
                    max={Math.max(swarmWorkerSteps.length, 1)}
                    step={1}
                    value={[
                      Math.max(
                        1,
                        Math.min(
                          swarmConcurrencyLimit,
                          Math.max(swarmWorkerSteps.length, 1)
                        )
                      ),
                    ]}
                    onValueChange={([value]) => setSwarmConcurrencyLimit(value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    How many workers can run at once
                  </p>
                </div>
              </FormSectionCard>
            )}

            {!isLoop && (
              <FormSectionCard
                icon={isParallel ? GitBranch : isSwarm ? Bot : ListOrdered}
                title={
                  isParallel
                    ? "Parallel Overview"
                    : isSwarm
                      ? "Swarm Overview"
                      : "Step Overview"
                }
                hint={
                  isParallel
                    ? "Launch 2-5 research branches, then merge them in one synthesis step."
                    : isSwarm
                      ? "Run one mayor, 2-5 workers, and one refinery step on the existing workflow engine."
                    : undefined
                }
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {isParallel
                        ? `${branchSteps.length} branch${branchSteps.length === 1 ? "" : "es"}`
                        : isSwarm
                          ? `${swarmWorkerSteps.length} worker${swarmWorkerSteps.length === 1 ? "" : "s"}`
                        : `${steps.length} step${steps.length === 1 ? "" : "s"}`}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addStep}
                      disabled={
                        (isParallel && branchSteps.length >= MAX_PARALLEL_BRANCHES) ||
                        (isSwarm && swarmWorkerSteps.length >= MAX_SWARM_WORKERS)
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {isParallel ? "Add Branch" : isSwarm ? "Add Worker" : "Add Step"}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {isParallel ? (
                      <>
                        {branchSteps.map((step, i) => (
                          <p
                            key={step.id}
                            className="text-xs text-muted-foreground truncate"
                          >
                            Branch {i + 1}: {step.name || "(unnamed)"}
                          </p>
                        ))}
                        <p className="text-xs text-muted-foreground truncate">
                          Join: {synthesisStep?.name || "(unnamed synthesis step)"}
                        </p>
                      </>
                    ) : isSwarm ? (
                      <>
                        <p className="text-xs text-muted-foreground truncate">
                          Mayor: {mayorStep?.name || "(unnamed mayor step)"}
                        </p>
                        {swarmWorkerSteps.map((step, i) => (
                          <p
                            key={step.id}
                            className="text-xs text-muted-foreground truncate"
                          >
                            Worker {i + 1}: {step.name || "(unnamed)"}
                          </p>
                        ))}
                        <p className="text-xs text-muted-foreground truncate">
                          Refinery: {refineryStep?.name || "(unnamed refinery step)"}
                        </p>
                      </>
                    ) : (
                      steps.map((step, i) => (
                        <p
                          key={step.id}
                          className="text-xs text-muted-foreground truncate"
                        >
                          #{i + 1} {step.name || "(unnamed)"}
                        </p>
                      ))
                    )}
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
            ) : isParallel ? (
              <>
                <FormSectionCard
                  icon={GitBranch}
                  title="Research Branches"
                  hint="Each branch runs independently before Stagent unlocks the join step."
                >
                  <div className="space-y-4">
                    {branchSteps.map((step, index) =>
                      renderStepEditor(step, index, {
                        title: `Branch ${index + 1}`,
                        icon: GitBranch,
                        removable: branchSteps.length > MIN_PARALLEL_BRANCHES,
                        badgeLabel: `B${index + 1}`,
                      })
                    )}
                  </div>
                </FormSectionCard>

                {synthesisStep &&
                  renderStepEditor(synthesisStep, branchSteps.length, {
                    title: "Synthesis Step",
                    icon: MessageSquare,
                    hint: "This step receives labeled outputs from every branch as context.",
                    badgeLabel: "JOIN",
                  })}
              </>
            ) : isSwarm ? (
              <>
                {mayorStep &&
                  renderStepEditor(mayorStep, 0, {
                    title: "Mayor",
                    icon: Brain,
                    hint: "Plans the swarm, assigns each worker a lane, and defines the merge objective.",
                    badgeLabel: "MAYOR",
                  })}

                <FormSectionCard
                  icon={Bot}
                  title="Worker Agents"
                  hint="Workers run in parallel after the mayor step completes."
                >
                  <div className="space-y-4">
                    {swarmWorkerSteps.map((step, index) =>
                      renderStepEditor(step, index + 1, {
                        title: `Worker ${index + 1}`,
                        icon: Bot,
                        removable:
                          swarmWorkerSteps.length > MIN_SWARM_WORKERS,
                        badgeLabel: `W${index + 1}`,
                      })
                    )}
                  </div>
                </FormSectionCard>

                {refineryStep &&
                  renderStepEditor(
                    refineryStep,
                    swarmWorkerSteps.length + 1,
                    {
                      title: "Refinery",
                      icon: MessageSquare,
                      hint: "Merges the mayor plan and completed worker outputs into one final result.",
                      badgeLabel: "REFINERY",
                    }
                  )}
              </>
            ) : (
              steps.map((step, index) =>
                renderStepEditor(step, index, {
                  title: `Step ${index + 1}`,
                  removable: steps.length > 1,
                })
              )
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
