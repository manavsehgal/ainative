"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, X } from "lucide-react";

interface PermissionActionProps {
  taskId: string;
  notificationId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  responded: boolean;
  response: string | null;
  onResponded: () => void;
}

/**
 * Build a suggested permission pattern from a tool invocation.
 * Mirrors the server-side logic in permissions.ts.
 */
function buildPattern(
  toolName: string,
  input: Record<string, unknown>
): string {
  if (toolName === "Bash" && typeof input.command === "string") {
    const firstWord = input.command.split(/\s+/)[0];
    return `Bash(command:${firstWord} *)`;
  }
  return toolName;
}

export function PermissionAction({
  taskId,
  notificationId,
  toolName,
  toolInput,
  responded,
  response,
  onResponded,
}: PermissionActionProps) {
  const [loading, setLoading] = useState(false);

  if (responded && response) {
    try {
      const parsed = JSON.parse(response);
      const wasAlwaysAllowed = parsed.behavior === "allow" && parsed.alwaysAllow;
      return (
        <span className="text-xs text-muted-foreground">
          {parsed.behavior === "allow"
            ? wasAlwaysAllowed
              ? "Always allowed"
              : "Allowed"
            : "Denied"}
        </span>
      );
    } catch {
      return null;
    }
  }

  async function handleAction(
    behavior: "allow" | "deny",
    alwaysAllow = false
  ) {
    setLoading(true);
    try {
      const pattern = alwaysAllow ? buildPattern(toolName, toolInput) : undefined;
      await fetch(`/api/tasks/${taskId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId,
          behavior,
          updatedInput: behavior === "allow" ? toolInput : undefined,
          message: behavior === "deny" ? "User denied this action" : undefined,
          alwaysAllow: alwaysAllow || undefined,
          permissionPattern: pattern,
        }),
      });
      onResponded();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 mt-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAction("allow")}
        disabled={loading}
      >
        <Check className="h-3.5 w-3.5 mr-1" />
        Allow Once
      </Button>
      <Button
        size="sm"
        onClick={() => handleAction("allow", true)}
        disabled={loading}
      >
        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
        Always Allow
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAction("deny")}
        disabled={loading}
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Deny
      </Button>
    </div>
  );
}
