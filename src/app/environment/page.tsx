import { getLatestScan, getArtifacts, getArtifactCounts, getToolCounts, getCheckpoints } from "@/lib/environment/data";
import { listTemplates } from "@/lib/environment/templates";
import { calculateHealthScore } from "@/lib/environment/health-scoring";
import { EnvironmentDashboard } from "@/components/environment/environment-dashboard";
import { PageShell } from "@/components/shared/page-shell";
import { getWorkspaceContext } from "@/lib/environment/workspace-context";

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
  const checkpoints = getCheckpoints();
  const templates = listTemplates();
  const healthScore = calculateHealthScore(scan, artifacts);

  const workspace = getWorkspaceContext();
  const workspaceLabel = (
    <span className="text-sm text-muted-foreground font-normal inline-flex items-center gap-1.5">
      {workspace.parentPath}/<span className="font-medium text-foreground">{workspace.folderName}</span>
      {workspace.gitBranch && <span className="text-xs text-muted-foreground/70">⎇ {workspace.gitBranch}</span>}
    </span>
  );

  return (
    <PageShell title="Environment" actions={workspaceLabel}>
      <EnvironmentDashboard
        scan={scan}
        artifacts={artifacts}
        categoryCounts={categoryCounts}
        toolCounts={toolCounts}
        checkpoints={checkpoints}
        templates={templates}
        healthScore={healthScore}
      />
    </PageShell>
  );
}
