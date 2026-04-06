import { NextRequest, NextResponse } from "next/server";
import { analyzeWorkflowFailure } from "@/lib/workflows/error-analysis";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const analysis = await analyzeWorkflowFailure(id);
    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
