"use client";

import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableRelationCombobox } from "./table-relation-combobox";
import type { ColumnDef } from "@/lib/tables/types";

interface CellEditorProps {
  column: ColumnDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CellEditor({
  column,
  value,
  onChange,
  onConfirm,
  onCancel,
}: CellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const strValue = value == null ? "" : String(value);

  switch (column.dataType) {
    case "boolean":
      // Booleans toggle directly, no edit mode needed
      return null;

    case "select": {
      const options = column.config?.options ?? [];
      return (
        <Select
          value={strValue}
          onValueChange={(v) => {
            onChange(v);
            onConfirm();
          }}
          open
        >
          <SelectTrigger className="h-8 border-0 shadow-none focus:ring-2 focus:ring-primary text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "number":
      return (
        <Input
          ref={inputRef}
          type="number"
          value={strValue}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          onBlur={onConfirm}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          className="h-8 border-0 shadow-none focus-visible:ring-2 focus-visible:ring-primary rounded-none text-sm"
        />
      );

    case "date":
      return (
        <Input
          ref={inputRef}
          type="date"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onConfirm}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          className="h-8 border-0 shadow-none focus-visible:ring-2 focus-visible:ring-primary rounded-none text-sm"
        />
      );

    case "relation": {
      const targetId = column.config?.targetTableId;
      const dispCol = column.config?.displayColumn ?? "name";
      if (!targetId) return null;
      return (
        <TableRelationCombobox
          targetTableId={targetId}
          displayColumn={dispCol}
          value={strValue || null}
          onChange={(v) => {
            onChange(v);
            onConfirm();
          }}
        />
      );
    }

    case "computed":
      // Computed columns are read-only
      return null;

    case "url":
    case "email":
    case "text":
    default:
      return (
        <Input
          ref={inputRef}
          type={column.dataType === "email" ? "email" : column.dataType === "url" ? "url" : "text"}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onConfirm}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          className="h-8 border-0 shadow-none focus-visible:ring-2 focus-visible:ring-primary rounded-none text-sm"
        />
      );
  }
}

// ── Display renderers ────────────────────────────────────────────────

interface CellDisplayProps {
  column: ColumnDef;
  value: unknown;
  onToggleBoolean?: (newValue: boolean) => void;
}

export function CellDisplay({ column, value, onToggleBoolean }: CellDisplayProps) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground/40 text-sm">—</span>;
  }

  switch (column.dataType) {
    case "boolean":
      return (
        <Checkbox
          checked={!!value}
          onCheckedChange={(checked) => onToggleBoolean?.(!!checked)}
          className="ml-1"
        />
      );

    case "select":
      return (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
          {String(value)}
        </span>
      );

    case "number": {
      const num = Number(value);
      return (
        <span className="tabular-nums text-sm">
          {isNaN(num) ? String(value) : num.toLocaleString()}
        </span>
      );
    }

    case "date": {
      const str = String(value);
      try {
        return <span className="text-sm">{new Date(str).toLocaleDateString()}</span>;
      } catch {
        return <span className="text-sm">{str}</span>;
      }
    }

    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value).replace(/^https?:\/\//, "").slice(0, 40)}
        </a>
      );

    case "email":
      return (
        <a
          href={`mailto:${value}`}
          className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    case "computed":
      return (
        <span className="text-sm text-muted-foreground italic">
          {String(value)}
        </span>
      );

    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}
