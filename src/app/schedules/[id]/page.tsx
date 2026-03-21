import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageShell } from "@/components/shared/page-shell";
import { ScheduleDetailView } from "@/components/schedules/schedule-detail-view";

export const dynamic = "force-dynamic";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id));

  if (!schedule) notFound();

  // Serialize Date timestamps and add firing history placeholder for client component
  const initialSchedule = {
    ...schedule,
    createdAt: schedule.createdAt instanceof Date ? schedule.createdAt.toISOString() : String(schedule.createdAt),
    expiresAt: schedule.expiresAt instanceof Date ? schedule.expiresAt.toISOString() : schedule.expiresAt ? String(schedule.expiresAt) : null,
    lastFiredAt: schedule.lastFiredAt instanceof Date ? schedule.lastFiredAt.toISOString() : schedule.lastFiredAt ? String(schedule.lastFiredAt) : null,
    nextFireAt: schedule.nextFireAt instanceof Date ? schedule.nextFireAt.toISOString() : schedule.nextFireAt ? String(schedule.nextFireAt) : null,
    firingHistory: [] as Array<{ id: string; title: string; status: string; createdAt: string; result: string | null }>,
  };

  return (
    <PageShell backHref="/schedules" backLabel="Back to Schedules">
      <ScheduleDetailView scheduleId={id} initialSchedule={initialSchedule} />
    </PageShell>
  );
}
