"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Image, FileCode } from "lucide-react";

interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: string;
}

interface FileUploadProps {
  onUploaded: (file: UploadedFile) => void;
  uploads: UploadedFile[];
  onRemove: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.includes("pdf") || type.includes("document") || type.includes("text")) return FileText;
  if (type.includes("javascript") || type.includes("typescript") || type.includes("json") || type.includes("xml")) return FileCode;
  return FileText;
}

export function FileUpload({ onUploaded, uploads, onRemove }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onUploaded(data);
      }
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a file — click or drag and drop"
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">
          {uploading ? "Uploading..." : "Click or drop a file"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Max 50MB per file</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {uploads.length > 0 && (
        <div className="space-y-1">
          {uploads.map((f) => {
            const Icon = getFileIcon(f.type);
            return (
            <div key={f.id} className="flex items-center gap-2 text-sm">
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="flex-1 truncate">{f.originalName}</span>
              <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onRemove(f.id)}
                aria-label={`Remove ${f.originalName}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
