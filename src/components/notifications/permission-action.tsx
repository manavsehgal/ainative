"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface PermissionActionProps {
  taskId: string;
  notificationId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  responded: boolean;
  response: string | null;
  onResponded: () => void;
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
      return (
        <span className="text-xs text-muted-foreground">
          {parsed.behavior === "allow" ? "Allowed" : "Denied"}
        </span>
      );
    } catch {
      return null;
    }
  }

  async function handleAction(behavior: "allow" | "deny") {
    setLoading(true);
    try {
      await fetch(`/api/tasks/${taskId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId,
          behavior,
          updatedInput: behavior === "allow" ? toolInput : undefined,
          message: behavior === "deny" ? "User denied this action" : undefined,
        }),
      });
      onResponded();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 mt-2">
      <Button size="sm" onClick={() => handleAction("allow")} disabled={loading}>
        <Check className="h-3.5 w-3.5 mr-1" />
        Allow
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
