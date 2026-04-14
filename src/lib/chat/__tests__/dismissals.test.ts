import { describe, it, expect } from "vitest";
import {
  loadDismissals,
  saveDismissal,
  activeDismissedIds,
  DISMISSAL_TTL_MS,
} from "../dismissals";

type Store = { read: () => string | null; write: (v: string) => void };

function mockStore(initial: string | null = null): Store {
  let v = initial;
  return {
    read: () => v,
    write: (next) => {
      v = next;
    },
  };
}

describe("dismissals", () => {
  const NOW = 1_700_000_000_000;

  it("returns empty when store is null", () => {
    const store = mockStore();
    const all = loadDismissals(store);
    expect(all).toEqual({});
  });

  it("saves dismissals keyed by conversation + skill", () => {
    const store = mockStore();
    saveDismissal(store, "conv-1", "skill-a", NOW);
    const all = loadDismissals(store);
    expect(all["conv-1"]["skill-a"]).toBe(NOW);
  });

  it("activeDismissedIds excludes expired entries", () => {
    const store = mockStore();
    saveDismissal(store, "c1", "fresh", NOW);
    saveDismissal(store, "c1", "old", NOW - DISMISSAL_TTL_MS - 1000);
    const ids = activeDismissedIds(store, "c1", NOW);
    expect(ids.has("fresh")).toBe(true);
    expect(ids.has("old")).toBe(false);
  });

  it("returns empty set when conversation has no dismissals", () => {
    const store = mockStore();
    expect(activeDismissedIds(store, "never-seen", NOW).size).toBe(0);
  });

  it("silently tolerates store write errors", () => {
    const store: Store = {
      read: () => null,
      write: () => {
        throw new Error("quota");
      },
    };
    expect(() => saveDismissal(store, "c1", "s1", NOW)).not.toThrow();
  });

  it("silently tolerates corrupt JSON on read", () => {
    const store = mockStore("not-json");
    expect(loadDismissals(store)).toEqual({});
  });
});
