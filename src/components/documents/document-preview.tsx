"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocumentWithRelations } from "./types";

interface DocumentPreviewProps {
  document: DocumentWithRelations;
}

export function DocumentPreview({ document: doc }: DocumentPreviewProps) {
  const isImage = doc.mimeType.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";
  const isMarkdown = doc.mimeType === "text/markdown";
  const isText =
    doc.mimeType.startsWith("text/") ||
    doc.mimeType === "application/json";

  if (isImage) {
    return (
      <div className="rounded-md overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
        <img
          src={`/api/uploads/${doc.id}`}
          alt={doc.originalName}
          className="max-h-64 object-contain"
        />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="rounded-md overflow-hidden border border-border">
        <iframe
          src={`/api/uploads/${doc.id}`}
          className="w-full h-64"
          title={doc.originalName}
        />
      </div>
    );
  }

  if (isMarkdown && doc.extractedText) {
    return (
      <div className="rounded-md border border-border p-3 prose prose-sm dark:prose-invert max-h-64 overflow-y-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {doc.extractedText.slice(0, 5000)}
        </ReactMarkdown>
      </div>
    );
  }

  if (isText && doc.extractedText) {
    return (
      <pre className="text-xs bg-muted p-3 rounded-md max-h-64 overflow-y-auto whitespace-pre-wrap break-words border border-border">
        {doc.extractedText.slice(0, 5000)}
      </pre>
    );
  }

  // Fallback — no preview
  return (
    <div className="rounded-md border border-border p-6 text-center text-muted-foreground">
      <p className="text-sm">No preview available for this file type.</p>
      <p className="text-xs mt-1">Download the file to view its contents.</p>
    </div>
  );
}
