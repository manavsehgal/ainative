"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TargetRow {
  id: string;
  displayValue: string;
}

interface TableRelationComboboxProps {
  targetTableId: string;
  displayColumn: string;
  value: string | string[] | null;
  multiple?: boolean;
  onChange: (value: string | string[]) => void;
}

export function TableRelationCombobox({
  targetTableId,
  displayColumn,
  value,
  multiple = false,
  onChange,
}: TableRelationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const selectedIds = multiple
    ? Array.isArray(value)
      ? value
      : value
        ? [value]
        : []
    : value
      ? [value as string]
      : [];

  const fetchRows = useCallback(
    async (query?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("search", query);
        params.set("limit", "50");

        const res = await fetch(
          `/api/tables/${targetTableId}/rows?${params.toString()}`
        );
        if (res.ok) {
          const data = await res.json();
          const items: TargetRow[] = (data.rows ?? data ?? []).map(
            (row: Record<string, unknown>) => ({
              id: String(row.id ?? row._id ?? ""),
              displayValue: String(row[displayColumn] ?? row.id ?? ""),
            })
          );
          setRows(items);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [targetTableId, displayColumn]
  );

  useEffect(() => {
    if (open) {
      fetchRows();
    }
  }, [open, fetchRows]);

  useEffect(() => {
    if (open && search) {
      const timer = setTimeout(() => fetchRows(search), 300);
      return () => clearTimeout(timer);
    }
  }, [search, open, fetchRows]);

  function handleSelect(rowId: string) {
    if (multiple) {
      const current = [...selectedIds];
      const idx = current.indexOf(rowId);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else {
        current.push(rowId);
      }
      onChange(current);
    } else {
      onChange(rowId);
      setOpen(false);
    }
  }

  function handleRemove(rowId: string) {
    if (multiple) {
      onChange(selectedIds.filter((id) => id !== rowId));
    } else {
      onChange(multiple ? [] : "");
    }
  }

  function getDisplayValue(rowId: string): string {
    const row = rows.find((r) => r.id === rowId);
    return row?.displayValue ?? rowId;
  }

  // Single value display
  const singleDisplay =
    !multiple && selectedIds.length > 0
      ? getDisplayValue(selectedIds[0])
      : null;

  return (
    <div className="space-y-1.5">
      {/* Multi-select: show selected as badges */}
      {multiple && selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              <span className="truncate max-w-[120px]">
                {getDisplayValue(id)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(id);
                }}
                className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 text-sm font-normal"
          >
            <span className="truncate">
              {singleDisplay ?? (multiple ? "Select rows..." : "Select a row...")}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <>
                  <CommandEmpty>No rows found.</CommandEmpty>
                  <CommandGroup>
                    {rows.map((row) => {
                      const isSelected = selectedIds.includes(row.id);
                      return (
                        <CommandItem
                          key={row.id}
                          value={row.id}
                          onSelect={() => handleSelect(row.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{row.displayValue}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
