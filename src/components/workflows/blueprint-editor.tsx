"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const TEMPLATE = `id: my-blueprint
name: My Custom Blueprint
description: A brief description of what this blueprint does
version: "1.0.0"
domain: work
tags: [custom]
pattern: sequence
estimatedDuration: "10-15 min"
difficulty: beginner
author: me

variables:
  - id: topic
    type: text
    label: Topic
    description: The main topic
    required: true
    placeholder: "e.g., something to research"

steps:
  - name: Step 1
    profileId: general
    promptTemplate: |
      Work on the following: {{topic}}
    requiresApproval: false
`;

export function BlueprintEditor() {
  const router = useRouter();
  const [yaml, setYaml] = useState(TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save blueprint");
        return;
      }

      toast.success(`Blueprint "${data.name}" created`);
      router.push("/workflows");
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Create Blueprint</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Blueprint
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Blueprint YAML</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="blueprint-yaml" className="sr-only">
              Blueprint YAML
            </Label>
            <Textarea
              id="blueprint-yaml"
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              className="font-mono text-xs min-h-[500px]"
              spellCheck={false}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
