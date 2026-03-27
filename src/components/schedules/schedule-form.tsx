"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Clock, Bot } from "lucide-react";
import {
  type AgentRuntimeId,
  DEFAULT_AGENT_RUNTIME,
  listRuntimeCatalog,
} from "@/lib/agents/runtime/catalog";
import {
  getSupportedRuntimes,
  profileSupportsRuntime,
} from "@/lib/agents/profiles/compatibility";
import type { AgentProfile } from "@/lib/agents/profiles/types";

type ProfileOption = Pick<AgentProfile, "id" | "name" | "supportedRuntimes">;

export const INTERVAL_PRESETS = [
  { label: "Every 5 minutes", value: "5m" },
  { label: "Every 15 minutes", value: "15m" },
  { label: "Every 30 minutes", value: "30m" },
  { label: "Every hour", value: "1h" },
  { label: "Every 2 hours", value: "2h" },
  { label: "Daily at 9 AM", value: "1d" },
  { label: "Custom", value: "custom" },
];

export interface ScheduleFormValues {
  name: string;
  prompt: string;
  interval: string;
  projectId: string;
  assignedAgent: string;
  agentProfile: string;
  recurs: boolean;
  maxFirings: number | "";
  expiresInHours: number | "";
}

export interface ScheduleFormInitialValues {
  name: string;
  prompt: string;
  /** The cron expression or human-friendly interval string */
  interval: string;
  projectId: string;
  assignedAgent: string;
  agentProfile: string;
  recurs: boolean;
  maxFirings: number | null;
  expiresAt: string | null;
}

interface ScheduleFormProps {
  projects: { id: string; name: string }[];
  initialValues?: ScheduleFormInitialValues;
  onSubmit: (values: ScheduleFormValues) => Promise<void>;
  submitLabel: string;
  loading: boolean;
  error: string | null;
  onError: (error: string | null) => void;
}

/** Reverse-map a cron expression to a preset value, or "custom" if no match */
function cronToPreset(cron: string): { preset: string; custom: string } {
  const presetMap: Record<string, string> = {
    "*/5 * * * *": "5m",
    "*/15 * * * *": "15m",
    "*/30 * * * *": "30m",
    "0 * * * *": "1h",
    "0 */2 * * *": "2h",
    "0 9 * * *": "1d",
  };
  const matched = presetMap[cron];
  if (matched) return { preset: matched, custom: "" };
  return { preset: "custom", custom: cron };
}

