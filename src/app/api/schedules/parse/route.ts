import { NextRequest, NextResponse } from "next/server";
import { parseNaturalLanguage } from "@/lib/schedules/nlp-parser";
import {
  parseInterval,
  computeNextFireTime,
  describeCron,
} from "@/lib/schedules/interval-parser";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { expression } = body as { expression?: string };

  if (!expression?.trim()) {
    return NextResponse.json(
      { error: "Expression is required" },
      { status: 400 }
    );
  }

  const input = expression.trim();

  // Layer 1: Try NLP parser first
  const nlResult = parseNaturalLanguage(input);
  if (nlResult) {
    const nextFireTimes = computeNextNFireTimes(nlResult.cronExpression, 3);
    return NextResponse.json({
      cronExpression: nlResult.cronExpression,
      description: nlResult.description,
      nextFireTimes,
      confidence: nlResult.confidence,
    });
  }

  // Layer 2: Fall back to parseInterval (handles "5m", "2h", "1d", raw cron)
  try {
    const cronExpression = parseInterval(input);
    const description = describeCron(cronExpression);
    const nextFireTimes = computeNextNFireTimes(cronExpression, 3);
    return NextResponse.json({
      cronExpression,
      description,
      nextFireTimes,
      confidence: 1.0,
    });
  } catch {
    return NextResponse.json(
      { error: `Could not parse "${input}". Try expressions like "every weekday at 9am", "hourly", "5m", or a cron expression.` },
      { status: 400 }
    );
  }
}

/**
 * Compute the next N fire times from a cron expression.
 */
function computeNextNFireTimes(cronExpression: string, count: number): string[] {
  const times: string[] = [];
  let from = new Date();
  for (let i = 0; i < count; i++) {
    const next = computeNextFireTime(cronExpression, from);
    times.push(next.toISOString());
    // Move 1ms past the computed time so the next iteration advances
    from = new Date(next.getTime() + 1000);
  }
  return times;
}
