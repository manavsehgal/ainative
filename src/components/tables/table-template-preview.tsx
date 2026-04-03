"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { UserTableTemplateRow } from "@/lib/db/schema";
import type { ColumnDef } from "@/lib/tables/types";

interface TableTemplatePreviewProps {
  template: UserTableTemplateRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloned: (tableId: string) => void;
}

export function TableTemplatePreview({
  template,
  open,
  onOpenChange,
  onCloned,
}: TableTemplatePreviewProps) {
  const [step, setStep] = useState<"preview" | "clone">("preview");
  const [name, setName] = useState(template.name);
  const [includeSampleData, setIncludeSampleData] = useState(true);
  const [saving, setSaving] = useState(false);

  let columns: ColumnDef[] = [];
  try {
    columns = JSON.parse(template.columnSchema) as ColumnDef[];
  } catch { /* */ }

  let sampleData: Record<string, unknown>[] = [];
  try {
    if (template.sampleData) {
      sampleData = JSON.parse(template.sampleData) as Record<string, unknown>[];
    }
  } catch { /* */ }

  async function handleClone() {
    if (!name.trim()) {
      toast.error("Table name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          name: name.trim(),
          includeSampleData,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to create table from template");
        return;
      }

      const table = await res.json();
      toast.success(`Table "${name}" created from template`);
      onCloned(table.id);
    } catch {
      toast.error("Failed to create table from template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) setStep("preview");
        onOpenChange(v);
      }}
    >
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>
            {step === "preview" ? template.name : "Create from Template"}
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          {step === "preview" ? (
            <>
              {template.description && (
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>
              )}

              <div className="space-y-1">
                <h4 className="text-sm font-medium">
                  Columns ({columns.length})
                </h4>
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

              {sampleData.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Sample Data</h4>
                  <div className="rounded-md border overflow-auto max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.map((col) => (
                            <TableHead key={col.name} className="text-xs">
                              {col.displayName}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sampleData.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {columns.map((col) => (
                              <TableCell key={col.name} className="text-xs">
                                {String(row[col.name] ?? "—")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="clone-name">Table Name</Label>
                <Input
                  id="clone-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="include-data">Include sample data</Label>
                <Switch
                  id="include-data"
                  checked={includeSampleData}
                  onCheckedChange={setIncludeSampleData}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Creates a new table with {columns.length} columns
                {includeSampleData && sampleData.length > 0
                  ? ` and ${sampleData.length} sample rows`
                  : ""}
                .
              </p>
            </>
          )}
        </div>

        <SheetFooter className="px-6">
          {step === "preview" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setStep("clone")}>
                Use This Template
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button onClick={handleClone} disabled={saving}>
                {saving ? "Creating..." : "Create Table"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
