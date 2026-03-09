"use client";

import { useState } from "react";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AIAssistPanel } from "./ai-assist-panel";
import { FileUpload } from "./file-upload";

interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: string;
}

interface TaskCreateDialogProps {
  projects: { id: string; name: string }[];
  onCreated: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TaskCreateDialog({ projects, onCreated, open: controlledOpen, onOpenChange }: TaskCreateDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [priority, setPriority] = useState("2");
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
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
          fileIds: uploads.length > 0 ? uploads.map((f) => f.id) : undefined,
        }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setProjectId("");
        setPriority("2");
        setUploads([]);
        setOpen(false);
        toast.success("Task created");
        onCreated();
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
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed instructions for the agent"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
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
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">P0 - Critical</SelectItem>
                  <SelectItem value="1">P1 - High</SelectItem>
                  <SelectItem value="2">P2 - Medium</SelectItem>
                  <SelectItem value="3">P3 - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Attachments</Label>
            <FileUpload
              uploads={uploads}
              onUploaded={(f) => setUploads((prev) => [...prev, f])}
              onRemove={(id) => setUploads((prev) => prev.filter((f) => f.id !== id))}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={loading || !title.trim()} className="w-full">
            {loading ? "Creating..." : "Create Task"}
          </Button>
          <AIAssistPanel
            title={title}
            description={description}
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
              onCreated();
            }}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
