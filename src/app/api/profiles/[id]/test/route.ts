import { NextRequest, NextResponse } from "next/server";
import { runProfileTests } from "@/lib/agents/profiles/test-runner";

/**
 * POST /api/profiles/[id]/test
 *
 * Run behavioral smoke tests for a profile. Returns test results
 * with pass/fail per test case and keyword match details.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const report = await runProfileTests(id);
    return NextResponse.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Test execution failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
