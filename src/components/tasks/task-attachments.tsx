"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, Image, FileCode, File } from "lucide-react";
import { toast } from "sonner";
import type { DocumentRow } from "@/lib/db/schema";

interface TaskAttachmentsProps {
  documents: DocumentRow[];
  title?: string;
  onDeleted?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("python") ||
    mimeType.includes("json")
  )
    return FileCode;
  if (mimeType.startsWith("text/")) return FileText;
  return File;
}

export function TaskAttachments({
  documents,
  title = "Attachments",
  onDeleted,
}: TaskAttachmentsProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(docId: string) {
    setDeleting(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Document removed");
        onDeleted?.();
      } else {
        toast.error("Failed to remove document");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  }

  if (documents.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <div className="space-y-1.5">
        {documents.map((doc) => {
          const Icon = getFileIcon(doc.mimeType);
          return (
            <div
              key={doc.id}
              className="flex items-center gap-2 text-sm group"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{doc.originalName}</span>
              {doc.direction === "output" && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  v{doc.version}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatSize(doc.size)}
              </span>
              <a
                href={`/api/documents/${doc.id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={`Download ${doc.originalName}`}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(doc.id)}
                disabled={deleting === doc.id}
                aria-label={`Delete ${doc.originalName}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
