import { listTables } from "@/lib/data/tables";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { TableBrowser } from "@/components/tables/table-browser";
import { PageShell } from "@/components/shared/page-shell";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const tables = await listTables();

  const projectList = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects);

  return (
    <PageShell title="Tables">
      <TableBrowser initialTables={tables} projects={projectList} />
    </PageShell>
  );
}
