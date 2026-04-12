"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WhatsIncluded {
  tables: string[];
  schedules: string[];
  profiles: string[];
  blueprints: string[];
  triggers: string[];
  savedViews: string[];
  envVars: string[];
  setupChecklist: string[];
}

interface AppDetail {
  app: {
    appId: string;
    name: string;
    version: string;
    permissions: string[];
    estimatedSetupMinutes: number;
    difficulty: string;
    trustLevel: string;
  };
  whatsIncluded: WhatsIncluded | null;
}

interface InstallConfirmationDialogProps {
  appId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  installing: boolean;
}

const ARTIFACT_SECTIONS: { key: keyof WhatsIncluded; label: string; color: string }[] = [
  { key: "tables", label: "Tables", color: "bg-blue-500" },
  { key: "schedules", label: "Schedules", color: "bg-amber-500" },
  { key: "profiles", label: "Profiles", color: "bg-emerald-500" },
  { key: "blueprints", label: "Blueprints", color: "bg-purple-500" },
  { key: "triggers", label: "Triggers", color: "bg-rose-500" },
  { key: "savedViews", label: "Saved Views", color: "bg-cyan-500" },
  { key: "envVars", label: "Environment Variables", color: "bg-orange-500" },
];

export function InstallConfirmationDialog({
  appId,
  open,
  onOpenChange,
  onConfirm,
  installing,
}: InstallConfirmationDialogProps) {
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/apps/catalog/${appId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setDetail(data as AppDetail))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, appId]);

  const included = detail?.whatsIncluded;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Install {detail?.app.name ?? "App"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review what this app will create on your instance before proceeding.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <div className="space-y-4 max-h-80 overflow-y-auto py-2">
            {/* Version + setup time */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Version {detail.app.version}</span>
              <span>~{detail.app.estimatedSetupMinutes} min setup</span>
              <span className="capitalize">{detail.app.difficulty}</span>
            </div>

            {/* What will be created */}
            {included && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What will be created
                </h3>
                {ARTIFACT_SECTIONS.map(({ key, label, color }) => {
                  const items = included[key];
                  if (!Array.isArray(items) || items.length === 0) return null;
                  return (
                    <div key={key}>
                      <div className="text-xs font-medium mb-1">{items.length} {items.length === 1 ? label.replace(/s$/, "") : label}</div>
                      <ul className="space-y-0.5">
                        {items.map((item) => (
                          <li key={item} className="text-sm flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${color} shrink-0`} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Permissions */}
            {detail.app.permissions.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Permissions required
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {detail.app.permissions.map((perm) => (
                    <Badge key={perm} variant="outline" className="text-[10px] font-mono">
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Unable to load app details. You can still proceed with the install.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={installing}>Cancel</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={installing || loading}>
            {installing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              "Confirm Install"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
