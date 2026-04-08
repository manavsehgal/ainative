import { describe, it, expect, beforeEach } from "vitest";
import {
  registerChatStream,
  unregisterChatStream,
  getActiveChatStreamCount,
  isAnyChatStreaming,
} from "../active-streams";

describe("active chat streams", () => {
  beforeEach(() => {
    for (const id of ["a", "b", "c"]) unregisterChatStream(id);
  });

  it("starts empty", () => {
    expect(getActiveChatStreamCount()).toBe(0);
    expect(isAnyChatStreaming()).toBe(false);
  });

  it("tracks a single registered stream", () => {
    registerChatStream("a");
    expect(getActiveChatStreamCount()).toBe(1);
    expect(isAnyChatStreaming()).toBe(true);
  });

  it("tracks multiple streams independently", () => {
    registerChatStream("a");
    registerChatStream("b");
    expect(getActiveChatStreamCount()).toBe(2);
  });

  it("is idempotent — registering the same id twice still counts as one", () => {
    registerChatStream("a");
    registerChatStream("a");
    expect(getActiveChatStreamCount()).toBe(1);
  });

  it("unregisters by id", () => {
    registerChatStream("a");
    registerChatStream("b");
    unregisterChatStream("a");
    expect(getActiveChatStreamCount()).toBe(1);
    expect(isAnyChatStreaming()).toBe(true);
  });

  it("unregistering a non-existent id is a no-op", () => {
    expect(() => unregisterChatStream("never-registered")).not.toThrow();
    expect(getActiveChatStreamCount()).toBe(0);
  });
});
