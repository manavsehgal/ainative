import { NextRequest, NextResponse } from "next/server";
import { getTable, addColumn, getColumns } from "@/lib/data/tables";
import {
  extractStructuredData,
  inferColumnTypes,
  importRows,
  createImportRecord,
} from "@/lib/tables/import";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const table = await getTable(id);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const body = await req.json();
    const { documentId, columnMapping, preview } = body as {
      documentId?: string;
      columnMapping?: Array<{
        name: string;
        displayName: string;
        dataType: string;
        skip?: boolean;
      }>;
      preview?: boolean;
    };

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    // Step 1: Extract structured data from the document
    const { headers, rows } = await extractStructuredData(documentId);

    // Step 2: Infer column types from a sample (first 100 rows)
    const sampleRows = rows.slice(0, 100);
    const inferredColumns = inferColumnTypes(headers, sampleRows);

    // If preview mode, return data without importing
    if (preview) {
      return NextResponse.json({
        headers,
        sampleRows: rows.slice(0, 10),
        totalRows: rows.length,
        inferredColumns,
      });
    }

    // Step 3: Use user-provided column mapping or fall back to inferred
    const finalColumns = columnMapping
      ? inferredColumns.map((col) => {
          const mapped = columnMapping.find(
            (m) => m.name === col.name || m.displayName === col.displayName
          );
          if (mapped?.skip) return null;
          if (mapped) {
            return {
              ...col,
              name: mapped.name,
              displayName: mapped.displayName,
              dataType: mapped.dataType as typeof col.dataType,
            };
          }
          return col;
        }).filter(Boolean) as typeof inferredColumns
      : inferredColumns;

    // Step 4: Ensure columns exist on the table
    const existingColumns = await getColumns(id);
    const existingNames = new Set(existingColumns.map((c) => c.name));

    for (const col of finalColumns) {
      if (!existingNames.has(col.name)) {
        await addColumn(id, {
          name: col.name,
          displayName: col.displayName,
          dataType: col.dataType,
          config: col.config,
        });
      }
    }

    // Step 5: Import all rows
    const result = await importRows(id, rows, finalColumns);

    // Step 6: Create import audit record
    await createImportRecord(id, documentId, result);

    return NextResponse.json({
      importId: result.importId,
      rowsImported: result.rowsImported,
      rowsSkipped: result.rowsSkipped,
      errors: result.errors.slice(0, 20), // Limit error detail in response
      columns: finalColumns,
    });
  } catch (err) {
    console.error("[tables/import] POST error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to import data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
