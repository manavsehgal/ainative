import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { maskChannelRow } from "@/lib/channels/types";

const VALID_CHANNEL_TYPES = ["slack", "telegram", "webhook"] as const;

export async function GET() {
  const result = await db
    .select()
    .from(channelConfigs)
    .orderBy(desc(channelConfigs.createdAt));

  return NextResponse.json(result.map(maskChannelRow));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { channelType, name, config } = body as {
    channelType?: string;
    name?: string;
    config?: Record<string, unknown>;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!channelType || !VALID_CHANNEL_TYPES.includes(channelType as typeof VALID_CHANNEL_TYPES[number])) {
    return NextResponse.json(
      { error: `Invalid channel type. Must be one of: ${VALID_CHANNEL_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!config || typeof config !== "object") {
    return NextResponse.json({ error: "Config object is required" }, { status: 400 });
  }

  // Validate required fields per type
  if (channelType === "slack" && !config.webhookUrl) {
    return NextResponse.json({ error: "Slack channels require a webhookUrl" }, { status: 400 });
  }
  if (channelType === "telegram" && (!config.botToken || !config.chatId)) {
    return NextResponse.json({ error: "Telegram channels require botToken and chatId" }, { status: 400 });
  }
  if (channelType === "webhook" && !config.url) {
    return NextResponse.json({ error: "Webhook channels require a url" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(channelConfigs).values({
    id,
    channelType: channelType as typeof VALID_CHANNEL_TYPES[number],
    name: name.trim(),
    config: JSON.stringify(config),
    status: "active",
    testStatus: "untested",
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, id));

  return NextResponse.json(maskChannelRow(created), { status: 201 });
}
