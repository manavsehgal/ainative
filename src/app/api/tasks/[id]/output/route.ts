import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Detect content type from the result
  const result = task.result ?? "";
  let contentType: "text" | "markdown" | "code" | "json" | "unknown" = "text";

  if (result.startsWith("{") || result.startsWith("[")) {
    try {
      JSON.parse(result);
      contentType = "json";
    } catch {
      contentType = "text";
    }
  } else if (result.includes("```") || result.includes("# ") || result.includes("**")) {
    contentType = "markdown";
  } else if (
    result.includes("function ") ||
    result.includes("const ") ||
    result.includes("import ") ||
    result.includes("def ") ||
    result.includes("class ")
  ) {
    contentType = "code";
  }

  return NextResponse.json({
    taskId: id,
    status: task.status,
    result,
    contentType,
  });
}
