import { notFound } from "next/navigation";
import { PageShell } from "@/components/shared/page-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Workflow, Table2, Clock } from "lucide-react";
import { AppDetailActions } from "@/components/apps/app-detail-actions";
import { getApp } from "@/lib/apps/registry";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = getApp(id);
  if (!app) notFound();

  const m = app.manifest;

  return (
    <PageShell
      title={app.name}
      description={app.description ?? "Composed app"}
      backHref="/apps"
      backLabel="All apps"
      actions={
        <div className="flex items-center gap-2">
          <StatusChip status="running" size="md" />
          <AppDetailActions
            appId={app.id}
            appName={app.name}
            tableCount={app.tableCount}
            scheduleCount={app.scheduleCount}
            fileCount={app.files.length}
          />
        </div>
      }
    >
      <div className="space-y-6">
        <Section title="Composition" icon={Bot}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {m.profiles.length > 0 && (
              <ArtifactList
                heading="Profiles"
                icon={Bot}
                items={m.profiles.map((p) => p.id)}
              />
            )}
            {m.blueprints.length > 0 && (
              <ArtifactList
                heading="Blueprints"
                icon={Workflow}
                items={m.blueprints.map((b) => b.id)}
              />
            )}
            {m.tables.length > 0 && (
              <ArtifactList
                heading="Tables"
                icon={Table2}
                items={m.tables.map((t) => t.id)}
              />
            )}
            {m.schedules.length > 0 && (
              <ArtifactList
                heading="Schedules"
                icon={Clock}
                items={m.schedules.map((s) =>
                  s.cron ? `${s.id} (${s.cron})` : s.id
                )}
              />
            )}
          </div>
        </Section>

        {app.files.length > 0 && (
          <Section title="Files">
            <Card>
              <CardContent className="p-4">
                <ul className="space-y-1 text-xs font-mono text-muted-foreground">
                  {app.files.map((f) => (
                    <li key={f} className="truncate" title={f}>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground/60">
                  Informational — these files are written under your control. No approval required.
                </p>
              </CardContent>
            </Card>
          </Section>
        )}
      </div>
    </PageShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function ArtifactList({
  heading,
  icon: Icon,
  items,
}: {
  heading: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {heading} ({items.length})
        </div>
        <ul className="space-y-1 text-sm">
          {items.map((x) => (
            <li key={x} className="font-mono text-xs truncate" title={x}>
              {x}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