export function ScheduleForm({
  projects,
  initialValues,
  onSubmit,
  submitLabel,
  loading,
  error,
  onError,
}: ScheduleFormProps) {
  const runtimeOptions = listRuntimeCatalog();
  const runtimeLabelMap = new Map(
    runtimeOptions.map((runtime) => [runtime.id, runtime.label])
  );

  // Determine initial interval state
  const initInterval = initialValues
    ? cronToPreset(initialValues.interval)
    : { preset: "5m", custom: "" };

  const [name, setName] = useState(initialValues?.name ?? "");
  const [prompt, setPrompt] = useState(initialValues?.prompt ?? "");
  const [intervalPreset, setIntervalPreset] = useState(initInterval.preset);
  const [customInterval, setCustomInterval] = useState(initInterval.custom);
  const [projectId, setProjectId] = useState(initialValues?.projectId ?? "");
  const [assignedAgent, setAssignedAgent] = useState(
    initialValues?.assignedAgent ?? ""
  );
  const [agentProfile, setAgentProfile] = useState(
    initialValues?.agentProfile ?? ""
  );
  const [recurs, setRecurs] = useState(initialValues?.recurs ?? true);
  const [maxFirings, setMaxFirings] = useState<number | "">(
    initialValues?.maxFirings ?? ""
  );
  const [expiresInHours, setExpiresInHours] = useState<number | "">(
    initialValues ? "" : ""
  );
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: ProfileOption[]) => setProfiles(data))
      .catch(() => {});
  }, []);

  const selectedRuntimeId = (assignedAgent ||
    DEFAULT_AGENT_RUNTIME) as AgentRuntimeId;
  const selectedProfile = profiles.find(
    (profile) => profile.id === agentProfile
  );
  const profileCompatibilityError =
    selectedProfile && !profileSupportsRuntime(selectedProfile, selectedRuntimeId)
      ? `${selectedProfile.name} does not support ${
          runtimeLabelMap.get(selectedRuntimeId) ?? selectedRuntimeId
        }`
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;

    const interval =
      intervalPreset === "custom" ? customInterval : intervalPreset;
    if (!interval.trim()) {
      onError("Please enter an interval");
      return;
    }
    if (profileCompatibilityError) {
      onError(profileCompatibilityError);
      return;
    }

    onError(null);
    await onSubmit({
      name: name.trim(),
      prompt: prompt.trim(),
      interval,
      projectId,
      assignedAgent,
      agentProfile,
      recurs,
      maxFirings,
      expiresInHours,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="sched-name">Name</Label>
        <Input
          id="sched-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Build status check"
          required
        />
        <p className="text-xs text-muted-foreground">
          Human-readable schedule name
        </p>
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <Label htmlFor="sched-prompt">Prompt</Label>
        <Textarea
          id="sched-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What the agent does each firing"
          rows={3}
          required
        />
        <p className="text-xs text-muted-foreground">
          Instructions for each execution
        </p>
      </div>

      {/* Interval */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          Interval
        </Label>
        <Select value={intervalPreset} onValueChange={setIntervalPreset}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {intervalPreset === "custom" && (
          <>
            <Input
              value={customInterval}
              onChange={(e) => setCustomInterval(e.target.value)}
              placeholder="e.g., 10m, 3h, or */5 * * * *"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground">
              Duration or cron expression
            </p>
          </>
        )}
      </div>

      {/* Recurring toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="sched-recurs">Recurring</Label>
          <Switch
            id="sched-recurs"
            checked={recurs}
            onCheckedChange={setRecurs}
          />
        </div>
        {recurs && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sched-max">Max firings</Label>
              <Input
                id="sched-max"
                type="number"
                min={1}
                value={maxFirings}
                onChange={(e) =>
                  setMaxFirings(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="Unlimited"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty = unlimited
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-expires">Expires in (hours)</Label>
              <Input
                id="sched-expires"
                type="number"
                min={1}
                value={expiresInHours}
                onChange={(e) =>
                  setExpiresInHours(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
                placeholder="Never"
              />
              <p className="text-xs text-muted-foreground">Auto-pause timer</p>
            </div>
          </div>
        )}
      </div>

      {/* Project */}
      {projects.length > 0 && (
        <div className="space-y-2">
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
          <p className="text-xs text-muted-foreground">Context directory</p>
        </div>
      )}

      {/* Runtime */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          Runtime
        </Label>
        <Select
          value={assignedAgent || "default"}
          onValueChange={(value) =>
            setAssignedAgent(value === "default" ? "" : value)
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
          Which provider runtime each firing should use
        </p>
      </div>

      {/* Agent Profile */}
      {profiles.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            Agent Profile
          </Label>
          <Select
            value={agentProfile || "auto"}
            onValueChange={(value) =>
              setAgentProfile(value === "auto" ? "" : value)
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
                  disabled={!profileSupportsRuntime(p, selectedRuntimeId)}
                >
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Auto-detect only considers profiles compatible with the selected
            runtime
          </p>
          {selectedProfile && (
            <p
              className={`text-xs ${
                profileCompatibilityError
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {profileCompatibilityError ??
                `Supports ${getSupportedRuntimes(selectedProfile)
                  .map(
                    (runtimeId) =>
                      runtimeLabelMap.get(runtimeId) ?? runtimeId
                  )
                  .join(", ")}`}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={loading || !name.trim() || !prompt.trim()}
        className="w-full"
      >
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
