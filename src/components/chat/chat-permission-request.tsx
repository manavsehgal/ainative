"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, X, ShieldAlert } from "lucide-react";
import { buildPermissionSummary, buildPermissionPattern } from "@/lib/notifications/permissions";

interface ChatPermissionRequestProps {
  conversationId: string;
  requestId: string;
  messageId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: string; // "pending" | "complete" | "error"
  onStatusChange?: (status: string) => void;
}

export function ChatPermissionRequest({
  conversationId,
  requestId,
  messageId,
  toolName,
  toolInput,
  status,
  onStatusChange,
}: ChatPermissionRequestProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"allowed" | "denied" | null>(
    status === "complete" ? "allowed" : status === "error" ? "denied" : null
  );

  const summary = buildPermissionSummary(toolName, toolInput);

  async function handleAction(behavior: "allow" | "deny", alwaysAllow = false) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            messageId,
            behavior,
            updatedInput: behavior === "allow" ? toolInput : undefined,
            alwaysAllow: alwaysAllow || undefined,
            toolName,
            toolInput,
            permissionPattern: alwaysAllow
              ? buildPermissionPattern(toolName, toolInput)
              : undefined,
          }),
        }
      );
      if (res.ok || res.status === 404) {
        // Success or stale request (expired/HMR) — update UI either way
        setResult(behavior === "allow" ? "allowed" : "denied");
        onStatusChange?.(behavior === "allow" ? "complete" : "error");
      }
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="font-medium">{toolName}</span>
          <span className="text-xs">—</span>
          <span className="text-xs truncate">{summary}</span>
          <span className="ml-auto text-xs font-medium">
            {result === "allowed" ? "Allowed" : "Denied"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="font-medium">Permission required: {toolName}</span>
      </div>
      <p className="text-xs text-muted-foreground font-mono truncate">
        {summary}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction("allow")}
          disabled={loading}
        >
          <Check className="h-3.5 w-3.5" />
          Allow Once
        </Button>
        <Button
          size="sm"
          onClick={() => handleAction("allow", true)}
          disabled={loading}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Always Allow
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction("deny")}
          disabled={loading}
        >
          <X className="h-3.5 w-3.5" />
          Deny
        </Button>
      </div>
    </div>
  );
}
