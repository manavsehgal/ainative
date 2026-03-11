"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { DocumentPreview } from "./document-preview";
import { getFileIcon, formatSize, getStatusColor } from "./utils";
import type { DocumentWithRelations } from "./types";

interface DocumentDetailViewProps {
  documentId: string;
}

export function DocumentDetailView({ documentId }: DocumentDetailViewProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentWithRelations | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [linking, setLinking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`);
      if (res.ok) {
        setDoc(await res.json());
      }
    } catch {
      // silent
    }
    setLoaded(true);
  }, [documentId]);

  useEffect(() => {
    refresh();
    fetch("/api/projects")
      .then((r) => r.ok ? r.json() : [])
      .then(setProjects)
      .catch(() => {});
  }, [refresh]);

  async function handleDelete() {
    if (!doc) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Document deleted");
        router.push("/documents");
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
        refresh();
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
        refresh();
      }
    } catch {
      toast.error("Failed to unlink");
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!doc) {
    return <p className="text-muted-foreground">Document not found.</p>;
  }

  const Icon = getFileIcon(doc.mimeType);

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="h-6 w-6 text-muted-foreground shrink-0" />
          <h1 className="text-2xl font-bold truncate">{doc.originalName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/api/uploads/${doc.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </a>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Preview */}
      <Card>
        <CardContent className="pt-4">
          <DocumentPreview document={doc} />
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Details</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Linked Task</h4>
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
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Project</h4>
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
        </CardContent>
      </Card>

      {/* Extracted text */}
      {doc.extractedText && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Extracted Text</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-md max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
              {doc.extractedText.slice(0, 2000)}
              {doc.extractedText.length > 2000 && "\n\n... (truncated)"}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Processing error */}
      {doc.processingError && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Processing Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{doc.processingError}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
