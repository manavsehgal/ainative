# Handoff: M3 Phase A COMPLETE — next session picks up Phase B (cross-runtime wiring)

**Created:** 2026-04-19 (M3 Phase A foundation shipped — T1, T2, T3, T4, T5 subsumed)
**Supersedes:** `handoff/2026-04-19-m3-groom-complete-handoff.md` (M3 groomed → implementation began)
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **M3 Phase A is DONE.** Foundation layer — plugin manifest Kind 1 discriminator, capability-check + plugins.lock, plugin-MCP loader skeleton, transport dispatch (stdio + in-process SDK), runtime catalog column — all shipped across **15 commits on main**, zero test regressions in M3-touched code, 126/126 plugin tests green, `tsc --noEmit` clean. Working tree clean. Subagent-driven-development model (implementer + spec-compliance reviewer + code-quality reviewer per task) applied to all 5 tasks; 4 spec deviations caught and fixed inline. Next session picks up **Phase B** (cross-runtime wiring T6–T9) which is the first time CLAUDE.md's runtime-registry-adjacent smoke-test budget rule bites — a real `npm run dev` smoke at T19 is MANDATORY and unit tests cannot substitute.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`** — the 21-task plan. Sections to know cold: **Phase B (T6–T9)** starts at T6 (Claude SDK 5-source merge). Skip the "scope challenge" header; Option A (PROCEED minus gmail) is already the executing scope.
3. **`features/chat-tools-plugin-kind-1.md`** — the M3 feature spec. Section "Runtime registration — per adapter" is the Phase B bible.
4. **`.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md`** — TDR-035. Section **§1 (five-source merge)** is the non-negotiable contract for every Phase B adapter. Section §2 (loader authority) is already in place — Phase B adapters MUST call `loadPluginMcpServers()` exclusively.
5. **`ideas/self-extending-machine-strategy.md`** — living strategy doc; Amendments 2026-04-19 (I + II) still authoritative.
6. **Previous handoff** `handoff/2026-04-19-m3-groom-complete-handoff.md` — still authoritative for the state at M3-groomed; this handoff supersedes it from M3-Phase-A-complete onward.
7. **CLAUDE.md's runtime-registry smoke rule** — copy-paste from CLAUDE.md into the Phase B implementer prompts:

> Whenever a plan adds, removes, or reshapes an import in any module transitively reachable from `@/lib/agents/runtime/catalog.ts` — notably `src/lib/agents/claude-agent.ts`, `src/lib/agents/runtime/claude.ts`, `src/lib/agents/runtime/openai-direct.ts`, `src/lib/agents/runtime/anthropic-direct.ts`, or `src/lib/workflows/engine.ts` — it **must** budget an end-to-end smoke step that runs a real task under `npm run dev`, not just unit tests. Unit tests that `vi.mock("@/lib/chat/ainative-tools", ...)` structurally cannot catch module-load cycles.

---

## What shipped this session

### Commits on main (ahead of origin by 15; oldest → newest)

```
b6ac0cd0  feat(plugins): T1 — Kind 1 manifest discriminated union
c894df27  feat(plugins): T2 — capability-check + plugins.lock hash derivation
893e546d  fix(plugins):  T2 — remove dead imports + unused EMPTY_LOCK const
b5d86060  fix(plugins):  T2 — guard deriveManifestHash against non-mapping YAML
602acbf9  feat(runtime): T5 — add supportsPluginMcpServers column to catalog
4be9a362  feat(plugins): T3 — plugin-MCP loader skeleton with capability gate
03a3e2a9  fix(plugins):  T3 — remove dead safePreview import post-parser-refactor
9bfeaecc  fix(plugins):  T3 — emit per-plugin skip log for Ollama runtime
79a0c29d  refactor(plugins): T3 code-review cleanup — nits from quality pass
4026abf9  feat(plugins): T4 — transport dispatch module (stdio spawn + SDK import)
73aaf8a0  feat(plugins): T4 — integrate transport validation into mcp-loader
0eea4a6c  fix(plugins):  T4 — direct SIGKILL on stdio_init_timeout per TDR-035 §5
e593d552  refactor(plugins): T4 code-review cleanup — drop dead vi call + T14 TODO
```

**HEAD:** `e593d552`. **Origin is 15 commits behind.** Pushing is the user's call — nothing was pushed this session per the "don't push without user confirmation" rule from the prior handoff.

### T1 (one commit) — manifest discriminated union

