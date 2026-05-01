# Handoff: M3 Phase B COMPLETE — next session picks up Phase C (security additions)

**Created:** 2026-04-19 (M3 Phase B foundation shipped — T6, T7, T8, T9 across four runtime adapters; one fix-forward commit)
**Supersedes:** `handoff/2026-04-19-m3-phase-a-complete-handoff.md`
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **M3 Phase B is DONE.** Cross-runtime wiring — Claude SDK 5-source merge, Codex App Server plugin-MCP sync, Anthropic direct + OpenAI direct helpers + transform — all shipped across **5 commits on main**, zero test regressions, 206/206 Phase-B-adjacent tests green, `tsc --noEmit` clean. Working tree clean. Subagent-driven-development model (implementer + spec-compliance reviewer + code-quality reviewer per task) applied to all 4 tasks; **one critical bug caught in review** (T7 regex-based strip was not idempotent — would have corrupted `config.toml` on every user's 2nd Codex session) and fixed inline before landing. Next session picks up **Phase C** (T10–T14 security additions): per-tool approval overlay, capability expiry, revocation flow, `--safe-mode` CLI flag, confinement modes (seatbelt/AppArmor/Docker).

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`** — the 21-task plan. Sections to know cold: **Phase C (T10–T14)** starts at T10 (per-tool approval overlay). Phase A + B tasks (T1–T9) are all shipped; Phase A subsumed T5 into T3 per prior handoff.
3. **`features/chat-tools-plugin-kind-1.md`** — the M3 feature spec. Sections "Per-tool approval overlay (Codex-style)", "Capability expiry (opt-in)", "Revocation flow", "`--safe-mode` CLI flag", "Confinement modes (OS-level subprocess isolation)" are the Phase C bibles.
4. **`.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md`** — TDR-035. Still `proposed`. Phase C touches §5 (reload semantics per transport) and §6 (process ownership and lifecycle) for the revocation + confinement work. Phase C does NOT change the five-source merge (that's settled in Phase B).
5. **`ideas/self-extending-machine-strategy.md`** — living strategy doc; Amendments 2026-04-19 (I + II) still authoritative.
6. **Previous handoffs** — `handoff/2026-04-19-m3-phase-a-complete-handoff.md` (Phase A foundation), `handoff/2026-04-19-m3-groom-complete-handoff.md` (M3 groomed state). Authoritative for prior-phase state; this handoff supersedes from M3-Phase-B-complete onward.
7. **CLAUDE.md's runtime-registry smoke rule** — still binding. Phase C's T14 (confinement mode spawn wrap) is runtime-registry-adjacent via the stdio spawn path. T10 touches `handleToolPermission` in `claude-agent.ts:618` which is also adjacent. T20 covers T14's smoke; T19 (depends on T10/T12/T15 among others) covers T10 indirectly.

---

## What shipped this session

### Commits on main (ahead of origin by 21; Phase B oldest → newest)

```
4f3403b1  feat(plugins): T6 — Claude SDK 5-source merge with pluginServers
3eb0c9dc  feat(plugins): T7 — Codex plugin-MCP sync to config.toml
f771a7c7  feat(plugins): T8 — Anthropic direct runtime MCP 5-source merge
0488a33c  feat(plugins): T9 — OpenAI direct runtime MCP 5-source merge
0c501637  fix(plugins):  T7 — line-based strip + sync-failure logging (C1+I1)
```

**HEAD:** `0c501637`. **Origin is 21 commits behind** (15 Phase A + 1 handoff doc + 5 Phase B). Push at end of session per user directive (push command issued 2026-04-19 — see git log for the actual origin state as of this handoff's commit).

### T6 (one commit) — Claude SDK 5-source merge

- `src/lib/agents/claude-agent.ts`: `withAinativeMcpServer` became 5-arg `(profileServers, browserServers, externalServers, pluginServers, projectId?)` with `ainative` spread LAST per TDR-035 §1. Helper exported for testability. Both call sites (`:566` execution, `:724` resume) dynamically import `loadPluginMcpServers` inside a 3-element `Promise.all` alongside `getBrowserMcpServers()` + `getExternalMcpServers()` — symmetric shape across both call sites.
- Tests at `src/lib/agents/__tests__/claude-agent.test.ts`: +4 T6 tests (happy path, plugin-cannot-shadow-ainative, full key-order, source-grep invariant that both sites call `loadPluginMcpServers({ runtime: "claude-code" })`). 38/38 green.
- Both review lanes passed first try. Code-quality reviewer noted 4 non-blocking suggestions (precision of source-grep regex, helper export shape, error-path documentation, empty-plugin shadow-path test). None shipped as fixes — recorded for future follow-up.

### T7 (two commits) — Codex App Server plugin-MCP sync

**Initial commit `3eb0c9dc`:**
- `src/lib/environment/sync/mcp-sync.ts`: added `preparePluginMcpCodexSync(registrations, targetPath?)` (pure function — optional path override makes tests tmpdir-based) and `syncPluginMcpToCodex()` orchestrator that dynamically imports `listPluginMcpRegistrations` and writes `[mcp_servers.<pluginId>-<serverName>]` entries to `~/.codex/config.toml`. Strip-then-re-add pattern: remove ALL plugin-owned sections (accepted AND disabled), then emit fresh sections for accepted-stdio only. `ainative-sdk` transport entries skipped (Codex doesn't speak that transport).
- `src/lib/agents/runtime/codex-app-server-client.ts`: `connect()` now calls `syncPluginMcpToCodex()` via dynamic `await import(...)` before Codex spawns. Error was caught and silently swallowed.
- `PluginMcpRegistration` imported as `import type` at module top — compile-time erased, safe from cycle.
- 8 unit tests at `src/lib/environment/sync/__tests__/mcp-sync.test.ts` using real tmpdir (no fs mocks).

**Fix commit `0c501637` (triggered by code-quality review):**
- **C1 (critical):** Regex-based strip `[^\[]*` terminated at any `[` character — including the `[` inside inline TOML arrays (`args = ["a.js"]`) and `.env` sub-sections (`[mcp_servers.<key>.env]`). On the 2nd consecutive `syncPluginMcpToCodex()` call, the config.toml would accumulate orphaned array literals / env tables and eventually become invalid TOML. Since `CodexAppServerClient.connect()` runs the sync on EVERY session, this would have bitten every user on their 2nd Codex session.
- Replaced regex with line-based splitter: iterate lines, match section headers with `^\[mcp_servers\.(...)\]\s*$`, extract `baseKey` (handling both bare sections and `.env` children), enter/exit skip mode on header boundaries, preserve non-plugin sections verbatim.
- **I1 (important):** Replaced the empty `catch {}` in `codex-app-server-client.ts` `connect()` with a best-effort log write to `$AINATIVE_DATA_DIR/logs/plugins.log` via `getAinativeLogsDir()` from `@/lib/utils/ainative-paths`. Nested try/catch makes logging non-throwing.
- **S1 (suggestion):** Removed pre-existing dead imports (`existsSync`, `readFileSync`, `parseTOML`) in mcp-sync.ts — they pre-dated T7 but landed in the same cleanup commit per Phase A convention.
- 2 new tests added: idempotency assertion (`run2.content === run1.content`) and env-sub-section strip. Test count 8 → 10.
- Code-quality re-review confirmed the fix is correct on every listed edge case (first-section-is-plugin, trailing whitespace, multi-env configs, non-plugin section preservation).

### T8 (one commit) — Anthropic direct runtime MCP merge

- `src/lib/agents/runtime/anthropic-direct.ts`: added `export async function withAnthropicDirectMcpServers(...)` helper — byte-identical body to T6's `withAinativeMcpServer` except for the function name. Added `mcpServers` field to `AnthropicCallOptions`. `callAnthropicModel` now sets `params.mcp_servers = options.mcpServers` (when non-empty) before `client.messages.stream(params, ...)`. `params` is typed as `any`, no `@ts-expect-error` needed. Call-site IIFE in `executeAnthropicDirectTask` loads `loadPluginMcpServers({ runtime: "anthropic-direct" })` dynamically — runtime-id matches catalog line 183.
- Scope caveat applied: anthropic-direct has no existing browser/external-MCP wiring, so those positions receive `{}`. Five-source contract honored positionally, even with empty upstream sources.
- Pre-existing static import of `createToolServer` at line 18 (pre-M3 tech debt) left alone — NOT T8's scope.
- 3 tests at `src/lib/agents/runtime/__tests__/anthropic-direct.test.ts` (new file): helper happy-path, plugin-cannot-shadow, source-grep invariant. 3/3 green.
- Both review lanes passed first try. Code-quality reviewer noted 4 non-blocking suggestions (source-grep precision against comment false-positives, IIFE vs flattened await, no graceful-degradation test for loader-throws, file size 681 → 745 LOC — still reasonable).

### T9 (one commit) — OpenAI direct runtime MCP merge

- `src/lib/agents/runtime/openai-direct.ts`: added `export async function withOpenAiDirectMcpServers(...)` helper — byte-identical body to T6/T8 except for the function name. Added `export function mcpServersToOpenAiTools(mergedServers)` transform that converts the canonical `Record<name, config>` shape into OpenAI Responses API `Array<{ type: "mcp", server_label, ... }>` entries. Transform excludes the `ainative` key (OpenAI direct uses its existing `forProvider("openai")` function-calling path for ainative, NOT the MCP path). Maps `url` → `server_url` to match OpenAI's wire naming. Added `pluginMcpTools` field to `OpenAICallOptions`. Call site in `executeOpenAIDirectTask` passes transform output to `allTools` which is spread after existing function-calling tools before `client.responses.create`.
- Runtime-id is `"openai-direct"` — matches catalog line 224.
- 9 tests at `src/lib/agents/runtime/__tests__/openai-direct.test.ts` (new file): helper happy-path + plugin-cannot-shadow + five-source order + transform shape + ainative-exclusion + url→server_url + empty-map → empty-array + two source-grep invariants (loadPluginMcpServers call + helper usage within `executeOpenAIDirectTask`). 9/9 green.
- Code-quality reviewer noted `url` branch of transform is currently unreachable from `NormalizedMcpConfig` (which only exposes command/args/env/transport/entry) — kept as forward-compat hedge for eventual remote-MCP shapes. Acceptable dead branch with T9-6 covering it in isolation.

---

## Uncommitted state at handoff

**Working tree is CLEAN.** Every task committed. No partial edits, no staged-but-uncommitted, no stashed changes.

21 commits sit ahead of `origin/main` after the Phase B implementation but BEFORE this handoff + push. After push, origin will be current.

---

## What's next — Phase C

### On-ramp A — Pick up T10 (per-tool approval overlay) as first Phase C task

T10 is the natural entry: it extends `plugins.lock` (T2's file), hooks into `handleToolPermission` at `claude-agent.ts:618`, and adds a new chat tool. The review model (subagent-driven-development) can proceed task-by-task as in Phases A and B.

### On-ramp B — Parallel T11/T12/T13 after T10 lands

T11 (capability expiry), T12 (revocation flow), T13 (`--safe-mode` flag) are mostly independent of each other. After T10 sets the per-tool pattern, these three can dispatch in parallel (T11 and T12 both extend `capability-check.ts`; T13 touches `bin/cli.ts`). Watch for file-conflict on `capability-check.ts` between T11 and T12 — serialize those two.

### Phase C task sequence (5 tasks)

| Task | What | Model | Risk |
|---|---|---|---|
| **T10** | Per-tool approval overlay (Codex-style): `never`/`prompt`/`approve` per tool, stored in `plugins.lock`, gated at `handleToolPermission`. New chat tool `set_plugin_tool_approval`. | Sonnet | Touches permission-gate logic. Runtime-registry-adjacent via `handleToolPermission`. |
| **T11** | Capability expiry (opt-in): optional `expiresAt` in `plugins.lock`, new chat tool `set_plugin_accept_expiry({ days ∈ {30, 90, 180, 365} })`. | Haiku | Trivial — opt-in field + chat tool. |
| **T12** | Revocation flow: new chat tool `revoke_plugin_capabilities({ pluginId })`, SIGTERMs stdio child (5s SIGKILL fallback per TDR-035 §5), busts `require.cache` for in-process, fires Inbox notification. | Haiku | Simple inverse of grant, but touches process lifecycle. |
| **T13** | `--safe-mode` CLI flag: `bin/cli.ts` parses flag, exports `AINATIVE_SAFE_MODE=true` into Next.js process env, short-circuits Kind-1 plugin load (Kind 5 still loads). | Haiku | Simple flag parse. |
| **T14** | Confinement modes: `confinementMode: "none" / "seatbelt" / "apparmor" / "docker"` enum. Per-capability profiles, platform detection, Docker boot-sweep, `plugin dry-run` CLI command. | Sonnet | **Highest-complexity Phase C task.** Policy DSL + platform branches + Docker. Consider splitting T14a/T14b/T14c if implementation gets dense. |

**Recommended dispatch order:** T10 first (sets the approval-gate pattern). Then T11 + T13 parallel (zero file overlap), T12 after T10 (depends on T10's lockfile shape extension). T14 last — it's the densest task and benefits from having T10–T13 lockfile + CLI patterns as stable ground.

### After Phase C — Phases D/E/F

- Phase D (T15): chat tool extensions — `list_plugins` field additions, transport-aware `reload_plugin`, new `grant_plugin_capabilities`
- Phase E (T16–T18): echo-server dogfood plugin + `docs/plugin-security.md` + TDR-035 drift invariant tests
- Phase F (T19–T21): **three mandatory smoke tests** per CLAUDE.md runtime-registry-adjacent rule. T19 covers T6–T9 + T15 + T16. T20 covers T14 (confinement). T21 covers T10–T13 (reload + revoke + safe-mode cycles).

---

## Regression guards — don't undo these

### From this session (Phase B)

- **Five-source merge contract — ainative LAST across all 4 adapters.** T6 (`withAinativeMcpServer` at `claude-agent.ts:70`), T8 (`withAnthropicDirectMcpServers` at `anthropic-direct.ts:63`), T9 (`withOpenAiDirectMcpServers` at `openai-direct.ts:...`) all have byte-identical helper bodies (modulo function name). T7 writes sections to `config.toml` preserving conceptual five-source order via namespacing. T18's upcoming drift heuristic test will grep all four sites — flipping spread order in any adapter will fail that test.
- **Dash-separator namespace in Codex config.toml: `<pluginId>-<serverName>`.** Not dot, not underscore. Documented in TDR-035 §1 Codex row. T18's drift heuristic will check this.
- **T7's line-based strip, NOT regex.** The regex approach landed a critical idempotency bug in the first T7 commit (`3eb0c9dc`); the fix (`0c501637`) switched to line-based. A future contributor tempted to "simplify back to a regex" will re-introduce the bug. The file comment on the strip function (mcp-sync.ts:158-165) explicitly calls out the invariant — don't delete that comment.
- **T7 I1 log-write must remain inside a nested try/catch.** `connect()` in `codex-app-server-client.ts` must NEVER throw from the plugin-sync path. If logging itself fails (disk full, permissions), the error must be swallowed so Codex can still start. A future contributor simplifying the nested catch into a single catch risks regressing this.
- **`mcpServersToOpenAiTools` excludes `ainative` key.** Line `if (name === "ainative") continue` in the transform is load-bearing: OpenAI direct's `createToolServer(...).forProvider("openai")` path handles ainative via function-calling, NOT MCP. Removing this exclusion would register ainative TWICE (once as function-calling, once as MCP) and cause tool-name collisions.
- **`params.mcp_servers` in T8 and `pluginMcpTools` field in T9 must remain beta-aware.** The Anthropic Messages API `mcp_servers` is a beta field — T8's JSDoc explicitly notes this. A future SDK version might formalize the field or rename it; the conditional shape at anthropic-direct.ts:220 (`if (options.mcpServers && Object.keys(...).length > 0) params.mcp_servers = ...`) handles the empty-map shadow path correctly.
- **Source-grep invariant tests at T6, T8, T9 are intentional.** They catch regressions where a call site is deleted but the helper remains (orphan helper). If a future refactor renames `loadPluginMcpServers` or changes the runtime-id string, update ALL THREE invariant tests simultaneously or they'll false-fail.
- **Scope caveat applied consistently:** T8 and T9 pass `{}` for browser/external/profile positions because those adapters don't have upstream MCP wiring yet. A future task that adds browser-MCP support to anthropic-direct/openai-direct MUST use the existing helper positions — don't invent a parallel merge path.

### From prior sessions (still binding)

All Phase A + prior-milestone guards remain authoritative. See `handoff/2026-04-19-m3-phase-a-complete-handoff.md` → "Don't undo these" section for the full list (TDR-032 dynamic-import discipline, `supportsPluginMcpServers` catalog column, `loadPluginMcpServers` as sole source of pluginServers, `detached: false` at every spawn in `src/lib/plugins/`, Option A validation model, canonical hash array-order preservation, cosmetic fields excluded from hash, `plugins.lock.bak` written BEFORE primary, `CAPABILITY_VALUES` single source of truth, prior M1 + M2 regression guards).

---

## Risks and watches for Phase C

### T10 is the first permission-gate extension in this feature

`handleToolPermission` at `claude-agent.ts:618` is touched by multiple existing features (tool-permission-persistence, MCP elicitation). T10 adds a per-plugin-tool-mode dimension — the resolution order matters:
1. Per-tool mode from `plugins.lock` (new in T10): `never` / `prompt` / `approve`
2. Existing tool-permission-persistence rule (Always Allow, Always Deny)
3. MCP elicitation (SEP-1036)

Reviewer check question: "Does T10 insert itself BEFORE existing rules (highest precedence) or AFTER (fallback when no explicit rule exists)?" Spec says per-tool approval is the "Second gate beyond install-time" — so it runs AFTER install-time capability-accept but BEFORE the existing permission cache / UI. The order in `handleToolPermission` must be: capability-accept gate → per-tool mode → tool-permission-persistence → user prompt. Get this wrong and either users get double-prompted or plugin tools bypass the prompt surface entirely.

### T11/T12 both extend `capability-check.ts` — serialize them

If T11 and T12 dispatch in parallel, both will modify the same file. File conflict risk. Recommended: T10 → T12 → T11 → T13 → T14 serial, OR T10 → (T11, T13 parallel) → T12 → T14. If running T11/T12 in parallel, one must rebase onto the other's commit; messy.

### T14 is the highest-complexity task in the plan

Policy DSL (seatbelt profiles under `.sb` files, AppArmor profiles), platform detection branches (macOS rejects AppArmor, Linux rejects seatbelt), Docker spawn translation (`docker run --rm -i --network ... --label ainative-plugin=<id> ...`), boot-sweep for orphaned containers (`docker ps --filter label=ainative-plugin` → `docker kill`), and the `ainative plugin dry-run <id>` CLI command. The plan's "Risk watches" section explicitly flags this: "Consider splitting into T14a (enum + profile stubs) + T14b (actual seatbelt profiles) + T14c (Docker wrapper) if the single-task scope feels dense during implementation." Use the split if the implementer subagent reports DONE_WITH_CONCERNS on its first pass.

### The `confinementMode` enum must be declared in T1's schema NOW

Check: is `confinementMode` already in `ChatToolsPluginManifestSchema` at `src/lib/plugins/sdk/types.ts`? Phase A T1 mentioned it. If not, T14 needs to extend the schema — and that's a hash-affecting change (any new hashed field forces re-accept for existing users). Verify before starting T14.

### Pre-existing test failures (NOT caused by Phase B)

Full-suite test run at Phase B HEAD: same as Phase A baseline — 1280 passed, 7 failed, 12 skipped.
- `src/lib/validators/__tests__/settings.test.ts` → 1 failure ("rejects missing method field"). Already in MEMORY.
- `src/lib/agents/__tests__/router.test.ts` → 6 failures ("Task task-N not found"). Root cause appears to be missing `conversations` table in test bootstrap DB. Unrelated to M3. Tracked in Phase A handoff. Not fixed this session.

Plugin-suite tests: 126/126 green. Claude-agent tests: 38/38 green. New T8 + T9 tests: 12 total, all green. T7 tests: 10 green. **Phase B itself: 206 new or touched tests, 206 green.**

### Phase C's first smoke budget fires at T19

Still T19 (smoke 1: Claude SDK + echo-server end-to-end across 4 runtimes) — depends on T6 + T7 + T8 + T9 (all shipped) + T15 (Phase D) + T16 (echo-server dogfood, Phase E). T20 and T21 fire at their respective Phase F slots. Phase C does not unlock any smokes by itself — the Phase F smokes are the integration guards for everything Phases A through E ship.

### Subagent review lanes remain worth the cost

Phase B results: **1 critical bug caught** (T7 C1 regex idempotency — would have shipped to users and corrupted config.toml on 2nd Codex session) + 1 important logging gap (T7 I1) + 1 suggested cleanup (T7 S1). All three caught by the code-quality reviewer after spec-compliance passed. Spec-compliance review found no issues in any Phase B task — but spec-compliance ≠ correctness. The code-quality lane earned its keep this phase by an embarrassment-saving margin. Keep running both lanes on every Phase C task.

### Phantom LSP panel — still flaky, hit ~4 times this session

Inline diagnostics panel emitted "Cannot find module @/lib/chat/ainative-tools" and "declared but never read" warnings on files that compile cleanly under `tsc --noEmit`. MEMORY-flagged recurring issue. **Trust `npx tsc --noEmit | grep <file>` over the panel.** Do not spend a subagent round-trip chasing phantom LSP errors.

### Dead branch in T9 transform

`mcpServersToOpenAiTools`'s `url` → `server_url` branch is currently unreachable from `NormalizedMcpConfig` (which only exposes command/args/env/transport/entry — no url). Kept as forward-compatibility hedge for eventual remote-MCP shapes. Test T9-6 covers it in isolation. If a future task adds `url` to `NormalizedMcpConfig` (remote MCP support), the branch becomes live — no code change needed.

---

## Subagent model mix for Phase C implementation

Informed by Phase B runs:

- **Haiku** — allocated for T11 (trivial lockfile field + chat tool), T12 (inverse of grant, simple), T13 (flag parse). Three tasks that benefit from speed.
- **Sonnet** — allocated for T10 (permission-gate logic, multiple resolution paths), T14 (policy DSL + platform detection + Docker — highest complexity in the plan).
- **Opus** — not allocated. If T14 reveals architectural tension around confinement profile schemas, escalate to Opus for a TDR draft (TDR-036 candidate).

Phase B's review-lane discipline caught 1 critical bug in 5 commits — **keep both lanes on every Phase C task.**

---

## Open decisions deferred (inherited + new)

- All Phase A + prior open decisions still apply (see prior handoffs).
- **T7 code-quality suggestion S1.1 (latent, not blocking):** `serverName` is not validated against kebab-case at manifest ingestion time (unlike `pluginId` which is constrained at `sdk/types.ts:24`). A `serverName` containing a dot would produce `[mcp_servers.<pluginId>-<server.name>]` which parses as a nested TOML table and breaks idempotency on re-read. Fix options: (a) validate `serverName` against `/^[a-z][a-z0-9-]*$/` during `.mcp.json` parsing, or (b) quote-escape the key in TOML emission. No current repo plugin hits this — all use kebab-case. Track as follow-up; not blocking Phase C.
- **T8 + T9 graceful-degradation under loader throws.** The current `loadPluginMcpServers` is designed to never throw (it captures errors as rejected registrations). If that contract ever weakens, T8 and T9's uncaught IIFE awaits would crash the request. Flag for tracking only — no action needed unless the loader contract changes.
- **T6 + T8 + T9 empty-plugin shadow-path tests.** The loader returns `{}` in safe-mode / unsupported-runtime / no-plugins-installed cases. Tests currently cover the `{pluginName: config}` case but not literally `{}`. A one-line test addition would lock in the degenerate case. Defer to T19 smoke coverage.
- **Extract `logToFile` to `src/lib/plugins/plugin-logger.ts`.** Now 5 copies (registry.ts, capability-check.ts, mcp-loader.ts, transport-dispatch.ts, and T7's logging approach in codex-app-server-client.ts uses the same pattern locally). Phase A handoff deferred this; T7 fix commit added the 5th instance. Threshold hit — do before T15 adds a 6th. Low-scope.
- **T12 corrupted-lockfile write-over UX (I-1 from T2 review).** Still deferred to T12. T12 is the revocation task — surface the corruption UX there.
- **Parallelize outer plugin-scan loop (M-8 from T4 review).** Still deferred until 5+ plugins common.
- **Source-grep invariant tests could false-positive on comments** (noted in T6 + T8 code-quality reviews). If a future task adds a comment containing the full `loadPluginMcpServers({ runtime: "..." })` string, that test's count flips to 2 and fails. Mitigation: strip comments before grepping, or switch to line-anchored regex. Defer to T18 (which formalizes drift heuristics).

---

## Environment state at handoff time

- **Branch:** `main`, **working tree clean**. 21 commits ahead of `origin/main` (15 Phase A + 1 Phase A handoff + 5 Phase B). After the user's push, origin will be current.
- **HEAD:** `0c501637` (T7 fix-forward commit).
- **Tests (full suite):** 1280 passed / 7 failed / 12 skipped — same baseline as Phase A. All 7 failures pre-existing (settings validator, router DB setup).
- **Tests (Phase B-adjacent):** 206/206 green across plugins (126), claude-agent (38), anthropic-direct (3), openai-direct (9), mcp-sync (10), other runtime tests (20+).
- **`npx tsc --noEmit`:** clean.
- **`package.json` version:** still `0.13.3`. npm publish deferred until post-M5 per Amendment 2026-04-19.
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]`.
- **Smoke data dirs:** `~/.ainative-smoke-m3*` still not yet created — will be created during T19/T20/T21 in Phase F.
- **Dev server:** not running.
- **Chat-tool count:** 87 (M2-shipped). Phase B added zero. Phase C will add 3 (T10: `set_plugin_tool_approval`, T11: `set_plugin_accept_expiry`, T12: `revoke_plugin_capabilities`). Phase D will add 1 (T15: `grant_plugin_capabilities`). End-of-M3 target: 91.
- **TDR count:** 34 → 35 with TDR-035 still `proposed`. Transitions to `accepted` at M3 shipped (post-Phase F smokes).
- **New artifacts this session (all committed):**
  - `src/lib/agents/__tests__/claude-agent.test.ts` — extended with T6 mocks + 4 tests (file pre-existed)
  - `src/lib/environment/sync/__tests__/mcp-sync.test.ts` (new — 10 tests)
  - `src/lib/agents/runtime/__tests__/anthropic-direct.test.ts` (new — 3 tests)
  - `src/lib/agents/runtime/__tests__/openai-direct.test.ts` (new — 9 tests)
  - `withAinativeMcpServer` exported + 5-arg signature (Claude SDK)
  - `withAnthropicDirectMcpServers` helper (Anthropic direct)
  - `withOpenAiDirectMcpServers` helper + `mcpServersToOpenAiTools` transform (OpenAI direct)
  - `preparePluginMcpCodexSync` + `syncPluginMcpToCodex` (Codex sync)
  - `mcpServers` field on `AnthropicCallOptions`; `pluginMcpTools` field on `OpenAICallOptions`
  - Sync-failure logging in `CodexAppServerClient.connect()` via `getAinativeLogsDir`

---

## Session meta — what this handoff captures vs. what the committed artifacts already capture

This handoff focuses on **what's specific to the Phase B → Phase C transition**, not what's already in the committed code. Canonical sources:

- **T6–T9 implementation details** → the code + tests themselves (everything committed, nothing in WIP)
- **T7 C1 bug + fix rationale** → commit `0c501637` message + code-quality review comments in the session transcript
- **Architectural decisions** → TDR-035 (still `proposed`); Phase C implementers should confirm no new architectural tension before relying on it
- **M3 implementation ordering** → `.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`
- **Overall strategy** → `ideas/self-extending-machine-strategy.md`
- **Prior state (Phase A shipped)** → `handoff/2026-04-19-m3-phase-a-complete-handoff.md`
- **Prior state (M3 groomed)** → `handoff/2026-04-19-m3-groom-complete-handoff.md`
- **Prior state (M2 shipped)** → `handoff/2026-04-19-self-extending-machine-m2-shipped-handoff.md`

If in doubt, read the doc. This handoff is the routing table, not the authority.

---

*End of handoff. Phase B is complete, Phase C is scoped, and Phase C's first task (T10 per-tool approval overlay) can begin with the Phase B five-source merge contract as stable ground across all four runtime adapters. The working tree is clean, 21 commits have landed, and the subagent-driven-development rhythm caught an embarrassment-saving critical bug (T7 C1) in review — the review lanes continue to earn their keep. Phase C's first file-conflict risk is T11/T12 (both extend capability-check.ts) — serialize those two. Phase C's densest task is T14 (confinement) — consider the T14a/b/c split if the implementer hits complexity.*
