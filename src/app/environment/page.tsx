import { getLatestScan, getArtifacts, getArtifactCounts, getToolCounts } from "@/lib/environment/data";
import { EnvironmentDashboard } from "@/components/environment/environment-dashboard";
import { PageShell } from "@/components/shared/page-shell";

export const dynamic = "force-dynamic";

export default async function EnvironmentPage() {
  const scan = getLatestScan();

  if (!scan) {
    return (
      <PageShell title="Environment">
        <EnvironmentDashboard
          scan={null}
          artifacts={[]}
          categoryCounts={[]}
          toolCounts={[]}
        />
      </PageShell>
    );
  }

  const artifacts = getArtifacts({ scanId: scan.id });
  const categoryCounts = getArtifactCounts(scan.id);
  const toolCounts = getToolCounts(scan.id);

  return (
    <PageShell title="Environment">
      <EnvironmentDashboard
        scan={scan}
        artifacts={artifacts}
        categoryCounts={categoryCounts}
        toolCounts={toolCounts}
      />
    </PageShell>
  );
}
