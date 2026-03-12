import { NextRequest, NextResponse } from "next/server";
import {
  getBudgetGuardrailSnapshot,
  setBudgetPolicy,
} from "@/lib/settings/budget-guardrails";
import { updateBudgetPolicySchema } from "@/lib/validators/settings";

export async function GET() {
  const snapshot = await getBudgetGuardrailSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = updateBudgetPolicySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await setBudgetPolicy(parsed.data);
  const snapshot = await getBudgetGuardrailSnapshot();
  return NextResponse.json(snapshot);
}
