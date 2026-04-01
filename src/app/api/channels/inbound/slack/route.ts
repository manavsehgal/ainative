import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { slackAdapter } from "@/lib/channels/slack-adapter";
import { handleInboundMessage } from "@/lib/channels/gateway";

/**
 * POST /api/channels/inbound/slack?configId=xxx
 *
 * Receives Slack Events API callbacks.
 * Handles:
 * - url_verification challenge (required during Slack app setup)
 * - event_callback with message events
 *
 * IMPORTANT: Slack requires a 200 response within 3 seconds.
 * We respond immediately and process the message asynchronously.
 */
export async function POST(req: NextRequest) {
  const configId = req.nextUrl.searchParams.get("configId");

  // Read raw body for signature verification
  const rawBody = await req.text();
  let body: SlackPayload;
  try {
    body = JSON.parse(rawBody) as SlackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle URL verification challenge (no configId needed)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

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

  // Verify Slack signature
  let parsedConfig: Record<string, unknown>;
  try {
    parsedConfig = JSON.parse(config.config) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid channel config" }, { status: 500 });
  }

  // Require signingSecret — refuse to process inbound messages without signature verification
  if (!parsedConfig.signingSecret) {
    return NextResponse.json(
      { error: "Channel config missing signingSecret — cannot verify request" },
      { status: 401 }
    );
  }

  if (slackAdapter.verifySignature) {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    if (!slackAdapter.verifySignature(rawBody, headers, parsedConfig)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // Only handle event_callback with message events
  if (body.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const message = slackAdapter.parseInbound!(body, {});
  if (!message) {
    // Not a message event or bot message — acknowledge silently
    return NextResponse.json({ ok: true });
  }

  // Process asynchronously — respond 200 immediately (Slack 3-second requirement)
  handleInboundMessage({
    channelConfigId: configId,
    message,
  }).catch((err) => {
    console.error(`[slack-inbound] Error handling message for config ${configId}:`, err);
  });

  return NextResponse.json({ ok: true });
}

// ── Slack payload types ────────────────────────────────────────────────

interface SlackPayload {
  type: string;
  challenge?: string;
  token?: string;
  event?: {
    type: string;
    text?: string;
    user?: string;
    bot_id?: string;
    subtype?: string;
    ts?: string;
    thread_ts?: string;
    channel?: string;
  };
}
