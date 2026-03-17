import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  batchApproveProposals,
  batchRejectProposals,
} from "@/lib/agents/learning-session";

const batchSchema = z.object({
  proposalIds: z.array(z.string().min(1)).min(1),
  action: z.enum(["approve", "reject"]),
});

/**
 * POST /api/context/batch — batch approve or reject context proposals.
 *
 * Used by the batch proposal review UI after workflow completion.
 * Accepts an array of learned_context row IDs and an action.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = batchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "proposalIds (string[]) and action ('approve'|'reject') are required" },
        { status: 400 }
      );
    }

    const { proposalIds, action } = parsed.data;

    const count =
      action === "approve"
        ? await batchApproveProposals(proposalIds)
        : await batchRejectProposals(proposalIds);

    return NextResponse.json({ success: true, action, count });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Batch operation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
