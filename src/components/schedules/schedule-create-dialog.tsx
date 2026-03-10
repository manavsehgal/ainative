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
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ProfileOption {
  id: string;
  name: string;
}

interface ScheduleCreateDialogProps {
  projects: { id: string; name: string }[];
  onCreated: () => void;
}

const INTERVAL_PRESETS = [
  { label: "Every 5 minutes", value: "5m" },
  { label: "Every 15 minutes", value: "15m" },
  { label: "Every 30 minutes", value: "30m" },
  { label: "Every hour", value: "1h" },
  { label: "Every 2 hours", value: "2h" },
  { label: "Daily at 9 AM", value: "1d" },
  { label: "Custom", value: "custom" },
];

export function ScheduleCreateDialog({
  projects,
  onCreated,
}: ScheduleCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [intervalPreset, setIntervalPreset] = useState("5m");
  const [customInterval, setCustomInterval] = useState("");
  const [projectId, setProjectId] = useState("");
  const [agentProfile, setAgentProfile] = useState("");
  const [recurs, setRecurs] = useState(true);
  const [maxFirings, setMaxFirings] = useState<number | "">("");
  const [expiresInHours, setExpiresInHours] = useState<number | "">("");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: ProfileOption[]) => setProfiles(data))
      .catch(() => {});
  }, []);

  function resetForm() {
    setName("");
    setPrompt("");
    setIntervalPreset("5m");
    setCustomInterval("");
    setProjectId("");
    setAgentProfile("");
    setRecurs(true);
    setMaxFirings("");
    setExpiresInHours("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;

    const interval =
      intervalPreset === "custom" ? customInterval : intervalPreset;
    if (!interval.trim()) {
      setError("Please enter an interval");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          prompt: prompt.trim(),
          interval,
          projectId: projectId || undefined,
          agentProfile: agentProfile || undefined,
          recurs,
          maxFirings: maxFirings || undefined,
          expiresInHours: expiresInHours || undefined,
        }),
      });

      if (res.ok) {
        resetForm();
        setOpen(false);
        toast.success("Schedule created");
        onCreated();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed to create schedule (${res.status})`);
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
          New Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sched-name">Name</Label>
            <Input
              id="sched-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Build status check"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sched-prompt">Prompt</Label>
            <Textarea
              id="sched-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="The prompt the agent will execute on each firing"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Interval</Label>
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
              <Input
                value={customInterval}
                onChange={(e) => setCustomInterval(e.target.value)}
                placeholder="e.g., 10m, 3h, or */5 * * * *"
                className="mt-2"
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="sched-recurs">Recurring</Label>
            <Switch
              id="sched-recurs"
              checked={recurs}
              onCheckedChange={setRecurs}
            />
          </div>

          {recurs && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sched-max">Max firings (optional)</Label>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="sched-expires">Expires in (hours, optional)</Label>
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
              </div>
            </div>
          )}

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
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {profiles.length > 0 && (
            <div className="space-y-2">
              <Label>Agent Profile (optional)</Label>
              <Select value={agentProfile} onValueChange={setAgentProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={loading || !name.trim() || !prompt.trim()}
            className="w-full"
          >
            {loading ? "Creating..." : "Create Schedule"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
