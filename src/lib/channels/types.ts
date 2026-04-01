/**
 * Channel adapter types for multi-channel delivery and bidirectional chat.
 */

export interface ChannelAdapter {
  channelType: string;
  send(message: ChannelMessage, config: Record<string, unknown>): Promise<ChannelDeliveryResult>;
  testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; error?: string }>;

  // ── Bidirectional support (optional) ────────────────────────────────
  /** Parse an inbound webhook payload into a normalized message. */
  parseInbound?(rawBody: unknown, headers: Record<string, string>): InboundMessage | null;
  /** Verify webhook signature authenticity. */
  verifySignature?(rawBody: string, headers: Record<string, string>, config: Record<string, unknown>): boolean;
  /** Send a reply in-thread (distinct from fire-and-forget send). */
  sendReply?(message: ChannelMessage, config: Record<string, unknown>, threadId?: string): Promise<ChannelDeliveryResult>;
}

export interface ChannelMessage {
  subject: string;
  body: string;
  format: "text" | "markdown";
  metadata?: Record<string, unknown>;
}

export interface ChannelDeliveryResult {
  success: boolean;
  channelId?: string;
  externalId?: string;
  error?: string;
}

// ── Credential masking ───────────────────────────────────────────────

/** Fields in channel config JSON that contain secrets and must be masked in API responses. */
const SENSITIVE_CONFIG_KEYS = ["botToken", "signingSecret", "webhookSecret"];

/**
 * Mask sensitive fields in a channel config JSON string.
 * Returns a new JSON string with secrets replaced by "****<last4>".
 */
export function maskChannelConfig(configJson: string): string {
  try {
    const parsed = JSON.parse(configJson) as Record<string, unknown>;
    for (const key of SENSITIVE_CONFIG_KEYS) {
      const val = parsed[key];
      if (typeof val === "string" && val.length > 0) {
        const last4 = val.slice(-4);
        parsed[key] = `****${last4}`;
      }
    }
    return JSON.stringify(parsed);
  } catch {
    return configJson;
  }
}

/**
 * Mask sensitive fields in a channel config row before returning from API.
 */
export function maskChannelRow<T extends { config: string }>(row: T): T {
  return { ...row, config: maskChannelConfig(row.config) };
}

/** Normalized inbound message from any channel. */
export interface InboundMessage {
  text: string;
  senderName?: string;
  senderId?: string;
  externalThreadId?: string;
  externalMessageId?: string;
  isBot?: boolean;
  /** Raw channel-specific payload for adapter-level access. */
  raw?: unknown;
}
