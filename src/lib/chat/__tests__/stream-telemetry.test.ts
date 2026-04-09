import { describe, it, expect, beforeEach } from "vitest";
import {
  recordTermination,
  readTerminations,
  countTerminations,
  __resetForTesting,
} from "../stream-telemetry";

describe("stream-telemetry ring buffer", () => {
  beforeEach(() => {
    __resetForTesting();
  });

  it("returns [] before any events are recorded", () => {
    expect(readTerminations()).toEqual([]);
  });

  it("records events in chronological order", () => {
    recordTermination({
      reason: "stream.completed",
      conversationId: "c1",
      messageId: "m1",
      durationMs: 100,
    });
    recordTermination({
      reason: "stream.aborted.client",
      conversationId: "c2",
      messageId: "m2",
      durationMs: 50,
    });

    const events = readTerminations();
    expect(events).toHaveLength(2);
    expect(events[0].reason).toBe("stream.completed");
    expect(events[1].reason).toBe("stream.aborted.client");
    expect(events[0].timestamp).toBeLessThanOrEqual(events[1].timestamp);
  });

  it("stamps each event with a timestamp", () => {
    const before = Date.now();
    recordTermination({
      reason: "stream.completed",
      conversationId: "c1",
      messageId: "m1",
      durationMs: 0,
    });
    const after = Date.now();
    const events = readTerminations();
    expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(events[0].timestamp).toBeLessThanOrEqual(after);
  });

  it("wraps around after 500 events, preserving newest-500 in order", () => {
    // Write 520 events — first 20 should be evicted.
    for (let i = 0; i < 520; i++) {
      recordTermination({
        reason: "stream.completed",
        conversationId: `c${i}`,
        messageId: `m${i}`,
        durationMs: i,
      });
    }

    const events = readTerminations();
    expect(events).toHaveLength(500);
    // Oldest surviving event should be #20; newest should be #519.
    expect(events[0].conversationId).toBe("c20");
    expect(events[0].durationMs).toBe(20);
    expect(events[499].conversationId).toBe("c519");
    expect(events[499].durationMs).toBe(519);
  });

  it("countTerminations groups by reason code across the full buffer", () => {
    recordTermination({ reason: "stream.completed", conversationId: "c", messageId: "m", durationMs: 1 });
    recordTermination({ reason: "stream.completed", conversationId: "c", messageId: "m", durationMs: 1 });
    recordTermination({ reason: "stream.aborted.client", conversationId: "c", messageId: "m", durationMs: 1 });
    recordTermination({ reason: "stream.finalized.error", conversationId: "c", messageId: "m", durationMs: 1, error: "boom" });

    const counts = countTerminations();
    expect(counts["stream.completed"]).toBe(2);
    expect(counts["stream.aborted.client"]).toBe(1);
    expect(counts["stream.finalized.error"]).toBe(1);
    expect(counts["stream.aborted.signal"]).toBe(0);
    expect(counts["stream.reconciled.stale"]).toBe(0);
  });

  it("countTerminations honors the windowMs filter", async () => {
    recordTermination({ reason: "stream.completed", conversationId: "c", messageId: "m", durationMs: 1 });
    // Wait a few ms so the second event has a strictly later timestamp.
    await new Promise((r) => setTimeout(r, 10));
    const midpoint = Date.now();
    await new Promise((r) => setTimeout(r, 10));
    recordTermination({ reason: "stream.completed", conversationId: "c", messageId: "m", durationMs: 1 });

    // Use a window that only includes the second event.
    const windowMs = Date.now() - midpoint + 5;
    const counts = countTerminations(windowMs);
    expect(counts["stream.completed"]).toBe(1);
  });

  it("readTerminations returns a copy, not a live reference", () => {
    recordTermination({ reason: "stream.completed", conversationId: "c", messageId: "m", durationMs: 1 });
    const first = readTerminations();
    recordTermination({ reason: "stream.completed", conversationId: "c2", messageId: "m2", durationMs: 1 });
    // first snapshot should still have only the initial event.
    expect(first).toHaveLength(1);
    expect(readTerminations()).toHaveLength(2);
  });

  it("records optional error strings on error events", () => {
    recordTermination({
      reason: "stream.finalized.error",
      conversationId: "c",
      messageId: "m",
      durationMs: 42,
      error: "boom",
    });
    expect(readTerminations()[0].error).toBe("boom");
  });

  it("allows null conversationId / messageId / durationMs for edge cases", () => {
    recordTermination({
      reason: "stream.reconciled.stale",
      conversationId: null,
      messageId: null,
      durationMs: null,
    });
    const events = readTerminations();
    expect(events[0].conversationId).toBeNull();
    expect(events[0].messageId).toBeNull();
    expect(events[0].durationMs).toBeNull();
  });
});
