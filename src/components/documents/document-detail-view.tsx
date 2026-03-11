"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Trash2,
  Unlink,
  HardDrive,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Link2,
  FolderKanban,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentPreview } from "./document-preview";
import { getFileIcon, formatSize, getStatusColor, formatRelativeTime } from "./utils";
import type { DocumentWithRelations } from "./types";

interface DocumentDetailViewProps {
  documentId: string;
}

function getStatusDotColor(status: string): string {
  switch (status) {
    case "ready":
      return "bg-status-completed";
    case "processing":
      return "bg-status-running";
    case "error":
      return "bg-status-failed";
    case "uploaded":
      return "bg-status-warning";
    default:
      return "bg-muted-foreground";
  }
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
  const DirectionIcon = doc.direction === "output" ? ArrowUpRight : ArrowDownLeft;
  const wordCount = doc.extractedText
    ? doc.extractedText.split(/\s+/).filter(Boolean).length
    : 0;

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

      {/* Bento Grid: Extracted Text + Metadata + Links */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
        {/* Extracted Text — spans 2 rows on desktop */}
        {doc.extractedText ? (
          <Card className="md:row-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Extracted Text
                <Badge variant="secondary" className="text-xs ml-auto">
                  {wordCount.toLocaleString()} words
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded-md max-h-80 overflow-y-auto whitespace-pre-wrap break-words">
                {doc.extractedText.slice(0, 2000)}
                {doc.extractedText.length > 2000 && "\n\n... (truncated)"}
              </pre>
            </CardContent>
          </Card>
        ) : (
          <Card className="md:row-span-2 flex items-center justify-center">
            <CardContent className="pt-4 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No extracted text</p>
            </CardContent>
          </Card>
        )}

        {/* Metadata Strip */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Type */}
            <div className="flex items-center gap-2 text-sm">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Badge variant="outline" className="text-xs font-normal">
                {doc.mimeType}
              </Badge>
            </div>
            {/* Size */}
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{formatSize(doc.size)}</span>
            </div>
            {/* Status */}
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(doc.status)}`} />
              <Badge variant="outline" className={`text-xs ${getStatusColor(doc.status)}`}>
                {doc.status}
              </Badge>
            </div>
            {/* Direction */}
            <div className="flex items-center gap-2 text-sm">
              <DirectionIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="capitalize">{doc.direction}</span>
            </div>
            {/* Date */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span title={new Date(doc.createdAt).toLocaleString()}>
                {formatRelativeTime(typeof doc.createdAt === "number" ? doc.createdAt : new Date(doc.createdAt).getTime())}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Task link */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Link2 className="h-3 w-3" />
                <span>Task</span>
              </div>
              {doc.taskTitle ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{doc.taskTitle}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnlinkTask}
                    aria-label="Unlink from task"
                    className="h-7 px-2"
                  >
                    <Unlink className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not linked</p>
              )}
            </div>
            {/* Project selector */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <FolderKanban className="h-3 w-3" />
                <span>Project</span>
              </div>
              <Select
                value={doc.projectId ?? "none"}
                onValueChange={handleLinkProject}
                disabled={linking}
              >
                <SelectTrigger className="w-full h-8 text-sm">
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
      </div>

      {/* Preview — collapsible, full width */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-medium p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>Preview</span>
          <span className="text-muted-foreground text-xs group-open:rotate-90 transition-transform">▶</span>
        </summary>
        <div className="mt-2">
          <Card>
            <CardContent className="pt-4">
              <DocumentPreview document={doc} />
            </CardContent>
          </Card>
        </div>
      </details>

      {/* Processing Error — conditional, red accent */}
      {doc.processingError && (
        <div className="rounded-lg border border-destructive/30 border-l-2 border-l-destructive bg-card p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Processing Error</p>
              <p className="text-xs text-muted-foreground mt-1">{doc.processingError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
