import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks, workflows, documents, schedules } from "@/lib/db/schema";
import { like, desc } from "drizzle-orm";
import { listProfiles } from "@/lib/agents/profiles/registry";

interface EntityResult {
  entityType: string;
  entityId: string;
  label: string;
  status?: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10), 20);

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${query}%`;
  const perType = Math.max(2, Math.floor(limit / 5));

  const results: EntityResult[] = [];

  // Search in parallel across all entity types
  const [projectRows, taskRows, workflowRows, documentRows, scheduleRows] =
    await Promise.all([
      db
        .select({ id: projects.id, name: projects.name, status: projects.status })
        .from(projects)
        .where(like(projects.name, pattern))
        .orderBy(desc(projects.updatedAt))
        .limit(perType),
      db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(tasks)
        .where(like(tasks.title, pattern))
        .orderBy(desc(tasks.updatedAt))
        .limit(perType),
      db
        .select({ id: workflows.id, name: workflows.name, status: workflows.status })
        .from(workflows)
        .where(like(workflows.name, pattern))
        .orderBy(desc(workflows.updatedAt))
        .limit(perType),
      db
        .select({ id: documents.id, name: documents.originalName, status: documents.status })
        .from(documents)
        .where(like(documents.originalName, pattern))
        .orderBy(desc(documents.createdAt))
        .limit(perType),
      db
        .select({ id: schedules.id, name: schedules.name, status: schedules.status })
        .from(schedules)
        .where(like(schedules.name, pattern))
        .orderBy(desc(schedules.updatedAt))
        .limit(perType),
    ]);

  for (const p of projectRows) {
    results.push({ entityType: "project", entityId: p.id, label: p.name, status: p.status });
  }
  for (const t of taskRows) {
    results.push({ entityType: "task", entityId: t.id, label: t.title, status: t.status });
  }
  for (const w of workflowRows) {
    results.push({ entityType: "workflow", entityId: w.id, label: w.name, status: w.status });
  }
  for (const d of documentRows) {
    results.push({ entityType: "document", entityId: d.id, label: d.name, status: d.status });
  }
  for (const s of scheduleRows) {
    results.push({ entityType: "schedule", entityId: s.id, label: s.name, status: s.status });
  }

  // Search profiles in-memory (file-based registry)
  const lowerQuery = query.toLowerCase();
  const profileMatches = listProfiles()
    .filter((p) => p.name.toLowerCase().includes(lowerQuery) || p.id.toLowerCase().includes(lowerQuery))
    .slice(0, perType);

  for (const p of profileMatches) {
    results.push({ entityType: "profile", entityId: p.id, label: p.name });
  }

  return NextResponse.json({ results: results.slice(0, limit) });
}
