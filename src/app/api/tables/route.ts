import { NextRequest, NextResponse } from "next/server";
import {
  listTables,
  createTable,
  cloneFromTemplate,
} from "@/lib/data/tables";
import {
  createTableSchema,
  cloneFromTemplateSchema,
} from "@/lib/tables/validation";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const source = url.searchParams.get("source") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;

    const tables = await listTables({ projectId, source, search });
    return NextResponse.json(tables);
  } catch (err) {
    console.error("[tables] GET error:", err);
    return NextResponse.json(
      { error: "Failed to list tables" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Template clone path
    if (body.templateId) {
      const parsed = cloneFromTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const table = await cloneFromTemplate(parsed.data);
      return NextResponse.json(table, { status: 201 });
    }

    // Normal create path
    const parsed = createTableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const table = await createTable(parsed.data);
    return NextResponse.json(table, { status: 201 });
  } catch (err) {
    console.error("[tables] POST error:", err);
    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}
