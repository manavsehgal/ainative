import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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

  return (
    <div className="p-6">
      <Link href="/schedules">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Schedules
        </Button>
      </Link>
      <ScheduleDetailView scheduleId={id} />
    </div>
  );
}
