"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";

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
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-3 w-3 mr-1" />
          Full Output
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{workflowName} — Full Output</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={copyAll}>
              <Copy className="h-3 w-3 mr-1" />
              Copy All
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadAll}>
              <Download className="h-3 w-3 mr-1" />
              Download .md
            </Button>
          </div>

          {completedSteps.map((step, i) => (
            <div key={i}>
              {i > 0 && <hr className="my-4 border-border" />}
              <h3 className="text-sm font-semibold mb-3">{step.name}</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.result}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
