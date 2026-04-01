import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { ChannelAdapter, ChannelMessage, ChannelDeliveryResult } from "./types";
import { slackAdapter } from "./slack-adapter";
import { telegramAdapter } from "./telegram-adapter";
import { webhookAdapter } from "./webhook-adapter";

const adapters: Record<string, ChannelAdapter> = {
  slack: slackAdapter,
  telegram: telegramAdapter,
  webhook: webhookAdapter,
};

/**
 * Get a channel adapter by type.
 */
export function getChannelAdapter(channelType: string): ChannelAdapter {
  const adapter = adapters[channelType];
  if (!adapter) {
    throw new Error(`Unknown channel type: ${channelType}`);
  }
  return adapter;
}

/**
 * Send a message to multiple channels by their config IDs.
 * Skips disabled channels. Returns results for each channel attempted.
 */
export async function sendToChannels(
  channelIds: string[],
  message: ChannelMessage
): Promise<ChannelDeliveryResult[]> {
  if (channelIds.length === 0) return [];

  const configs = await db
    .select()
    .from(channelConfigs)
    .where(inArray(channelConfigs.id, channelIds));

  const results: ChannelDeliveryResult[] = [];

  for (const config of configs) {
    if (config.status === "disabled") {
      results.push({
        success: false,
        channelId: config.id,
        error: "Channel is disabled",
      });
      continue;
    }

    const adapter = adapters[config.channelType];
    if (!adapter) {
      results.push({
        success: false,
        channelId: config.id,
        error: `Unknown channel type: ${config.channelType}`,
      });
      continue;
    }

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config.config) as Record<string, unknown>;
    } catch {
      results.push({
        success: false,
        channelId: config.id,
        error: "Invalid channel config JSON",
      });
      continue;
    }

    const result = await adapter.send(message, parsedConfig);
    results.push({ ...result, channelId: config.id });

    // Update test status based on send result
    const now = new Date();
    db.update(channelConfigs)
      .set({
        testStatus: result.success ? "ok" : "failed",
        updatedAt: now,
      })
      .where(eq(channelConfigs.id, config.id))
      .run();
  }

  return results;
}
