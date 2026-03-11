"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { GitBranch, Plus, Pencil, Copy, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { workflowStatusVariant, patternLabels } from "@/lib/constants/status-colors";

interface Workflow {
  id: string;
  name: string;
  status: string;
  projectId: string | null;
  definition: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowListProps {
  projects: { id: string; name: string }[];
}

function getPattern(definitionJson: string): string {
  try {
    const def = JSON.parse(definitionJson);
    return def.pattern ?? "unknown";
  } catch {
    return "unknown";
  }
}

function getStepCount(definitionJson: string): number {
  try {
    const def = JSON.parse(definitionJson);
    return def.steps?.length ?? 0;
  } catch {
    return 0;
  }
}

function getPromptPreview(definitionJson: string): string {
  try {
    const def = JSON.parse(definitionJson);
    const prompt = def.steps?.[0]?.prompt ?? "";
    return prompt.length > 80 ? prompt.slice(0, 80) + "\u2026" : prompt;
  } catch {
    return "";
  }
}

export function WorkflowList({ projects }: WorkflowListProps) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/workflows");
    if (res.ok) setWorkflows(await res.json());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(id: string) {
    setConfirmDeleteId(null);
    const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Workflow deleted");
      refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Failed to delete workflow");
    }
  }

  async function handleRerun(id: string) {
    const res = await fetch(`/api/workflows/${id}/execute`, { method: "POST" });
    if (res.ok) {
      toast.success("Workflow re-started");
      router.push(`/workflows/${id}`);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Failed to re-run workflow");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workflows</h1>
        <Button onClick={() => router.push("/workflows/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          heading="No workflows yet"
          description="Create a workflow to chain agent tasks together."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => {
            const pattern = getPattern(wf.definition);
            const stepCount = getStepCount(wf.definition);
            const promptPreview = getPromptPreview(wf.definition);
            return (
              <Card
                key={wf.id}
                tabIndex={0}
                className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
                onClick={() => router.push(`/workflows/${wf.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/workflows/${wf.id}`); } }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">{wf.name}</CardTitle>
                    <Badge variant={workflowStatusVariant[wf.status] ?? "secondary"}>
                      {wf.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{patternLabels[pattern] ?? pattern}</span>
                    <span>&middot;</span>
                    <span>{stepCount} step{stepCount !== 1 ? "s" : ""}</span>
                  </div>
                  {promptPreview && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                      {promptPreview}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-3">
                    {wf.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Edit workflow"
                        onClick={(e) => { e.stopPropagation(); router.push(`/workflows/${wf.id}/edit`); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Clone workflow"
                      onClick={(e) => { e.stopPropagation(); router.push(`/workflows/${wf.id}/edit?clone=true`); }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {(wf.status === "completed" || wf.status === "failed") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Re-run workflow"
                        onClick={(e) => { e.stopPropagation(); handleRerun(wf.id); }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {wf.status !== "active" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        aria-label="Delete workflow"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(wf.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="Delete Workflow"
        description="This will permanently delete this workflow and cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        destructive
      />
    </div>
  );
}
