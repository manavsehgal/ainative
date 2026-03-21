import { Suspense } from "react";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { MonitorOverview } from "@/components/monitoring/monitor-overview";
import { MonitorRefreshButton } from "@/components/monitoring/monitor-overview-wrapper";
import { LogStream } from "@/components/monitoring/log-stream";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/page-shell";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const activeTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .orderBy(tasks.createdAt);

  return (
    <PageShell
      title="Monitor"
      actions={<MonitorRefreshButton />}
    >
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        }
      >
        <MonitorOverview />
      </Suspense>
      <LogStream tasks={activeTasks} />
    </PageShell>
  );
}
