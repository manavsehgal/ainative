"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, FileText, Settings, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { AIAssistPanel } from "./ai-assist-panel";
import { FileUpload } from "./file-upload";
import { FormSectionCard } from "@/components/shared/form-section-card";
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

type ProfileOption = Pick<
  AgentProfile,
  "id" | "name" | "description" | "supportedRuntimes"
>;

interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: string;
}

interface TaskCreatePanelProps {
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  "0": "bg-[var(--priority-critical)]",
  "1": "bg-[var(--priority-high)]",
  "2": "bg-[var(--priority-medium)]",
  "3": "bg-[var(--priority-low)]",
};

export function TaskCreatePanel({ projects, defaultProjectId }: TaskCreatePanelProps) {
  const runtimeOptions = listRuntimeCatalog();
  const runtimeLabelMap = new Map(
    runtimeOptions.map((runtime) => [runtime.id, runtime.label])
  );
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [assignedAgent, setAssignedAgent] = useState<string>("");
  const [priority, setPriority] = useState("2");
  const [agentProfile, setAgentProfile] = useState<string>("");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: ProfileOption[]) => setProfiles(data))
      .catch(() => {});
  }, []);

  const selectedRuntimeId = (assignedAgent ||
    DEFAULT_AGENT_RUNTIME) as AgentRuntimeId;
  const selectedProfile = profiles.find((profile) => profile.id === agentProfile);
  const profileCompatibilityError =
    selectedProfile && !profileSupportsRuntime(selectedProfile, selectedRuntimeId)
      ? `${selectedProfile.name} does not support ${
          runtimeLabelMap.get(selectedRuntimeId) ?? selectedRuntimeId
        }`
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (profileCompatibilityError) {
      setError(profileCompatibilityError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: projectId || undefined,
          priority: parseInt(priority, 10),
          assignedAgent: assignedAgent || undefined,
          agentProfile: agentProfile || undefined,
          fileIds: uploads.length > 0 ? uploads.map((f) => f.id) : undefined,
        }),
      });
      if (res.ok) {
        toast.success("Task created");
        router.push("/dashboard");
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed to create task (${res.status})`);
      }
    } catch (err) {
      setError("Network error — could not reach server");
      console.error("Task creation failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create Task</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <FormSectionCard icon={FileText} title="Task Details">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="task-title">Title</Label>
                    <Input
                      id="task-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Concise task summary</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-desc">Description</Label>
                    <Textarea
                      id="task-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Detailed instructions for the agent"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Detailed agent instructions</p>
                  </div>
                </div>
              </FormSectionCard>

              <FormSectionCard icon={Settings} title="Configuration">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
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
                      <p className="text-xs text-muted-foreground">Working directory</p>
                    </div>
                    <div className="space-y-1.5">
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
                  </div>
                  <div className="space-y-1.5">
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
                      Which provider runtime should execute this task
                    </p>
                  </div>
                  {profiles.length > 0 && (
                    <div className="space-y-1.5">
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
                      <p className="text-xs text-muted-foreground">
                        Auto-detect only considers profiles compatible with the selected runtime
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
                </div>
              </FormSectionCard>

              <FormSectionCard icon={Paperclip} title="Attachments">
                <FileUpload
                  uploads={uploads}
                  onUploaded={(f) => setUploads((prev) => [...prev, f])}
                  onRemove={(id) => setUploads((prev) => prev.filter((f) => f.id !== id))}
                />
              </FormSectionCard>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" disabled={loading || !title.trim()} className="w-full">
                {loading ? "Creating..." : "Create Task"}
              </Button>
            </div>
            <div className="glass-card-light rounded-lg">
              <AIAssistPanel
                title={title}
                description={description}
                assignedAgent={assignedAgent || undefined}
                onApplyDescription={(d) => setDescription(d)}
                onCreateSubtasks={async (subtasks) => {
                  let created = 0;
                  const failures: string[] = [];
                  for (const sub of subtasks) {
                    toast.info(`Creating sub-task ${created + 1}/${subtasks.length}...`);
                    try {
                      const res = await fetch("/api/tasks", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: sub.title,
                          description: sub.description,
                          projectId: projectId || undefined,
                          priority: parseInt(priority, 10),
                          assignedAgent: assignedAgent || undefined,
                          agentProfile: agentProfile || undefined,
                        }),
                      });
                      if (res.ok) {
                        created++;
                      } else {
                        failures.push(sub.title);
                      }
                    } catch {
                      failures.push(sub.title);
                    }
                  }
                  if (failures.length > 0) {
                    toast.error(`Failed to create ${failures.length} sub-task(s): ${failures.join(", ")}`);
                  }
                  if (created > 0) {
                    toast.success(`Created ${created} sub-task(s)`);
                  }
                  router.push("/dashboard");
                }}
              />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
