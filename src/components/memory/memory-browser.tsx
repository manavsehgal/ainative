"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Brain, Archive, XCircle, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { AgentMemoryRow } from "@/lib/db/schema";

const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  fact: "default",
  preference: "secondary",
  pattern: "outline",
  outcome: "destructive",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  decayed: "secondary",
  archived: "outline",
  rejected: "destructive",
};

interface MemoryBrowserProps {
  profileId: string;
}

export function MemoryBrowser({ profileId }: MemoryBrowserProps) {
  const [memories, setMemories] = useState<AgentMemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editConfidence, setEditConfidence] = useState<string>("");

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ profileId });
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/memory?${params}`);
      if (res.ok) {
        setMemories(await res.json());
      }
    } catch {
      toast.error("Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, [profileId, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  async function handleArchive(id: string) {
    try {
      const res = await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("Memory archived");
        fetchMemories();
      }
    } catch {
      toast.error("Failed to archive memory");
    }
  }

  async function handleReject(id: string) {
    try {
      const res = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
      if (res.ok) {
        toast.success("Memory rejected");
        fetchMemories();
      }
    } catch {
      toast.error("Failed to reject memory");
    }
  }

  async function handleSaveConfidence(id: string) {
    const value = parseInt(editConfidence, 10);
    if (isNaN(value) || value < 0 || value > 1000) {
      toast.error("Confidence must be between 0 and 1000");
      return;
    }
    try {
      const res = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confidence: value }),
      });
      if (res.ok) {
        toast.success("Confidence updated");
        setEditingId(null);
        fetchMemories();
      }
    } catch {
      toast.error("Failed to update confidence");
    }
  }

  function formatDate(dateValue: string | Date | null | undefined): string {
    if (!dateValue) return "Never";
    const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    return d.toLocaleDateString();
  }

  if (!loading && memories.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="decayed">Decayed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <EmptyState
          icon={Brain}
          heading="No memories yet"
          description="Episodic memories are extracted from task results and stored as factual knowledge for this profile."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="fact">Fact</SelectItem>
            <SelectItem value="preference">Preference</SelectItem>
            <SelectItem value="pattern">Pattern</SelectItem>
            <SelectItem value="outcome">Outcome</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="decayed">Decayed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {memories.length} {memories.length === 1 ? "memory" : "memories"}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Content</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="text-right">Accesses</TableHead>
              <TableHead>Last Accessed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              memories.map((memory) => (
                <TableRow key={memory.id}>
                  <TableCell className="max-w-[300px]">
                    <p className="text-sm truncate" title={memory.content}>
                      {memory.content}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={CATEGORY_VARIANTS[memory.category] ?? "outline"}>
                      {memory.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {editingId === memory.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          value={editConfidence}
                          onChange={(e) => setEditConfidence(e.target.value)}
                          className="w-20 h-7 text-xs"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleSaveConfidence(memory.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(memory.confidence / 1000) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round((memory.confidence / 1000) * 100)}%
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {memory.accessCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(memory.lastAccessedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[memory.status] ?? "outline"}>
                      {memory.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Edit confidence"
                        onClick={() => {
                          setEditingId(memory.id);
                          setEditConfidence(String(memory.confidence));
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Archive"
                        onClick={() => handleArchive(memory.id)}
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        title="Reject"
                        onClick={() => handleReject(memory.id)}
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
