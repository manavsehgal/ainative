"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Trash2, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { DocumentPreview } from "./document-preview";
import { getFileIcon, formatSize, getStatusColor } from "./utils";
import type { DocumentWithRelations } from "./types";

interface DocumentDetailSheetProps {
  document: DocumentWithRelations | null;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onUpdated: () => void;
}

export function DocumentDetailSheet({
  document: doc,
  projects,
  onClose,
  onUpdated,
}: DocumentDetailSheetProps) {
  const [deleting, setDeleting] = useState(false);
  const [linking, setLinking] = useState(false);

  async function handleDelete() {
    if (!doc) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Document deleted");
        onClose();
        onUpdated();
      } else {
        toast.error("Failed to delete document");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLinkProject(projectId: string) {
    if (!doc) return;
    setLinking(true);
    try {
      const value = projectId === "none" ? null : projectId;
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: value }),
      });
      if (res.ok) {
        toast.success(value ? "Linked to project" : "Unlinked from project");
        onUpdated();
      }
    } catch {
      toast.error("Failed to update link");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkTask() {
    if (!doc) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: null }),
      });
      if (res.ok) {
        toast.success("Unlinked from task");
        onUpdated();
      }
    } catch {
      toast.error("Failed to unlink");
    }
  }

  if (!doc) return null;

  const Icon = getFileIcon(doc.mimeType);

  return (
    <Sheet open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="truncate">{doc.originalName}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          {/* Preview */}
          <DocumentPreview document={doc} />

          <Separator />

          {/* Metadata */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{doc.mimeType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size</span>
              <span>{formatSize(doc.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className={getStatusColor(doc.status)}>
                {doc.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Direction</span>
              <span>{doc.direction}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uploaded</span>
              <span>{new Date(doc.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <Separator />

          {/* Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Linked Task</h4>
            {doc.taskTitle ? (
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{doc.taskTitle}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnlinkTask}
                  aria-label="Unlink from task"
                >
                  <Unlink className="h-3.5 w-3.5 mr-1" />
                  Unlink
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not linked to a task</p>
            )}

            <h4 className="text-sm font-medium">Project</h4>
            <Select
              value={doc.projectId ?? "none"}
              onValueChange={handleLinkProject}
              disabled={linking}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Extracted text preview */}
          {doc.extractedText && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Extracted Text</h4>
                <pre className="text-xs bg-muted p-3 rounded-md max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                  {doc.extractedText.slice(0, 2000)}
                  {doc.extractedText.length > 2000 && "\n\n... (truncated)"}
                </pre>
              </div>
            </>
          )}

          {doc.processingError && (
            <>
              <Separator />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-destructive">Processing Error</h4>
                <p className="text-xs text-muted-foreground">{doc.processingError}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <a
                href={`/api/uploads/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Download
              </a>
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