- `src/lib/plugins/sdk/types.ts`: `PrimitivesBundleManifestSchema` extracted as internal const; new `ChatToolsPluginManifestSchema` accepts `kind: "chat-tools"`, `capabilities: z.array(z.enum(CAPABILITY_VALUES)).default([])`, optional `confinementMode`, `dockerImage`, `defaultToolApproval`. Both variants `.strict()`. Exported `PluginManifestSchema = z.discriminatedUnion("kind", [Kind5, Kind1])`. Exported `CAPABILITY_VALUES = ["fs", "net", "child_process", "env"] as const` + `Capability` type (extracted mid-T2 per the T1 review's M-5 suggestion).
- 20 new tests at `src/lib/plugins/sdk/__tests__/types.test.ts`; existing `manifest-schema.test.ts` updated for the new valid-Kind-1 reality.

### T2 (three commits) — canonical hash + plugins.lock I/O

- `src/lib/plugins/capability-check.ts` (new, ~295 LOC): `deriveManifestHash(yamlContent) → "sha256:<hex>"` over canonical form (sort keys recursively, exclude cosmetic fields `name/description/tags/author`, preserve array order — capabilities re-ordering IS a re-accept event by design), guards non-object YAML with named error per Engineering Principle #2. `readPluginsLock()` fails closed on missing/corrupt/schema-mismatch. `writePluginsLock(id, entry)` is atomic tempfile+rename with 0600 perms, `.bak` written BEFORE primary overwrite. `removePluginsLockEntry(id)` same pattern. `isCapabilityAccepted(id, hash) → {accepted, reason?, acceptedHash?}`.
- Path helper added: `getAinativePluginsLockPath()` in `src/lib/utils/ainative-paths.ts` → `<AINATIVE_DATA_DIR>/plugins.lock`.
- 20 tests at `src/lib/plugins/__tests__/capability-check.test.ts` — all real-fs via `fs.mkdtempSync`, no mocks.

### T3 + T5 (four commits) — plugin-MCP loader skeleton + catalog flag

- **T5 subsumed into T3** because T3's loader needs the `supportsPluginMcpServers` flag. `src/lib/agents/runtime/catalog.ts` gained the field on `RuntimeFeatures` with claude-code=true, codex=true, anthropic-direct=true, openai-direct=true, ollama=false. Invariant test in `catalog.test.ts` asserts these values.
- `src/lib/plugins/mcp-loader.ts` (new, ~580 LOC): `loadPluginMcpServers(opts?)` async returns `Record<serverName, NormalizedMcpConfig>`. `listPluginMcpRegistrations(opts?)` returns full list including disabled entries (for T12 revocation + T15 chat tools). Short-circuits on `AINATIVE_SAFE_MODE=true` and on runtime-flag = false. Per-plugin isolation via try/catch. Sort readdirSync for cross-platform determinism. Ollama filter logs `"plugin <id> skipped on <runtime> runtime"` per-plugin per-session, dedup key scoped with `pluginsDir` so tmpdir tests don't cross-contaminate.
- Parser refactor: extracted `parseMcpConfigFile(filePath) → Record<serverName, RawMcpServerEntry> | null` from `src/lib/environment/parsers/mcp-config.ts`. `parseClaudeMcpConfig` refactored to delegate. `RawMcpServerEntry` exported.
- 22 tests at `src/lib/plugins/__tests__/mcp-loader.test.ts` covering happy paths, env/args template resolution, safe-mode, Ollama per-plugin log (with log-file grep assertion), capability gate, hash drift, transport dispatch, existence checks, per-plugin isolation, Kind-5 ignore, multi-server plugins, catalog invariant, log-file grep for `mcp_parse_error`, 2 bonus introspection tests.

### T4 (four commits) — transport dispatch (Option A — pre-flight validation)

- **User directive resolved mid-session:** Option A — pre-flight validation, not long-lived ainative-owned children. Ainative spawns, sends MCP `initialize` via stdin, waits ≤10s for response, kills child on success/failure. Runtime children are SDK-owned at request time.
- `src/lib/plugins/transport-dispatch.ts` (new, ~480 LOC) exports:
  - `validateStdioMcp(config, pluginId, serverName, opts?)` — `spawn(..., { detached: false, stdio: ["pipe","pipe","pipe"] })`. Sends MCP initialize request (protocol `2024-11-05`). Streams stderr to `plugins.log` with `[plugin <id>/<server>]` prefix. Returns `{ ok: true }` or `{ ok: false, reason: "stdio_init_timeout" | "stdio_init_malformed", detail? }`. **Timeout path: direct SIGKILL** (plugin already unresponsive). **All other paths: SIGTERM + 5s + SIGKILL fallback** for graceful flush. Post-success: sends `notifications/initialized` courtesy + `stdin.end()`, then graceful kill.
  - `validateInProcessSdk(config, pluginId, serverName)` — `require()` for `.js`/`.cjs`, `await import()` for `.mjs`. Duck-types `createServer` export, duck-types return value against `setRequestHandler | connect | onRequest`. Returns `{ ok: true }` or `{ ok: false, reason: "sdk_invalid_export", detail? }`.
  - `bustInProcessServerCache(absPath) → void` — wraps `delete require.cache[require.resolve(absPath)]` in try/catch for ESM/Windows safety.
- Three new `disabledReason` values added to `PluginMcpRegistration`: `stdio_init_timeout`, `stdio_init_malformed`, `sdk_invalid_export`.
- `scanPlugin` in mcp-loader.ts now `async`, awaits validators before emitting `status: "accepted"`.
- 16 tests at `src/lib/plugins/__tests__/transport-dispatch.test.ts` using real `process.execPath` + inline Node script fixtures (no Python dep). Includes **source-grep invariant tests** for `detached: true` (TDR-035 §6 drift heuristic precursor — T18 will formalize).
- T3 test file `mcp-loader.test.ts` updated to use MCP-responding fake-server scripts (real subprocess validation now runs; empty `touch`-file binaries no longer suffice).

---

## Uncommitted state at handoff

**Working tree is CLEAN.** Every task committed. No partial edits, no staged-but-uncommitted, no stashed changes.

15 commits sit ahead of `origin/main`. User decides when to push — per prior handoff convention, pushing is not automatic.

---

## What's next — Phase B

### On-ramp A — Push Phase A commits, then begin Phase B (recommended)

```bash
git push origin main   # 15 commits: T1/T2/T3/T4/T5 series
```

Then pick up T6.

### On-ramp B — Dive straight into T6 without pushing

Fine if the user prefers to batch pushes. Phase B tasks are independent of the push boundary.

### Phase B task sequence (4 tasks)

| Task | What | Model | Risk |
|---|---|---|---|
| **T6** | Claude SDK 5-source merge: extend `withAinativeMcpServer` at `claude-agent.ts:70` from 4-arg to 5-arg; both call sites (`:566` task exec + `:724` task resume) MUST pass the same `pluginServers` from a single `loadPluginMcpServers({ runtime: "claude-code" })` call. | Sonnet | **Runtime-registry-adjacent** — TDR-032 discipline mandatory, smoke budget applies. |
| **T7** | Codex App Server sync: extend `mcp-sync.ts` to include plugin-MCP as a new lane; write entries to `config.toml [mcp_servers.<pluginId>-<serverName>]`. | Sonnet | Runtime-registry-adjacent. |
| **T8** | Anthropic direct: new `withAnthropicDirectMcpServers` helper, 5-source merge shape, async + dynamic `await import("@/lib/chat/ainative-tools")` per TDR-032. | Sonnet | Runtime-registry-adjacent. |
| **T9** | OpenAI direct: new `withOpenAiDirectMcpServers` helper, transforms plugin MCP entries to OpenAI Responses API `tools: [{ type: "mcp", ... }]` shape. | Sonnet | Runtime-registry-adjacent. |

**Recommended dispatch order:** T6 first (sets the pattern), then T7/T8/T9 can dispatch in parallel since they touch independent adapter files. Each still needs its own spec-compliance + code-quality review pass.

**First smoke budget fires at T19** which depends on T6–T9 + T15 + T16. Phase B can land all 4 tasks before any smoke runs, but **don't skip T19** — TDR-032's module-load cycle is undetectable by unit tests that mock `@/lib/chat/ainative-tools`.

### After Phase B — Phases C/D/E/F

- Phase C (T10–T14): security additions — per-tool approval, capability expiry, revocation, safe-mode, confinement modes
- Phase D (T15): chat tool extensions — `list_plugins` fields, transport-aware `reload_plugin`, new `grant_plugin_capabilities`
- Phase E (T16–T18): echo-server dogfood + `docs/plugin-security.md` + TDR-035 drift invariant tests
- Phase F (T19–T21): three smoke tests — cross-runtime, confinement + Docker, reload + revoke + safe-mode cycles

---

## Regression guards — don't undo these

### From this session (Phase A)

- **Five-source merge contract — ainative LAST.** `withAinativeMcpServer` will become 5-arg in T6: `{ ...profileServers, ...browserServers, ...externalServers, ...pluginServers, ainative: ainativeServer }`. **The ainative-last position is non-negotiable per TDR-035 §1.** A plugin declaring `mcpServers: { ainative: ... }` MUST be silently dropped by the spread order. T18's drift heuristic test will assert this.
- **`supportsPluginMcpServers: boolean` on RuntimeFeatures — Ollama is FALSE, all others TRUE.** Invariant test at `catalog.test.ts` asserts these values by name. Flipping any without updating the test is a deliberate drift check.
- **`loadPluginMcpServers()` is the ONLY source of `pluginServers`.** No adapter may scan disk independently. TDR-035 §2 authority. The T18 drift heuristic will grep `src/lib/agents/runtime/` for `plugin.yaml` reads outside `mcp-loader.ts`.
- **`detached: false` explicit at every `spawn(...)` in `src/lib/plugins/`.** TDR-035 §6. Three enforcement sites: source-comment at the spawn call, source-grep test 5 (`transport-dispatch.test.ts:286`), and dedicated grep invariant test 15 (`:593`). T18 will formalize as an `/architect` drift heuristic.
- **Option A validation model — no long-lived `childRegistry`.** Ainative spawns only for MCP-initialize validation, kills on success/failure. Runtime children are SDK-owned. If a future contributor tries to add long-lived ainative-managed children, they're introducing a second process model that conflicts with the SDK's spawn-per-session behavior.
- **Timeout path uses direct SIGKILL** (not SIGTERM + fallback). `killChild` branches on `result.reason === "stdio_init_timeout"`. An unresponsive plugin has already shown it ignores stdin; SIGTERM would waste 5s. Spec-review fix commit `0eea4a6c` is load-bearing.
- **Canonical hash array-order preservation.** `sortKeysDeep` sorts object keys but preserves array order. A plugin with `capabilities: [net, fs]` produces a different hash from `capabilities: [fs, net]` — re-accept required. This is safety over UX per TDR-035 §3. Test 4 in `capability-check.test.ts` asserts this.
- **Cosmetic fields excluded from hash — EXACTLY `name`, `description`, `tags`, `author`.** Any NEW manifest field added to `plugin.yaml` MUST be explicitly categorized as "hashed" or "cosmetic" at addition time. The T2 test suite will catch silent additions via the determinism invariant, but a hashed field bypasses the check.
- **`plugins.lock.bak` written BEFORE primary overwrite** — a crash between write and rename leaves prior state in `.bak` and primary unchanged. If a future contributor reverses the order, the .bak can contain half-written content on crash.
- **`CAPABILITY_VALUES` tuple is the single source of truth.** Exported from `sdk/types.ts`, used by Zod schema + by `capability-check.ts` PluginsLockEntrySchema. Duplicating it anywhere creates a fan-out that's hard to keep in sync.

### From prior sessions (still binding)

- Everything from `handoff/2026-04-19-m3-groom-complete-handoff.md` → "Don't undo these" section (M1 + M2 + Path C + Post-M2 fix). Especially: `lastLoadedPluginIds` tracker, boot-order comment in instrumentation-node.ts, dynamic `await import` in all three chat tools, `scanBundleSection<T>` generic helper, column-coverage invariant test, `removeOrphanSchedules` + install-first pattern in `loadOneBundle`, eager `pluginCache` population.

---

## Risks and watches for Phase B

### T6 is where CLAUDE.md's smoke-budget rule fires for the first time in M3

T6 modifies `claude-agent.ts:70` (definition), `:566` (task execution call site), `:724` (task resume call site). All three live on the module graph reachable from `src/lib/agents/runtime/catalog.ts`. **Unit tests cannot catch module-load cycles at these seams.** Precedents:
- M1 T18 caught the state-preservation bug after 19 unit tests passed.
- Pre-M1 commits `092f925` → `2b5ae42` shipped with 34/34 green unit tests and 0 TypeScript errors, then crashed at first real request with `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`.

**Mitigation:** Phase B implementer prompts MUST include the TDR-032 dynamic-import discipline. Any static import of `@/lib/chat/ainative-tools` from `src/lib/agents/` is a bug. The pattern is `const { createToolServer } = await import("@/lib/chat/ainative-tools");` inside the function body, not at module top.

### T6's BOTH call sites must pass the same `pluginServers`

`claude-agent.ts:566` (task execution) and `:724` (task resume) MUST receive the same `pluginServers` object within a single request. Otherwise a task that spawned while plugin A was installed, paused, and resumed after plugin A's capabilities were revoked would see divergent tool sets. Reviewer check question: "Does the resume path call `loadPluginMcpServers` fresh, or snapshot from execution time?" Either is valid — **consistency within a single task lifecycle** is the invariant.

### Codex App Server (T7) is special — merge happens on disk, not in-memory

T7's "merge" writes entries to `~/.ainative/codex/config.toml [mcp_servers]` rather than spreading into a request payload. The five-source order is preserved conceptually, but assembly is serialized across file writes. Watch for race conditions with concurrent `config.toml` writers. Existing `mcp-sync.ts` already has bi-directional Claude↔Codex sync — extend, don't reinvent. Namespace plugin entries as `<pluginId>-<serverName>` to avoid collision with external MCP entries.

### T8/T9 direct-adapter helpers — async for TDR-032

Both `withAnthropicDirectMcpServers` and `withOpenAiDirectMcpServers` MUST be async — they dynamically import `@/lib/chat/ainative-tools` inside the function body. Watch for a contributor making them sync by inlining the import at module top. TDR-032 is unforgiving.

### File-size watch

- `mcp-loader.ts` is ~580 LOC post-T3/T4. T6 doesn't touch it; T6 touches `claude-agent.ts`.
- `transport-dispatch.ts` is ~480 LOC. Phase B shouldn't grow this.
- `claude-agent.ts` is already large. T6 adds ~30 LOC. Watch it doesn't push past whatever threshold the codebase has implicitly set.

### Subagent review lanes are still earning their keep

M3 Phase A results: 4 spec deviations caught (T2 scalar-YAML guard, T3 Ollama per-plugin log format, T4 SIGKILL on timeout, T4 dead `vi` call). Each caught by exactly one reviewer lane — spec caught behavioral gaps, quality caught code-hygiene gaps. **Run both lanes on every Phase B task.** Don't short-circuit to "it's just a 30-LOC adapter change."

### The diagnostics panel is consistently flaky

MEMORY-flagged recurring issue: after file edits, the inline TypeScript LSP panel emits phantom "Cannot find module '@/lib/agents/runtime/catalog'" and "declared but never read" warnings. Trust `npx tsc --noEmit | grep <file>` over the panel. This session hit it at least 4 times — if you see module-not-found on a file that clearly imports correctly, run tsc before spending a subagent round-trip.

### Pre-existing test failures (NOT caused by M3)

Full-suite test run at `e593d552`: 1280 passed, 7 failed, 12 skipped.

**Confirmed pre-existing** (verified by running the same tests at `95cf1294`, pre-T1):
- `src/lib/validators/__tests__/settings.test.ts` → 1 failure ("rejects missing method field"). Already in MEMORY.md.
- `src/lib/agents/__tests__/router.test.ts` → 6 failures, all "Task task-N not found" → DB setup issue. **Not in MEMORY yet.** Root cause looks like missing `conversations` table in the test-bootstrap DB (`[bootstrap] ALTER TABLE failed: no such table: conversations` spam). Unrelated to M3. Track separately.

Plugin-suite tests: 126/126 green. Full-suite: 1280/1299 passed (99.5%). Ship confidence high.

---

## Subagent model mix for Phase B implementation

Informed by Phase A runs:

- **Haiku** — not allocated in Phase B (no mechanical-only tasks). Keep as fallback for any sub-task that materializes as pure-schema work.
- **Sonnet** — T6, T7, T8, T9. All four are integration work touching multi-file surfaces.
- **Opus** — not allocated. If a task reveals architectural tension (new TDR needed), escalate to Opus for the TDR draft.

Phase A tests showed Sonnet handles runtime-registry-adjacent changes cleanly when the prompt explicitly calls out TDR-032 + the smoke-budget rule.

---

## Open decisions deferred (still — none block Phase B)

Inherited from M3-groomed handoff + Phase A review follow-ups:

- **Extract `logToFile` to `src/lib/plugins/plugin-logger.ts`** — 4 copies now exist (registry.ts, capability-check.ts, mcp-loader.ts, transport-dispatch.ts). Threshold hit. Do this before T15 which will add a 5th. Low-scope — 30-line extraction + 4 import swaps.
- **T12 corrupted-lockfile write-over UX (I-1 from T2 review)** — `writePluginsLock` silently overwrites a previously-corrupted lockfile after `readPluginsLock` returned empty-state. Not a correctness bug (.bak preserves prior), but a silent-failure candidate per Engineering Principle #1. Fold into T12's revocation flow where the corrupted-lockfile UX surfaces to users.
- **Test 7 SIGTERM sentinel (I-3 from T4 review)** — current test only asserts `result.ok === true`, not actual child kill. Tighten in a T4-adjacent follow-up or bundle into T21 (smoke 3).
- **Env-leak in validation child spawn (M-5 from T4 review)** — `TODO(T14)` comment already in `transport-dispatch.ts:127`. T14 confinement strips sensitive env.
- **Parallelize outer plugin-scan loop (M-8 from T4 review)** — current implementation validates plugins serially in `listPluginMcpRegistrations`. 10 plugins × 10s timeout = 100s worst case. Defer until 5+ plugins become common in practice. Per-plugin isolation already in place.
- All deferred items from prior handoff still apply (per-tool-call audit log, DNS allowlist per capability, worker-thread isolation, cross-plugin MCP scoping, runtime safe-mode toggle, etc.)

---

## Environment state at handoff time

- **Branch:** `main`, **working tree clean**. 15 commits ahead of `origin/main`.
- **HEAD:** `e593d552` (T4 cleanup)
- **Tests (full suite):** 1280 passed / 7 failed / 12 skipped (1299 total). All 7 failures pre-existing.
- **Tests (plugins suite):** 126/126 green in 17 files.
- **`npx tsc --noEmit`:** clean.
- **`package.json` version:** still `0.13.3`. npm publish deferred until post-M5 per Amendment 2026-04-19.
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]`.
- **Smoke data dirs:** `~/.ainative-smoke-plugins-m1` + `~/.ainative-smoke-m2` still exist from prior milestones. `~/.ainative-smoke-m3*` not yet created — will be created during T19/T20/T21.
- **Dev server:** not running.
- **Chat-tool count:** 87 (M2-shipped). Phase B adds zero. End-of-M3 target: 91 (after T10/T11/T12/T15 add `set_plugin_tool_approval`, `set_plugin_accept_expiry`, `revoke_plugin_capabilities`, `grant_plugin_capabilities`).
- **TDR count:** 34 → 35 with TDR-035 still `proposed`. Transitions to `accepted` at M3 shipped.
- **New artifacts this session (all committed):**
  - `src/lib/plugins/capability-check.ts` + `__tests__/capability-check.test.ts`
  - `src/lib/plugins/mcp-loader.ts` + `__tests__/mcp-loader.test.ts`
  - `src/lib/plugins/transport-dispatch.ts` + `__tests__/transport-dispatch.test.ts`
  - `src/lib/plugins/sdk/__tests__/types.test.ts`
  - `getAinativePluginsLockPath()` helper in `ainative-paths.ts`
  - `supportsPluginMcpServers` column + invariant test in catalog
  - `parseMcpConfigFile` + `RawMcpServerEntry` extracted in environment/parsers/mcp-config.ts

---

## Session meta — what this handoff captures vs. what the committed artifacts already capture

This handoff focuses on **what's specific to the Phase A → Phase B transition**, not what's already in the committed code. Canonical sources:

- **T1–T5 implementation details** → the code + tests themselves (everything committed, nothing in WIP)
- **Architectural decisions** → TDR-035 (still `proposed`); Phase B implementers should confirm no new architectural tension before relying on it
- **M3 implementation ordering** → `.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`
- **Overall strategy** → `ideas/self-extending-machine-strategy.md`
- **Prior state (groomed)** → `handoff/2026-04-19-m3-groom-complete-handoff.md`
- **Prior state (M2-shipped)** → `handoff/2026-04-19-self-extending-machine-m2-shipped-handoff.md`

If in doubt, read the doc. This handoff is the routing table, not the authority.

---

*End of handoff. Phase A is complete, Phase B is scoped, and Phase B's first task (T6) can begin with the Phase A foundation as stable ground. The working tree is clean, 15 commits await push, and the subagent-driven-development rhythm proved its value — 4 spec-deviations caught and fixed inline across 5 tasks. Phase B's first smoke budget triggers at T19, not before.*
