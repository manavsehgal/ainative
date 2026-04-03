"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { COLUMN_DATA_TYPES, columnTypeLabel } from "@/lib/constants/table-status";
import type { ColumnDataType } from "@/lib/constants/table-status";

interface ColumnDraft {
  name: string;
  displayName: string;
  dataType: ColumnDataType;
}

interface TableCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: { id: string; name: string }[];
  onCreated: () => void;
}

export function TableCreateSheet({
  open,
  onOpenChange,
  projects,
  onCreated,
}: TableCreateSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [columns, setColumns] = useState<ColumnDraft[]>([
    { name: "name", displayName: "Name", dataType: "text" },
  ]);
  const [saving, setSaving] = useState(false);

  function addColumn() {
    setColumns((prev) => [
      ...prev,
      { name: "", displayName: "", dataType: "text" },
    ]);
  }

  function removeColumn(index: number) {
    setColumns((prev) => prev.filter((_, i) => i !== index));
  }

  function updateColumn(index: number, field: keyof ColumnDraft, value: string) {
    setColumns((prev) =>
      prev.map((col, i) => {
        if (i !== index) return col;
        const updated = { ...col, [field]: value };
        // Auto-generate name from displayName
        if (field === "displayName") {
          updated.name = value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "");
        }
        return updated;
      })
    );
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Table name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          projectId: projectId === "none" ? null : projectId,
          columns: columns
            .filter((c) => c.name && c.displayName)
            .map((c, i) => ({
              name: c.name,
              displayName: c.displayName,
              dataType: c.dataType,
              position: i,
            })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.formErrors?.[0] || "Failed to create table");
        return;
      }

      toast.success("Table created");
      onOpenChange(false);
      onCreated();

      // Reset form
      setName("");
      setDescription("");
      setProjectId("none");
      setColumns([{ name: "name", displayName: "Name", dataType: "text" }]);
    } catch {
      toast.error("Failed to create table");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Create Table</SheetTitle>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="table-name">Name</Label>
            <Input
              id="table-name"
              placeholder="e.g. Customer List"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="table-desc">Description</Label>
            <Textarea
              id="table-desc"
              placeholder="What is this table for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Columns</Label>
              <Button variant="ghost" size="sm" onClick={addColumn}>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {columns.map((col, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Column name"
                    value={col.displayName}
                    onChange={(e) => updateColumn(i, "displayName", e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={col.dataType}
                    onValueChange={(v) => updateColumn(i, "dataType", v)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMN_DATA_TYPES.filter(
                        (dt) => dt !== "relation" && dt !== "computed"
                      ).map((dt) => (
                        <SelectItem key={dt} value={dt}>
                          {columnTypeLabel[dt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeColumn(i)}
                    disabled={columns.length <= 1}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="px-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating..." : "Create Table"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
