"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { TableSpreadsheet } from "./table-spreadsheet";
import { TableTriggersTab } from "./table-triggers-tab";
import { TableHistoryTab } from "./table-history-tab";
import { TableChartBuilder, type EditChartData } from "./table-chart-builder";
import { TableChartView } from "./table-chart-view";
import { Button } from "@/components/ui/button";
import { BarChart3, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import type { ColumnDef } from "@/lib/tables/types";
import type { UserTableRowRow } from "@/lib/db/schema";

interface ChartView {
  id: string;
  name: string;
  config: {
    type: "bar" | "line" | "pie" | "scatter";
    xColumn: string;
    yColumn?: string;
    aggregation?: "sum" | "avg" | "count" | "min" | "max";
  };
}

interface TableDetailTabsProps {
  tableId: string;
  columns: ColumnDef[];
  initialRows: UserTableRowRow[];
}

export function TableDetailTabs({
  tableId,
  columns,
  initialRows,
}: TableDetailTabsProps) {
  const [charts, setCharts] = useState<ChartView[]>([]);
  const [chartBuilderOpen, setChartBuilderOpen] = useState(false);
  const [editChart, setEditChart] = useState<EditChartData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChartView | null>(null);
  const [, setDeleting] = useState(false);

  // Parse rows for chart rendering
  const parsedRows = initialRows.map((r) => ({
    data: typeof r.data === "string" ? JSON.parse(r.data) as Record<string, unknown> : r.data as Record<string, unknown>,
  }));

  const fetchCharts = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${tableId}/charts`);
      if (res.ok) setCharts(await res.json());
    } catch { /* silent */ }
  }, [tableId]);

  useEffect(() => { fetchCharts(); }, [fetchCharts]);

  function handleEdit(chart: ChartView) {
    setEditChart({
      id: chart.id,
      name: chart.name,
      config: chart.config,
    });
    setChartBuilderOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/charts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        toast.success(`Chart "${deleteTarget.name}" deleted`);
        fetchCharts();
      } else {
        toast.error("Failed to delete chart");
      }
    } catch {
      toast.error("Failed to delete chart");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function handleBuilderClose(open: boolean) {
    setChartBuilderOpen(open);
    if (!open) setEditChart(null);
  }

  return (
    <>
      <Tabs defaultValue="data" className="w-full">
        <TabsList>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="mt-4">
          <TableSpreadsheet
            tableId={tableId}
            columns={columns}
            initialRows={initialRows}
          />
        </TabsContent>

        <TabsContent value="charts" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => { setEditChart(null); setChartBuilderOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                New Chart
              </Button>
            </div>

            {charts.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                heading="No charts yet"
                description="Create a chart to visualize your table data."
                action={
                  <Button onClick={() => setChartBuilderOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Chart
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {charts.map((chart) => (
                  <div key={chart.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium truncate">{chart.name}</h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(chart)}
                          aria-label={`Edit ${chart.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(chart)}
                          aria-label={`Delete ${chart.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <TableChartView
                      config={chart.config}
                      title=""
                      rows={parsedRows}
                    />
                  </div>
                ))}
              </div>
            )}

            <TableChartBuilder
              tableId={tableId}
              columns={columns.map((c) => ({
                name: c.name,
                displayName: c.displayName,
                dataType: c.dataType,
              }))}
              open={chartBuilderOpen}
              onOpenChange={handleBuilderClose}
              onChartSaved={fetchCharts}
              editChart={editChart}
            />
          </div>
        </TabsContent>

        <TabsContent value="triggers" className="mt-4">
          <TableTriggersTab tableId={tableId} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <TableHistoryTab tableId={tableId} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Delete chart "${deleteTarget?.name}"?`}
        description="This will permanently remove this chart. The underlying table data is not affected."
        confirmLabel="Delete Chart"
        onConfirm={handleDelete}
        destructive
      />
    </>
  );
}
