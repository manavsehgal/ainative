"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Bot, FileText, AlignLeft } from "lucide-react";
import { toast } from "sonner";
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
import type { TaskItem } from "./task-card";

type ProfileOption = Pick<
  AgentProfile,
  "id" | "name" | "description" | "supportedRuntimes"
>;

const PRIORITY_COLORS: Record<string, string> = {
  "0": "bg-[var(--priority-critical)]",
  "1": "bg-[var(--priority-high)]",
  "2": "bg-[var(--priority-medium)]",
  "3": "bg-[var(--priority-low)]",
};

interface TaskEditDialogProps {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function TaskEditDialog({
  task,
  open,
  onOpenChange,
  onUpdated,
}: TaskEditDialogProps) {
  const runtimeOptions = listRuntimeCatalog();
  const runtimeLabelMap = new Map(
    runtimeOptions.map((runtime) => [runtime.id, runtime.label])
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("2");
  const [assignedAgent, setAssignedAgent] = useState("");
  const [agentProfile, setAgentProfile] = useState("");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: ProfileOption[]) => setProfiles(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(String(task.priority));
      setAssignedAgent(task.assignedAgent ?? "");
      setAgentProfile(task.agentProfile ?? "");
    }
  }, [task]);

  const selectedRuntimeId = (assignedAgent ||
    DEFAULT_AGENT_RUNTIME) as AgentRuntimeId;
  const selectedProfile = profiles.find((p) => p.id === agentProfile);
  const profileCompatibilityError =
    selectedProfile && !profileSupportsRuntime(selectedProfile, selectedRuntimeId)
      ? `${selectedProfile.name} does not support ${
          runtimeLabelMap.get(selectedRuntimeId) ?? selectedRuntimeId
        }`
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !title.trim()) return;
    if (profileCompatibilityError) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority: parseInt(priority, 10),
          assignedAgent: assignedAgent || undefined,
          agentProfile: agentProfile || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Task updated");
        onOpenChange(false);
        onUpdated();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to update task");
      }
    } catch {
      toast.error("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update task details. Only planned and queued tasks can be edited.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-task-title" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Title
            </Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-task-desc" className="flex items-center gap-1.5">
              <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
              Description
            </Label>
            <Textarea
              id="edit-task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detailed instructions for the agent"
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "0", label: "P0 - Critical" },
                  { value: "1", label: "P1 - High" },
                  { value: "2", label: "P2 - Medium" },
                  { value: "3", label: "P3 - Low" },
                ].map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[p.value]} inline-block`} />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          </div>
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
                      <span className="flex items-center gap-1.5">
                        <Bot className="h-3 w-3" />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Button
            type="submit"
            disabled={loading || !title.trim() || !!profileCompatibilityError}
            className="w-full"
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
