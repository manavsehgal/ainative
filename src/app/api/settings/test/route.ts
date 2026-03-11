import { NextResponse } from "next/server";
import { DEFAULT_AGENT_RUNTIME } from "@/lib/agents/runtime/catalog";
import { getRuntimeSummary, testRuntimeConnection } from "@/lib/agents/runtime";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      runtime?: string;
    };
    const runtimeId = body.runtime ?? DEFAULT_AGENT_RUNTIME;
    const result = await testRuntimeConnection(runtimeId);
    const summary = getRuntimeSummary(runtimeId);
    return NextResponse.json({
      ...result,
      runtime: summary.runtime.id,
      capabilities: summary.capabilities,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { connected: false, error: message },
      { status: 200 } // 200 so the client can read the error
    );
  }
}
