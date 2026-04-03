"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Link,
  Mail,
  GitBranch,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Trash2,
  Pencil,
} from "lucide-react";
import type { ColumnDef } from "@/lib/tables/types";
import type { ColumnDataType } from "@/lib/constants/table-status";
import type { LucideIcon } from "lucide-react";

const typeIcons: Record<ColumnDataType, LucideIcon> = {
  text: Type,
  number: Hash,
  date: Calendar,
  boolean: CheckSquare,
  select: List,
  url: Link,
  email: Mail,
  relation: GitBranch,
  computed: Sparkles,
};

interface ColumnHeaderProps {
  column: ColumnDef;
  sortDirection: "asc" | "desc" | null;
  onSort: (direction: "asc" | "desc") => void;
  onRename: () => void;
  onDelete: () => void;
}

export function SpreadsheetColumnHeader({
  column,
  sortDirection,
  onSort,
  onRename,
  onDelete,
}: ColumnHeaderProps) {
  const Icon = typeIcons[column.dataType] ?? Type;

  return (
    <div className="flex items-center gap-1 w-full">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate text-xs font-medium">{column.displayName}</span>
      {sortDirection === "asc" && <ArrowUp className="h-3 w-3 text-muted-foreground" />}
      {sortDirection === "desc" && <ArrowDown className="h-3 w-3 text-muted-foreground" />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-auto shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onSort("asc")}>
            <ArrowUp className="h-4 w-4 mr-2" />
            Sort Ascending
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSort("desc")}>
            <ArrowDown className="h-4 w-4 mr-2" />
            Sort Descending
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
