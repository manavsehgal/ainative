"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppActionBinding, AppResourceMap } from "@/lib/apps/types";

interface AppActionButtonsProps {
  appId: string;
  projectId: string | null;
  resourceMap: AppResourceMap;
  actions: AppActionBinding[];
}

function resolveHref(
  appId: string,
  projectId: string | null,
  resourceMap: AppResourceMap,
  action: AppActionBinding["action"]
) {
  switch (action.type) {
    case "openProject":
      return projectId ? `/projects/${projectId}` : null;
    case "openPage":
      return `/apps/${appId}/${action.pageKey}`;
    case "openTable":
      return resourceMap.tables[action.tableKey]
        ? `/tables/${resourceMap.tables[action.tableKey]}`
        : null;
    case "openSchedules":
      return "/schedules";
    case "openWorkflows":
      return "/workflows/blueprints";
    case "clearSampleData":
      return null;
  }
}

export function AppActionButtons({
  appId,
  projectId,
  resourceMap,
  actions,
}: AppActionButtonsProps) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function handleClearSampleData(key: string) {
    setPendingKey(key);
    try {
      const res = await fetch(`/api/apps/${appId}/clear-sample-data`, {
        method: "POST",
      });
      const data = (await res.json()) as { deletedRows?: number; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to clear sample data");
      }

      toast.success(
        data.deletedRows
          ? `Removed ${data.deletedRows} sample row${data.deletedRows === 1 ? "" : "s"}.`
          : "No sample rows found."
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clear sample data"
      );
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((item) => {
        const href = resolveHref(appId, projectId, resourceMap, item.action);
        const isPending = pendingKey === item.key;

        if (item.action.type === "clearSampleData") {
          return (
            <Button
              key={item.key}
              type="button"
              variant={item.variant ?? "default"}
              size="sm"
              disabled={isPending}
              onClick={() => handleClearSampleData(item.key)}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {item.label}
            </Button>
          );
        }

        if (!href) {
          return (
            <Button
              key={item.key}
              type="button"
              variant={item.variant ?? "outline"}
              size="sm"
              disabled
            >
              {item.label}
            </Button>
          );
        }

        return (
          <Button
            key={item.key}
            asChild
            variant={item.variant ?? "outline"}
            size="sm"
          >
            <Link href={href}>{item.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
