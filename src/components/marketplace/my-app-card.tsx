"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveAppIcon } from "@/lib/apps/icons";
import { AppUninstallButton } from "@/components/apps/app-uninstall-button";
import { DeleteAppConfirmationDialog } from "@/components/apps/delete-app-confirmation-dialog";
import type { MyAppEntry } from "@/lib/apps/types";

interface MyAppCardProps {
  app: MyAppEntry;
  onRemoved: (appId: string) => void;
  onStateChange: () => void;
}

const STATE_BADGE: Record<
  MyAppEntry["state"],
  { label: string; variant: "success" | "secondary" | "destructive" | "outline" }
> = {
  installed: { label: "Installed", variant: "success" },
  archived: { label: "Archived", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  corrupt: { label: "Corrupt", variant: "outline" },
};

export function MyAppCard({ app, onRemoved, onStateChange }: MyAppCardProps) {
  const Icon = resolveAppIcon(app.icon);
  const badge = STATE_BADGE[app.state];

  const [reinstalling, setReinstalling] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleReinstall() {
    setReinstalling(true);
    try {
      const res = await fetch(`/api/apps/my/${app.appId}/reinstall`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Reinstall failed");
      toast.success(`${app.name} reinstalled successfully!`);
      onStateChange();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reinstall app",
      );
    } finally {
      setReinstalling(false);
    }
  }

  async function handleDelete(deleteProject: boolean) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/apps/my/${app.appId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteProject }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success(`${app.name} permanently deleted.`);
      setShowDelete(false);
      onRemoved(app.appId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete app",
      );
    } finally {
      setDeleting(false);
    }
  }

  const isArchived = app.state === "archived";
  const isCorrupt = app.state === "corrupt";

  return (
    <div
      className={`surface-card rounded-xl border p-5 flex flex-col ${
        isArchived ? "opacity-70" : ""
      } ${app.state === "failed" ? "border-l-4 border-l-destructive/30" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="surface-card-muted flex h-10 w-10 items-center justify-center rounded-lg border shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">{app.name}</h3>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {app.description}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="capitalize shrink-0">
          {app.category}
        </Badge>
      </div>

      {/* Bootstrap error */}
      {app.bootstrapError && app.state === "failed" && (
        <p className="mt-2 text-xs text-destructive line-clamp-2">
          {app.bootstrapError}
        </p>
      )}

      {/* Metadata row */}
      {!isCorrupt && (
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span>v{app.version}</span>
          <span>
            {app.tableCount} {app.tableCount === 1 ? "table" : "tables"}
          </span>
          <span>
            {app.scheduleCount}{" "}
            {app.scheduleCount === 1 ? "schedule" : "schedules"}
          </span>
        </div>
      )}

      {/* Tags */}
      {app.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {app.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer — actions per state */}
      <div className="mt-auto pt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {app.installedAt
            ? `Installed ${new Date(app.installedAt).toLocaleDateString()}`
            : isCorrupt
              ? "Package damaged"
              : "Not installed"}
        </div>
        <div className="flex items-center gap-2">
          {/* Installed: Open + Uninstall */}
          {app.state === "installed" && (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href={`/apps/${app.appId}`}>Open</Link>
              </Button>
              <AppUninstallButton
                appId={app.appId}
                appName={app.name}
                size="sm"
                variant="ghost"
                redirectTo="/marketplace?tab=myapps"
              />
            </>
          )}

          {/* Archived: Reinstall + Delete */}
          {app.state === "archived" && (
            <>
              <Button
                size="sm"
                onClick={handleReinstall}
                disabled={reinstalling}
              >
                {reinstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Re-install
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Failed: Retry + Delete */}
          {app.state === "failed" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReinstall}
                disabled={reinstalling}
              >
                {reinstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Retry
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Corrupt: Delete only */}
          {app.state === "corrupt" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteAppConfirmationDialog
        appId={app.appId}
        appName={app.name}
        isInstalled={app.state === "installed" || app.state === "failed"}
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
