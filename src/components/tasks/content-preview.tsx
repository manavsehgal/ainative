"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { PROSE_READER } from "@/lib/constants/prose-styles";

interface ContentPreviewProps {
  content: string;
  contentType: "text" | "markdown" | "code" | "json" | "unknown";
}

export function ContentPreview({ content, contentType }: ContentPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  function copyToClipboard() {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  }

  function downloadAsFile() {
    const ext = contentType === "json" ? "json" : contentType === "code" ? "txt" : contentType === "markdown" ? "md" : "txt";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // M4: Safe JSON formatting
  function formatJson(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  const heightClass = expanded ? "" : "max-h-80";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Output ({contentType})
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Collapse output" : "Expand output"}>
              {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyToClipboard} aria-label="Copy to clipboard">
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={downloadAsFile} aria-label="Download as file">
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {contentType === "json" ? (
          <pre className={`text-xs font-mono bg-muted p-3 rounded overflow-auto ${heightClass}`}>
            {formatJson(content)}
          </pre>
        ) : contentType === "code" ? (
          <pre className={`text-xs font-mono bg-muted p-3 rounded overflow-auto ${heightClass}`}>
            {content}
          </pre>
        ) : contentType === "markdown" ? (
          <div className={`${PROSE_READER} overflow-auto ${heightClass}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className={`text-sm whitespace-pre-wrap overflow-auto ${heightClass}`}>
            {content}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
