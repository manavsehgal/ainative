import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { tasks, agentLogs } from "@/lib/db/schema";
import { eq, count, sql, gte, and } from "drizzle-orm";
import { Activity, CheckCircle, Zap, Clock } from "lucide-react";

export async function MonitorOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.status, "running"));

  const [todayResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(gte(tasks.createdAt, today));

  const [completedResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.status, "completed"));

  const [totalResult] = await db
    .select({ count: count() })
    .from(tasks)
    .where(
      sql`${tasks.status} IN ('completed', 'failed')`
    );

  const successRate =
    totalResult.count > 0
      ? Math.round((completedResult.count / totalResult.count) * 100)
      : 0;

  const [lastLog] = await db
    .select()
    .from(agentLogs)
    .orderBy(sql`${agentLogs.timestamp} DESC`)
    .limit(1);

  const metrics = [
    {
      title: "Active Agents",
      value: activeResult.count,
      icon: Activity,
      color: "text-status-running",
    },
    {
      title: "Tasks Today",
      value: todayResult.count,
      icon: Zap,
      color: "text-status-warning",
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      icon: CheckCircle,
      color: "text-status-completed",
    },
    {
      title: "Last Activity",
      value: lastLog
        ? new Date(lastLog.timestamp).toLocaleTimeString()
        : "None",
      icon: Clock,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((m) => (
        <Card key={m.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {m.title}
            </CardTitle>
            <m.icon className={`h-4 w-4 ${m.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{m.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
