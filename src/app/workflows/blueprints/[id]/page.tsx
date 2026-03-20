import Link from "next/link";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BlueprintPreview } from "@/components/workflows/blueprint-preview";
import { getBlueprint } from "@/lib/workflows/blueprints/registry";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BlueprintDetailPage({ params }: Props) {
  const { id } = await params;
  const blueprint = getBlueprint(id);

  if (!blueprint) {
    notFound();
  }

  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  return (
    <div className="bg-background min-h-screen p-6">
      <Link href="/workflows/blueprints">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Blueprints
        </Button>
      </Link>
      <BlueprintPreview blueprint={blueprint} projects={allProjects} />
    </div>
  );
}
