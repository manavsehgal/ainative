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
import { FolderOpen, AlignLeft, FolderCode } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Project {
  id: string;
  name: string;
  description: string | null;
  workingDirectory: string | null;
  status: string;
}

interface ProjectEditDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
  onUpdated,
}: ProjectEditDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setWorkingDirectory(project.workingDirectory ?? "");
      setStatus(project.status);
    }
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          workingDirectory: workingDirectory.trim() || undefined,
          status,
        }),
      });
      if (res.ok) {
        toast.success("Project saved");
        onOpenChange(false);
        onUpdated();
      } else {
        toast.error("Failed to save project");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    setLoading(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      toast.success("Project deleted");
      onOpenChange(false);
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project name, status, and execution context without changing its associated tasks.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                Name
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Short, memorable name</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="flex items-center gap-1.5">
                <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Optional context for agents</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-working-dir" className="flex items-center gap-1.5">
                <FolderCode className="h-3.5 w-3.5 text-muted-foreground" />
                Working Directory
              </Label>
              <Input
                id="edit-working-dir"
                value={workingDirectory}
                onChange={(e) => setWorkingDirectory(e.target.value)}
                placeholder="/path/to/project (optional)"
              />
              <p className="text-xs text-muted-foreground">
                Agent tasks will execute in this directory.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--status-completed)] inline-block" />
                      Active
                    </span>
                  </SelectItem>
                  <SelectItem value="paused">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--status-warning)] inline-block" />
                      Paused
                    </span>
                  </SelectItem>
                  <SelectItem value="completed">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--status-running)] inline-block" />
                      Completed
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Paused projects won&apos;t accept task executions</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || !name.trim()} className="flex-1">
                {loading ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
              >
                Delete
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete project?"
        description="This will permanently delete the project. Tasks associated with it will not be deleted."
        confirmLabel="Delete Project"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
