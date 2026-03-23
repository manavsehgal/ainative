"use client";

import { useEffect, useState, useCallback } from "react";
import { Timer } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormSectionCard } from "@/components/shared/form-section-card";

const SETTING_KEY = "runtime.sdkTimeoutSeconds";
const DEFAULT_TIMEOUT = 60;

export function RuntimeTimeoutSection() {
  const [timeout, setTimeout_] = useState(String(DEFAULT_TIMEOUT));
  const [saving, setSaving] = useState(false);

  const fetchTimeout = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/runtime");
      if (res.ok) {
        const data = await res.json();
        if (data.sdkTimeoutSeconds) setTimeout_(data.sdkTimeoutSeconds);
      }
    } catch {
      // Use default
    }
  }, []);

  useEffect(() => {
    fetchTimeout();
  }, [fetchTimeout]);

  const handleSave = async (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 10 || num > 300) {
      toast.error("Timeout must be between 10 and 300 seconds");
      return;
    }

    setSaving(true);
    try {
      await fetch("/api/settings/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdkTimeoutSeconds: String(num) }),
      });
      setTimeout_(String(num));
      toast.success("Timeout updated");
    } catch {
      toast.error("Failed to save timeout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Runtime</CardTitle>
        <CardDescription>
          Configure runtime behavior for AI operations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormSectionCard
          icon={Timer}
          title="SDK Timeout"
          hint="Maximum seconds to wait for AI responses (task assist, completions). Min 10, max 300."
        >
          <Input
            type="number"
            min={10}
            max={300}
            value={timeout}
            onChange={(e) => setTimeout_(e.target.value)}
            onBlur={(e) => handleSave(e.target.value)}
            disabled={saving}
            className="w-32"
          />
        </FormSectionCard>
      </CardContent>
    </Card>
  );
}
