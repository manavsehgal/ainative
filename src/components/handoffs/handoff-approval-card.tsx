"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HandoffApprovalCardProps {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  subject: string;
  body: string;
  priority: number;
  chainDepth: number;
  status: string;
  requiresApproval: boolean;
  onActionComplete?: () => void;
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "Critical",
  1: "High",
  2: "Medium",
  3: "Low",
};

const PRIORITY_VARIANTS: Record<number, "destructive" | "default" | "secondary" | "outline"> = {
  0: "destructive",
  1: "default",
  2: "secondary",
  3: "outline",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  accepted: CheckCircle2,
  in_progress: Clock,
  completed: CheckCircle2,
  rejected: XCircle,
  expired: AlertTriangle,
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accepted: "default",
  in_progress: "default",
  completed: "secondary",
  rejected: "destructive",
  expired: "outline",
};

export function HandoffApprovalCard({
  id,
  fromProfileId,
  toProfileId,
  subject,
  body,
  priority,
  chainDepth,
  status,
  requiresApproval,
  onActionComplete,
}: HandoffApprovalCardProps) {
  const [acting, setActing] = useState(false);

  const StatusIcon = STATUS_ICONS[status] ?? Clock;

  const handleAction = async (action: "approve" | "reject") => {
    setActing(true);
    try {
      const res = await fetch(`/api/handoffs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, approvedBy: "user" }),
      });

      if (res.ok) {
        toast.success(`Handoff ${action === "approve" ? "approved" : "rejected"}`);
        onActionComplete?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? `Failed to ${action} handoff`);
      }
    } catch {
      toast.error(`Failed to ${action} handoff`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">{subject}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{fromProfileId}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-mono">{toProfileId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={PRIORITY_VARIANTS[priority] ?? "secondary"}>
            {PRIORITY_LABELS[priority] ?? "Medium"}
          </Badge>
          <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-3">{body}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {chainDepth > 0 && (
            <span>Chain depth: {chainDepth}</span>
          )}
          {requiresApproval && status === "pending" && (
            <Badge variant="outline" className="text-xs">
              Awaiting approval
            </Badge>
          )}
        </div>

        {status === "pending" && requiresApproval && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("reject")}
              disabled={acting}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => handleAction("approve")}
              disabled={acting}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
