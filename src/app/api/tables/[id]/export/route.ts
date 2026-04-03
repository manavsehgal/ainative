import { NextRequest, NextResponse } from "next/server";
import { getTable, listRows } from "@/lib/data/tables";
import type { ColumnDef } from "@/lib/tables/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const table = await getTable(id);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "csv";

    let columns: ColumnDef[] = [];
    try {
      columns = JSON.parse(table.columnSchema) as ColumnDef[];
    } catch {
      columns = [];
    }

    // Fetch all rows (up to 10000)
    const rows = await listRows(id, { limit: 10000 });
    const parsedRows = rows.map((r) => JSON.parse(r.data) as Record<string, unknown>);

    switch (format) {
      case "json":
        return new NextResponse(JSON.stringify(parsedRows, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${table.name}.json"`,
          },
        });

      case "xlsx": {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(table.name);

        // Add header row
        worksheet.addRow(columns.map((c) => c.displayName));

        // Add data rows
        for (const row of parsedRows) {
          worksheet.addRow(columns.map((c) => row[c.name] ?? ""));
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buffer = await workbook.xlsx.writeBuffer() as any;
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${table.name}.xlsx"`,
          },
        });
      }

      case "csv":
      default: {
        const lines: string[] = [];
        // Header
        lines.push(columns.map((c) => escapeCsvField(c.displayName)).join(","));
        // Data rows
        for (const row of parsedRows) {
          lines.push(
            columns.map((c) => escapeCsvField(String(row[c.name] ?? ""))).join(",")
          );
        }
        const csv = lines.join("\n");
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${table.name}.csv"`,
          },
        });
      }
    }
  } catch (err) {
    console.error("[tables/export] GET error:", err);
    return NextResponse.json({ error: "Failed to export table" }, { status: 500 });
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
