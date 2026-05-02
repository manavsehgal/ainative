import { notFound } from "next/navigation";
import { PageShell } from "@/components/shared/page-shell";
import { AppDetailActions } from "@/components/apps/app-detail-actions";
import { KitView } from "@/components/apps/kit-view/kit-view";
import { getApp } from "@/lib/apps/registry";
import { pickKit } from "@/lib/apps/view-kits";
import { resolveBindings } from "@/lib/apps/view-kits/resolve";
import { loadRuntimeState } from "@/lib/apps/view-kits/data";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = getApp(id);
  if (!app) notFound();

  const kit = pickKit(app.manifest, []);
  const bindings = resolveBindings(app.manifest);
  const projection = kit.resolve({ manifest: app.manifest, columns: [] });
  const runtime = await loadRuntimeState(app, bindings);
  const model = kit.buildModel(projection, runtime);

  model.header.actions = (
    <AppDetailActions
      appId={app.id}
      appName={app.name}
      tableCount={app.tableCount}
      scheduleCount={app.scheduleCount}
      fileCount={app.files.length}
    />
  );

  return (
    <PageShell backHref="/apps" backLabel="All apps">
      <KitView model={model} />
    </PageShell>
  );
}
