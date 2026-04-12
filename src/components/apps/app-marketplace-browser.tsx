"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  Download,
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Store,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import type { AppCatalogEntry, AppDifficulty, AppTrustLevel } from "@/lib/apps/types";
import { resolveAppIcon } from "@/lib/apps/icons";
import { PublishAppSheet } from "@/components/marketplace/publish-app-sheet";

interface AppMarketplaceBrowserProps {
  canInstall: boolean;
  canPublish?: boolean;
}

const APP_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "finance", label: "Finance" },
  { value: "sales", label: "Sales" },
  { value: "content", label: "Content" },
  { value: "dev", label: "Dev" },
  { value: "automation", label: "Automation" },
  { value: "general", label: "General" },
];

const DIFFICULTY_MAP: Record<AppDifficulty, number> = {
  beginner: 1,
  intermediate: 3,
  advanced: 5,
};

const TRUST_CONFIG: Record<AppTrustLevel, { icon: typeof Shield; color: string; label: string }> = {
  official: { icon: ShieldCheck, color: "text-amber-500", label: "Official" },
  verified: { icon: ShieldCheck, color: "text-emerald-500", label: "Verified" },
  community: { icon: Shield, color: "text-blue-500", label: "Community" },
  private: { icon: ShieldAlert, color: "text-muted-foreground", label: "Private" },
};

function DifficultyDots({ difficulty }: { difficulty: AppDifficulty }) {
  const filled = DIFFICULTY_MAP[difficulty] ?? 1;
  return (
    <div className="flex items-center gap-0.5" title={`${difficulty} (${filled}/5)`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            i < filled ? "bg-foreground/70" : "bg-foreground/15"
          }`}
        />
      ))}
    </div>
  );
}

function TrustBadge({ level }: { level: AppTrustLevel }) {
  const config = TRUST_CONFIG[level] ?? TRUST_CONFIG.community;
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-1 ${config.color}`} title={config.label}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[10px] font-medium uppercase tracking-wide">{config.label}</span>
    </div>
  );
}

function AppCard({
  app,
  canInstall,
  installing,
  onInstall,
  onPublish,
}: {
  app: AppCatalogEntry;
  canInstall: boolean;
  installing: boolean;
  onInstall: (appId: string) => void;
  onPublish?: (app: AppCatalogEntry) => void;
}) {
  const Icon = resolveAppIcon(app.icon);

  return (
    <div className="surface-card rounded-xl border p-5 flex flex-col">
      {/* Header — clickable to detail page */}
      <Link
        href={`/marketplace/apps/${app.appId}`}
        className="flex items-start justify-between gap-3 group"
      >
        <div className="flex items-start gap-3">
          <div className="surface-card-muted flex h-10 w-10 items-center justify-center rounded-lg border shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-sm font-semibold group-hover:underline">{app.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{app.description}</p>
          </div>
        </div>
        <Badge variant="outline" className="capitalize shrink-0">
          {app.category}
        </Badge>
      </Link>

      {/* Metadata row */}
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <DifficultyDots difficulty={app.difficulty} />
        <span>{app.tableCount} {app.tableCount === 1 ? "table" : "tables"}</span>
        <span>{app.scheduleCount} {app.scheduleCount === 1 ? "schedule" : "schedules"}</span>
        <span>~{app.estimatedSetupMinutes}m</span>
      </div>

      {/* Trust + tags */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <TrustBadge level={app.trustLevel} />
        <div className="flex flex-wrap gap-1">
          {app.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Footer — install/open */}
      <div className="mt-auto pt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {app.installed
            ? `Installed \u00b7 ${app.installedStatus}`
            : `v${app.version}`}
        </div>
        <div className="flex items-center gap-2">
          {app.installed ? (
            <div className="flex items-center gap-1.5">
              {onPublish && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.preventDefault(); onPublish(app); }}
                  title="Publish to marketplace"
                >
                  <Upload className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link href={`/apps/${app.appId}`}>Open</Link>
              </Button>
            </div>
          ) : canInstall ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                onInstall(app.appId);
              }}
              disabled={installing}
            >
              {installing ? (
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
}

export function AppMarketplaceBrowser({ canInstall, canPublish }: AppMarketplaceBrowserProps) {
  const [apps, setApps] = useState<AppCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [publishApp, setPublishApp] = useState<AppCatalogEntry | null>(null);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (category !== "all") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [category, searchQuery]);

  async function loadApps() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const qs = params.toString();
      const res = await fetch(`/api/apps/catalog${qs ? `?${qs}` : ""}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, searchQuery]);

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

  function handleClearFilters() {
    setCategory("all");
    setSearchQuery("");
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <FilterBar activeCount={activeFilterCount} onClear={handleClearFilters}>
        {APP_CATEGORIES.map((cat) => (
          <Badge
            key={cat.value}
            variant={category === cat.value ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setCategory(cat.value)}
          >
            {cat.label}
          </Badge>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 w-48 pl-8 text-xs"
          />
        </div>
      </FilterBar>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="surface-card-muted h-52 animate-pulse rounded-xl border" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={Store}
          heading="No apps found"
          description={
            activeFilterCount > 0
              ? "No apps match your current filters. Try broadening your search."
              : "Verified runtime bundles will appear here once they are added to the catalog."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <AppCard
              key={app.appId}
              app={app}
              canInstall={canInstall}
              installing={installing === app.appId}
              onInstall={handleInstall}
              onPublish={canPublish ? (a) => setPublishApp(a) : undefined}
            />
          ))}
        </div>
      )}

      {/* Publish sheet */}
      <PublishAppSheet
        open={publishApp !== null}
        onOpenChange={(open) => { if (!open) setPublishApp(null); }}
        app={publishApp}
        onPublished={loadApps}
      />
    </div>
  );
}
