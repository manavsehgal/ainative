import { notFound } from "next/navigation";
import { getTable, listRows } from "@/lib/data/tables";
import { PageShell } from "@/components/shared/page-shell";
import { TableDetailTabs } from "@/components/tables/table-detail-tabs";
import { evaluateComputedColumns } from "@/lib/tables/computed";
import type { ColumnDef } from "@/lib/tables/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TableDetailPage({ params }: Props) {
  const { id } = await params;
  const table = await getTable(id);

  if (!table) {
    notFound();
  }

  let columns: ColumnDef[] = [];
  try {
    columns = JSON.parse(table.columnSchema) as ColumnDef[];
  } catch {
    columns = [];
  }

  const rawRows = await listRows(id, { limit: 500 });
  const rows = evaluateComputedColumns(columns, rawRows);

  return (
    <PageShell
      title={table.name}
      description={table.description ?? undefined}
      backHref="/tables"
      backLabel="Tables"
    >
      <TableDetailTabs
        tableId={id}
        columns={columns}
        initialRows={rows}
      />
    </PageShell>
  );
}
