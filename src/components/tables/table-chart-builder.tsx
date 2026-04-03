"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BarChart3, LineChart, PieChart, ScatterChart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ChartType = "bar" | "line" | "pie" | "scatter";
type Aggregation = "sum" | "avg" | "count" | "min" | "max";

export interface EditChartData {
  id: string;
  name: string;
  config: {
    type: ChartType;
    xColumn: string;
    yColumn?: string;
    aggregation?: Aggregation;
  };
}

interface TableChartBuilderProps {
  tableId: string;
  columns: Array<{ name: string; displayName: string; dataType: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChartSaved: () => void;
  editChart?: EditChartData | null;
}

const CHART_TYPES: Array<{
  value: ChartType;
  label: string;
  icon: typeof BarChart3;
}> = [
  { value: "bar", label: "Bar", icon: BarChart3 },
  { value: "line", label: "Line", icon: LineChart },
  { value: "pie", label: "Pie", icon: PieChart },
  { value: "scatter", label: "Scatter", icon: ScatterChart },
];

const AGGREGATIONS: Array<{ value: Aggregation; label: string }> = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

const NUMERIC_TYPES = new Set(["number", "currency", "percent", "integer", "float"]);

export function TableChartBuilder({
  tableId,
  columns,
  open,
  onOpenChange,
  onChartSaved,
  editChart,
}: TableChartBuilderProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [title, setTitle] = useState("");
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [aggregation, setAggregation] = useState<Aggregation>("count");
  const [saving, setSaving] = useState(false);

  const isEditing = !!editChart;
  const numericColumns = columns.filter((c) => NUMERIC_TYPES.has(c.dataType));

  // Populate form when editing
  useEffect(() => {
    if (editChart) {
      setChartType(editChart.config.type);
      setTitle(editChart.name);
      setXColumn(editChart.config.xColumn);
      setYColumn(editChart.config.yColumn ?? "");
      setAggregation(editChart.config.aggregation ?? "count");
    } else {
      resetForm();
    }
  }, [editChart]);

  function resetForm() {
    setChartType("bar");
    setTitle("");
    setXColumn("");
    setYColumn("");
    setAggregation("count");
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Chart title is required");
      return;
    }
    if (!xColumn) {
      toast.error("X-axis column is required");
      return;
    }
    if (aggregation !== "count" && !yColumn) {
      toast.error("Y-axis column is required for this aggregation");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: chartType,
        title: title.trim(),
        xColumn,
        yColumn: yColumn || null,
        aggregation,
      };

      const url = isEditing
        ? `/api/tables/${tableId}/charts/${editChart.id}`
        : `/api/tables/${tableId}/charts`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEditing ? `Chart "${title}" updated` : `Chart "${title}" created`);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? `Failed to ${isEditing ? "update" : "create"} chart`);
        return;
      }

      onOpenChange(false);
      onChartSaved();
      if (!isEditing) resetForm();
    } catch {
      toast.error(`Failed to ${isEditing ? "update" : "create"} chart`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Chart" : "Create Chart"}</SheetTitle>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-5 overflow-y-auto">
          {/* Chart type selector */}
          <div className="space-y-2">
            <Label>Chart Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {CHART_TYPES.map((ct) => {
                const Icon = ct.icon;
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setChartType(ct.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      chartType === ct.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {ct.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="chart-title">Title</Label>
            <Input
              id="chart-title"
              placeholder="e.g. Revenue by Month"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* X-axis column */}
          <div className="space-y-2">
            <Label>X-Axis Column</Label>
            <Select value={xColumn} onValueChange={setXColumn}>
              <SelectTrigger>
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aggregation */}
          <div className="space-y-2">
            <Label>Aggregation</Label>
            <Select
              value={aggregation}
              onValueChange={(v) => setAggregation(v as Aggregation)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGGREGATIONS.map((agg) => (
                  <SelectItem key={agg.value} value={agg.value}>
                    {agg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Y-axis column (only for non-count aggregations) */}
          {aggregation !== "count" && (
            <div className="space-y-2">
              <Label>Y-Axis Column (numeric)</Label>
              <Select value={yColumn} onValueChange={setYColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select numeric column" />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No numeric columns available
                    </SelectItem>
                  ) : (
                    numericColumns.map((col) => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.displayName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {numericColumns.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add a numeric column to use sum, average, min, or max aggregations.
                </p>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? isEditing ? "Updating..." : "Creating..."
              : isEditing ? "Update Chart" : "Create Chart"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
