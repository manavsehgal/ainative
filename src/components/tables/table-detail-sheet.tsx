"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { tableSourceVariant } from "@/lib/constants/table-status";
import { formatRowCount, formatColumnCount } from "./utils";
import type { TableWithRelations } from "./types";
import type { ColumnDef } from "@/lib/tables/types";

interface TableDetailSheetProps {
  table: TableWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function TableDetailSheet({
  table,
  open,
  onOpenChange,
  onDeleted,
}: TableDetailSheetProps) {
  const router = useRouter();

  let columns: ColumnDef[] = [];
  try {
    columns = JSON.parse(table.columnSchema) as ColumnDef[];
  } catch {
    // Invalid schema
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Table deleted");
        onOpenChange(false);
        onDeleted();
      } else {
        toast.error("Failed to delete table");
      }
    } catch {
      toast.error("Failed to delete table");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>{table.name}</SheetTitle>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          {table.description && (
            <p className="text-sm text-muted-foreground">
              {table.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Badge variant={tableSourceVariant[table.source]}>
              {table.source}
            </Badge>
            <span className="text-muted-foreground">
              {formatColumnCount(table.columnCount)}
            </span>
            <span className="text-muted-foreground">
              {formatRowCount(table.rowCount)}
            </span>
          </div>

          {table.projectName && (
            <div className="text-sm">
              <span className="text-muted-foreground">Project: </span>
              {table.projectName}
            </div>
          )}

          {columns.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Columns</h4>
              <div className="rounded-md border divide-y">
                {columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span>{col.displayName}</span>
                    <Badge variant="outline" className="text-xs">
                      {col.dataType}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Created{" "}
            {table.createdAt
              ? new Date(table.createdAt).toLocaleDateString()
              : "—"}
            {" · "}
            Updated{" "}
            {table.updatedAt
              ? new Date(table.updatedAt).toLocaleDateString()
              : "—"}
          </div>
        </div>

        <SheetFooter className="px-6">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/tables/${table.id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
