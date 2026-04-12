"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface UninstallPreview {
  app: { appId: string; name: string; version: string; status: string };
  resources: {
    tables: { name: string; rowCount: number }[];
    schedules: string[];
    triggers: string[];
    savedViews: string[];
    notificationCount: number;
  };
  linkedProject: { id: string; name: string } | null;
}

interface UninstallConfirmationDialogProps {
  appId: string;
  appName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteProject: boolean) => void;
  uninstalling: boolean;
}

const RESOURCE_SECTIONS: {
  key: keyof UninstallPreview["resources"];
  label: string;
  color: string;
}[] = [
  { key: "tables", label: "Tables", color: "bg-blue-500" },
  { key: "schedules", label: "Schedules", color: "bg-amber-500" },
  { key: "triggers", label: "Triggers", color: "bg-rose-500" },
  { key: "savedViews", label: "Saved Views", color: "bg-cyan-500" },
];

export function UninstallConfirmationDialog({
  appId,
  appName,
  open,
  onOpenChange,
  onConfirm,
  uninstalling,
}: UninstallConfirmationDialogProps) {
  const [preview, setPreview] = useState<UninstallPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteProject, setDeleteProject] = useState(false);

  useEffect(() => {
    if (!open) {
      setDeleteProject(false);
      return;
    }
    setLoading(true);
    fetch(`/api/apps/${appId}/uninstall-preview`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPreview(data as UninstallPreview))
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [open, appId]);

  const totalRows =
    preview?.resources.tables.reduce((sum, t) => sum + t.rowCount, 0) ?? 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Uninstall {appName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review what will be removed from your instance.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : preview ? (
          <div className="space-y-4 max-h-80 overflow-y-auto py-2">
            {/* Version info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Version {preview.app.version}</span>
              <span>Status: {preview.app.status}</span>
            </div>

            {/* Resources to remove */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What will be removed
              </h3>

              {RESOURCE_SECTIONS.map(({ key, label, color }) => {
                const items = preview.resources[key];
                if (key === "tables") {
                  const tables = items as UninstallPreview["resources"]["tables"];
                  if (tables.length === 0) return null;
                  return (
                    <div key={key}>
                      <div className="text-xs font-medium mb-1">
                        {tables.length} {tables.length === 1 ? "Table" : "Tables"}
                        {totalRows > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({totalRows.toLocaleString()} total rows)
                          </span>
                        )}
                      </div>
                      <ul className="space-y-0.5">
                        {tables.map((t) => (
                          <li key={t.name} className="text-sm flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${color} shrink-0`} />
                            {t.name}
                            <span className="text-muted-foreground text-xs">
                              ({t.rowCount} rows)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }

                const names = items as string[];
                if (names.length === 0) return null;
                return (
                  <div key={key}>
                    <div className="text-xs font-medium mb-1">
                      {names.length} {names.length === 1 ? label.replace(/s$/, "") : label}
                    </div>
                    <ul className="space-y-0.5">
                      {names.map((name) => (
                        <li key={name} className="text-sm flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${color} shrink-0`} />
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {preview.resources.notificationCount > 0 && (
                <div className="text-xs font-medium">
                  {preview.resources.notificationCount} Notification{preview.resources.notificationCount !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {/* Project deletion option */}
            {preview.linkedProject && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="delete-project"
                    checked={deleteProject}
                    onCheckedChange={(checked) =>
                      setDeleteProject(checked === true)
                    }
                  />
                  <Label
                    htmlFor="delete-project"
                    className="text-sm leading-tight cursor-pointer"
                  >
                    Also delete project &ldquo;{preview.linkedProject.name}&rdquo;
                    and all its data (tasks, workflows, conversations)
                  </Label>
                </div>
                {deleteProject && (
                  <p className="text-xs text-destructive ml-6">
                    This is irreversible. All project data will be permanently deleted.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Unable to load app details. You can still proceed with the uninstall.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={uninstalling}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => onConfirm(deleteProject)}
            disabled={uninstalling || loading}
          >
            {uninstalling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uninstalling...
              </>
            ) : deleteProject ? (
              "Uninstall & Delete Project"
            ) : (
              "Uninstall"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
