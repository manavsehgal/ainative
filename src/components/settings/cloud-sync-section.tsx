"use client";

import { useState, useEffect } from "react";
import { Cloud, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SyncSession {
  id: string;
  device_name: string;
  sync_type: string;
  blob_size_bytes: number;
  created_at: string;
}

export function CloudSyncSection() {
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetch("/api/sync/sessions")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => {});
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/sync/export", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Backup uploaded (${formatBytes(data.sizeBytes)})`);
        // Refresh sessions
        const sessRes = await fetch("/api/sync/sessions");
        if (sessRes.ok) setSessions((await sessRes.json()).sessions ?? []);
      } else {
        toast.error(data.error ?? "Export failed");
      }
    } catch {
      toast.error("Failed to export");
    } finally {
      setExporting(false);
    }
  }

  async function handleRestore() {
    if (!confirm("This will replace your local database with the latest cloud backup. A safety backup will be created first. Continue?")) {
      return;
    }
    setRestoring(true);
    try {
      const res = await fetch("/api/sync/restore", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Database restored. Restart the app to apply changes.");
      } else {
        toast.error(data.error ?? "Restore failed");
      }
    } catch {
      toast.error("Failed to restore");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Cloud Sync
        </CardTitle>
        <CardDescription>
          Encrypted database backup and restore via Supabase Storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || restoring}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {exporting ? "Exporting..." : "Backup Now"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestore}
            disabled={exporting || restoring || sessions.length === 0}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {restoring ? "Restoring..." : "Restore Latest"}
          </Button>
        </div>

        {sessions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Recent Syncs</h4>
            <div className="space-y-1">
              {sessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={s.sync_type === "backup" ? "secondary" : "outline"} className="text-[10px]">
                      {s.sync_type}
                    </Badge>
                    <span className="text-muted-foreground">{s.device_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{formatBytes(s.blob_size_bytes)}</span>
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No backups yet. Click "Backup Now" to create your first encrypted cloud backup.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
