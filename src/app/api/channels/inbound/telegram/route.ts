import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { telegramAdapter } from "@/lib/channels/telegram-adapter";
import { handleInboundMessage } from "@/lib/channels/gateway";

/**
 * POST /api/channels/inbound/telegram?configId=xxx&secret=yyy
 *
 * Receives Telegram Bot API webhook updates.
 * - configId: channel config ID to route to
 * - secret: shared secret for verification (set during webhook registration)
 */
export async function POST(req: NextRequest) {
  const configId = req.nextUrl.searchParams.get("configId");
  const secret = req.nextUrl.searchParams.get("secret");

  if (!configId) {
    return NextResponse.json({ error: "Missing configId" }, { status: 400 });
  }

  // Fetch channel config
  const config = db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, configId))
    .get();

  if (!config) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Verify secret token
  let parsedConfig: Record<string, unknown>;
  try {
    parsedConfig = JSON.parse(config.config) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid channel config" }, { status: 500 });
  }

  // Require webhookSecret — refuse to process inbound messages without authentication
  const expectedSecret = parsedConfig.webhookSecret as string | undefined;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Channel config missing webhookSecret — cannot verify request" },
      { status: 401 }
    );
  }

  // NOTE: The secret is passed as a query-string parameter. This is Telegram's recommended
  // webhook verification design (https://core.telegram.org/bots/api#setwebhook secret_token).
  // Query strings may appear in server access logs — ensure logs are access-controlled.
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  // Parse the Telegram update
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = telegramAdapter.parseInbound!(body, {});
  if (!message) {
    // Not a text message (e.g., edited message, photo) — acknowledge silently
    return NextResponse.json({ ok: true });
  }

  // Skip bot messages to prevent loops
  if (message.isBot) {
    return NextResponse.json({ ok: true });
  }

  // Process asynchronously — respond 200 immediately to Telegram
  // (Telegram retries if no response within ~60s, but faster is better)
  handleInboundMessage({
    channelConfigId: configId,
    message,
  }).catch((err) => {
    console.error(`[telegram-inbound] Error handling message for config ${configId}:`, err);
  });

  return NextResponse.json({ ok: true });
}
