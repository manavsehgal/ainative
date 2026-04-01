import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getChannelAdapter } from "@/lib/channels/registry";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [channel] = await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, id));

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  let parsedConfig: Record<string, unknown>;
  try {
    parsedConfig = JSON.parse(channel.config) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid channel config JSON" }, { status: 500 });
  }

  try {
    const adapter = getChannelAdapter(channel.channelType);
    const result = await adapter.testConnection(parsedConfig);

    const now = new Date();
    await db
      .update(channelConfigs)
      .set({
        testStatus: result.ok ? "ok" : "failed",
        updatedAt: now,
      })
      .where(eq(channelConfigs.id, id));

    return NextResponse.json({
      testStatus: result.ok ? "ok" : "failed",
      error: result.error,
    });
  } catch (err) {
    return NextResponse.json(
      { testStatus: "failed", error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
