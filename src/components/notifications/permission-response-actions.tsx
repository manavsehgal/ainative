"use client";

import { useState } from "react";
import { Check, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildPermissionPattern,
  getPermissionResponseLabel,
  type PermissionToolInput,
} from "@/lib/notifications/permissions";

interface AskUserQuestionOption {
  label: string;
  description?: string;
}

function parseQuestionOptions(toolInput: PermissionToolInput): AskUserQuestionOption[] {
  const raw = (toolInput as { options?: unknown }).options;
  if (!Array.isArray(raw)) return [];
  const out: AskUserQuestionOption[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && typeof (item as { label?: unknown }).label === "string") {
      const entry: AskUserQuestionOption = {
        label: (item as { label: string }).label,
      };
      const desc = (item as { description?: unknown }).description;
      if (typeof desc === "string") entry.description = desc;
      out.push(entry);
    }
  }
  return out;
}

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

  if (toolName === "AskUserQuestion" || toolName === "ask_user_question") {
    return (
      <QuestionReplyActions
        taskId={taskId}
        notificationId={notificationId}
        toolInput={toolInput}
        onResponded={onResponded}
        className={className}
        buttonSize={buttonSize}
      />
    );
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

interface QuestionReplyActionsProps {
  taskId?: string | null;
  notificationId: string;
  toolInput: PermissionToolInput;
  onResponded?: () => void;
  className?: string;
  buttonSize?: "sm" | "default";
}

/**
 * Renders the response UI for an `AskUserQuestion` notification:
 * - If `toolInput.options` is a non-empty array → card-cluster radiogroup (one click = answer).
 * - Otherwise → free-form textarea + Send.
 *
 * Posts to /api/tasks/[id]/respond with `{ behavior: "allow", updatedInput: { answer } }`.
 * The task runtime's `waitForToolPermissionResponse()` unblocks and returns `{ answer }`
 * to the agent.
 */
function QuestionReplyActions({
  taskId,
  notificationId,
  toolInput,
  onResponded,
  className,
  buttonSize = "sm",
}: QuestionReplyActionsProps) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const options = parseQuestionOptions(toolInput);

  async function sendAnswer(answer: string) {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId ?? "_checkpoint"}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId,
          behavior: "allow",
          updatedInput: { answer: answer.trim() },
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "Failed to send answer");
      }

      onResponded?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send answer"
      );
    } finally {
      setLoading(false);
    }
  }

  if (options.length > 0) {
    return (
      <div
        role="radiogroup"
        aria-label="Choose a response"
        className={cn("grid gap-2 sm:grid-cols-1", className)}
      >
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => sendAnswer(option.label)}
            disabled={loading}
            className="rounded-lg border border-border/60 bg-background/60 p-3 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
          >
            <div className="text-sm font-medium text-foreground">{option.label}</div>
            {option.description && (
              <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Type your reply…"
        rows={3}
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            sendAnswer(draft);
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</span>
        <Button
          size={buttonSize}
          onClick={() => sendAnswer(draft)}
          disabled={loading || !draft.trim()}
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </div>
    </div>
  );
}
