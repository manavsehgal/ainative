"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RuntimeOption {
  id: string;
  label: string;
}

interface CostFiltersProps {
  dateRange: string;
  runtimeId: string;
  status: string;
  activityType: string;
  runtimeOptions: RuntimeOption[];
}

const DATE_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "blocked", label: "Blocked" },
  { value: "unknown_pricing", label: "Unknown pricing" },
];

const ACTIVITY_OPTIONS = [
  { value: "all", label: "All activities" },
  { value: "task_run", label: "Task runs" },
  { value: "task_resume", label: "Task resumes" },
  { value: "workflow_step", label: "Workflow steps" },
  { value: "scheduled_firing", label: "Scheduled firings" },
  { value: "task_assist", label: "Task assist" },
  { value: "profile_test", label: "Profile tests" },
];

export function CostFilters({
  dateRange,
  runtimeId,
  status,
  activityType,
  runtimeOptions,
}: CostFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function replaceFilters(next: URLSearchParams) {
    const href = next.size > 0 ? `${pathname}?${next.toString()}` : pathname;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function setFilter(
    key: "range" | "runtime" | "status" | "activity",
    value: string
  ) {
    const next = new URLSearchParams(searchParams.toString());
    const defaultValue = key === "range" ? "30d" : "all";
    if (value === defaultValue) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    replaceFilters(next);
  }

  function resetFilters() {
    replaceFilters(new URLSearchParams());
  }

  const hasCustomFilters =
    dateRange !== "30d" ||
    runtimeId !== "all" ||
    status !== "all" ||
    activityType !== "all";

  return (
    <div className="surface-panel flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <ListFilter className="h-3.5 w-3.5" />
          <span>Audit Filters</span>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating
            </span>
          ) : null}
          {hasCustomFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
        <Select value={dateRange} onValueChange={(value) => setFilter("range", value)}>
          <SelectTrigger className="surface-control w-full justify-between lg:w-[170px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={runtimeId} onValueChange={(value) => setFilter("runtime", value)}>
          <SelectTrigger className="surface-control w-full justify-between lg:w-[210px]">
            <SelectValue placeholder="All runtimes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All runtimes</SelectItem>
            {runtimeOptions.map((runtime) => (
              <SelectItem key={runtime.id} value={runtime.id}>
                {runtime.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(value) => setFilter("status", value)}>
          <SelectTrigger className="surface-control w-full justify-between lg:w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activityType}
          onValueChange={(value) => setFilter("activity", value)}
        >
          <SelectTrigger className="surface-control w-full justify-between lg:w-[190px]">
            <SelectValue placeholder="All activities" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
