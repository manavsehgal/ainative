import { describe, it, expect, vi, beforeEach } from "vitest";

// Map-backed mock DB — same pattern used by settings-tools.test.ts but one
// level lower so the helpers under test (getModelPreference / setModelPreference)
// run for real and exercise their coercion logic against the boundary.
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock("@/lib/db", () => {
  const select = () => ({
    from: () => ({
      where: (predicate: { key: string }) =>
        store.has(predicate.key) ? [{ value: store.get(predicate.key) }] : [],
    }),
  });
  const insert = () => ({
    values: (row: { key: string; value: string }) => {
      store.set(row.key, row.value);
      return { run: () => undefined };
    },
  });
  const update = () => ({
    set: (patch: { value: string }) => ({
      where: (predicate: { key: string }) => {
        store.set(predicate.key, patch.value);
        return { run: () => undefined };
      },
    }),
  });
  return { db: { select, insert, update } };
});

vi.mock("@/lib/db/schema", () => ({
  settings: { key: "key" },
}));

// drizzle-orm `eq(col, value)` is called with our mocked column object;
// we just need a deterministic shape for the predicate that the mocked
// `.where(...)` can read.
vi.mock("drizzle-orm", () => ({
  eq: (_col: unknown, value: string) => ({ key: value }),
}));

import {
  getModelPreference,
  setModelPreference,
  hasSeenModelPreferencePrompt,
} from "../helpers";

beforeEach(() => {
  store.clear();
});

describe("getModelPreference", () => {
  it("returns null when no preference recorded", async () => {
    expect(await getModelPreference()).toBeNull();
  });

  it("returns the persisted preference for known values", async () => {
    for (const pref of ["quality", "cost", "privacy", "balanced"] as const) {
      await setModelPreference(pref);
      expect(await getModelPreference()).toBe(pref);
    }
  });

  it("coerces unknown raw values back to null", async () => {
    store.set("chat.modelPreference", "definitely-not-a-real-preference");
    expect(await getModelPreference()).toBeNull();
  });

  it("treats the empty string (skip marker) as null", async () => {
    store.set("chat.modelPreference", "");
    expect(await getModelPreference()).toBeNull();
  });
});

describe("setModelPreference", () => {
  it("persists each known preference", async () => {
    await setModelPreference("quality");
    expect(store.get("chat.modelPreference")).toBe("quality");
  });

  it("writes empty string when set to null (skip marker)", async () => {
    await setModelPreference(null);
    expect(store.get("chat.modelPreference")).toBe("");
  });

  it("overwrites previous preference", async () => {
    await setModelPreference("cost");
    await setModelPreference("privacy");
    expect(store.get("chat.modelPreference")).toBe("privacy");
  });
});

describe("hasSeenModelPreferencePrompt", () => {
  it("is false when nothing has been recorded", async () => {
    expect(await hasSeenModelPreferencePrompt()).toBe(false);
  });

  it("is true after a real preference is set", async () => {
    await setModelPreference("balanced");
    expect(await hasSeenModelPreferencePrompt()).toBe(true);
  });

  it("is true after Skip (null preference recorded as empty string)", async () => {
    await setModelPreference(null);
    expect(await hasSeenModelPreferencePrompt()).toBe(true);
  });
});
