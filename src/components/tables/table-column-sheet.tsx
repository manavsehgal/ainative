"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

interface TableColumnSheetProps {
  tableId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnAdded: () => void;
}

interface TableInfo {
  id: string;
  name: string;
  columnSchema: string;
}

export function TableColumnSheet({
  tableId,
  open,
  onOpenChange,
  onColumnAdded,
}: TableColumnSheetProps) {
  const [displayName, setDisplayName] = useState("");
  const [dataType, setDataType] = useState<ColumnDataType>("text");
  const [required, setRequired] = useState(false);
  const [selectOptions, setSelectOptions] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  // Computed column state
  const [formula, setFormula] = useState("");
  const [formulaType, setFormulaType] = useState<string>("arithmetic");

  // Relation column state
  const [targetTableId, setTargetTableId] = useState("");
  const [displayColumn, setDisplayColumn] = useState("");
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([]);
  const [targetColumns, setTargetColumns] = useState<string[]>([]);

  // Fetch available tables when relation type is selected
  useEffect(() => {
    if (dataType !== "relation" || !open) return;
    fetch("/api/tables")
      .then((r) => r.json())
      .then((tables: TableInfo[]) => setAvailableTables(tables.filter((t) => t.id !== tableId)))
      .catch(() => {});
  }, [dataType, open, tableId]);

  // Fetch target table columns when target table changes
  useEffect(() => {
    if (!targetTableId) { setTargetColumns([]); return; }
    fetch(`/api/tables/${targetTableId}`)
      .then((r) => r.json())
      .then((t: TableInfo) => {
        const cols = JSON.parse(t.columnSchema) as Array<{ name: string }>;
        setTargetColumns(cols.map((c) => c.name));
        if (cols.length > 0 && !displayColumn) setDisplayColumn(cols[0].name);
      })
      .catch(() => {});
  }, [targetTableId]);

  const name = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  function addOption() {
    setSelectOptions((prev) => [...prev, ""]);
  }

  function updateOption(index: number, value: string) {
    setSelectOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function removeOption(index: number) {
    setSelectOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!displayName.trim()) {
      toast.error("Column name is required");
      return;
    }
    if (dataType === "computed" && !formula.trim()) {
      toast.error("Formula is required for computed columns");
      return;
    }
    if (dataType === "relation" && !targetTableId) {
      toast.error("Target table is required for relation columns");
      return;
    }

    setSaving(true);
    try {
      let config: Record<string, unknown> | undefined;
      if (dataType === "select") {
        config = { options: selectOptions.filter((o) => o.trim()) };
      } else if (dataType === "computed") {
        config = { formula: formula.trim(), formulaType, resultType: "text" };
      } else if (dataType === "relation") {
        config = { targetTableId, displayColumn: displayColumn || undefined };
      }

      const res = await fetch(`/api/tables/${tableId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          displayName: displayName.trim(),
          dataType,
          required,
          config,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.formErrors?.[0] || "Failed to add column");
        return;
      }

      toast.success(`Column "${displayName}" added`);
      onOpenChange(false);
      onColumnAdded();

      // Reset
      setDisplayName("");
      setDataType("text");
      setRequired(false);
      setSelectOptions([""]);
      setFormula("");
      setFormulaType("arithmetic");
      setTargetTableId("");
      setDisplayColumn("");
    } catch {
      toast.error("Failed to add column");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>Add Column</SheetTitle>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="col-name">Display Name</Label>
            <Input
              id="col-name"
              placeholder="e.g. Email Address"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {name && (
              <p className="text-xs text-muted-foreground">
                Field name: <code>{name}</code>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={dataType} onValueChange={(v) => setDataType(v as ColumnDataType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_DATA_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>
                    {columnTypeLabel[dt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="col-required">Required</Label>
            <Switch
              id="col-required"
              checked={required}
              onCheckedChange={setRequired}
            />
          </div>

          {dataType === "select" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button variant="ghost" size="sm" onClick={addOption}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-1">
                {selectOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className="h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeOption(i)}
                      disabled={selectOptions.length <= 1}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dataType === "computed" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Formula</Label>
                <Textarea
                  placeholder="e.g. {{price}} * {{quantity}}"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Reference columns with {"{{column_name}}"} syntax. Supports +, -, *, /, if(), concat(), sum(), avg(), min(), max().
                </p>
              </div>
              <div className="space-y-2">
                <Label>Formula Type</Label>
                <Select value={formulaType} onValueChange={setFormulaType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arithmetic">Arithmetic</SelectItem>
                    <SelectItem value="text_concat">Text Concatenation</SelectItem>
                    <SelectItem value="date_diff">Date Difference</SelectItem>
                    <SelectItem value="conditional">Conditional</SelectItem>
                    <SelectItem value="aggregate">Aggregate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {dataType === "relation" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Target Table</Label>
                <Select value={targetTableId} onValueChange={setTargetTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {targetColumns.length > 0 && (
                <div className="space-y-2">
                  <Label>Display Column</Label>
                  <Select value={displayColumn} onValueChange={setDisplayColumn}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {targetColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The column from the target table shown in this cell.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Adding..." : "Add Column"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
