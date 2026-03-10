import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { ScheduleList } from "@/components/schedules/schedule-list";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  return (
    <div className="gradient-ocean-mist min-h-screen p-6">
      <ScheduleList projects={allProjects} />
    </div>
  );
}
