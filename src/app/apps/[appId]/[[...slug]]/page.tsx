import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageShell } from "@/components/shared/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { getAppInstance } from "@/lib/apps/service";
import { resolveAppIcon } from "@/lib/apps/icons";
import { getTable, listRows } from "@/lib/data/tables";
import { AppActionButtons } from "@/components/apps/app-action-buttons";
import { AppUninstallButton } from "@/components/apps/app-uninstall-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ appId: string; slug?: string[] }>;
}

function summarizeMetricValue(tableRows: Awaited<ReturnType<typeof listRows>>, aggregation: "rowCount" | "sampleCount") {
  if (aggregation === "rowCount") {
    return tableRows.length;
  }

  return tableRows.filter((row) => {
    try {
      const data = JSON.parse(row.data) as Record<string, unknown>;
      return data._sample === true;
    } catch {
      return false;
    }
  }).length;
}

export default async function AppRuntimePage({ params }: Props) {
  const { appId, slug } = await params;
  const instance = getAppInstance(appId);

  if (!instance) {
    notFound();
  }

  const currentPath = slug?.[0] ?? "";
  const page = instance.ui.pages.find((entry) => (entry.path ?? "") === currentPath);

  if (!page) {
    notFound();
  }

  const scheduleIds = Object.values(instance.resourceMap.schedules);
  const scheduleRows =
    scheduleIds.length > 0
      ? db.select().from(schedules).where(inArray(schedules.id, scheduleIds)).all()
      : [];

  const tableRowsByKey = new Map<string, Awaited<ReturnType<typeof listRows>>>();
  const tableMetaByKey = new Map<string, { id: string; name: string; rowCount: number }>();

  for (const table of instance.bundle.tables) {
    const tableId = instance.resourceMap.tables[table.key];
    if (!tableId) continue;

    const installedTable = await getTable(tableId);
    const rows = await listRows(tableId, { limit: 20 });
    tableRowsByKey.set(table.key, rows);

    if (installedTable) {
      tableMetaByKey.set(table.key, {
        id: installedTable.id,
        name: installedTable.name,
        rowCount: installedTable.rowCount,
      });
    }
  }

  if (instance.status === "failed") {
    return (
      <PageShell
        title={instance.name}
        description="Bootstrap failed. Retry from Settings → Installed Apps after fixing the issue."
        backHref="/settings/apps"
        backLabel="Installed Apps"
      >
        <Card>
          <CardHeader>
            <CardTitle>Bootstrap failed</CardTitle>
            <CardDescription>{instance.bootstrapError ?? "Unknown bootstrap error."}</CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  if (instance.status === "disabled") {
    return (
      <PageShell
        title={instance.name}
        description="This app is disabled. Re-enable it from Settings → Installed Apps."
        backHref="/settings/apps"
        backLabel="Installed Apps"
      >
        <Card>
          <CardHeader>
            <CardTitle>App disabled</CardTitle>
            <CardDescription>
              The project data is still present, but this runtime bundle is hidden from the sidebar until re-enabled.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={instance.name}
      description={page.description ?? instance.manifest.description}
      backHref="/marketplace"
      backLabel="Marketplace"
      actions={
        <div className="flex items-center gap-2">
          {instance.projectId && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${instance.projectId}`}>Open project</Link>
            </Button>
          )}
          <AppUninstallButton
            appId={instance.appId}
            appName={instance.name}
            variant="ghost"
            size="sm"
            redirectTo="/marketplace"
          />
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {instance.ui.pages.map((entry) => {
          const href = `/apps/${instance.appId}${entry.path ? `/${entry.path}` : ""}`;
          const active = entry.key === page.key;

          return (
            <Button
              key={entry.key}
              asChild
              size="sm"
              variant={active ? "default" : "outline"}
            >
              <Link href={href}>{entry.title}</Link>
            </Button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {page.widgets.map((widget, index) => {
          if (widget.type === "hero") {
            const Icon = resolveAppIcon(instance.manifest.icon);

            return (
              <Card key={`${widget.type}-${index}`} className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {widget.eyebrow ? <Badge variant="secondary">{widget.eyebrow}</Badge> : null}
                    <Badge variant="outline">{instance.manifest.category}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="surface-card-muted flex h-10 w-10 items-center justify-center rounded-lg border">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>{widget.title}</CardTitle>
                      <CardDescription>{widget.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          }

          if (widget.type === "stats") {
            return (
              <Card key={`${widget.type}-${index}`}>
                <CardHeader>
                  <CardTitle>{widget.title ?? "Metrics"}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  {widget.metrics.map((metric) => {
                    const rows = tableRowsByKey.get(metric.tableKey) ?? [];
                    const value = summarizeMetricValue(rows, metric.aggregation);

                    return (
                      <div key={metric.key} className="surface-card-muted rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">{metric.label}</div>
                        <div className="mt-1 text-2xl font-semibold">{value}</div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          }

          if (widget.type === "actions") {
            return (
              <Card key={`${widget.type}-${index}`}>
                <CardHeader>
                  <CardTitle>{widget.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {widget.actions.map((action) => (
                      <div key={action.key}>
                        <div className="text-sm font-medium">{action.label}</div>
                        {action.description ? (
                          <div className="text-xs text-muted-foreground">{action.description}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <AppActionButtons
                    appId={instance.appId}
                    projectId={instance.projectId}
                    resourceMap={instance.resourceMap}
                    actions={widget.actions}
                  />
                </CardContent>
              </Card>
            );
          }

          if (widget.type === "linkedAssets") {
            return (
              <Card key={`${widget.type}-${index}`}>
                <CardHeader>
                  <CardTitle>{widget.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {widget.showProfiles ? (
                    <div>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Profiles
                      </div>
                      <div className="space-y-2">
                        {instance.bundle.profiles.map((profile) => (
                          <div key={profile.id} className="surface-card-muted rounded-lg border p-3">
                            <div className="text-sm font-medium">{profile.label}</div>
                            {profile.description ? (
                              <div className="text-xs text-muted-foreground">{profile.description}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {widget.showBlueprints ? (
                    <div>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Blueprints
                      </div>
                      <div className="space-y-2">
                        {instance.bundle.blueprints.map((blueprint) => (
                          <div key={blueprint.id} className="surface-card-muted rounded-lg border p-3">
                            <div className="text-sm font-medium">{blueprint.label}</div>
                            {blueprint.description ? (
                              <div className="text-xs text-muted-foreground">{blueprint.description}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          }

          if (widget.type === "scheduleList") {
            return (
              <Card key={`${widget.type}-${index}`}>
                <CardHeader>
                  <CardTitle>{widget.title}</CardTitle>
                  {widget.description ? (
                    <CardDescription>{widget.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  {scheduleRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No schedules installed.</div>
                  ) : (
                    scheduleRows.map((schedule) => (
                      <div key={schedule.id} className="surface-card-muted rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">{schedule.name}</div>
                          <Badge variant="outline">{schedule.status}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {schedule.cronExpression}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          }

          if (widget.type === "table") {
            const rows = tableRowsByKey.get(widget.tableKey) ?? [];
            const meta = tableMetaByKey.get(widget.tableKey);
            const previewColumns =
              widget.columns ?? instance.bundle.tables.find((table) => table.key === widget.tableKey)?.columns.map((column) => column.name) ?? [];

            return (
              <Card key={`${widget.type}-${index}`} className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>{widget.title}</CardTitle>
                      {widget.description ? (
                        <CardDescription>{widget.description}</CardDescription>
                      ) : null}
                    </div>
                    {meta ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/tables/${meta.id}`}>Open table</Link>
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  {rows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No rows available.</div>
                  ) : (
                    <div className="surface-scroll overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            {previewColumns.map((column) => (
                              <th key={column} className="px-3 py-2 font-medium">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, widget.limit ?? 8).map((row) => {
                            const parsed = JSON.parse(row.data) as Record<string, unknown>;
                            return (
                              <tr key={row.id} className="border-t">
                                {previewColumns.map((column) => (
                                  <td key={`${row.id}-${column}`} className="px-3 py-2 align-top">
                                    {String(parsed[column] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={`${widget.type}-${index}`} className="lg:col-span-2">
              <CardHeader>
                {widget.title ? <CardTitle>{widget.title}</CardTitle> : null}
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {widget.markdown}
                </ReactMarkdown>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
