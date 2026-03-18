"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { PROSE_READER } from "@/lib/constants/prose-styles";

interface StepOutput {
  name: string;
  result: string;
}

interface WorkflowFullOutputProps {
  workflowName: string;
  steps: StepOutput[];
}

export function WorkflowFullOutput({ workflowName, steps }: WorkflowFullOutputProps) {
  const completedSteps = steps.filter((s) => s.result);

  if (completedSteps.length === 0) return null;

  const fullMarkdown = completedSteps
    .map((step) => `## ${step.name}\n\n${step.result}`)
    .join("\n\n---\n\n");

  function copyAll() {
    navigator.clipboard.writeText(fullMarkdown);
    toast.success("Full output copied");
  }

  function downloadAll() {
    const blob = new Blob([fullMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, "-").toLowerCase()}-output.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Full Output</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={copyAll}>
              <Copy className="h-3 w-3 mr-1" />
              Copy All
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadAll}>
              <Download className="h-3 w-3 mr-1" />
              Download .md
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose-reader-surface space-y-6">
          {completedSteps.map((step, i) => (
            <div key={i}>
              {i > 0 && <hr className="border-border" />}
              <h3 className="text-sm font-semibold mb-3">{step.name}</h3>
              <div className={PROSE_READER}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.result}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
