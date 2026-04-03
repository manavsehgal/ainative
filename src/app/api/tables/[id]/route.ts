import { NextRequest, NextResponse } from "next/server";
import {
  getTable,
  updateTable,
  deleteTable,
  getColumns,
} from "@/lib/data/tables";
import { updateTableSchema } from "@/lib/tables/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const table = await getTable(id);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const columns = await getColumns(id);
    return NextResponse.json({ ...table, columns });
  } catch (err) {
    console.error("[tables] GET by id error:", err);
    return NextResponse.json(
      { error: "Failed to get table" },
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
    const body = await req.json();
    const parsed = updateTableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await getTable(id);
    if (!existing) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const updated = await updateTable(id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[tables] PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update table" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const existing = await getTable(id);
    if (!existing) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    await deleteTable(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[tables] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete table" },
      { status: 500 }
    );
  }
}
