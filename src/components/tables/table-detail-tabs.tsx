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
import { TableChartBuilder } from "./table-chart-builder";
import { TableChartView } from "./table-chart-view";
import { Button } from "@/components/ui/button";
import { BarChart3, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
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

  return (
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
            <Button variant="outline" size="sm" onClick={() => setChartBuilderOpen(true)}>
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
                  <TableChartView
                    config={chart.config}
                    title={chart.name}
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
            onOpenChange={setChartBuilderOpen}
            onChartCreated={fetchCharts}
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
  );
}
