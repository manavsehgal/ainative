"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface FailureActionProps {
  taskId: string;
  onRetried: () => void;
}

export function FailureAction({ taskId, onRetried }: FailureActionProps) {
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    try {
      // Move back to queued
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "queued" }),
      });
      // Then execute
      await fetch(`/api/tasks/${taskId}/execute`, { method: "POST" });
      onRetried();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleRetry} disabled={loading} className="mt-2">
      <RotateCcw className="h-3.5 w-3.5 mr-1" />
      Retry
    </Button>
  );
}
