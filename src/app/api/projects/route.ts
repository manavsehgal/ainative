import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { createProjectSchema } from "@/lib/validators/project";

export async function GET() {
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`(SELECT COUNT(*) FROM tasks WHERE tasks.project_id = ${projects.id})`.as("task_count"),
    })
    .from(projects)
    .orderBy(projects.createdAt);

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(projects).values({
    id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));

  return NextResponse.json(project, { status: 201 });
}
