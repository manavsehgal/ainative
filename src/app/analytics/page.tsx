import { Suspense } from "react";
import { PageShell } from "@/components/shared/page-shell";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import {
  getOutcomeCounts,
  getSuccessRateTrend,
  getCostPerOutcomeTrend,
  getProfileLeaderboard,
  getEstimatedHoursSaved,
} from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

function AnalyticsContent() {
  const outcomes = getOutcomeCounts(30);
  const successTrend = getSuccessRateTrend(30);
  const costTrend = getCostPerOutcomeTrend(30);
  const leaderboard = getProfileLeaderboard(30);
  const hoursSaved = getEstimatedHoursSaved(30);

  return (
    <AnalyticsDashboard
      outcomes={outcomes}
      successTrend={successTrend}
      costTrend={costTrend}
      leaderboard={leaderboard}
      hoursSaved={hoursSaved}
    />
  );
}

export default function AnalyticsPage() {
  return (
    <PageShell title="Analytics" description="Agent performance and ROI insights">
      <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
        <AnalyticsContent />
      </Suspense>
    </PageShell>
  );
}
