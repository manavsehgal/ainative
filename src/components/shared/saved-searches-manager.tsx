"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SavedSearch } from "@/hooks/use-saved-searches";

const LABEL_MAX = 120;

interface SavedSearchesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searches: SavedSearch[];
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

/**
 * SavedSearchesManager — dialog for renaming or deleting saved searches.
 *
 * Distinct from the inline palette delete (which is one-click with a 5s
 * undo toast). This dialog is a deliberate management context, so delete
 * requires an explicit "Confirm" click (no undo).
 */
export function SavedSearchesManager({
  open,
  onOpenChange,
  searches,
  onRename,
  onRemove,
}: SavedSearchesManagerProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function startRename(s: SavedSearch) {
    setRenamingId(s.id);
    setDraft(s.label);
    setError(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setDraft("");
    setError(null);
  }

  function commitRename(s: SavedSearch) {
    // If renaming was already cancelled (e.g., via Escape) the renamingId
    // no longer matches — blur fires after cancelRename() has set it to null.
    if (renamingId !== s.id) return;

    const next = draft.trim();
    if (next.length === 0) {
      setError("Label cannot be empty");
      return;
    }
    if (next.length > LABEL_MAX) {
      setError(`Label too long (max ${LABEL_MAX} chars)`);
      return;
    }
    const dupe = searches.find(
      (other) =>
        other.id !== s.id &&
        other.surface === s.surface &&
        other.label.toLowerCase() === next.toLowerCase()
    );
    if (dupe) {
      setError("A saved search with that label already exists for this surface");
      return;
    }
    if (next !== s.label) onRename(s.id, next);
    cancelRename();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage saved searches</DialogTitle>
          <DialogDescription>Rename or delete your saved filter combinations.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-2 overflow-y-auto max-h-[60vh]">
          {searches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved searches yet.</p>
          ) : (
            searches.map((s) => {
              const isRenaming = renamingId === s.id;
              const isPendingDelete = pendingDeleteId === s.id;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="space-y-1">
                        <Input
                          aria-label="Rename"
                          autoFocus
                          value={draft}
                          onChange={(e) => {
                            setDraft(e.target.value);
                            setError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename(s);
                            }
                          }}
                          onBlur={() => commitRename(s)}
                          className="h-7"
                        />
                        {error && (
                          <p className="text-xs text-destructive">{error}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{s.label}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {s.surface}
                        </Badge>
                      </div>
                    )}
                    <p className="truncate text-xs font-mono text-muted-foreground">
                      {s.filterInput}
                    </p>
                  </div>
                  {!isRenaming && !isPendingDelete && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Rename ${s.label}`}
                        onClick={() => startRename(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={`Delete ${s.label}`}
                        onClick={() => setPendingDeleteId(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {isPendingDelete && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7"
                        aria-label={`Confirm delete ${s.label}`}
                        onClick={() => {
                          onRemove(s.id);
                          setPendingDeleteId(null);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Confirm delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        aria-label="Cancel delete"
                        onClick={() => setPendingDeleteId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
