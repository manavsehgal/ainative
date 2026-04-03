"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { History, RotateCcw, User, Bot } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

interface HistoryEntry {
  id: string;
  rowId: string;
  tableId: string;
  previousData: string;
  changedBy: string;
  changeType: "update" | "delete";
  createdAt: string;
}

interface TableHistoryTabProps {
  tableId: string;
}

export function TableHistoryTab({ tableId }: TableHistoryTabProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${tableId}/history?limit=100`);
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tableId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  async function handleRollback(entry: HistoryEntry) {
    try {
      const res = await fetch(`/api/tables/${tableId}/rows/${entry.rowId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historyEntryId: entry.id }),
      });
      if (res.ok) {
        toast.success("Row restored to previous version");
        fetchHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to rollback");
      }
    } catch {
      toast.error("Failed to rollback");
    }
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  }

  function formatData(json: string) {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Loading history...</p>;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        heading="No history yet"
        description="Row changes will be tracked here as you edit data."
      />
    );
  }

  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-muted-foreground mb-3">
        {entries.length} change{entries.length !== 1 ? "s" : ""} recorded
      </p>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="border rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {entry.changedBy === "agent" ? (
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Badge variant={entry.changeType === "delete" ? "destructive" : "secondary"}>
                  {entry.changeType}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  Row {entry.rowId.slice(0, 8)}...
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  {expandedId === entry.id ? "Hide" : "View"}
                </Button>
                {entry.changeType !== "delete" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRollback(entry)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                )}
              </div>
            </div>
            {expandedId === entry.id && (
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
                {formatData(entry.previousData)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
