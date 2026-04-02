"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Loader2 } from "lucide-react";
import { getFileIcon, formatSize, getStatusDotColor } from "@/components/documents/utils";

export interface PickerDocument {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  direction: string;
  status: string;
  category: string | null;
  taskTitle: string | null;
  projectName: string | null;
  /** Source workflow name (if document was produced by a workflow task) */
  sourceWorkflow?: string;
  /** Parent workflow name (joined from tasks → workflows) */
  workflowName?: string | null;
  createdAt: number;
}

interface DocumentPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Scope documents to a project. Null = show all ready documents. */
  projectId: string | null;
  /** Currently selected document IDs (to pre-check) */
  selectedIds: Set<string>;
  /** Called when user confirms selection */
  onConfirm: (selectedIds: string[]) => void;
  /** Optional: scope to a step ID label */
  stepLabel?: string;
  /** Grouping mode: "workflow" groups by source workflow, "project" by project name, "source" by direction */
  groupBy?: "workflow" | "project" | "source";
  /** Override the sheet title */
  title?: string;
}

export function DocumentPickerSheet({
  open,
  onOpenChange,
  projectId,
  selectedIds,
  onConfirm,
  stepLabel,
  groupBy = "source",
  title,
}: DocumentPickerSheetProps) {
  const [documents, setDocuments] = useState<PickerDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());

  // Sync initial selection when sheet opens
  useEffect(() => {
    if (open) {
      setLocalSelected(new Set(selectedIds));
      fetchDocuments();
    }
  }, [open, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDocuments() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "ready" });
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/documents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch {
      // Silently fail — empty list shown
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (doc) =>
        doc.originalName.toLowerCase().includes(q) ||
        doc.category?.toLowerCase().includes(q) ||
        doc.taskTitle?.toLowerCase().includes(q)
    );
  }, [documents, search]);

  // Group documents based on the groupBy mode
  const grouped = useMemo(() => {
    const groups: Record<string, PickerDocument[]> = {};
    for (const doc of filtered) {
      let key: string;
      switch (groupBy) {
        case "workflow":
          key =
            doc.direction === "output"
              ? doc.workflowName
                ? `From: ${doc.workflowName}`
                : doc.taskTitle
                  ? `From: ${doc.taskTitle}`
                  : "Agent Generated"
              : "Uploaded";
          break;
        case "project":
          key = doc.projectName ?? "No Project";
          break;
        case "source":
        default:
          key =
            doc.direction === "output"
              ? doc.taskTitle
                ? "Task Output"
                : "Agent Generated"
              : "Uploaded";
          break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    }
    return groups;
  }, [filtered, groupBy]);

  function toggleDocument(id: string) {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleConfirm() {
    onConfirm([...localSelected]);
    onOpenChange(false);
  }

  const sheetTitle = title
    ? title
    : stepLabel
      ? `Select Documents for "${stepLabel}"`
      : "Select Input Documents";

  const emptyMessage = search
    ? "No documents match your search."
    : projectId
      ? "No documents available in this project."
      : "No documents available. Upload files in the Documents view.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="p-4">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {sheetTitle}
          </SheetTitle>
          <SheetDescription>
            Choose documents to provide as context.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 flex flex-col gap-4 flex-1 min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Document list */}
          <ScrollArea className="flex-1 min-h-0 -mx-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                {emptyMessage}
              </div>
            ) : (
              <div className="space-y-4 px-2">
                {Object.entries(grouped).map(([source, docs]) => (
                  <div key={source}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {source}
                    </p>
                    <div className="space-y-1">
                      {docs.map((doc) => {
                        const Icon = getFileIcon(doc.mimeType);
                        const isChecked = localSelected.has(doc.id);
                        return (
                          <div
                            key={doc.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleDocument(doc.id)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDocument(doc.id); } }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                              isChecked
                                ? "bg-accent/50 border border-accent"
                                : "hover:bg-muted/50 border border-transparent"
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              aria-label={`Select ${doc.originalName}`}
                            />
                            <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.originalName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatSize(doc.size)}
                                {doc.category && ` · ${doc.category}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${getStatusDotColor(doc.status)}`}
                              />
                              {doc.direction === "output" && (
                                <Badge variant="outline" className="text-[10px] px-1.5">
                                  output
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {localSelected.size} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
