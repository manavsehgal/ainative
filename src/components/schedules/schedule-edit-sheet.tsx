"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  ScheduleForm,
  type ScheduleFormValues,
  type ScheduleFormInitialValues,
} from "./schedule-form";

interface ScheduleEditSheetProps {
  scheduleId: string | null;
  projects: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

interface ScheduleData {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  projectId: string | null;
  assignedAgent: string | null;
  agentProfile: string | null;
  recurs: boolean;
  maxFirings: number | null;
  expiresAt: string | null;
}

export function ScheduleEditSheet({
  scheduleId,
  projects,
  open,
  onOpenChange,
  onUpdated,
}: ScheduleEditSheetProps) {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!scheduleId) return;
    setLoaded(false);
    const res = await fetch(`/api/schedules/${scheduleId}`);
    if (res.ok) setSchedule(await res.json());
    setLoaded(true);
  }, [scheduleId]);

  useEffect(() => {
    if (!open || !scheduleId) {
      setSchedule(null);
      setLoaded(false);
      setError(null);
      return;
    }
    fetchSchedule();
  }, [open, scheduleId, fetchSchedule]);

  const initialValues: ScheduleFormInitialValues | undefined = schedule
    ? {
        name: schedule.name,
        prompt: schedule.prompt,
        interval: schedule.cronExpression,
        projectId: schedule.projectId ?? "",
        assignedAgent: schedule.assignedAgent ?? "",
        agentProfile: schedule.agentProfile ?? "",
        recurs: schedule.recurs,
        maxFirings: schedule.maxFirings,
        expiresAt: schedule.expiresAt,
      }
    : undefined;

  async function handleSubmit(values: ScheduleFormValues) {
    if (!scheduleId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          prompt: values.prompt,
          interval: values.interval,
          assignedAgent: values.assignedAgent || "",
          agentProfile: values.agentProfile || "",
        }),
      });

      if (res.ok) {
        toast.success("Schedule updated");
        onOpenChange(false);
        onUpdated();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed to update schedule (${res.status})`);
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-muted-foreground" />
            <SheetTitle>Edit Schedule</SheetTitle>
          </div>
          <SheetDescription>
            Update the schedule name, prompt, interval, or agent configuration.
          </SheetDescription>
        </SheetHeader>

        {/* Body — px-6 pb-6 per project convention (SheetContent has NO body padding) */}
        <div className="px-6 pb-6 overflow-y-auto">
          {!loaded ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !schedule ? (
            <p className="text-muted-foreground">Schedule not found.</p>
          ) : (
            <ScheduleForm
              key={scheduleId}
              projects={projects}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              submitLabel="Save Changes"
              loading={loading}
              error={error}
              onError={setError}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
