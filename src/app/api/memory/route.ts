import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentMemory } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { checkLimit, buildLimitErrorBody } from "@/lib/license/limit-check";
import { getMemoryCount } from "@/lib/license/limit-queries";
import { createTierLimitNotification } from "@/lib/license/notifications";

/**
 * GET /api/memory?profileId=xxx&category=fact&status=active
 * List memories with optional filters.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const profileId = searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId query parameter is required" },
      { status: 400 }
    );
  }

  const conditions = [eq(agentMemory.profileId, profileId)];

  const category = searchParams.get("category");
  if (category) {
    conditions.push(
      eq(
        agentMemory.category,
        category as "fact" | "preference" | "pattern" | "outcome"
      )
    );
  }

  const status = searchParams.get("status");
  if (status) {
    conditions.push(
      eq(
        agentMemory.status,
        status as "active" | "decayed" | "archived" | "rejected"
      )
    );
  }

  const memories = db
    .select()
    .from(agentMemory)
    .where(and(...conditions))
    .orderBy(desc(agentMemory.confidence))
    .all();

  return NextResponse.json(memories);
}

/**
 * POST /api/memory
 * Create a memory manually (operator injection).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profileId, category, content, tags, confidence } = body;

    if (!profileId || !category || !content) {
      return NextResponse.json(
        { error: "profileId, category, and content are required" },
        { status: 400 }
      );
    }

    const validCategories = ["fact", "preference", "pattern", "outcome"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Tier limit check — memory cap per profile
    const currentCount = getMemoryCount(profileId);
    const limitResult = checkLimit("agentMemories", currentCount);
    if (!limitResult.allowed) {
      createTierLimitNotification("agentMemories", currentCount, limitResult.limit).catch(() => {});
      return NextResponse.json(buildLimitErrorBody("agentMemories", limitResult), { status: 402 });
    }

    const now = new Date();
    const id = randomUUID();
    // Convert 0-1 confidence to 0-1000, default 700
    const confidenceInt =
      confidence !== undefined
        ? Math.round(Math.min(1, Math.max(0, confidence)) * 1000)
        : 700;

    db.insert(agentMemory)
      .values({
        id,
        profileId,
        category,
        content,
        confidence: confidenceInt,
        tags: tags ? JSON.stringify(tags) : null,
        accessCount: 0,
        decayRate: 10,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return NextResponse.json({ id }, { status: 201 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create memory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * PATCH /api/memory
 * Update memory confidence or status.
 * Body: { id: string, confidence?: number (0-1000), status?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, confidence, status } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (confidence !== undefined) {
      updates.confidence = Math.round(
        Math.min(1000, Math.max(0, confidence))
      );
    }

    if (status !== undefined) {
      const validStatuses = ["active", "decayed", "archived", "rejected"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `status must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    db.update(agentMemory)
      .set(updates)
      .where(eq(agentMemory.id, id))
      .run();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update memory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/memory
 * Soft-delete: set status to "archived" (no hard delete).
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    db.update(agentMemory)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(agentMemory.id, id))
      .run();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to archive memory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
