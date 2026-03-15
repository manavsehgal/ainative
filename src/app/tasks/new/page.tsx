import Link from "next/link";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TaskCreatePanel } from "@/components/tasks/task-create-panel";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  return (
    <div className="gradient-morning-sky min-h-screen p-6">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Button>
      </Link>
      <TaskCreatePanel
        projects={allProjects}
        defaultProjectId={params.project}
      />
    </div>
  );
}
