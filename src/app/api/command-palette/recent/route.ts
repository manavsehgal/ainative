import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getManifest } from "@/lib/docs/reader";

export async function GET() {
  const [recentProjects, recentTasks] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
      })
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .limit(5),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
      })
      .from(tasks)
      .orderBy(desc(tasks.updatedAt))
      .limit(5),
  ]);

  // Read playbook items from manifest
  let playbook: { slug: string; title: string; tags: string[] }[] = [];
  try {
    const manifest = getManifest();
    playbook = [
      ...manifest.sections.map((s) => ({
        slug: s.slug,
        title: s.title,
        tags: s.tags,
      })),
      ...manifest.journeys.map((j) => ({
        slug: j.slug,
        title: j.title,
        tags: [j.persona, j.difficulty],
      })),
    ];
  } catch {
    // docs/manifest.json may not exist — graceful fallback
  }

  return NextResponse.json({
    projects: recentProjects,
    tasks: recentTasks,
    playbook,
  });
}
