import { db } from "@/lib/db";
import { projects, tasks, workflows, documents, schedules } from "@/lib/db/schema";
import type { QuickAccessItem } from "./types";

/**
 * Scan assistant response text for references to known entities.
 * Returns QuickAccessItem[] for rendering as navigation pills.
 *
 * Detection strategy: search for entity names/titles in the response text.
 * This is a lightweight heuristic — not NLP entity extraction.
 */
export async function detectEntities(
  text: string,
  projectId?: string | null
): Promise<QuickAccessItem[]> {
  const items: QuickAccessItem[] = [];
  const lowerText = text.toLowerCase();

  // Fetch candidate entities (scoped to project if available, else global recent)
  const [projectRows, taskRows, workflowRows, documentRows, scheduleRows] =
    await Promise.all([
      db.select({ id: projects.id, name: projects.name }).from(projects).limit(20),
      db.select({ id: tasks.id, title: tasks.title }).from(tasks).limit(30),
      db.select({ id: workflows.id, name: workflows.name }).from(workflows).limit(20),
      db.select({ id: documents.id, name: documents.originalName }).from(documents).limit(20),
      db.select({ id: schedules.id, name: schedules.name }).from(schedules).limit(20),
    ]);

  // Check each entity for a name match in the response
  for (const p of projectRows) {
    if (p.name.length >= 3 && lowerText.includes(p.name.toLowerCase())) {
      items.push({
        entityType: "project",
        entityId: p.id,
        label: p.name,
        href: `/projects/${p.id}`,
      });
    }
  }

  for (const t of taskRows) {
    if (t.title.length >= 3 && lowerText.includes(t.title.toLowerCase())) {
      items.push({
        entityType: "task",
        entityId: t.id,
        label: t.title,
        href: `/dashboard`,
      });
    }
  }

  for (const w of workflowRows) {
    if (w.name.length >= 3 && lowerText.includes(w.name.toLowerCase())) {
      items.push({
        entityType: "workflow",
        entityId: w.id,
        label: w.name,
        href: `/workflows/${w.id}`,
      });
    }
  }

  for (const d of documentRows) {
    if (d.name.length >= 3 && lowerText.includes(d.name.toLowerCase())) {
      items.push({
        entityType: "document",
        entityId: d.id,
        label: d.name,
        href: `/documents/${d.id}`,
      });
    }
  }

  for (const s of scheduleRows) {
    if (s.name.length >= 3 && lowerText.includes(s.name.toLowerCase())) {
      items.push({
        entityType: "schedule",
        entityId: s.id,
        label: s.name,
        href: `/schedules`,
      });
    }
  }

  // Deduplicate by entityId
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.entityId)) return false;
    seen.add(item.entityId);
    return true;
  });
}
