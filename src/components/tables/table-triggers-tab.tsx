"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Zap, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Trigger {
  id: string;
  name: string;
  eventType: "row_added" | "row_updated" | "row_deleted";
  condition: {
    column: string;
    operator: string;
    value: string;
  } | null;
  actionType: "run_workflow" | "create_task";
  actionConfig: Record<string, string>;
  status: "active" | "paused";
  fireCount: number;
}

interface TableTriggersTabProps {
  tableId: string;
}

const EVENT_TYPES = [
  { value: "row_added", label: "Row Added" },
  { value: "row_updated", label: "Row Updated" },
  { value: "row_deleted", label: "Row Deleted" },
] as const;

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
] as const;

const ACTION_TYPES = [
  { value: "run_workflow", label: "Run Workflow" },
  { value: "create_task", label: "Create Task" },
] as const;

function eventBadgeVariant(eventType: string) {
  switch (eventType) {
    case "row_added":
      return "default" as const;
    case "row_updated":
      return "secondary" as const;
    case "row_deleted":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function TableTriggersTab({ tableId }: TableTriggersTabProps) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<Trigger["eventType"]>("row_added");
  const [conditionColumn, setConditionColumn] = useState("");
  const [conditionOperator, setConditionOperator] = useState("equals");
  const [conditionValue, setConditionValue] = useState("");
  const [hasCondition, setHasCondition] = useState(false);
  const [actionType, setActionType] = useState<Trigger["actionType"]>("run_workflow");
  const [actionTargetId, setActionTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTriggers = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${tableId}/triggers`);
      if (res.ok) {
        const raw = await res.json();
        const list = raw.triggers ?? raw ?? [];
        // Map API shape (triggerEvent, JSON strings) to component shape (eventType, parsed objects)
        setTriggers(
          list.map((t: Record<string, unknown>) => ({
            ...t,
            eventType: t.triggerEvent ?? t.eventType,
            condition: typeof t.condition === "string" ? JSON.parse(t.condition) : t.condition ?? null,
            actionConfig: typeof t.actionConfig === "string" ? JSON.parse(t.actionConfig) : t.actionConfig ?? {},
          }))
        );
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  function resetForm() {
    setName("");
    setEventType("row_added");
    setConditionColumn("");
    setConditionOperator("equals");
    setConditionValue("");
    setHasCondition(false);
    setActionType("run_workflow");
    setActionTargetId("");
    setEditingTrigger(null);
  }

  function openAdd() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(trigger: Trigger) {
    setEditingTrigger(trigger);
    setName(trigger.name);
    setEventType(trigger.eventType);
    if (trigger.condition) {
      setHasCondition(true);
      setConditionColumn(trigger.condition.column);
      setConditionOperator(trigger.condition.operator);
      setConditionValue(trigger.condition.value);
    } else {
      setHasCondition(false);
      setConditionColumn("");
      setConditionOperator("equals");
      setConditionValue("");
    }
    setActionType(trigger.actionType);
    setActionTargetId(trigger.actionConfig?.targetId ?? "");
    setSheetOpen(true);
  }

  async function handleToggle(trigger: Trigger) {
    const newStatus = trigger.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/tables/${tableId}/triggers/${trigger.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTriggers((prev) =>
          prev.map((t) => (t.id === trigger.id ? { ...t, status: newStatus } : t))
        );
        toast.success(`Trigger ${newStatus === "active" ? "activated" : "paused"}`);
      } else {
        toast.error("Failed to update trigger status");
      }
    } catch {
      toast.error("Failed to update trigger status");
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Trigger name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        triggerEvent: eventType,
        condition: hasCondition
          ? { column: conditionColumn, operator: conditionOperator, value: conditionValue }
          : null,
        actionType,
        actionConfig: { targetId: actionTargetId },
      };

      const isEdit = !!editingTrigger;
      const url = isEdit
        ? `/api/tables/${tableId}/triggers/${editingTrigger.id}`
        : `/api/tables/${tableId}/triggers`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Failed to ${isEdit ? "update" : "create"} trigger`);
        return;
      }

      toast.success(`Trigger "${name}" ${isEdit ? "updated" : "created"}`);
      setSheetOpen(false);
      resetForm();
      fetchTriggers();
    } catch {
      toast.error("Failed to save trigger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading triggers...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Triggers ({triggers.length})
        </h3>
        <Button variant="outline" size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Trigger
        </Button>
      </div>

      {triggers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Zap className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No triggers configured. Add a trigger to automate actions when rows change.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {triggers.map((trigger) => (
            <div
              key={trigger.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {trigger.name}
                  </span>
                  <Badge variant={eventBadgeVariant(trigger.eventType)}>
                    {trigger.eventType.replace(/_/g, " ")}
                  </Badge>
                </div>
                {trigger.condition && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When {trigger.condition.column} {trigger.condition.operator}{" "}
                    {trigger.condition.value}
                  </p>
                )}
              </div>

              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {trigger.fireCount} fires
              </span>

              <Switch
                checked={trigger.status === "active"}
                onCheckedChange={() => handleToggle(trigger)}
                aria-label={`Toggle ${trigger.name}`}
              />

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => openEdit(trigger)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Trigger config sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>
              {editingTrigger ? "Edit Trigger" : "Add Trigger"}
            </SheetTitle>
          </SheetHeader>

          <div className="px-6 pb-6 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="trigger-name">Name</Label>
              <Input
                id="trigger-name"
                placeholder="e.g. Notify on new row"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={eventType}
                onValueChange={(v) => setEventType(v as Trigger["eventType"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condition builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="trigger-condition">Condition</Label>
                <Switch
                  id="trigger-condition"
                  checked={hasCondition}
                  onCheckedChange={setHasCondition}
                />
              </div>
              {hasCondition && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Column</Label>
                    <Input
                      placeholder="Column name"
                      value={conditionColumn}
                      onChange={(e) => setConditionColumn(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Operator</Label>
                    <Select
                      value={conditionOperator}
                      onValueChange={setConditionOperator}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input
                      placeholder="Comparison value"
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action config */}
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select
                value={actionType}
                onValueChange={(v) => setActionType(v as Trigger["actionType"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((at) => (
                    <SelectItem key={at.value} value={at.value}>
                      {at.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger-target">
                {actionType === "run_workflow" ? "Workflow ID" : "Task Template"}
              </Label>
              <Input
                id="trigger-target"
                placeholder={
                  actionType === "run_workflow"
                    ? "Select or enter workflow ID"
                    : "Select or enter task template"
                }
                value={actionTargetId}
                onChange={(e) => setActionTargetId(e.target.value)}
              />
            </div>
          </div>

          <SheetFooter className="px-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving
                ? "Saving..."
                : editingTrigger
                  ? "Update Trigger"
                  : "Add Trigger"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
