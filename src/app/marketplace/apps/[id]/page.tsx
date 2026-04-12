import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/shared/page-shell";
import { getAppCatalogEntry } from "@/lib/apps/service";
import { getAppBundle } from "@/lib/apps/registry";
import { resolveAppIcon } from "@/lib/apps/icons";
import { AppDetailInstallButton } from "@/components/marketplace/app-detail-install-button";
import type { AppDifficulty, AppTrustLevel } from "@/lib/apps/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const DIFFICULTY_LABELS: Record<AppDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const TRUST_LABELS: Record<AppTrustLevel, string> = {
  official: "Official",
  verified: "Verified",
  community: "Community",
  private: "Private",
};

export default async function AppDetailPage({ params }: Props) {
  const { id } = await params;
  const entry = getAppCatalogEntry(id);

  if (!entry) {
    notFound();
  }

  const bundle = getAppBundle(id);
  const Icon = resolveAppIcon(entry.icon);

  const artifactCounts = bundle
    ? [
        { label: "Tables", count: bundle.tables.length },
        { label: "Schedules", count: bundle.schedules.length },
        { label: "Profiles", count: bundle.profiles.length },
        { label: "Blueprints", count: bundle.blueprints.length },
        { label: "Triggers", count: bundle.triggers?.length ?? 0 },
        { label: "Saved Views", count: bundle.savedViews?.length ?? 0 },
        { label: "Env Vars", count: bundle.envVars?.length ?? 0 },
      ].filter((a) => a.count > 0)
    : [];

  return (
    <PageShell
      backHref="/marketplace"
      backLabel="Marketplace"
    >
      {/* Hero section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="surface-card-muted flex h-16 w-16 items-center justify-center rounded-xl border shrink-0">
            <Icon className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{entry.name}</h1>
              <Badge variant="outline" className="capitalize">
                {entry.category}
              </Badge>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                {TRUST_LABELS[entry.trustLevel]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {entry.description}
            </p>
          </div>
        </div>

        {/* Install / Open button */}
        <div className="shrink-0">
          {entry.installed ? (
            <Link
              href={`/apps/${entry.appId}`}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open App
            </Link>
          ) : (
            <AppDetailInstallButton appId={entry.appId} appName={entry.name} />
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* What's Included */}
          {artifactCounts.length > 0 && (
            <div className="surface-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-4">What&apos;s Included</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {artifactCounts.map((a) => (
                  <div key={a.label} className="surface-card-muted rounded-lg border p-3 text-center">
                    <div className="text-2xl font-semibold">{a.count}</div>
                    <div className="text-xs text-muted-foreground mt-1">{a.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed artifacts */}
          {bundle && (
            <div className="surface-card rounded-xl border p-5 space-y-4">
              <h2 className="text-sm font-semibold">Artifacts</h2>

              {bundle.tables.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Tables</h3>
                  <ul className="space-y-1">
                    {bundle.tables.map((t) => (
                      <li key={t.key} className="text-sm flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="font-medium">{t.name}</span>
                        {t.description && (
                          <span className="text-muted-foreground text-xs">— {t.description}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {bundle.schedules.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Schedules</h3>
                  <ul className="space-y-1">
                    {bundle.schedules.map((s) => (
                      <li key={s.key} className="text-sm flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground text-xs font-mono">{s.cronExpression}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {bundle.profiles.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Agent Profiles</h3>
                  <ul className="space-y-1">
                    {bundle.profiles.map((p) => (
                      <li key={p.id} className="text-sm flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-medium">{p.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(bundle.triggers?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Triggers</h3>
                  <ul className="space-y-1">
                    {bundle.triggers!.map((t) => (
                      <li key={t.key} className="text-sm flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                        <span className="font-medium">{t.name}</span>
                        <span className="text-muted-foreground text-xs">on {t.event}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Permissions */}
          {entry.permissions.length > 0 && (
            <div className="surface-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-3">Permissions Required</h2>
              <div className="flex flex-wrap gap-2">
                {entry.permissions.map((perm) => (
                  <Badge key={perm} variant="outline" className="text-xs font-mono">
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Setup checklist */}
          {bundle && bundle.setupChecklist.length > 0 && (
            <div className="surface-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-3">Setup Checklist</h2>
              <ol className="space-y-2 list-decimal list-inside">
                {bundle.setupChecklist.map((step, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <div className="surface-card rounded-xl border p-5 space-y-4">
            <h2 className="text-sm font-semibold">Details</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">{entry.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="capitalize">{entry.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Difficulty</span>
                <span>{DIFFICULTY_LABELS[entry.difficulty]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Setup Time</span>
                <span>~{entry.estimatedSetupMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trust Level</span>
                <span>{TRUST_LABELS[entry.trustLevel]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{entry.installed ? `Installed (${entry.installedStatus})` : "Not installed"}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="surface-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
