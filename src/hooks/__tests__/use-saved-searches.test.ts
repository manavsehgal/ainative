import { renderHook, act, waitFor } from "@testing-library/react";
import { useSavedSearches } from "../use-saved-searches";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

describe("useSavedSearches — rename", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/api/settings/chat/saved-searches") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            searches: [
              {
                id: "s1",
                surface: "task",
                label: "Old label",
                filterInput: "#status:blocked",
                createdAt: "2026-04-14T00:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renames a saved search optimistically and persists via PUT", async () => {
    const { result } = renderHook(() => useSavedSearches());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.searches[0].label).toBe("Old label");

    act(() => {
      result.current.rename("s1", "New label");
    });

    expect(result.current.searches[0].label).toBe("New label");

    const putCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([, init]) => init?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.searches[0].label).toBe("New label");
    expect(body.searches[0].id).toBe("s1");
  });

  it("no-ops when id is not found", async () => {
    const { result } = renderHook(() => useSavedSearches());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.searches;

    act(() => {
      result.current.rename("does-not-exist", "Whatever");
    });

    expect(result.current.searches).toEqual(before);
  });
});
