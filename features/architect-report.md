---
generated: 2026-04-19
mode: tdr
---

# Architect Report

## TDR-035 created — Plugin-MCP Cross-Runtime Registration Contract

**File:** `.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md`
**Status:** proposed
**Category:** runtime
**Supersedes:** none (new)

### What this TDR codifies

Six load-bearing architectural decisions for the M3 `chat-tools-plugin-kind-1` feature, covering how plugin-shipped MCP servers register across five runtime adapters:

1. **Five-source MCP merge contract** — `{ profile, browser, external, plugin, ainative }` in that spread order, ainative ALWAYS last so no plugin can shadow the ainative tool surface. Every runtime adapter with `supportsPluginMcpServers: true` MUST follow this order.
2. **Plugin-MCP loader as authoritative source** — `loadPluginMcpServers()` at `src/lib/plugins/mcp-loader.ts` is the ONLY code path that reads plugin manifests for MCP purposes. Adapters MUST NOT scan disk independently.
3. **Capability-accept lockfile hash derivation** — deterministic SHA-256 of canonicalized `plugin.yaml` (sorted keys, excluded cosmetic fields `name`/`description`/`tags`/`author`). Auditable without running ainative.
4. **Transport dispatch via `.mcp.json` shape** — presence of `command` → stdio (MCP standard); `transport: "ainative-sdk"` → in-process SDK; ambiguous or missing → disabled. Matches Claude Code's `.mcp.json` convention.
5. **Reload semantics per transport** — stdio = SIGTERM + 5s wait + SIGKILL fallback + respawn; in-process SDK = `require.cache` bust + re-require + atomic swap. No half-reloaded state.
6. **Process ownership and lifecycle** — stdio children owned by ainative; spawn at boot step 7; graceful-shutdown SIGTERM on exit; `detached: false` enforced; per-plugin env isolation without leaking ainative secrets by default.

### Why it needed to be written now

M3's spec (`features/chat-tools-plugin-kind-1.md`) is groomed and proposes four independent runtime adapters need plugin-MCP wiring (Claude SDK, Codex App Server, Anthropic direct, OpenAI direct; Ollama opts out). Without a codified contract, each adapter's author would re-derive merge order, capability-gating hook placement, and reload semantics independently. By the time a sixth runtime (Gemini, DeepSeek) arrives, the drift across adapters would be five independent patterns. TDR-035 is the universal contract that prevents that accretion.

### Evidence grounding

Direct code references verified at draft time:
- `src/lib/agents/claude-agent.ts:70` — current `withAinativeMcpServer` 4-arg signature (extends to 5-arg in M3)
- `src/lib/agents/claude-agent.ts:566` + `:724` — two call sites that MUST pass the same `pluginServers`
- `src/lib/environment/parsers/mcp-config.ts` — canonical `.mcp.json` parser the loader reuses, not duplicates
- `src/lib/environment/sync/mcp-sync.ts` — bi-directional Claude ↔ Codex sync the Codex adapter extends
- `src/lib/agents/runtime/catalog.ts:33-67` — `RuntimeFeatures` interface gains `supportsPluginMcpServers: boolean`

### New drift heuristics introduced

Three checks that run in architecture review + architecture health modes:

1. **Five-source merge order inversion** — flag any adapter spreading `pluginServers` after `ainative` (lets a plugin shadow builtin tool names).
2. **Plugin-MCP loader authority** — flag any runtime adapter that reads `plugin.yaml` or scans `$AINATIVE_DATA_DIR/plugins/` directly. The loader owns discovery.
3. **stdio process detachment** — flag any spawn call in `src/lib/plugins/` using `detached: true`, `daemon()`, or double-fork. Graceful shutdown depends on non-detached children.

### Inherited patterns (from existing TDRs)

- **TDR-006** (multi-runtime adapter registry) — capability-matrix extension column
- **TDR-032** (runtime ainative MCP injection / module-load cycle) — every new merge helper and the capability-check module follow the dynamic-import discipline
- **TDR-034** (Kind 5 plugin loader) — per-plugin error isolation extended with three M3 failure modes: `capability_denied`, `lock_mismatch`, `safe_mode`
- **TDR-009** (idempotent database bootstrap) — self-heal-at-producing-boundary principle applied to plugin lifecycle

### Alternatives explicitly rejected

1. Adapter-owned plugin discovery (rejected for triple-duplication risk)
2. Explicit `transport: "stdio"` enum (rejected for breaking Claude Code parser compat)
3. Custom `@ainative/plugin-sdk` (rejected by strategy Amendment 2026-04-19 (II))
4. Whole-file hash for lockfile (rejected for cosmetic-edit over-prompting)
5. Node `vm` / worker-thread sandboxing (rejected by strategy §10 + §11 — not a real security boundary)
6. Adapter-specific merge helper signatures (rejected for drift risk)

### Downstream handoffs

- **`/product-manager`** — spec `features/chat-tools-plugin-kind-1.md` already references TDR-035; no further spec edit needed.
- **Implementation (when M3 kicks off)** — the implementation plan MUST budget an invariant test for each of the three drift heuristics above. Suggested test location: `src/lib/plugins/__tests__/cross-runtime-contract.test.ts`.
- **`/supervisor`** — next health check will pick up TDR-035 and include it in pattern-compliance audits once M3 begins implementing.

---

*Generated by `/architect` — TDR Management mode*
