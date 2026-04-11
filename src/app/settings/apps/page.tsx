import { PageShell } from "@/components/shared/page-shell";
import { InstalledAppsManager } from "@/components/apps/installed-apps-manager";
import { listInstalledAppInstances } from "@/lib/apps/service";

export const dynamic = "force-dynamic";

export default function SettingsAppsPage() {
  const apps = listInstalledAppInstances().map((instance) => ({
    appId: instance.appId,
    name: instance.name,
    version: instance.version,
    projectId: instance.projectId,
    status: instance.status,
    bootstrapError: instance.bootstrapError,
    installedAt: instance.installedAt,
    bootstrappedAt: instance.bootstrappedAt,
    icon: instance.manifest.icon,
    projectHref: instance.projectId ? `/projects/${instance.projectId}` : null,
    openHref: `/apps/${instance.appId}`,
  }));

  return (
    <PageShell
      title="Installed Apps"
      description="Manage deterministic runtime bundles linked to projects."
      backHref="/settings"
      backLabel="Settings"
    >
      <InstalledAppsManager initialApps={apps} />
    </PageShell>
  );
}
