"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { AppCatalogEntry } from "@/lib/apps/types";
import { resolveAppIcon } from "@/lib/apps/icons";

interface AppMarketplaceBrowserProps {
  canInstall: boolean;
}

export function AppMarketplaceBrowser({ canInstall }: AppMarketplaceBrowserProps) {
  const [apps, setApps] = useState<AppCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);

  async function loadApps() {
    setLoading(true);
    try {
      const res = await fetch("/api/apps/catalog");
      const data = (await res.json()) as { apps?: AppCatalogEntry[] };
      setApps(data.apps ?? []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApps();
  }, []);

  async function handleInstall(appId: string) {
    setInstalling(appId);
    try {
      const res = await fetch("/api/apps/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId }),
      });
      const data = (await res.json()) as {
        app?: { openHref?: string };
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Install failed");
      }

      toast.success("App installed and bootstrapped.");
      await loadApps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to install app");
    } finally {
      setInstalling(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((idx) => (
          <div key={idx} className="surface-card-muted h-52 animate-pulse rounded-xl border" />
        ))}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        heading="No apps available"
        description="Verified runtime bundles will appear here once they are added to the catalog."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {apps.map((app) => {
        const Icon = resolveAppIcon(app.icon);
        const isInstalling = installing === app.appId;

        return (
          <div key={app.appId} className="surface-card rounded-xl border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="surface-card-muted flex h-10 w-10 items-center justify-center rounded-lg border">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{app.name}</h3>
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      {app.trustLevel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{app.description}</p>
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {app.category}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{app.tableCount} tables</span>
              <span>{app.scheduleCount} schedules</span>
              <span>{app.profileCount} profiles</span>
              <span>{app.blueprintCount} blueprints</span>
              <span>~{app.estimatedSetupMinutes} min</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {app.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {app.installed
                  ? `Installed • ${app.installedStatus}`
                  : "Project-bound runtime bundle"}
              </div>
              <div className="flex items-center gap-2">
                {app.installed ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/apps/${app.appId}`}>Open</Link>
                  </Button>
                ) : canInstall ? (
                  <Button
                    size="sm"
                    onClick={() => handleInstall(app.appId)}
                    disabled={isInstalling}
                  >
                    {isInstalling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Install
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    Solo+ required
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
