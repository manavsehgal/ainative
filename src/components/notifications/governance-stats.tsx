"use client";

import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

interface GovernanceStatsProps {
  pending: number;
  approvedToday: number;
  deniedToday: number;
}

/**
 * Governance stats row — shows pending / approved today / denied counts.
 * Displayed at top of inbox to give governance status at a glance.
 */
export function GovernanceStats({
  pending,
  approvedToday,
  deniedToday,
}: GovernanceStatsProps) {
  const stats = [
    {
      label: "Pending",
      value: pending,
      icon: ShieldAlert,
      color: "text-status-warning",
      bgColor: "bg-status-warning/10",
    },
    {
      label: "Approved today",
      value: approvedToday,
      icon: ShieldCheck,
      color: "text-status-completed",
      bgColor: "bg-status-completed/10",
    },
    {
      label: "Denied",
      value: deniedToday,
      icon: ShieldX,
      color: "text-status-failed",
      bgColor: "bg-status-failed/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="surface-card-muted rounded-lg p-3 flex items-center gap-3"
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.bgColor}`}>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </div>
          <div>
            <p className="text-lg font-semibold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
