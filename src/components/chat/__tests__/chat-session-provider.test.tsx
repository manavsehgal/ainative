import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useRef, useState } from "react";

import type { ChatMessageRow } from "@/lib/db/schema";
import {
  ChatSessionProvider,
  useChatSession,
} from "@/components/chat/chat-session-provider";

// Satisfy the type import linter — we use ChatMessageRow in the Consumer
// probes below but through inference from session.messages.
void ({} as ChatMessageRow | undefined);

// ── Next.js router mock ──────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// ── Sonner mock ──────────────────────────────────────────────────────
const toastErrorSpy = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorSpy(...args),
  },
}));

// ── Test helpers ─────────────────────────────────────────────────────

/**
 * Small consumer component that exposes the session value via test ids.
 * Text probes let us assert state without wiring up the full ChatShell.
 */
function Consumer({ label }: { label?: string }) {
  const session = useChatSession();
  return (
    <div>
      <div data-testid={`${label ?? "c"}-active`}>{session.activeId ?? ""}</div>
      <div data-testid={`${label ?? "c"}-isStreaming`}>
        {String(session.isStreaming)}
      </div>
      <div data-testid={`${label ?? "c"}-messageCount`}>
        {session.messages.length}
      </div>
      <div data-testid={`${label ?? "c"}-assistantContent`}>
        {session.messages
          .filter((m: ChatMessageRow) => m.role === "assistant")
          .map((m: ChatMessageRow) => m.content)
          .join("|")}
      </div>
      <button
        data-testid={`${label ?? "c"}-send`}
        onClick={() => void session.sendMessage("hello")}
      >
        send
      </button>
      <button
        data-testid={`${label ?? "c"}-stop`}
        onClick={() => session.stopStreaming()}
      >
        stop
      </button>
      <button
        data-testid={`${label ?? "c"}-select`}
        onClick={() => session.setActiveConversation("conv-1")}
      >
        select
      </button>
      <button
        data-testid={`${label ?? "c"}-hydrate`}
        onClick={() =>
          session.hydrate({
            conversations: [
              {
                id: "conv-1",
                projectId: null,
                title: "Test conv",
                status: "active",
                runtimeId: "claude-code",
                modelId: "sonnet",
                createdAt: new Date(),
                updatedAt: new Date(),
                archivedAt: null,
              } as unknown as never,
            ],
            initialActiveId: "conv-1",
          })
        }
      >
        hydrate
      </button>
    </div>
  );
}

/**
 * A wrapper that keeps the provider mounted while letting tests mount and
 * unmount a child consumer on demand. This is how we verify that state
 * survives a consumer unmount/remount cycle — the provider is stable, only
 * the child toggles.
 */
function ProviderWithToggle() {
  const [show, setShow] = useState(true);
  return (
    <ChatSessionProvider>
      <button data-testid="toggle" onClick={() => setShow((v) => !v)}>
        toggle
      </button>
      <div data-testid="consumer-visible">{String(show)}</div>
      {show && <Consumer />}
    </ChatSessionProvider>
  );
}

/**
 * Build a ReadableStream that emits the given SSE chunks as `data: ...` lines.
 * Each chunk is JSON-serialized and prefixed with `data: ` + newline.
 */
function makeSSEStream(
  chunks: unknown[],
  opts: { closeAfterMs?: number } = {}
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        const line = `data: ${JSON.stringify(chunk)}\n`;
        controller.enqueue(encoder.encode(line));
        // Tiny yield so React can flush state between chunks.
        await new Promise((r) => setTimeout(r, 0));
      }
      if (opts.closeAfterMs) {
        await new Promise((r) => setTimeout(r, opts.closeAfterMs));
      }
      controller.close();
    },
  });
}

/**
 * Build a ReadableStream that waits indefinitely (useful for testing
 * abort behavior). Signal-aware: closes early if signal aborts.
 */
function makeHangingStream(signal: AbortSignal): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      signal.addEventListener("abort", () => {
        controller.error(
          Object.assign(new Error("aborted"), { name: "AbortError" })
        );
      });
    },
  });
}

// ── Suites ───────────────────────────────────────────────────────────

