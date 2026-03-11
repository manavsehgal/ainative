import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TaskDetailView } from "@/components/tasks/task-detail-view";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id));

  if (!task) notFound();

  // Serialize Date timestamps to ISO strings for client component
  const initialTask = {
    ...task,
    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : String(task.createdAt),
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : String(task.updatedAt),
    projectName: undefined,
  };

  return (
    <div className="gradient-morning-sky min-h-screen p-6">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Button>
      </Link>
      <TaskDetailView taskId={id} initialTask={initialTask} />
    </div>
  );
}
