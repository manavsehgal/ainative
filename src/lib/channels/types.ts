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
