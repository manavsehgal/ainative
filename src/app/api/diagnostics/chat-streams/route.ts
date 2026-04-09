import { NextRequest, NextResponse } from "next/server";
import {
  readTerminations,
  countTerminations,
} from "@/lib/chat/stream-telemetry";

/**
 * GET /api/diagnostics/chat-streams
 *
 * Dev-only diagnostics endpoint that reports how chat SSE streams have
 * terminated in the current server process. Returns counts by reason code
 * plus the most recent N events.
 *
 * Query params:
 *   ?windowMinutes=N  — restrict counts to the last N minutes (default: all)
 *   ?limit=N          — cap on recent events returned (default: 50, max: 500)
 *
 * Response shape:
 *   {
 *     windowMinutes: number | null,
 *     totalEvents: number,
 *     counts: Record<TerminationReason, number>,
 *     recent: TerminationEvent[]
 *   }
 *
 * Gated behind NODE_ENV !== production to match the data/clear and
 * data/seed routes. This is for maintainer inspection, not end users.
 *
 * See src/lib/chat/stream-telemetry.ts for the ring buffer + reason code
 * definitions. See features/chat-stream-resilience-telemetry.md for the
 * motivation (verify-before-building telemetry for a mid-stream refresh
 * bug reported by a sibling repo that doesn't reproduce here).
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Diagnostics disabled in production" },
      { status: 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const windowMinutesRaw = searchParams.get("windowMinutes");
  const limitRaw = searchParams.get("limit");

  const windowMinutes =
    windowMinutesRaw !== null ? Math.max(0, parseInt(windowMinutesRaw, 10) || 0) : null;
  const windowMs = windowMinutes !== null ? windowMinutes * 60 * 1000 : 0;

  const limit = Math.min(
    500,
    limitRaw !== null ? Math.max(1, parseInt(limitRaw, 10) || 50) : 50
  );

  const all = readTerminations();
  const recent = all.slice(-limit).reverse(); // newest first
  const counts = countTerminations(windowMs);

  return NextResponse.json({
    windowMinutes,
    totalEvents: all.length,
    counts,
    recent,
  });
}
