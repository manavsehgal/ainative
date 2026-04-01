import type { ChannelAdapter, ChannelMessage, ChannelDeliveryResult } from "./types";

/**
 * Escape special characters for Telegram MarkdownV2 format.
 */
function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/**
 * Convert basic Markdown to Telegram MarkdownV2.
 * We escape special chars first, then re-apply bold/code formatting.
 */
function toTelegramMarkdownV2(subject: string, body: string): string {
  const escapedSubject = escapeMarkdownV2(subject);
  const escapedBody = escapeMarkdownV2(body);
  return `*${escapedSubject}*\n\n${escapedBody}`;
}

export const telegramAdapter: ChannelAdapter = {
  channelType: "telegram",

  async send(message: ChannelMessage, config: Record<string, unknown>): Promise<ChannelDeliveryResult> {
    const botToken = config.botToken as string;
    const chatId = config.chatId as string;

    if (!botToken || !chatId) {
      return { success: false, error: "Missing botToken or chatId in config" };
    }

    const text = message.format === "markdown"
      ? toTelegramMarkdownV2(message.subject, message.body)
      : `${message.subject}\n\n${message.body}`;

    const parseMode = message.format === "markdown" ? "MarkdownV2" : undefined;

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(parseMode ? { parse_mode: parseMode } : {}),
        }),
      });

      const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string };

      if (!data.ok) {
        return { success: false, error: data.description ?? `Telegram API error (${res.status})` };
      }

      return { success: true, externalId: String(data.result?.message_id) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const botToken = config.botToken as string;
    if (!botToken) {
      return { ok: false, error: "Missing botToken" };
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/getMe`;
      const res = await fetch(url);
      const data = await res.json() as { ok: boolean; description?: string };

      if (!data.ok) {
        return { ok: false, error: data.description ?? "Telegram getMe failed" };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
