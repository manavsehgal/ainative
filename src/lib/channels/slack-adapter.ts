import type { ChannelAdapter, ChannelMessage, ChannelDeliveryResult } from "./types";

/**
 * Convert basic Markdown to Slack mrkdwn format.
 * - **bold** -> *bold*
 * - `code` stays as-is
 * - Links stay as-is
 */
function toSlackMrkdwn(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "*$1*") // bold
    .replace(/~~(.+?)~~/g, "~$1~"); // strikethrough
}

export const slackAdapter: ChannelAdapter = {
  channelType: "slack",

  async send(message: ChannelMessage, config: Record<string, unknown>): Promise<ChannelDeliveryResult> {
    const webhookUrl = config.webhookUrl as string;
    if (!webhookUrl) {
      return { success: false, error: "Missing webhookUrl in config" };
    }

    const text = message.format === "markdown"
      ? toSlackMrkdwn(`*${message.subject}*\n\n${message.body}`)
      : `${message.subject}\n\n${message.body}`;

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `Slack webhook returned ${res.status}: ${body}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const webhookUrl = config.webhookUrl as string;
    if (!webhookUrl) {
      return { ok: false, error: "Missing webhookUrl" };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Stagent channel test - connection OK" }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: `Webhook returned ${res.status}: ${body}` };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
