"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { FolderOpen, AlignLeft, FolderCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Project {
  id: string;
  name: string;
  description: string | null;
  workingDirectory: string | null;
  status: string;
}

interface ProjectFormSheetProps {
  mode: "create" | "edit";
  project?: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ProjectFormSheet({
  mode,
  project,
  open,
  onOpenChange,
  onSaved,
}: ProjectFormSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Pre-fill form in edit mode
  useEffect(() => {
    if (mode === "edit" && project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setWorkingDirectory(project.workingDirectory ?? "");
      setStatus(project.status);
    } else if (mode === "create") {
      setName("");
      setDescription("");
      setWorkingDirectory("");
      setStatus("active");
    }
    setError(null);
  }, [mode, project, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (mode === "create") {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            workingDirectory: workingDirectory.trim() || undefined,
          }),
        });
        if (res.ok) {
          toast.success("Project created");
          onOpenChange(false);
          onSaved();
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? `Failed to create project (${res.status})`);
        }
      } else if (project) {
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
          onSaved();
        } else {
          toast.error("Failed to save project");
        }
      }
    } catch (err) {
      setError("Network error — could not reach server");
      console.error("Project save failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    setConfirmDelete(false);
    setLoading(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      toast.success("Project deleted");
      onOpenChange(false);
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  const isEdit = mode === "edit";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{isEdit ? "Edit Project" : "Create Project"}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Update the project name, status, and execution context without changing its associated tasks."
                : "Create a project workspace with optional context so tasks stay grouped and runnable in the right directory."}
            </SheetDescription>
          </SheetHeader>

          {/* Body — px-6 pb-6 per project convention (SheetContent has NO body padding) */}
          <div className="px-6 pb-6 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proj-name" className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  Name
                </Label>
                <Input
                  id="proj-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                  required
                />
                <p className="text-xs text-muted-foreground">Short, memorable name</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proj-desc" className="flex items-center gap-1.5">
                  <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  Description
                </Label>
                <Textarea
                  id="proj-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Optional context for agents</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proj-dir" className="flex items-center gap-1.5">
                  <FolderCode className="h-3.5 w-3.5 text-muted-foreground" />
                  Working Directory
                </Label>
                <Input
                  id="proj-dir"
                  value={workingDirectory}
                  onChange={(e) => setWorkingDirectory(e.target.value)}
                  placeholder="/path/to/project (optional)"
                />
                <p className="text-xs text-muted-foreground">
                  Agent tasks will execute in this directory. Defaults to the Stagent server directory if empty.
                </p>
              </div>

              {isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="proj-status">Status</Label>
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
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" disabled={loading || !name.trim()} className="w-full">
                {loading
                  ? isEdit ? "Saving..." : "Creating..."
                  : isEdit ? "Save Project" : "Create Project"}
              </Button>

              {isEdit && (
                <div className="pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={loading}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete Project
                  </Button>
                </div>
              )}
            </form>
          </div>
        </SheetContent>
      </Sheet>

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
