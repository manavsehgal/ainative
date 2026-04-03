import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { userTableTemplates } from "@/lib/db/schema";
import { listTemplates, getTable, listRows } from "@/lib/data/tables";
import { listTemplatesSchema } from "@/lib/tables/validation";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") ?? undefined;
    const scope = url.searchParams.get("scope") ?? undefined;

    const parsed = listTemplatesSchema.safeParse({ category, scope });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const templates = await listTemplates(parsed.data);
    return NextResponse.json(templates);
  } catch (err) {
    console.error("[tables] GET templates error:", err);
    return NextResponse.json(
      { error: "Failed to list templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tables/templates — Save a table as a user-scoped template.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableId, name, description, category, includeSampleData } = body as {
      tableId?: string;
      name?: string;
      description?: string;
      category?: string;
      includeSampleData?: boolean;
    };

    if (!tableId || !name) {
      return NextResponse.json(
        { error: "tableId and name are required" },
        { status: 400 }
      );
    }

    const table = await getTable(tableId);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Optionally snapshot first 5 rows as sample data
    let sampleData: string | null = null;
    if (includeSampleData) {
      const rows = await listRows(tableId, { limit: 5 });
      sampleData = JSON.stringify(rows.map((r) => JSON.parse(r.data)));
    }

    const now = new Date();
    const templateId = randomUUID();

    db.insert(userTableTemplates)
      .values({
        id: templateId,
        name,
        description: description ?? table.description,
        category: (category as "business" | "personal" | "pm" | "finance" | "content") ?? "personal",
        columnSchema: table.columnSchema,
        sampleData,
        scope: "user",
        icon: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return NextResponse.json({ id: templateId, name }, { status: 201 });
  } catch (err) {
    console.error("[tables] POST templates error:", err);
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 }
    );
  }
}
