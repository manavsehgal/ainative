import { NextRequest, NextResponse } from "next/server";
import { generateOptimizationSuggestions } from "@/lib/workflows/optimizer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { definition, workflowId } = body;

    if (!definition) {
      return NextResponse.json(
        { error: "definition is required" },
        { status: 400 }
      );
    }

    const suggestions = await generateOptimizationSuggestions(
      definition,
      workflowId
    );
    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Optimization failed",
      },
      { status: 500 }
    );
  }
}
