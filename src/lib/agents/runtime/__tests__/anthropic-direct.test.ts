import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ─── Mock @/lib/chat/ainative-tools ──────────────────────────────────────────
// Must be hoisted (vi.mock is hoisted automatically) so the dynamic import
// inside withAnthropicDirectMcpServers resolves to this mock rather than the
// real module (which would pull in the full ainative-tools graph).

vi.mock("@/lib/chat/ainative-tools", () => ({
  createToolServer: vi.fn((_projectId?: string | null) => ({
    asMcpServer: () => ({ __mockAinativeServer: true }),
    forProvider: vi.fn(() => ({ tools: [], executeHandler: vi.fn() })),
  })),
}));

// ─── Static import of the helper under test ───────────────────────────────────
import { withAnthropicDirectMcpServers } from "../anthropic-direct";

// ═══════════════════════════════════════════════════════════════════════
// Group T8: withAnthropicDirectMcpServers — 5-source merge (TDR-035 §1)
// ═══════════════════════════════════════════════════════════════════════

describe("withAnthropicDirectMcpServers (T8 — 5-source merge)", () => {
  it("T8-1: happy path — plugin server present + ainative is last key", async () => {
    const result = await withAnthropicDirectMcpServers(
      {},
      {},
      {},
      { "plugin-a": { command: "x" } },
      null,
    );
    const keys = Object.keys(result);
    expect(keys).toContain("plugin-a");
    expect(keys).toContain("ainative");
    // ainative must be the LAST key (TDR-035 §1 position 5)
    expect(keys[keys.length - 1]).toBe("ainative");
  });

  it("T8-2: plugin cannot shadow ainative — real server wins", async () => {
    const result = await withAnthropicDirectMcpServers(
      {},
      {},
      {},
      { ainative: "fake" },
      null,
    );
    // The plugin's ainative key must be overwritten by the real in-process server
    expect((result.ainative as Record<string, unknown>).__mockAinativeServer).toBe(true);
    // Only one key — the plugin's override was silently replaced
    expect(Object.keys(result)).toEqual(["ainative"]);
  });

  it("T8-3: source-grep invariant — loadPluginMcpServers({ runtime: 'anthropic-direct' }) called exactly once", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../anthropic-direct.ts"),
      "utf8",
    );

    const pattern = `loadPluginMcpServers({ runtime: "anthropic-direct" })`;
    // Count occurrences — must be exactly 1
    const matches = src.split(pattern).length - 1;
    expect(matches).toBe(1);
  });
});
