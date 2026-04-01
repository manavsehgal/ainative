/**
 * Channel adapter types for multi-channel delivery.
 */

export interface ChannelAdapter {
  channelType: string;
  send(message: ChannelMessage, config: Record<string, unknown>): Promise<ChannelDeliveryResult>;
  testConnection(config: Record<string, unknown>): Promise<{ ok: boolean; error?: string }>;
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
