"use client";

import { useEffect, useState } from "react";
import { BarChart3, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function TelemetrySection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/telemetry")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setEnabled(d.enabled === true))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(checked: boolean) {
    setEnabled(checked);
    try {
      const res = await fetch("/api/settings/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (res.ok) {
        toast.success(checked ? "Telemetry enabled — thank you!" : "Telemetry disabled");
      } else {
        setEnabled(!checked); // Revert on failure
      }
    } catch {
      setEnabled(!checked);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Anonymous Telemetry
        </CardTitle>
        <CardDescription>
          Help improve Stagent by sharing anonymized usage data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Share usage data</p>
            <p className="text-xs text-muted-foreground">
              Activity types, model usage, and outcome rates. No task content, project names, or personal data.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading}
          />
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Data is opt-in, anonymized, and never includes task descriptions, file contents, or email addresses.
            You can disable this at any time.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
