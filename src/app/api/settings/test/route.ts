import { NextResponse } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getAuthEnv, updateAuthStatus } from "@/lib/settings/auth";

export async function POST() {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);

  try {
    const authEnv = await getAuthEnv();
    const response = query({
      prompt: "Reply with exactly: OK",
      options: {
        abortController,
        maxTurns: 1,
        cwd: process.cwd(),
        ...(authEnv && { env: { ...process.env, ...authEnv } }),
      },
    });

    for await (const raw of response as AsyncIterable<Record<string, unknown>>) {
      const message = raw as { type?: string; subtype?: string; api_key_source?: string };

      // We only need the init message to confirm connectivity
      if (message.type === "system" && message.subtype === "init") {
        const source = message.api_key_source ?? "unknown";
        updateAuthStatus(source as "db" | "env" | "oauth" | "unknown");
        abortController.abort();
        clearTimeout(timeout);
        return NextResponse.json({ connected: true, apiKeySource: source });
      }
    }

    clearTimeout(timeout);
    return NextResponse.json({ connected: true, apiKeySource: "unknown" });
  } catch (error: unknown) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);

    // Abort errors are expected when we abort after init
    if (abortController.signal.aborted && !message.includes("auth")) {
      return NextResponse.json({ connected: true, apiKeySource: "unknown" });
    }

    return NextResponse.json(
      { connected: false, error: message },
      { status: 200 } // 200 so the client can read the error
    );
  }
}