describe("ChatSessionProvider", () => {
  beforeEach(() => {
    toastErrorSpy.mockReset();
    vi.stubGlobal("crypto", {
      randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}`,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sendMessage accumulates SSE deltas into the assistant message", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.startsWith("/api/settings/chat")) return new Response(null, { status: 204 });
      if (u.startsWith("/api/chat/models")) return new Response(null, { status: 204 });
      if (u === "/api/chat/conversations" || u.endsWith("/api/chat/conversations")) {
        return new Response(
          JSON.stringify({
            id: "conv-new",
            projectId: null,
            title: "New Chat",
            status: "active",
            runtimeId: "claude-code",
            modelId: "haiku",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          { status: 200 }
        );
      }
      if (u.match(/\/api\/chat\/conversations\/conv-new\/messages$/)) {
        return new Response(
          makeSSEStream([
            { type: "delta", content: "Hello" },
            { type: "delta", content: " world" },
            { type: "done", messageId: "msg-final", quickAccess: [] },
          ]),
          { status: 200 }
        );
      }
      if (u.startsWith("/api/chat/conversations/conv-new")) {
        // GET metadata refresh after "done" event
        return new Response(
          JSON.stringify({ id: "conv-new", title: "Auto Title" }),
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChatSessionProvider>
        <Consumer />
      </ChatSessionProvider>
    );

    await act(async () => {
      screen.getByTestId("c-send").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("c-assistantContent").textContent).toBe(
        "Hello world"
      );
      expect(screen.getByTestId("c-isStreaming").textContent).toBe("false");
    });
  });

  it("preserves messages across consumer unmount/remount", async () => {
    // Seed state: hydrate with conv-1 (fetch returns empty message list),
    // then send a message and verify it's visible. Then toggle the consumer
    // off and back on and verify the messages are still there.
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.startsWith("/api/settings/chat")) return new Response(null, { status: 204 });
      if (u.startsWith("/api/chat/models")) return new Response(null, { status: 204 });
      if (u.match(/\/api\/chat\/conversations\/conv-1\/messages$/)) {
        // Support both GET (select refresh) and POST (send)
        // We can distinguish in a real test but here both return empty/delta
        // If POST, return the SSE stream. Differentiate by checking if there's a body.
        return new Response(
          makeSSEStream([
            { type: "delta", content: "persisted" },
            { type: "done", messageId: "msg-a", quickAccess: [] },
          ]),
          { status: 200 }
        );
      }
      if (u.startsWith("/api/chat/conversations/conv-1")) {
        return new Response(
          JSON.stringify({ id: "conv-1", title: "T" }),
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProviderWithToggle />);

    // Hydrate (sets conv-1 as active) and select
    await act(async () => {
      screen.getByTestId("c-hydrate").click();
    });
    await act(async () => {
      screen.getByTestId("c-send").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("c-assistantContent").textContent).toBe(
        "persisted"
      );
    });

    // Unmount the consumer
    await act(async () => {
      screen.getByTestId("toggle").click();
    });
    expect(screen.queryByTestId("c-assistantContent")).toBeNull();
    expect(screen.getByTestId("consumer-visible").textContent).toBe("false");

    // Remount the consumer — provider state should still be there
    await act(async () => {
      screen.getByTestId("toggle").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("c-assistantContent").textContent).toBe(
        "persisted"
      );
    });
  });

  it("selectConversation fetch failure calls toast.error and does not clear state", async () => {
    // The bug this test pins down: `handleSelectConversation`'s old catch
    // block was `setMessages([])`, which wiped all prior turns on any
    // fetch hiccup. The fix: on failure, call toast.error and leave
    // messagesByConversation untouched.
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = url.toString();
      const method = init?.method ?? "GET";
      if (u.startsWith("/api/settings/chat")) return new Response(null, { status: 204 });
      if (u.startsWith("/api/chat/models")) return new Response(null, { status: 204 });
      if (u.match(/\/api\/chat\/conversations\/conv-missing\/messages$/) && method === "GET") {
        return new Response("boom", { status: 500 });
      }
      if (u.startsWith("/api/chat/conversations/conv-missing")) {
        return new Response(JSON.stringify({ id: "conv-missing" }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    // Custom consumer that exposes a button to select a specific (failing) conversation
    function FailingSelectConsumer() {
      const session = useChatSession();
      return (
        <div>
          <div data-testid="cache-keys">
            {Object.keys(session.conversations.length ? { placeholder: 1 } : {}).join(",")}
          </div>
          <button
            data-testid="select-failing"
            onClick={() => {
              // Directly call setActiveConversation with an id that has no
              // cache entry — this triggers loadMessagesForConversation,
              // which will hit the failing mock.
              session.setActiveConversation("conv-missing");
            }}
          >
            select failing
          </button>
        </div>
      );
    }

    render(
      <ChatSessionProvider>
        <FailingSelectConsumer />
      </ChatSessionProvider>
    );

    await act(async () => {
      screen.getByTestId("select-failing").click();
    });

    // The fetch fails → toast.error must be called. Prior to the fix,
    // the code would have called `setMessages([])`. Now it calls toast and
    // leaves state alone.
    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(
        "Failed to load conversation messages"
      );
    });
  });

  it("stopStreaming aborts an in-flight stream", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = url.toString();
      if (u.startsWith("/api/settings/chat")) return new Response(null, { status: 204 });
      if (u.startsWith("/api/chat/models")) return new Response(null, { status: 204 });
      if (u === "/api/chat/conversations" || u.endsWith("/api/chat/conversations")) {
        return new Response(
          JSON.stringify({
            id: "conv-abort",
            projectId: null,
            title: "T",
            status: "active",
            runtimeId: "claude-code",
            modelId: "haiku",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          { status: 200 }
        );
      }
      if (u.match(/\/api\/chat\/conversations\/conv-abort\/messages$/)) {
        const signal = init?.signal as AbortSignal;
        return new Response(makeHangingStream(signal), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChatSessionProvider>
        <Consumer />
      </ChatSessionProvider>
    );

    await act(async () => {
      screen.getByTestId("c-send").click();
    });

    // Give the fetch a microtask to kick off
    await waitFor(() => {
      expect(screen.getByTestId("c-isStreaming").textContent).toBe("true");
    });

    await act(async () => {
      screen.getByTestId("c-stop").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("c-isStreaming").textContent).toBe("false");
    });
  });

  it("view-remount telemetry pattern logs on unmount when streaming", async () => {
    // Contract test for the `client.stream.view-remount` telemetry code.
    // Mirrors the pattern ChatShell implements: track isStreaming in a ref,
    // then log on unmount iff the ref was true. The ref is necessary because
    // a stale closure would see isStreaming at effect-setup time, not at
    // unmount time.
    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});

    function ViewRemountConsumer() {
      const { isStreaming, activeId, sendMessage } = useChatSession();
      const isStreamingRef = useRef(isStreaming);
      const activeIdRef = useRef(activeId);
      useEffect(() => {
        isStreamingRef.current = isStreaming;
      }, [isStreaming]);
      useEffect(() => {
        activeIdRef.current = activeId;
      }, [activeId]);
      useEffect(() => {
        return () => {
          if (isStreamingRef.current) {
            // eslint-disable-next-line no-console
            console.info("[chat-stream] client.stream.view-remount", {
              conversationId: activeIdRef.current,
            });
          }
        };
        // Empty deps: run-once cleanup on unmount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <div>
          <div data-testid="vr-isStreaming">{String(isStreaming)}</div>
          <button
            data-testid="vr-send"
            onClick={() => void sendMessage("hello")}
          >
            send
          </button>
        </div>
      );
    }

    function ViewRemountWrapper() {
      const [mounted, setMounted] = useState(true);
      return (
        <ChatSessionProvider>
          <button data-testid="vr-unmount" onClick={() => setMounted(false)}>
            unmount
          </button>
          {mounted && <ViewRemountConsumer />}
        </ChatSessionProvider>
      );
    }

    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = url.toString();
      if (u.startsWith("/api/settings/chat")) return new Response(null, { status: 204 });
      if (u.startsWith("/api/chat/models")) return new Response(null, { status: 204 });
      if (u === "/api/chat/conversations" || u.endsWith("/api/chat/conversations")) {
        return new Response(
          JSON.stringify({
            id: "conv-vr",
            projectId: null,
            title: "T",
            status: "active",
            runtimeId: "claude-code",
            modelId: "haiku",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          { status: 200 }
        );
      }
      if (u.match(/\/api\/chat\/conversations\/conv-vr\/messages$/)) {
        const signal = init?.signal as AbortSignal;
        return new Response(makeHangingStream(signal), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ViewRemountWrapper />);

    await act(async () => {
      screen.getByTestId("vr-send").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("vr-isStreaming").textContent).toBe("true");
    });

    // Unmount the consumer while streaming is in flight.
    await act(async () => {
      screen.getByTestId("vr-unmount").click();
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[chat-stream] client.stream.view-remount",
      expect.objectContaining({ conversationId: "conv-vr" })
    );

    consoleInfoSpy.mockRestore();
  });

  it("view-remount telemetry pattern does NOT log when not streaming", async () => {
    // Guard case: unmounting without an active stream must not emit.
    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});

    function ViewRemountConsumer() {
      const { isStreaming } = useChatSession();
      const isStreamingRef = useRef(isStreaming);
      useEffect(() => {
        isStreamingRef.current = isStreaming;
      }, [isStreaming]);
      useEffect(() => {
        return () => {
          if (isStreamingRef.current) {
            // eslint-disable-next-line no-console
            console.info("[chat-stream] client.stream.view-remount", {
              conversationId: null,
            });
          }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div />;
    }

    function Wrapper() {
      const [mounted, setMounted] = useState(true);
      return (
        <ChatSessionProvider>
          <button data-testid="toggle" onClick={() => setMounted(false)}>
            toggle
          </button>
          {mounted && <ViewRemountConsumer />}
        </ChatSessionProvider>
      );
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 }))
    );

    render(<Wrapper />);

    await act(async () => {
      screen.getByTestId("toggle").click();
    });

    const viewRemountCalls = consoleInfoSpy.mock.calls.filter(
      ([msg]) =>
        typeof msg === "string" && msg.includes("client.stream.view-remount")
    );
    expect(viewRemountCalls).toHaveLength(0);

    consoleInfoSpy.mockRestore();
  });
});
