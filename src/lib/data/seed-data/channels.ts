export interface ChannelConfigSeed {
  id: string;
  channelType: "slack" | "telegram" | "webhook";
  name: string;
  config: string; // JSON
  status: "active" | "disabled";
  testStatus: "untested" | "ok" | "failed";
  direction: "outbound" | "bidirectional";
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelBindingSeed {
  id: string;
  channelConfigId: string;
  conversationId: string;
  externalThreadId: string | null;
  runtimeId: string;
  modelId: string | null;
  profileId: string | null;
  status: "active" | "paused" | "archived";
  pendingRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Seed realistic multi-channel delivery + bidirectional chat configs.
 * Credentials use plausible-looking synthetic strings; the channels API
 * masks them before returning to clients, so we include shape-correct
 * examples for demo purposes.
 */
export function createChannels(conversationIds: string[]): {
  configs: ChannelConfigSeed[];
  bindings: ChannelBindingSeed[];
} {
  const now = Date.now();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;

  const slackOps = crypto.randomUUID();
  const slackCS = crypto.randomUUID();
  const telegramLaunch = crypto.randomUUID();
  const webhookAnalytics = crypto.randomUUID();
  const webhookZapier = crypto.randomUUID();

  const configs: ChannelConfigSeed[] = [
    {
      id: slackOps,
      channelType: "slack",
      name: "#ops-alerts",
      config: JSON.stringify({
        channelId: "C08RX9K2M3N",
        botToken: "xoxb-EXAMPLE-SEED-TOKEN-NOT-REAL-ops",
        signingSecret: "e7d8c1f2a3b4c5d6e7f8a9b0c1d2e3f4",
        botUserId: "U08RX9K2M3N",
      }),
      status: "active",
      testStatus: "ok",
      direction: "bidirectional",
      createdAt: new Date(now - 20 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: slackCS,
      channelType: "slack",
      name: "#cs-escalations",
      config: JSON.stringify({
        channelId: "C08RX9P7Q8R",
        botToken: "xoxb-EXAMPLE-SEED-TOKEN-NOT-REAL-cs",
        signingSecret: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
        botUserId: "U08RX9P7Q8R",
      }),
      status: "active",
      testStatus: "ok",
      direction: "outbound",
      createdAt: new Date(now - 14 * DAY),
      updatedAt: new Date(now - 3 * HOUR),
    },
    {
      id: telegramLaunch,
      channelType: "telegram",
      name: "Launch Command (Telegram)",
      config: JSON.stringify({
        chatId: "-1001234567890",
        botToken: "TELEGRAM_SEED_TOKEN_PLACEHOLDER_NOT_REAL",
        webhookSecret: "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
      }),
      status: "active",
      testStatus: "ok",
      direction: "bidirectional",
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 6 * HOUR),
    },
    {
      id: webhookAnalytics,
      channelType: "webhook",
      name: "Analytics Digest (Linear)",
      config: JSON.stringify({
        webhookUrl: "https://hooks.linear.app/integrations/webhook/abc123xyz",
        webhookSecret: "aaaa1111bbbb2222cccc3333dddd4444",
      }),
      status: "active",
      testStatus: "ok",
      direction: "outbound",
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: webhookZapier,
      channelType: "webhook",
      name: "Zapier Catch Hook (failing)",
      config: JSON.stringify({
        webhookUrl:
          "https://hooks.zapier.com/hooks/catch/9876543/abcdefg/retired",
        webhookSecret: "5555eeee6666ffff7777gggg8888hhhh",
      }),
      status: "disabled",
      testStatus: "failed",
      direction: "outbound",
      createdAt: new Date(now - 30 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
  ];

  const bindings: ChannelBindingSeed[] = [];

  if (conversationIds.length > 0) {
    const [conv1, conv2, conv3] = conversationIds;
    if (conv1) {
      bindings.push({
        id: crypto.randomUUID(),
        channelConfigId: slackOps,
        conversationId: conv1,
        externalThreadId: "1711234567.001100",
        runtimeId: "claude-agent-sdk",
        modelId: "claude-sonnet-4-6",
        profileId: "general",
        status: "active",
        pendingRequestId: null,
        createdAt: new Date(now - 4 * DAY),
        updatedAt: new Date(now - 2 * HOUR),
      });
    }
    if (conv2) {
      bindings.push({
        id: crypto.randomUUID(),
        channelConfigId: telegramLaunch,
        conversationId: conv2,
        externalThreadId: "message_reply_42",
        runtimeId: "claude-agent-sdk",
        modelId: "claude-sonnet-4-6",
        profileId: "general",
        status: "active",
        pendingRequestId: null,
        createdAt: new Date(now - 2 * DAY),
        updatedAt: new Date(now - 1 * HOUR),
      });
    }
    if (conv3) {
      bindings.push({
        id: crypto.randomUUID(),
        channelConfigId: slackCS,
        conversationId: conv3,
        externalThreadId: null,
        runtimeId: "claude-agent-sdk",
        modelId: "claude-sonnet-4-6",
        profileId: "general",
        status: "paused",
        pendingRequestId: null,
        createdAt: new Date(now - 12 * DAY),
        updatedAt: new Date(now - 4 * DAY),
      });
    }
  }

  return { configs, bindings };
}
