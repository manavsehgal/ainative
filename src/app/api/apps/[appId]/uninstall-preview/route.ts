import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { getAppInstance } from "@/lib/apps/service";
import { getTable } from "@/lib/data/tables";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;
  const instance = getAppInstance(appId);

  if (!instance) {
    return NextResponse.json({ error: "App not installed" }, { status: 404 });
  }

  const rm = instance.resourceMap;

  // Resolve table names and row counts
  const tables: { name: string; rowCount: number }[] = [];
  for (const [key, tableId] of Object.entries(rm.tables)) {
    const table = await getTable(tableId);
    if (table) {
      tables.push({ name: table.name, rowCount: table.rowCount });
    } else {
      tables.push({ name: key, rowCount: 0 });
    }
  }

  // Resolve schedule names from bundle templates
  const scheduleNames = instance.bundle.schedules
    .filter((s) => rm.schedules[s.key])
    .map((s) => s.name);

  // Resolve trigger names from bundle templates
  const triggerNames = (instance.bundle.triggers ?? [])
    .filter((t) => rm.triggers?.[t.key])
    .map((t) => t.name);

  // Resolve saved view names from bundle templates
  const savedViewNames = (instance.bundle.savedViews ?? [])
    .filter((v) => rm.savedViews?.[v.key])
    .map((v) => v.name);

  // Notification count (no template names available — just count)
  const notificationCount = Object.keys(rm.notifications ?? {}).length;

  // Linked project info
  let linkedProject: { id: string; name: string } | null = null;
  if (instance.projectId) {
    const proj = db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, instance.projectId))
      .get();
    if (proj) {
      linkedProject = proj;
    }
  }

  return NextResponse.json({
    app: {
      appId: instance.appId,
      name: instance.name,
      version: instance.version,
      status: instance.status,
    },
    resources: {
      tables,
      schedules: scheduleNames,
      triggers: triggerNames,
      savedViews: savedViewNames,
      notificationCount,
    },
    linkedProject,
  });
}
