import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { conversations, chatMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { finalizeStreamingMessage } from "../reconcile";

function seedConversation(): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(conversations)
    .values({
      id,
      runtimeId: "test-runtime",
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

function seedStreaming(convId: string, content: string): string {
  const id = randomUUID();
  db.insert(chatMessages)
    .values({
      id,
      conversationId: convId,
      role: "assistant",
      content,
      status: "streaming",
      createdAt: new Date(),
    })
    .run();
  return id;
}

describe("finalizeStreamingMessage", () => {
  beforeEach(() => {
    db.delete(chatMessages).run();
    db.delete(conversations).run();
  });

  it("is a no-op when the message is already complete", async () => {
    const convId = seedConversation();
    const id = randomUUID();
    db.insert(chatMessages)
      .values({
        id,
        conversationId: convId,
        role: "assistant",
        content: "Already finished",
        status: "complete",
        createdAt: new Date(),
      })
      .run();

    await finalizeStreamingMessage(id, "ignored salvage text");

    const row = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .get();
    expect(row?.status).toBe("complete");
    expect(row?.content).toBe("Already finished");
  });

  it("salvages streaming row with substantial content as complete", async () => {
    const convId = seedConversation();
    const id = seedStreaming(convId, "");
    const partialText =
      "I searched the web and found three relevant articles about the topic. Here are the highlights of what I learned...";

    await finalizeStreamingMessage(id, partialText);

    const row = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .get();
    expect(row?.status).toBe("complete");
    expect(row?.content).toBe(partialText);
  });

  it("marks streaming row with no content as error with fallback string", async () => {
    const convId = seedConversation();
    const id = seedStreaming(convId, "");

    await finalizeStreamingMessage(id, "");

    const row = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .get();
    expect(row?.status).toBe("error");
    expect(row?.content).toMatch(/interrupted/i);
    expect(row?.content.length).toBeGreaterThan(0);
  });

  it("marks streaming row with very short content as error, not complete", async () => {
    const convId = seedConversation();
    const id = seedStreaming(convId, "");

    // 20 chars — not substantial enough to call "complete"
    await finalizeStreamingMessage(id, "Just a short reply.");

    const row = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .get();
    expect(row?.status).toBe("error");
    expect(row?.content).toBe("Just a short reply.");
  });

  it("marks streaming row with whitespace-only fullText as error with fallback", async () => {
    const convId = seedConversation();
    const id = seedStreaming(convId, "");

    await finalizeStreamingMessage(id, "   \n\n  \t ");

    const row = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .get();
    expect(row?.status).toBe("error");
    expect(row?.content).toMatch(/interrupted/i);
  });

  it("is a no-op when the message does not exist", async () => {
    // Should not throw — defensive null check
    await expect(
      finalizeStreamingMessage("nonexistent-id", "some text"),
    ).resolves.not.toThrow();
  });
});
