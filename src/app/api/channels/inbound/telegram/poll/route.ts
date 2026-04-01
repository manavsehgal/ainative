import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { telegramAdapter } from "@/lib/channels/telegram-adapter";
import { handleInboundMessage } from "@/lib/channels/gateway";

/**
 * POST /api/channels/inbound/telegram/poll?configId=xxx
 *
 * Poll Telegram's getUpdates API for pending messages and process them
 * through the gateway. Use this for local development when Telegram
 * can't reach localhost via webhooks.
 *
 * Returns the number of updates processed.
 */
export async function POST(req: NextRequest) {
  const configId = req.nextUrl.searchParams.get("configId");
  if (!configId) {
    return NextResponse.json({ error: "Missing configId" }, { status: 400 });
  }

  const config = db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, configId))
    .get();

  if (!config) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  let parsedConfig: Record<string, unknown>;
  try {
    parsedConfig = JSON.parse(config.config) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid channel config" }, { status: 500 });
  }

  const botToken = parsedConfig.botToken as string;
  if (!botToken) {
    return NextResponse.json({ error: "Missing botToken in config" }, { status: 400 });
  }

  // Read optional offset from request body
  const body = await req.json().catch(() => ({})) as { offset?: number };

  // Fetch updates from Telegram
  const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
  const params: Record<string, unknown> = { timeout: 0 };
  if (body.offset) {
    params.offset = body.offset;
  }

  let updates: TelegramUpdate[];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
    if (!data.ok) {
      return NextResponse.json({ error: "Telegram getUpdates failed" }, { status: 502 });
    }
    updates = data.result;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Telegram API error" },
      { status: 502 }
    );
  }

  if (updates.length === 0) {
    return NextResponse.json({ processed: 0, nextOffset: body.offset ?? null });
  }

  // Process each update through the gateway
  let processed = 0;
  let maxUpdateId = 0;

  for (const update of updates) {
    if (update.update_id > maxUpdateId) {
      maxUpdateId = update.update_id;
    }

    const message = telegramAdapter.parseInbound!(update, {});
    if (!message || message.isBot) continue;

    // Process sequentially to respect turn locking
    try {
      await handleInboundMessage({ channelConfigId: configId, message });
      processed++;
    } catch (err) {
      console.error(`[telegram-poll] Error processing update ${update.update_id}:`, err);
    }
  }

  // Acknowledge processed updates so Telegram doesn't return them again
  if (maxUpdateId > 0) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offset: maxUpdateId + 1, timeout: 0 }),
      });
    } catch {
      // Non-fatal — updates will be re-processed next poll
    }
  }

  return NextResponse.json({
    processed,
    total: updates.length,
    nextOffset: maxUpdateId + 1,
  });
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; is_bot: boolean; first_name: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
}
