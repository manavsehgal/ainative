import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/settings/helpers", () => {
  const store = new Map<string, string>();
  return {
    getSetting: vi.fn(async (k: string) => store.get(k) ?? null),
    setSetting: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    __store: store,
  };
});

import * as helpers from "@/lib/settings/helpers";
import { GET, PUT } from "../route";
import { NextRequest } from "next/server";

beforeEach(() => {
  // Reset the in-memory store between tests
  (helpers as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("saved-searches route", () => {
  it("GET with no stored value returns empty list", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ searches: [] });
  });

  it("PUT then GET round-trips a valid payload", async () => {
    const payload = {
      searches: [
        {
          id: "a",
          surface: "task" as const,
          label: "Blocked",
          filterInput: "#status:blocked",
          createdAt: "2026-04-14T00:00:00Z",
        },
      ],
    };
    const putRes = await PUT(
      new NextRequest("http://x/api/settings/chat/saved-searches", {
        method: "PUT",
        body: JSON.stringify(payload),
      })
    );
    expect(putRes.status).toBe(200);

    const getBody = await (await GET()).json();
    expect(getBody.searches).toHaveLength(1);
    expect(getBody.searches[0].label).toBe("Blocked");
  });

  it("PUT dedupes by id — last write wins", async () => {
    const req = new NextRequest("http://x", {
      method: "PUT",
      body: JSON.stringify({
        searches: [
          {
            id: "a",
            surface: "task",
            label: "First",
            filterInput: "#a:1",
            createdAt: "2026-04-14T00:00:00Z",
          },
          {
            id: "a",
            surface: "task",
            label: "Second (dup)",
            filterInput: "#a:1",
            createdAt: "2026-04-14T00:01:00Z",
          },
        ],
      }),
    });
    const res = await PUT(req);
    const body = await res.json();
    expect(body.searches).toHaveLength(1);
    expect(body.searches[0].label).toBe("Second (dup)");
  });

  it("PUT rejects invalid surface with 400", async () => {
    const req = new NextRequest("http://x", {
      method: "PUT",
      body: JSON.stringify({
        searches: [
          {
            id: "a",
            surface: "bogus",
            label: "x",
            filterInput: "",
            createdAt: "z",
          },
        ],
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("PUT rejects malformed JSON with 400", async () => {
    const req = new NextRequest("http://x", {
      method: "PUT",
      body: "not json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("GET recovers from malformed stored value", async () => {
    (helpers as unknown as { __store: Map<string, string> }).__store.set(
      "chat.savedSearches",
      "not-json-at-all"
    );
    const body = await (await GET()).json();
    expect(body).toEqual({ searches: [] });
  });
});
