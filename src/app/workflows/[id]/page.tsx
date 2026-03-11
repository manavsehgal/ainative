import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { WorkflowStatusView } from "@/components/workflows/workflow-status-view";

export const dynamic = "force-dynamic";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id));

  if (!workflow) notFound();

  return (
    <div className="gradient-ocean-mist min-h-screen p-6">
      <Link href="/workflows">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Workflows
        </Button>
      </Link>
      <WorkflowStatusView workflowId={id} />
    </div>
  );
}
