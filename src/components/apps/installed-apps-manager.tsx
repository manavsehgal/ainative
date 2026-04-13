"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveAppIcon } from "@/lib/apps/icons";

interface InstalledAppSummary {
  appId: string;
  name: string;
  version: string;
  projectId: string | null;
  status: string;
  bootstrapError: string | null;
  installedAt: string | Date;
  bootstrappedAt: string | Date | null;
  icon: string;
  projectHref: string | null;
  openHref: string;
}

interface InstalledAppsManagerProps {
  initialApps: InstalledAppSummary[];
}

export function InstalledAppsManager({ initialApps }: InstalledAppsManagerProps) {
  const router = useRouter();
  const [apps, setApps] = useState(initialApps);
  const [pendingAppId, setPendingAppId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function mutate(appId: string, action: "disable" | "enable" | "uninstall") {
    setPendingAppId(appId);
    try {
      const res = await fetch(`/api/apps/${appId}/${action}`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to ${action} app`);
      }

      if (action === "uninstall") {
        setApps((current) => current.filter((app) => app.appId !== appId));
      } else {
        setApps((current) =>
          current.map((app) =>
            app.appId === appId
              ? { ...app, status: action === "disable" ? "disabled" : "ready" }
              : app
          )
        );
      }

      toast.success(
        action === "uninstall"
          ? "App uninstalled. Project data was preserved."
          : `App ${action}d.`
      );
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} app`);
    } finally {
      setPendingAppId(null);
    }
  }

  if (apps.length === 0) {
    return (
      <div className="surface-card rounded-xl border p-6">
        <h2 className="text-base font-semibold">Installed Apps</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No runtime bundles are installed yet. Browse verified apps in the marketplace.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/marketplace">Browse marketplace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {apps.map((app) => {
        const Icon = resolveAppIcon(app.icon);
        const busy = pendingAppId === app.appId || isPending;

        return (
          <div key={app.appId} className="surface-card rounded-xl border p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <div className="surface-card-muted flex h-10 w-10 items-center justify-center rounded-lg border">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{app.name}</h2>
                    <Badge variant={app.status === "ready" ? "success" : "outline"}>
                      {app.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">v{app.version}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Installed {new Date(app.installedAt).toLocaleDateString()}
                    {app.projectId ? " • project-linked" : ""}
                  </p>
                  {app.bootstrapError ? (
                    <p className="text-xs text-status-failed">{app.bootstrapError}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={app.openHref}>Open</Link>
                </Button>
                {app.projectHref ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={app.projectHref}>Project</Link>
                  </Button>
                ) : null}
                {app.status === "disabled" ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => mutate(app.appId, "enable")}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Enable
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => mutate(app.appId, "disable")}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Disable
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => mutate(app.appId, "uninstall")}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Uninstall
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
