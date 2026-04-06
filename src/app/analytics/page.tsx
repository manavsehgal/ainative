import { Suspense } from "react";
import { PageShell } from "@/components/shared/page-shell";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { AnalyticsGateCard } from "@/components/analytics/analytics-gate-card";
import { licenseManager } from "@/lib/license/manager";
import {
  getOutcomeCounts,
  getSuccessRateTrend,
  getCostPerOutcomeTrend,
  getProfileLeaderboard,
  getEstimatedHoursSaved,
} from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

function AnalyticsContent() {
  const tier = licenseManager.getTierFromDb();
  const isAllowed = tier !== "community";

  const outcomes = getOutcomeCounts(30);
  const successTrend = getSuccessRateTrend(30);
  const costTrend = getCostPerOutcomeTrend(30);
  const leaderboard = getProfileLeaderboard(30);
  const hoursSaved = getEstimatedHoursSaved(30);

  const dashboard = (
    <AnalyticsDashboard
      outcomes={outcomes}
      successTrend={successTrend}
      costTrend={costTrend}
      leaderboard={leaderboard}
      hoursSaved={hoursSaved}
    />
  );

  if (isAllowed) return dashboard;

  return (
    <div className="relative">
      {/* Blurred dashboard preview */}
      <div className="opacity-20 pointer-events-none select-none blur-[2px]" aria-hidden>
        {dashboard}
      </div>
      {/* Upgrade CTA */}
      <div className="absolute inset-0 flex items-start justify-center pt-16">
        <AnalyticsGateCard />
      </div>
    </div>
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
