"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle, MessageSquare, FolderKanban } from "lucide-react";

interface StatsCardsProps {
  runningCount: number;
  completedToday: number;
  completedAllTime: number;
  awaitingReview: number;
  activeProjects: number;
}

export function StatsCards({
  runningCount,
  completedToday,
  completedAllTime,
  awaitingReview,
  activeProjects,
}: StatsCardsProps) {
  const stats = [
    {
      title: "Tasks Running",
      value: runningCount,
      subtitle: "Currently active",
      icon: Activity,
      color: "text-blue-500",
      href: "/monitor",
    },
    {
      title: "Completed Today",
      value: completedToday,
      subtitle: `All-time: ${completedAllTime}`,
      icon: CheckCircle,
      color: "text-green-500",
      href: "/dashboard",
    },
    {
      title: "Awaiting Review",
      value: awaitingReview,
      subtitle: "Human-loop pending",
      icon: MessageSquare,
      color: "text-amber-500",
      href: "/inbox",
    },
    {
      title: "Active Projects",
      value: activeProjects,
      subtitle: "In progress",
      icon: FolderKanban,
      color: "text-purple-500",
      href: "/projects",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((s) => (
        <Link key={s.title} href={s.href}>
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.title}
              </CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.subtitle}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
