"use client";

import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildPermissionPattern,
  getPermissionResponseLabel,
  type PermissionToolInput,
} from "@/lib/notifications/permissions";

interface PermissionResponseActionsProps {
  taskId?: string | null;
  notificationId: string;
  toolName: string;
  toolInput: PermissionToolInput;
  responded: boolean;
  response: string | null;
  onResponded?: () => void;
  className?: string;
  buttonSize?: "sm" | "default";
  layout?: "inline" | "stacked";
}

export function PermissionResponseActions({
  taskId,
  notificationId,
  toolName,
  toolInput,
  responded,
  response,
  onResponded,
  className,
  buttonSize = "sm",
  layout = "inline",
}: PermissionResponseActionsProps) {
  const [loading, setLoading] = useState(false);
  const responseLabel = responded ? getPermissionResponseLabel(response) : null;

  if (responseLabel) {
    return <span className="text-xs text-muted-foreground">{responseLabel}</span>;
  }

  async function handleAction(
    behavior: "allow" | "deny",
    alwaysAllow = false
  ) {
    setLoading(true);

    try {
      const permissionPattern = alwaysAllow
        ? buildPermissionPattern(toolName, toolInput)
        : undefined;

      const res = await fetch(`/api/tasks/${taskId ?? "_checkpoint"}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId,
          behavior,
          updatedInput: behavior === "allow" ? toolInput : undefined,
          message: behavior === "deny" ? "User denied this action" : undefined,
          alwaysAllow: alwaysAllow || undefined,
          permissionPattern,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "Failed to respond to permission request");
      }

      onResponded?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to respond to permission request"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "flex gap-2",
        layout === "inline" ? "flex-wrap items-center" : "flex-col",
        className
      )}
    >
      <Button
        size={buttonSize}
        variant="outline"
        onClick={() => handleAction("allow")}
        disabled={loading}
      >
        <Check className="h-3.5 w-3.5" />
        Allow Once
      </Button>
      <Button
        size={buttonSize}
        onClick={() => handleAction("allow", true)}
        disabled={loading}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Always Allow
      </Button>
      <Button
        size={buttonSize}
        variant="outline"
        onClick={() => handleAction("deny")}
        disabled={loading}
      >
        <X className="h-3.5 w-3.5" />
        Deny
      </Button>
    </div>
  );
}
