/**
 * Channel Poller — background service that polls bidirectional channels
 * for inbound messages when webhooks can't reach the server (e.g., localhost).
 *
 * Runs alongside the scheduler via instrumentation.ts.
 * Only polls channels with direction="bidirectional" and status="active".
 */

import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { telegramAdapter } from "./telegram-adapter";
import { handleInboundMessage } from "./gateway";
import type { InboundMessage } from "./types";

const POLL_INTERVAL_MS = 5_000; // 5 seconds
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Per-channel offset tracking (in-memory, resets on restart). */
const channelOffsets = new Map<string, number>();

/** Per-channel Slack timestamp tracking (in-memory). */
const slackTimestamps = new Map<string, string>();

/** Lock to prevent overlapping ticks. */
let ticking = false;

export function startChannelPoller(): void {
  if (intervalHandle !== null) return;
  intervalHandle = setInterval(() => {
    tickPoller().catch((err) => {
      console.error("[channel-poller] tick error:", err);
    });
  }, POLL_INTERVAL_MS);
  console.log(`[channel-poller] started — polling every ${POLL_INTERVAL_MS / 1000}s`);
}

export function stopChannelPoller(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[channel-poller] stopped");
  }
}

async function tickPoller(): Promise<void> {
  if (ticking) return; // Skip if previous tick still running
  ticking = true;
  try {
    // Find all active bidirectional channels
    const channels = db
      .select()
      .from(channelConfigs)
      .where(
        and(
          eq(channelConfigs.direction, "bidirectional"),
          eq(channelConfigs.status, "active")
        )
      )
      .all();

    for (const channel of channels) {
      try {
        await pollChannel(channel);
      } catch (err) {
        console.error(`[channel-poller] error polling ${channel.channelType}/${channel.id}:`, err);
      }
    }
  } finally {
    ticking = false;
  }
}

async function pollChannel(
  channel: typeof channelConfigs.$inferSelect
): Promise<void> {
  if (channel.channelType === "telegram") {
    await pollTelegram(channel);
  } else if (channel.channelType === "slack") {
    await pollSlack(channel);
  }
  // Webhook channels are push-based — no polling needed
}

async function pollTelegram(
  channel: typeof channelConfigs.$inferSelect
): Promise<void> {
  let parsedConfig: Record<string, unknown>;
  try {
    parsedConfig = JSON.parse(channel.config) as Record<string, unknown>;
  } catch {
    return;
  }

  const botToken = parsedConfig.botToken as string;
  if (!botToken) return;

  const offset = channelOffsets.get(channel.id);
  const params: Record<string, unknown> = { timeout: 0, limit: 20 };
  if (offset) {
    params.offset = offset;
  }

  let updates: TelegramUpdate[];
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }
    );
    const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
    if (!data.ok) return;
    updates = data.result;
  } catch {
    return; // Network error — retry next tick
  }

  if (updates.length === 0) return;

  let maxUpdateId = 0;
  for (const update of updates) {
    if (update.update_id > maxUpdateId) {
      maxUpdateId = update.update_id;
    }

    const message = telegramAdapter.parseInbound!(update, {});
    if (!message || message.isBot) continue;

    try {
      await handleInboundMessage({
        channelConfigId: channel.id,
        message,
      });
    } catch (err) {
      console.error(`[channel-poller] error processing telegram update ${update.update_id}:`, err);
    }
  }

  // Advance offset so Telegram doesn't return these again
  if (maxUpdateId > 0) {
    const nextOffset = maxUpdateId + 1;
    channelOffsets.set(channel.id, nextOffset);

    // Acknowledge with Telegram
    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: nextOffset, timeout: 0 }),
        }
      );
    } catch {
      // Non-fatal
    }
  }
}

async function pollSlack(
  channel: typeof channelConfigs.$inferSelect
): Promise<void> {
  let parsedConfig: Record<string, unknown>;
  try {
    parsedConfig = JSON.parse(channel.config) as Record<string, unknown>;
  } catch {
    return;
  }

  const botToken = parsedConfig.botToken as string;
  const slackChannelId = parsedConfig.slackChannelId as string;
  if (!botToken || !slackChannelId) return;

  // Use oldest timestamp to only fetch new messages
  const oldest = slackTimestamps.get(channel.id);

  const params = new URLSearchParams({
    channel: slackChannelId,
    limit: "20",
  });
  if (oldest) {
    params.set("oldest", oldest);
  }

  let messages: SlackMessage[];
  try {
    const res = await fetch(
      `https://slack.com/api/conversations.history?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${botToken}` },
      }
    );
    const data = (await res.json()) as {
      ok: boolean;
      messages?: SlackMessage[];
      error?: string;
    };
    if (!data.ok || !data.messages) return;
    messages = data.messages;
  } catch {
    return; // Network error — retry next tick
  }

  if (messages.length === 0) return;

  // Slack returns newest first — reverse to process chronologically
  messages.reverse();

  let maxTs = oldest ?? "0";
  for (const msg of messages) {
    // Skip bot messages, subtypes (joins, edits), and already-seen messages
    if (msg.bot_id || msg.subtype) continue;
    if (oldest && msg.ts <= oldest) continue;

    if (msg.ts > maxTs) {
      maxTs = msg.ts;
    }

    const inbound: InboundMessage = {
      text: msg.text ?? "",
      senderId: msg.user,
      senderName: msg.user,
      externalThreadId: msg.thread_ts ?? msg.ts,
      externalMessageId: msg.ts,
      isBot: !!msg.bot_id,
    };

    if (!inbound.text) continue;

    try {
      await handleInboundMessage({
        channelConfigId: channel.id,
        message: inbound,
      });
    } catch (err) {
      console.error(`[channel-poller] error processing slack message ${msg.ts}:`, err);
    }
  }

  // Track the latest timestamp so we don't re-process
  if (maxTs > (oldest ?? "0")) {
    slackTimestamps.set(channel.id, maxTs);
  }
}

interface SlackMessage {
  type: string;
  text?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  ts: string;
  thread_ts?: string;
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
