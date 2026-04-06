"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  OutcomeCount,
  TrendPoint,
  CostTrendPoint,
  ProfileStats,
} from "@/lib/analytics/queries";

interface AnalyticsDashboardProps {
  outcomes: OutcomeCount;
  successTrend: TrendPoint[];
  costTrend: CostTrendPoint[];
  leaderboard: ProfileStats[];
  hoursSaved: number;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="surface-card-muted rounded-lg p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export function AnalyticsDashboard({
  outcomes,
  successTrend,
  costTrend,
  leaderboard,
  hoursSaved,
}: AnalyticsDashboardProps) {
  const [hourlyRate, setHourlyRate] = useState(() => {
    if (typeof window === "undefined") return 75;
    const saved = localStorage.getItem("stagent-hourly-rate");
    return saved ? parseInt(saved, 10) : 75;
  });

  function updateHourlyRate(rate: number) {
    setHourlyRate(rate);
    if (typeof window !== "undefined") {
      localStorage.setItem("stagent-hourly-rate", String(rate));
    }
  }

  const valueGenerated = Math.round(hoursSaved * hourlyRate);
  const totalCostUsd = leaderboard.reduce((sum, p) => sum + p.totalCostMicros, 0) / 1_000_000;

  return (
    <div className="space-y-6">
      {/* ROI Summary Strip */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Tasks Completed" value={String(outcomes.completed)} sub="Last 30 days" />
        <StatCard label="Success Rate" value={`${outcomes.successRate}%`} sub={`${outcomes.failed} failed`} />
        <StatCard label="Hours Saved" value={`${hoursSaved}h`} sub={`~$${valueGenerated} value`} />
        <StatCard label="Total Cost" value={`$${totalCostUsd.toFixed(2)}`} sub="Agent spend" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Success Rate Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Task Outcomes (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={successTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="completed" stackId="1" fill="oklch(0.7 0.15 250)" stroke="oklch(0.6 0.2 250)" fillOpacity={0.3} />
                <Area type="monotone" dataKey="failed" stackId="1" fill="oklch(0.7 0.15 25)" stroke="oklch(0.6 0.2 25)" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost per Outcome Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cost per Task (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={costTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(2)}`} />
                <Tooltip formatter={(v) => [`$${(Number(v) / 1_000_000).toFixed(4)}`, "Avg Cost"]} />
                <Line type="monotone" dataKey="avgCostMicros" stroke="oklch(0.6 0.2 250)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Profile Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Profile Leaderboard (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No agent profiles have run tasks yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Profile</th>
                    <th className="pb-2 font-medium text-right">Completed</th>
                    <th className="pb-2 font-medium text-right">Failed</th>
                    <th className="pb-2 font-medium text-right">Success</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                    <th className="pb-2 font-medium text-right">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p) => (
                    <tr key={p.profileId} className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">{p.profileId}</td>
                      <td className="py-2 text-right">{p.completed}</td>
                      <td className="py-2 text-right text-muted-foreground">{p.failed}</td>
                      <td className="py-2 text-right">{p.successRate}%</td>
                      <td className="py-2 text-right">${(p.totalCostMicros / 1_000_000).toFixed(2)}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {p.avgDurationMs > 0 ? `${(p.avgDurationMs / 1000).toFixed(1)}s` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROI Calculator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">ROI Calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Your hourly rate:
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm">$</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => updateHourlyRate(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 rounded-md border px-2 py-1 text-sm"
                min={1}
              />
              <span className="text-xs text-muted-foreground">/hr</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">${valueGenerated.toLocaleString()}</span>
              <span className="text-muted-foreground"> estimated value from {hoursSaved}h saved</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
