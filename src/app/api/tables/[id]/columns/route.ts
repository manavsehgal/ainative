import { NextRequest, NextResponse } from "next/server";
import { getTable, addColumn, reorderColumns } from "@/lib/data/tables";
import {
  addColumnSchema,
  reorderColumnsSchema,
} from "@/lib/tables/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await getTable(id);
    if (!existing) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = addColumnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const column = await addColumn(id, parsed.data);
    return NextResponse.json(column, { status: 201 });
  } catch (err) {
    console.error("[tables] POST column error:", err);
    return NextResponse.json(
      { error: "Failed to add column" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await getTable(id);
    if (!existing) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = reorderColumnsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const columns = await reorderColumns(id, parsed.data.columnIds);
    return NextResponse.json(columns);
  } catch (err) {
    console.error("[tables] PATCH columns reorder error:", err);
    return NextResponse.json(
      { error: "Failed to reorder columns" },
      { status: 500 }
    );
  }
}
