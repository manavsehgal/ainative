import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { previewEnrichmentPlan } from "@/lib/tables/enrichment";

const MAX_BATCH_SIZE = 200;

const filterSchema = z.object({
  column: z.string().min(1),
  operator: z.enum([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "starts_with",
    "in",
    "is_empty",
    "is_not_empty",
  ]),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional(),
});

const previewRequestSchema = z.object({
  targetColumn: z.string().min(1).max(128),
  promptMode: z.enum(["auto", "custom"]).optional(),
  prompt: z.string().min(1).max(8192).optional(),
  filter: filterSchema.optional(),
  agentProfile: z.string().min(1).max(128).optional(),
  agentProfileOverride: z.string().min(1).max(128).optional(),
  batchSize: z.number().int().min(1).optional(),
}).superRefine((value, ctx) => {
  const mode = value.promptMode ?? (value.prompt ? "custom" : "auto");
  if (mode === "custom" && !value.prompt?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["prompt"],
      message: "Custom enrichment requires a prompt",
    });
  }
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = previewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const { batchSize, ...rest } = parsed.data;
  const cappedBatchSize =
    batchSize !== undefined ? Math.min(batchSize, MAX_BATCH_SIZE) : undefined;

  try {
    const preview = await previewEnrichmentPlan(id, {
      ...rest,
      batchSize: cappedBatchSize,
    });
    return NextResponse.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (/not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (/does not exist|unsupported/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[tables/enrich/plan] POST error:", err);
    return NextResponse.json(
      { error: "Failed to build enrichment plan" },
      { status: 500 }
    );
  }
}
