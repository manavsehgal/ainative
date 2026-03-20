"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bookmark,
  BookmarkPlus,
  Check,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ViewRow } from "@/lib/db/schema";

export interface ViewState {
  filters?: Record<string, unknown>;
  sorting?: { id: string; desc: boolean }[];
  columns?: Record<string, boolean>;
  density?: "compact" | "comfortable" | "spacious";
}

interface ViewSwitcherProps {
  /** Which surface this switcher is for (e.g., "tasks", "documents") */
  surface: string;
  /** Current view state to save */
  currentState: ViewState;
  /** Callback when a saved view is selected */
  onApply: (state: ViewState) => void;
}

/**
 * ViewSwitcher — dropdown for managing saved views per surface.
 *
 * Features:
 * - List saved views for the surface
 * - Apply a saved view (restores filters/sorting/columns/density)
 * - Save current state as a new view
 * - Set a default view
 * - Delete views
 */
export function ViewSwitcher({
  surface,
  currentState,
  onApply,
}: ViewSwitcherProps) {
  const [savedViews, setSavedViews] = useState<ViewRow[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchViews = useCallback(async () => {
    try {
      const res = await fetch(`/api/views?surface=${surface}`);
      if (res.ok) {
        const data = await res.json();
        setSavedViews(data);
      }
    } catch {
      // Silent fail
    }
  }, [surface]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  function applyView(view: ViewRow) {
    const state: ViewState = {
      filters: view.filters ? JSON.parse(view.filters) : undefined,
      sorting: view.sorting ? JSON.parse(view.sorting) : undefined,
      columns: view.columns ? JSON.parse(view.columns) : undefined,
      density: (view.density as ViewState["density"]) ?? "comfortable",
    };
    setActiveViewId(view.id);
    onApply(state);
  }

  async function saveView() {
    if (!newViewName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface,
          name: newViewName.trim(),
          ...currentState,
        }),
      });
      if (res.ok) {
        toast.success("View saved");
        setSaveDialogOpen(false);
        setNewViewName("");
        fetchViews();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to save view");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteView(id: string) {
    try {
      const res = await fetch(`/api/views/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("View deleted");
        if (activeViewId === id) setActiveViewId(null);
        fetchViews();
      }
    } catch {
      toast.error("Failed to delete view");
    }
  }

  async function setDefault(id: string) {
    try {
      const res = await fetch(`/api/views/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        toast.success("Default view updated");
        fetchViews();
      }
    } catch {
      toast.error("Failed to set default");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <Bookmark className="h-3 w-3" />
            Views
            {savedViews.length > 0 && (
              <span className="text-muted-foreground">({savedViews.length})</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {savedViews.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No saved views yet
            </div>
          ) : (
            savedViews.map((view) => (
              <DropdownMenuItem
                key={view.id}
                className="flex items-center justify-between gap-2 py-1.5"
                onClick={() => applyView(view)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {activeViewId === view.id && (
                    <Check className="h-3 w-3 text-primary shrink-0" />
                  )}
                  <span className="truncate text-sm">{view.name}</span>
                  {view.isDefault && (
                    <Star className="h-3 w-3 text-status-warning shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {!view.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefault(view.id);
                      }}
                      aria-label="Set as default"
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteView(view.id);
                    }}
                    aria-label="Delete view"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
            <BookmarkPlus className="h-3.5 w-3.5 mr-2" />
            Save current view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Save your current filters, sorting, and density as a named view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="view-name">View name</Label>
              <Input
                id="view-name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., My active tasks"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveView();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={saveView}
              disabled={saving || !newViewName.trim()}
            >
              {saving ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
