"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ChatTableResultProps {
  tableId: string;
  tableName: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  totalRows?: number;
  aggregation?: {
    operation: string;
    column: string;
    result: number;
    count: number;
  };
}

const MAX_VISIBLE_ROWS = 10;

export function ChatTableResult({
  tableId,
  tableName,
  columns,
  rows,
  totalRows,
  aggregation,
}: ChatTableResultProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, MAX_VISIBLE_ROWS);
  const hasMore = rows.length > MAX_VISIBLE_ROWS;

  if (aggregation) {
    return (
      <div className="rounded-lg border p-3 my-2 space-y-2">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{tableName}</span>
          <Badge variant="secondary" className="text-xs">
            {aggregation.operation}
          </Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {typeof aggregation.result === "number"
              ? aggregation.result.toLocaleString()
              : String(aggregation.result)}
          </span>
          <span className="text-xs text-muted-foreground">
            {aggregation.column} · {aggregation.count} rows
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border my-2 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{tableName}</span>
          <Badge variant="secondary" className="text-xs">
            {totalRows ?? rows.length} row{(totalRows ?? rows.length) !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Link
          href={`/tables/${tableId}`}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Open <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {columns.length > 0 && visibleRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                {columns.slice(0, 8).map((col) => (
                  <th key={col} className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                    {col}
                  </th>
                ))}
                {columns.length > 8 && (
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                    +{columns.length - 8} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.slice(0, 8).map((col) => (
                    <td key={col} className="px-3 py-1.5 max-w-[200px] truncate">
                      {row[col] == null ? (
                        <span className="text-muted-foreground/40">—</span>
                      ) : (
                        String(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div className="px-3 py-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show all {rows.length} rows
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
