import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createEnrichmentWorkflow } from "@/lib/tables/enrichment";

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

const enrichRequestSchema = z.object({
  targetColumn: z.string().min(1).max(128),
  promptMode: z.enum(["auto", "custom"]).optional(),
  prompt: z.string().min(1).max(8192).optional(),
  filter: filterSchema.optional(),
  agentProfile: z.string().min(1).max(128).optional(),
  agentProfileOverride: z.string().min(1).max(128).optional(),
  projectId: z.string().nullable().optional(),
  // Reject non-positive ints; the upper bound is *clamped* in the handler so
  // callers asking for too much get a working (smaller) batch instead of a 400.
  batchSize: z.number().int().min(1).optional(),
  itemVariable: z.string().min(1).max(64).optional(),
  workflowName: z.string().min(1).max(256).optional(),
  plan: z
    .object({
      promptMode: z.enum(["auto", "custom"]),
      strategy: z.enum([
        "single-pass-lookup",
        "single-pass-classify",
        "research-and-synthesize",
      ]),
      agentProfile: z.string().min(1),
      reasoning: z.string(),
      steps: z.array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          purpose: z.string().min(1),
          prompt: z.string().min(1),
          agentProfile: z.string().min(1).optional(),
        })
      ),
      targetContract: z.object({
        columnName: z.string().min(1),
        columnLabel: z.string().min(1),
        dataType: z.enum(["text", "number", "boolean", "select", "url", "email"]),
        allowedOptions: z.array(z.string()).optional(),
      }),
      eligibleRowCount: z.number().int().min(0),
      sampleBindings: z.array(z.record(z.string(), z.unknown())),
    })
    .optional(),
}).superRefine((value, ctx) => {
  const hasPlan = Boolean(value.plan);
  const mode = value.promptMode ?? (value.prompt ? "custom" : "auto");
  if (!hasPlan && mode === "custom" && !value.prompt?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["prompt"],
      message: "Custom enrichment requires a prompt",
    });
  }
});

/**
 * POST /api/tables/[id]/enrich
 *
 * Kicks off a row-driven enrichment workflow for a user table. The workflow
 * runs fire-and-forget (TDR-001); the response includes the workflow id and
 * the number of rows that will actually be processed (already-populated rows
 * are filtered out for idempotency).
 *
 * Status codes:
 *  - 202: workflow created and queued
 *  - 400: invalid body, unknown column, or other validation failure
 *  - 404: table not found
 *  - 500: unexpected error
 */
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

  const parsed = enrichRequestSchema.safeParse(body);
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
    const result = await createEnrichmentWorkflow(id, {
      ...rest,
      batchSize: cappedBatchSize,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (/not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (/does not exist|unsupported/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[tables/enrich] POST error:", err);
    return NextResponse.json(
      { error: "Failed to start enrichment workflow" },
      { status: 500 }
    );
  }
}
