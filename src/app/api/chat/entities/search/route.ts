import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, tasks, workflows, documents, schedules, userTables } from "@/lib/db/schema";
import { like, desc } from "drizzle-orm";
import { listProfiles } from "@/lib/agents/profiles/registry";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface EntityResult {
  entityType: string;
  entityId: string;
  label: string;
  status?: string;
  description?: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 30);

  const hasQuery = query.trim().length > 0;
  const pattern = hasQuery ? `%${query}%` : "";
  const perType = Math.max(2, Math.floor(limit / 7));

  const results: EntityResult[] = [];

  // Build queries — apply LIKE filter only when query is non-empty
  const projectQuery = db
    .select({ id: projects.id, name: projects.name, status: projects.status, description: projects.description })
    .from(projects);
  const taskQuery = db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status, description: tasks.description })
    .from(tasks);
  const workflowQuery = db
    .select({ id: workflows.id, name: workflows.name, status: workflows.status })
    .from(workflows);
  const documentQuery = db
    .select({ id: documents.id, name: documents.originalName, status: documents.status, mimeType: documents.mimeType, size: documents.size })
    .from(documents);
  const scheduleQuery = db
    .select({ id: schedules.id, name: schedules.name, status: schedules.status })
    .from(schedules);
  const tableQuery = db
    .select({ id: userTables.id, name: userTables.name, rowCount: userTables.rowCount, source: userTables.source })
    .from(userTables);

  // Search in parallel across all entity types
  const [projectRows, taskRows, workflowRows, documentRows, scheduleRows, tableRows] =
    await Promise.all([
      (hasQuery ? projectQuery.where(like(projects.name, pattern)) : projectQuery)
        .orderBy(desc(projects.updatedAt))
        .limit(perType),
      (hasQuery ? taskQuery.where(like(tasks.title, pattern)) : taskQuery)
        .orderBy(desc(tasks.updatedAt))
        .limit(perType),
      (hasQuery ? workflowQuery.where(like(workflows.name, pattern)) : workflowQuery)
        .orderBy(desc(workflows.updatedAt))
        .limit(perType),
      (hasQuery ? documentQuery.where(like(documents.originalName, pattern)) : documentQuery)
        .orderBy(desc(documents.createdAt))
        .limit(perType),
      (hasQuery ? scheduleQuery.where(like(schedules.name, pattern)) : scheduleQuery)
        .orderBy(desc(schedules.updatedAt))
        .limit(perType),
      (hasQuery ? tableQuery.where(like(userTables.name, pattern)) : tableQuery)
        .orderBy(desc(userTables.updatedAt))
        .limit(perType),
    ]);

  for (const p of projectRows) {
    results.push({ entityType: "project", entityId: p.id, label: p.name, status: p.status, description: p.description?.slice(0, 120) || undefined });
  }
  for (const t of taskRows) {
    results.push({ entityType: "task", entityId: t.id, label: t.title, status: t.status, description: t.description?.slice(0, 120) || undefined });
  }
  for (const w of workflowRows) {
    results.push({ entityType: "workflow", entityId: w.id, label: w.name, status: w.status });
  }
  for (const d of documentRows) {
    results.push({ entityType: "document", entityId: d.id, label: d.name, status: d.status, description: `${d.mimeType}, ${formatBytes(d.size)}` });
  }
  for (const s of scheduleRows) {
    results.push({ entityType: "schedule", entityId: s.id, label: s.name, status: s.status });
  }
  for (const t of tableRows) {
    results.push({ entityType: "table", entityId: t.id, label: t.name, description: `${t.rowCount ?? 0} rows · ${t.source}` });
  }

  // Search profiles in-memory (file-based registry)
  const allProfiles = listProfiles();
  const q = query.toLowerCase();
  const profileMatches = hasQuery
    ? allProfiles
        .filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
        )
        .slice(0, perType)
    : allProfiles.slice(0, perType);

  for (const p of profileMatches) {
    results.push({
      entityType: "profile",
      entityId: p.id,
      label: p.name,
      description: p.description
        ? `${p.domain} · ${p.description.slice(0, 100)}`
        : p.domain,
      status: p.domain,
    });
  }

  return NextResponse.json({ results: results.slice(0, limit) });
}
