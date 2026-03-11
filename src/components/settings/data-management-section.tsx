"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { Loader2, Trash2, Database } from "lucide-react";

export function DataManagementSection() {
  const [clearOpen, setClearOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleClear() {
    setLoading(true);
    try {
      const res = await fetch("/api/data/clear", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const d = data.deleted;
        toast.success(
          `Cleared ${d.projects} projects, ${d.tasks} tasks, ${d.documents} documents, ${d.agentLogs} logs, ${d.notifications} notifications, ${d.files} files`
        );
      } else {
        toast.error(`Clear failed: ${data.error}`);
      }
    } catch {
      toast.error("Clear failed — network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setLoading(true);
    try {
      const res = await fetch("/api/data/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const s = data.seeded;
        toast.success(
          `Seeded ${s.projects} projects, ${s.tasks} tasks, ${s.workflows} workflows, ${s.documents} documents, ${s.agentLogs} logs, ${s.notifications} notifications`
        );
      } else {
        toast.error(`Seed failed: ${data.error}`);
      }
    } catch {
      toast.error("Seed failed — network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Reset or populate your Stagent instance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Delete all projects, tasks, documents, agent logs, notifications,
                and uploaded files. Authentication settings are preserved.
              </p>
              <Badge variant="destructive" className="shrink-0">Irreversible</Badge>
            </div>
            <Button
              variant="destructive"
              onClick={() => setClearOpen(true)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Clear All Data
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Populate with 5 realistic projects, 25 tasks across varied
              statuses, 5 workflows, 12 documents (XLSX, PDF, DOCX, PPTX),
              agent logs, and notifications. Existing data is cleared first.
            </p>
            <Button
              variant="outline"
              onClick={() => setSeedOpen(true)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Seed Sample Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all data?"
        description="This will permanently delete all projects, tasks, documents, agent logs, notifications, and uploaded files. Authentication settings will be preserved. This action cannot be undone."
        confirmLabel="Clear All Data"
        onConfirm={handleClear}
        destructive
      />

      <ConfirmDialog
        open={seedOpen}
        onOpenChange={setSeedOpen}
        title="Seed sample data?"
        description="This will clear all existing data first, then populate with 5 projects, 25 tasks, 5 workflows, 12 documents (XLSX, PDF, DOCX, PPTX), agent logs, and notifications. Any current data will be lost."
        confirmLabel="Seed Data"
        onConfirm={handleSeed}
      />
    </>
  );
}
