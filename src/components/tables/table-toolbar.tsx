"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Columns3, Trash2, Upload, Download, Sparkles } from "lucide-react";

interface TableToolbarProps {
  tableId: string;
  rowCount: number;
  selectedCount: number;
  onAddRow: () => void;
  onAddColumn: () => void;
  onBulkDelete: () => void;
  onImport?: () => void;
  onEnrich?: () => void;
}

export function TableToolbar({
  tableId,
  rowCount,
  selectedCount,
  onAddRow,
  onAddColumn,
  onBulkDelete,
  onImport,
  onEnrich,
}: TableToolbarProps) {
  function handleExport(format: string) {
    window.open(`/api/tables/${tableId}/export?format=${format}`, "_blank");
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <Button variant="outline" size="sm" onClick={onAddColumn}>
        <Columns3 className="h-4 w-4 mr-1" />
        Column
      </Button>
      <Button variant="outline" size="sm" onClick={onAddRow}>
        <Plus className="h-4 w-4 mr-1" />
        Row
      </Button>

      {onImport && (
        <Button variant="outline" size="sm" onClick={onImport}>
          <Upload className="h-4 w-4 mr-1" />
          Import
        </Button>
      )}

      {onEnrich && (
        <Button size="sm" onClick={onEnrich}>
          <Sparkles className="h-4 w-4 mr-1" />
          Enrich
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleExport("csv")}>Export CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("xlsx")}>Export Excel</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("json")}>Export JSON</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedCount > 0 && (
        <Button variant="destructive" size="sm" onClick={onBulkDelete}>
          <Trash2 className="h-4 w-4 mr-1" />
          Delete ({selectedCount})
        </Button>
      )}

      <span className="ml-auto text-xs text-muted-foreground">
        {rowCount} {rowCount === 1 ? "row" : "rows"}
      </span>
    </div>
  );
}
