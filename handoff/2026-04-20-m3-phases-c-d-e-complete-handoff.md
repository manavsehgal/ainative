# Handoff: M3 Phases C + D + E COMPLETE — next session picks up Phase F (live smoke tests)

**Created:** 2026-04-20 (Phases C + D + E shipped in one session — T10 through T18, nine commits on `origin/main`, zero test regressions)
**Supersedes:** `handoff/2026-04-19-m3-phase-b-complete-handoff.md`
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **M3 is code-complete through T18.** Phase C security additions (per-tool approval, capability expiry, revocation, `--safe-mode`, confinement modes), Phase D chat-tool extensions (`list_plugins` Kind-1 shape, transport-aware `reload_plugin`, `grant_plugin_capabilities`), and Phase E dogfood + docs + invariant tests (echo-server, `docs/plugin-security.md`, TDR-035 drift heuristics) all shipped across **9 commits on `origin/main`**, `tsc --noEmit` clean, 218/218 plugin-adjacent tests green, 122/122 chat-tools tests green, working tree clean. Subagent-driven-development applied to all 9 tasks; phantom LSP noise consistently resolved by `tsc --noEmit`. Next session picks up **Phase F** — three mandatory smoke tests (T19 + T20 + T21) that require a live `npm run dev` + real runtime switching + human observation, per CLAUDE.md's runtime-registry-adjacent rule.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`** — the 21-task plan. Phase F sits at T19–T21 (lines 498–583). All other phases (A–E, T1–T18) are shipped.
3. **`features/chat-tools-plugin-kind-1.md`** — the M3 feature spec. Acceptance criteria section (lines 344–372) is the Phase F bible: most items are already ticked by code-complete state; the REAL `npm run dev` smoke (line 369) is T19.
4. **`docs/plugin-security.md`** — T17's 248-line user-visible security model doc. Read to calibrate tone if writing any M3-adjacent docs. Internal references only — no external URLs.
5. **`.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md`** — TDR-035. Still `proposed`. Transitions to `accepted` when Phase F smokes pass.
6. **Previous handoffs** — `handoff/2026-04-19-m3-phase-b-complete-handoff.md` (Phase B + prior state authority), `handoff/2026-04-19-m3-phase-a-complete-handoff.md`, `handoff/2026-04-19-m3-groom-complete-handoff.md`. This handoff supersedes from "M3 through T18 complete" onward.
7. **`src/lib/plugins/__tests__/cross-runtime-contract.test.ts`** — T18's drift heuristic suite. Worth a 5-min read before Phase F so you understand what *should* hold as you observe smoke behavior. If T19/T20/T21 reveal drift, the heuristic tests should already catch it — if they don't, add to them.
8. **CLAUDE.md's runtime-registry smoke rule** — still binding. T19 is the golden-path defense against module-load cycles. `vi.mock("@/lib/chat/ainative-tools", ...)` structurally cannot catch cycles; only real `npm run dev` can.

---

## What shipped this session

### Commits on main (origin pushed; nine new on top of 25d3a005)

```
7b1e78fc  test(plugins):  T18 — TDR-035 drift heuristic invariants
f6623c48  docs(plugins):  T17 — plugin-security.md
7b07c527  feat(plugins):  T16 — echo-server dogfood plugin
0a70efe6  feat(plugins):  T15 — chat tool extensions for Kind 1 plugins
794109c7  feat(plugins):  T14 — confinement modes (seatbelt + apparmor + docker)
21aa830b  feat(plugins):  T13 — --safe-mode CLI flag
0d907d5a  feat(plugins):  T12 — revocation flow
7f1319a6  feat(plugins):  T11 — capability expiry
52846f5a  feat(plugins):  T10 — per-tool approval overlay
```

**HEAD:** `7b1e78fc`. Origin is current. Nothing pending locally.

### Phase C — Security Additions (T10–T14)

#### T10 — Per-tool approval overlay (`52846f5a`)
- Extended `PluginsLockEntry` with optional `toolApprovals: Record<toolName, "never" | "prompt" | "approve">`
- New helpers in `src/lib/plugins/capability-check.ts`: `setPluginToolApproval`, `getPluginToolApprovalMode`, `resolvePluginToolApproval` (parses `mcp__<server>__<rest>`, dynamic-imports mcp-loader, reads manifest inline for `defaultToolApproval`)
- New **Layer 1.8** inserted in `src/lib/agents/tool-permissions.ts` between SDK filesystem auto-allow (1.75) and saved user permissions (2). Only fires for `mcp__*` tool names. Dynamic import per TDR-032.
- New chat tool `set_plugin_tool_approval({ pluginId, toolName, mode })`
- +14 capability-check tests, +5 tool-permissions tests; all green

#### T11 — Capability expiry (opt-in) (`7f1319a6`)
- Added optional `expiresAt: string` (ISO 8601) to `PluginsLockEntry` + Zod schema
- Extended `isCapabilityAccepted` with `reason: "expired"` branch; hash_drift takes precedence over expired
- `mcp-loader.ts` `scanPlugin` maps `expired` → `pending_capability_reaccept` + `disabledReason: "capability_accept_expired"`
- New chat tool `set_plugin_accept_expiry({ pluginId, days })` with Zod literal union `{30, 90, 180, 365}`
- Belt-and-suspenders guard: unparseable `expiresAt` (hand-edited lockfile) treated as "no expiry" rather than fail-closed
- +10 capability-check tests, +2 mcp-loader tests

#### T12 — Revocation flow (`0d907d5a`)
- New exported `revokePluginCapabilities(pluginId)` in `capability-check.ts` — removes lockfile entry, busts `require.cache` for in-process SDK plugins, emits Inbox `agent_message` notification, logs to `plugins.log`. Graceful double-revoke returns `{ revoked: false, reason: "no_entry" }`.
- New helper `listAcceptedInProcessEntriesForPlugin(pluginId)` in `mcp-loader.ts` returns entry paths for cache-bust
- **Scope clarification:** no stdio SIGTERM at loader level — Option A model per `transport-dispatch.ts:18-20` means loader never owns long-lived children; adapters spawn per-request
- New chat tool `revoke_plugin_capabilities({ pluginId })`
- +7 capability-check tests, +4 mcp-loader tests

#### T13 — `--safe-mode` CLI flag (`21aa830b`)
- `bin/cli.ts` parses `--safe-mode`, exports `AINATIVE_SAFE_MODE=true` into Next.js child process env
- `mcp-loader.ts` `buildSafeModeRegistrations` enumerates Kind-1 plugin dirs and emits `status: "disabled", disabledReason: "safe_mode"` per plugin — so `/api/plugins` surfaces WHAT is blocked. `loadPluginMcpServers()` still projects to accepted-only, returning `{}` to adapters.
- Kind-5 primitives-bundle plugins unaffected — they flow through `registry.ts`
- New test file `src/lib/__tests__/cli-safe-mode.test.ts` (4 drift heuristic tests against bin/cli.ts source); +3 mcp-loader tests

#### T14 — Confinement modes (`794109c7`) — **densest task in the plan**
- New `src/lib/plugins/confinement/wrap.ts` (~440 LOC): `wrapStdioSpawn(input, platform?)` helper returns platform-appropriate spawn args for `none` / `seatbelt` / `apparmor` / `docker` modes, plus `dockerBootSweep()` and `dryRunConfinement(pluginId)` for the CLI command
- 8 profile stubs under `src/lib/plugins/confinement/profiles/` — 4 seatbelt `.sb` + 4 apparmor `.profile` (one per capability). Stub-level baselines with `TODO(M3.5)` comments for real policy corpus.
- Docker wrap: `--rm -i --network <scope> --label ainative-plugin=<id> --label ainative-pid=<pid>`; network `none` default, `bridge` if `[net]`; `-v <pluginDir>/state:/state` mount if `[fs]`
- Boot sweep (`docker ps --filter label=ainative-plugin` → `docker kill`) — gated once per process + gated to only fire when at least one plugin declares `confinementMode: "docker"` (avoids probing on non-Docker hosts)
- **Security-positive choices:** `execFileSync` instead of `execSync` throughout (no shell injection); `docker ps` output filtered to hex-only IDs so a tampered format string can't inject arbitrary `docker kill` args
- **Inline seatbelt policy fallback** for `dist/` builds that may strip `.sb` assets — file-based canonical + string fallback, logs once per cap on fallback
- `bin/cli.ts` gained `plugin dry-run <id>` subcommand — pre-parses `process.argv[2]` before `program.parse()` + DB migration boilerplate so dry-run is invocable without DB setup
- Option B for mcp-loader integration: wrap decision computed in `scanPlugin` BEFORE `validateStdioMcp`. Unsupported platforms short-circuit to `disabled + confinement_unsupported_on_platform` with a new `disabledDetail` field.
- +25 wrap tests, +4 mcp-loader integration tests

### Phase D — Chat Tool Extensions (T15)

#### T15 — Chat tool extensions (`0a70efe6`)
- `list_plugins` extended to return `{ kind5: LoadedPlugin[], kind1: Kind1Entry[] }`. Each kind1 entry exposes `pluginId, transport, toolCount, capabilities, capabilityAcceptStatus, manifestHash, servers[]`.
- **Breaking change to return shape** — the chat tool's caller is the LLM; tool description updated to match. `/api/plugins` is a separate surface, untouched.
- `reload_plugin({ id })` now calls BOTH Kind-5 `reloadPlugin(id)` AND new Kind-1 `reloadPluginMcpRegistrations(id)`. Idempotent both directions — Kind-5 reload returns null for Kind-1-only plugins; Kind-1 reload returns empty registrations for Kind-5-only plugins.
- New `grantPluginCapabilities(pluginId, { expectedHash? })` in `capability-check.ts` with silent-swap guard: rejects with `{ granted: false, reason: "hash_drift", currentHash }` when `expectedHash` mismatches on-disk. Preserves existing `toolApprovals` + `expiresAt` on re-grant. Emits Inbox notification. Dynamic imports throughout.
- New chat tool `grant_plugin_capabilities({ pluginId, expectedHash? })` — finishes the grant ↔ revoke symmetry from T12.
- **Design improvement beyond spec:** `manifestHash` added to `list_plugins` kind1 entries — without it, the silent-swap guard couldn't be wired end-to-end (LLM had no way to capture "observed hash" at list time). Not in acceptance criteria; necessary for the guard to work.
- Leading comment block in `plugin-tools.ts` updated to document TDR-032 discipline for all 7 chat-tool handlers
- "revoked" state maps to "pending" in `capabilityAcceptStatus` — M3 v1 doesn't track a distinct revoked state (revoke removes the lockfile entry, indistinguishable from never-granted). Documented in code + tool description.
- +9 capability-check tests, +2 mcp-loader tests, +5 plugin-tools tests (including drift-heuristic grep against static imports)

### Phase E — Dogfood + Docs + Invariant Tests (T16–T18)

#### T16 — Echo-server dogfood plugin (`7b07c527`)
- New `src/lib/plugins/examples/echo-server/`:
  - `plugin.yaml` — `kind: chat-tools`, `capabilities: []` (zero — proves the grant flow without capability warnings)
  - `.mcp.json` — `command: "python3"`, `args: ["${PLUGIN_DIR}/server.py"]` (uses existing template resolver in mcp-loader)
  - `server.py` — stdlib-only Python MCP JSON-RPC 2.0 server: `initialize` + `tools/list` + `tools/call` for one `echo({ text }) → { echoed: text }` tool. Zero external deps. Python 3.9+.
  - `README.md` — user-facing install notes
- `seed.ts` unchanged — existing logic copies all subdirs of `examples/` when user's plugins dir is empty; echo-server rides along automatically
- Python sanity check verified: `initialize` / `tools/list` / `tools/call` all produce well-formed JSON-RPC responses
- +1 seed test; full plugin suite 163/163 green after this commit

#### T17 — `docs/plugin-security.md` (`f6623c48`)
- 248-line user-visible security model doc, 8 sections:
  1. The layered security model (walk through 10 layers from spec)
  2. Capability declarations (`fs` / `net` / `child_process` / `env` semantics)
  3. Click-accept and the lockfile (hash canonicalization, cosmetic-field exclusion, drift detection four-state machine)
  4. Per-tool approval (`never` / `prompt` / `approve` trust ramp pattern)
  5. Confinement modes (comparison table, platform-mismatch behavior, explicit "M3 ships stubs" callout, `plugin dry-run` usage)
  6. Revocation and safe mode (boot-time kill switch, no runtime toggle in v1)
  7. Trust model rationale (why capabilities without confinement are declarative; why Node `vm` is explicitly rejected)
  8. What we don't protect against (Docker kernel escape, SHA-256 break, plugin-author malice at install, PII sanitization, timing side-channels — all explicit non-goals)
- Internal-only references in footer (`features/chat-tools-plugin-kind-1.md`, TDR-032, TDR-035, file:line anchors). No external URLs fabricated.
- File+line anchors verified before citing — reader can navigate every claim back to source.

#### T18 — TDR-035 drift heuristic invariants (`7b1e78fc`)
- New `src/lib/plugins/__tests__/cross-runtime-contract.test.ts`, 426 lines, 10 tests tagged `drift-heuristic`:
  - **Heuristic 1** — five-source merge order: parses `withAinativeMcpServer`, `withAnthropicDirectMcpServers`, `withOpenAiDirectMcpServers` bodies with brace-balanced `extractFunctionBody()` helper (not regex — nested object literals + template literals would break naive regex). Asserts `ainative:` key assignment comes AFTER all `...*Servers` spreads in each of the three adapters.
  - **Heuristic 2** — loader authority: greps every `.ts` under `src/lib/agents/` for `plugin.yaml` and `plugins.lock` string literals. Must be zero matches. Only `src/lib/plugins/*` is allowed to read these.
  - **Heuristic 3** — stdio detachment: greps every `.ts` under `src/lib/plugins/` for `detached: true` / `detached:true` / `shell: true`. Additionally does a window-based check: for each `spawn(` call site, asserts `detached: false` appears within the next 400 characters. Skips `//` and ` *` comment lines so doc comments mentioning `spawn()` don't false-trigger.
- Each heuristic has a **meta-self-check**: an in-memory fake source string that SHOULD trigger the grep — asserts the grep actually works. Without this, a regex typo could leave a heuristic silently passing everything.
- Preconditions verified BEFORE T18 shipped: all three drift patterns are clean in the current codebase (claude-agent.ts:77, anthropic-direct.ts:63, openai-direct.ts:65 all follow canonical merge order; zero `plugin.yaml` references under `src/lib/agents/`; one `spawn(` site total, in transport-dispatch.ts, with `detached: false`).

---

## Uncommitted state at handoff

**Working tree is CLEAN.** Every task committed. Every Phase C + D + E commit pushed to `origin/main`. Nothing pending.

---

## What's next — Phase F

### Phase F tasks at a glance

| Task | What | Input requirements |
|---|---|---|
| **T19** | Smoke 1: Claude SDK + echo-server end-to-end across 4 runtimes + Ollama opt-out + Codex config.toml sync. 13 steps. | Live `npm run dev`; `ANTHROPIC_API_KEY` for Claude/anthropic-direct; `OPENAI_API_KEY` for openai-direct; Codex installed for config.toml verification; Ollama runtime switch for opt-out check. |
| **T20** | Smoke 2: Confinement + Docker off-ramp. 13 steps. Fixture: echo-server with `capabilities: [fs]`, `confinementMode: "seatbelt"` (macOS) or `"apparmor"` (Linux); later `confinementMode: "docker"` with a test Dockerfile. | macOS seatbelt installed (default) or Linux AppArmor loaded. Docker installed. ~30 min + `docker pull` time for image prep. |
| **T21** | Smoke 3: reload + revoke + per-tool approval + expiry + safe-mode cycles. 12 steps. | Same as T19 plus manual `.mcp.json` edit to trigger reload; manual `expiresAt` edit to force expiry. |

### Why smokes exist (CLAUDE.md rule)

Runtime-registry-adjacent code (anything transitively reachable from `src/lib/agents/runtime/catalog.ts`) can develop module-load cycles that surface as `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` at the FIRST Next.js request. Unit tests structurally cannot catch this — because `vi.mock("@/lib/chat/ainative-tools", ...)` replaces the real module entirely. The only defense is a live `npm run dev` that boots the plugin loader, seeds echo-server, and fires a real chat request through the adapter.

T19 is the highest-value smoke. If you're pressed for time, prioritize T19 > T21 > T20.

### T19 step sequence (abbreviated — full detail in plan lines 507–522)

1. `rm -rf ~/.ainative-smoke-m3 && mkdir ~/.ainative-smoke-m3`
2. `PORT=3010 AINATIVE_DATA_DIR=~/.ainative-smoke-m3 npm run dev > /tmp/m3-smoke-1.log 2>&1 &`
3. Wait for `[plugins] 1 loaded` in log (echo-server auto-seeded from `src/lib/plugins/examples/echo-server/`)
4. **Critical assertion:** grep `/tmp/m3-smoke-1.log` for `ReferenceError`, `Cannot access .* before initialization`, `claudeRuntimeAdapter` — expect ZERO matches
5. `curl -s :3010/api/plugins | jq '.plugins[]? | {id, kind, capabilityAcceptStatus, toolCount}'`
   - **Note:** the current `/api/plugins` response shape may not include `capabilityAcceptStatus` — this is T15's chat-tool shape, not necessarily the API route shape. Verify the API route returns Kind-1 info; extend if needed (scope creep — flag it, may need a T15-followup).
6. Invoke `grant_plugin_capabilities({ pluginId: "echo-server" })` via chat tool (or hand-write to `~/.ainative-smoke-m3/plugins.lock` if faster)
7. After grant, `reload_plugin` fires, stdio child spawns via `validateStdioMcp` (pre-flight), plugin becomes `accepted`
8. In chat: "Call the echo tool with text 'hello world'" — expect `mcp__echo-server__echo` invoked, `{ echoed: "hello world" }` returned
9. Repeat steps 7–8 with `AGENT_RUNTIME=anthropic-direct` and `AGENT_RUNTIME=openai-direct` (via env override or chat setting) — expect identical behavior across all three runtimes
10. Verify Codex path: `~/.ainative-smoke-m3/codex/config.toml` contains `[mcp_servers.echo-server-echo-server]` section after grant (T7 sync fires on `CodexAppServerClient.connect()` — may need to force a Codex runtime invocation to trigger it)
11. Switch runtime to Ollama, observe `"plugin echo-server skipped on ollama runtime"` in logs (once-per-session dedup), tool call degrades gracefully
12. `kill <pid>; pkill -f "echo_server" || true; pkill -f "server.py" || true`
13. Record in spec References: runtime versions, commit SHA (`7b1e78fc` now), observed behavior per step

### T20 step sequence (plan lines 537–550)

1. Fresh `~/.ainative-smoke-m3-confine`
2. Modify echo-server fixture: set `capabilities: [fs]` and `confinementMode: "seatbelt"` (macOS) or `"apparmor"` (Linux)
3. Start dev server; expect confinement applied
4. Verify `ps -p <pid> -o command` shows `sandbox-exec -p ...` wrap (macOS)
5. Trigger `echo` tool — should succeed (echo doesn't actually use `[fs]`)
6. Negative test: add a test tool that writes fs outside plugin state dir — expect profile denial in `plugins.log`
7. `ainative plugin dry-run echo-server` — expect policy summary, zero denials for baseline
8. Switch to `confinementMode: "docker"`, supply a test image
9. `docker ps --filter label=ainative-plugin=echo-server` shows running container
10. Trigger `echo` through Docker — response round-trips
11. Stop dev server; verify `docker kill` within 5s; no `ainative-plugin` labeled containers remain
12. Simulate leak: `docker run --label ainative-plugin=test-leak -d alpine sleep 60`, restart dev server, confirm boot sweep kills it
13. Record in spec References

### T21 step sequence (plan lines 566–578)

1. From T19 end state: edit `.mcp.json` (change `args` or `env`) to simulate config update
2. `reload_plugin({ id: "echo-server" })` — observe SIGTERM + respawn in logs
3. Per-tool approval: `set_plugin_tool_approval({ pluginId: "echo-server", toolName: "mcp__echo-server__echo", mode: "approve" })`
4. Trigger echo — expect blocking modal; approve; verify `mode: approve` honored
5. Set to `mode: never` — expect auto-allow next call without prompt
6. Expiry: `set_plugin_accept_expiry({ pluginId: "echo-server", days: 30 })`; verify lockfile `expiresAt` = now + 30 days
7. Hand-edit `expiresAt` to 5 min ago; reload plugins; verify plugin transitions to `pending_capability_reaccept` with `disabledReason: "capability_accept_expired"`
8. Revoke: `revoke_plugin_capabilities({ pluginId: "echo-server" })`; verify stdio child killed, lockfile entry gone, Inbox notification created (type: `agent_message`, title `Plugin capabilities revoked: echo-server`)
9. Safe-mode: stop dev; `npm run dev -- --safe-mode` (or `node dist/cli.js --safe-mode`); verify echo-server shows `disabled + safe_mode` in `/api/plugins`; verify `mcp__echo-server__*` unavailable in chat; Kind-5 plugins (finance-pack etc.) still load
10. Record + update spec frontmatter to `status: shipped` if all 3 smokes pass

### What to do after Phase F

When all three smokes pass:

1. `npm run test` — full suite; target ≥215 tests (we're currently at 218+122+10 = 350+ plugin-adjacent tests)
2. `npx tsc --noEmit` — clean
3. Record smoke SHAs in `features/chat-tools-plugin-kind-1.md` References section
4. Frontmatter: `status: planned` → `status: shipped`
5. `features/roadmap.md` — update Self-Extension Platform M3 row to `shipped`
6. `features/changelog.md` — add `## 2026-04-20` entry under `### Shipped — chat-tools-plugin-kind-1`
7. TDR-035 status: `proposed` → `accepted`
8. Write handoff `handoff/YYYY-MM-DD-m3-shipped-handoff.md` — what shipped, regression guards, M4 groom prep (`nl-to-composition-v1` is next per strategy §9)

---

## Regression guards — don't undo these

### From this session (Phase C + D + E)

**T10 — permission-gate layer insertion point.** `handleToolPermission` in `src/lib/agents/tool-permissions.ts` now has **Layer 1.8** between 1.75 (SDK filesystem + Skill auto-allow) and Layer 2 (saved user permissions). Only fires for `mcp__*`-prefixed tool names. A future contributor tempted to "consolidate" permission layers would regress the fast-path `never` auto-allow for plugin tools — keep this layer structure.

**T10 — `mcp__<server>__<tool>` parsing is load-bearing.** `resolvePluginToolApproval` splits on the FIRST `__` after the `mcp__` prefix, treating the rest as the tool-name. Changing this splits to "last occurrence" would mis-parse tools whose names contain `__`. Keep the first-occurrence semantics.

**T11 — hash_drift takes precedence over expired.** `isCapabilityAccepted` resolution order is: no entry → `not_accepted`; hash mismatch → `hash_drift` (even if also expired); expired → `expired`; otherwise → accepted. The precedence of `hash_drift` is intentional — a drifted manifest is the more actionable re-accept signal (manifest changed AND expired is strictly more suspicious than merely expired). Don't reorder.

**T11 — unparseable `expiresAt` treated as no-expiry.** Belt-and-suspenders for hand-edited lockfiles. Don't change to fail-closed.

**T12 — revoke is graceful no-op on missing entry.** `revokePluginCapabilities` returns `{ revoked: false, reason: "no_entry" }` rather than throwing when the plugin has no lockfile entry. Users may double-click revoke; don't break that UX.

**T12 — no stdio SIGTERM at loader level.** Revoke does NOT SIGTERM stdio children. Loader doesn't own them under Option A (`transport-dispatch.ts:18-20`). Future contributor wiring a `childRegistry` must revisit this, but DO NOT add a half-wired kill path that assumes child ownership when the loader doesn't have it.

**T13 — safe-mode shows disabled plugins in API, not just empty.** `listPluginMcpRegistrations()` under `AINATIVE_SAFE_MODE=true` returns one `disabled + safe_mode` registration per Kind-1 plugin. `loadPluginMcpServers()` continues to return `{}` via the accepted-only projection. The two-function split (from T3) supports this cleanly. Collapsing them would lose the "what's blocked" UX.

**T13 — safe-mode check PRECEDES runtime filter** in `listPluginMcpRegistrations`. Safe-mode is a boot-level kill switch; runtime filter is per-request. A user in safe-mode running Ollama should see disabled entries, not the Ollama-opt-out skip-log. Keep the order.

**T14 — `execFileSync` throughout confinement, not `execSync`.** Argv-based invocation eliminates shell-injection risk on the `docker ps` / `docker kill` boot-sweep path. A future contributor "simplifying" to `execSync` reintroduces shell parsing. Already flagged by a security hook during implementation; don't regress.

**T14 — `docker ps` output hex-filtered for container IDs.** Even if `docker ps --format '{{.ID}}'` returned injected content, the filter `/^[a-f0-9]+$/` rejects anything else before passing to `docker kill`. Defense-in-depth; keep it.

**T14 — `dockerBootSweep` gated both by module-level flag AND by "any plugin declares docker mode".** Prevents `docker ps` probe on non-Docker hosts on every `/api/plugins` request. Module-level flag means one probe per process; declaration-gate means no probe at all if no plugin uses docker confinement. Both gates are necessary.

**T14 — seatbelt inline-policy fallback preserves functionality in `dist/` builds.** File-based canonical source + string fallback. Logs once per cap on fallback. Don't remove the fallback — npx builds can legitimately strip `.sb` asset files.

**T14 — Option B mcp-loader integration: wrap BEFORE validateStdioMcp.** scanPlugin computes `wrapStdioSpawn` first; if unsupported, emit `disabled + confinement_unsupported_on_platform` and skip validation. Don't invert this — validating an unwrapped command and then trying to wrap at spawn time means the validation used different policy than the real run.

**T14 — `plugin dry-run` pre-parses `process.argv[2]` before `program.parse()`.** bin/cli.ts dispatches the subcommand BEFORE DB migration boilerplate so dry-run is invocable without DB setup. A future contributor restructuring bin/cli.ts should preserve this pre-parse.

**T15 — `list_plugins` return shape is `{ kind5, kind1 }`.** Breaking change from flat `LoadedPlugin[]` was deliberate — the LLM reads the tool description. `/api/plugins` is a separate surface. Don't fold them back together.

**T15 — `manifestHash` exposed in kind1 entries is load-bearing for silent-swap guard.** Without it, the LLM can't capture an observed hash at list time to pass as `expectedHash` to `grant_plugin_capabilities`. Not in the spec's acceptance criteria but necessary for the guard to work end-to-end.

**T15 — `reload_plugin` calls both Kind-5 and Kind-1 reload.** Kind-5 reload returns null for Kind-1-only plugins; Kind-1 reload returns empty registrations for Kind-5-only. Idempotent both directions. Don't add kind-detection logic to branch — the symmetric double-call IS the design.

**T15 — "revoked" state maps to "pending" in `capabilityAcceptStatus`.** M3 v1 doesn't track a distinct revoked state (revoke removes lockfile entry). A future task could add `plugins.lock` schema v2 with a `revoked` field if revocation history becomes a product requirement — but don't silently upgrade the current mapping.

**T16 — `.mcp.json` uses `${PLUGIN_DIR}` template for server.py path.** Leveraging the existing mcp-loader template resolver. Do NOT hardcode an absolute path — it breaks across install paths (npx vs git-clone, different folder rename domains).

**T16 — server.py is stdlib-only.** Zero external Python deps. Don't add `mcp` Python SDK or other dependencies; the dogfood's VALUE is that it proves the stdio surface works with nothing but Python 3.9+.

**T18 — drift-heuristic tests use `extractFunctionBody()` brace-balancer, not regex.** Nested object literals + template literals + comments break regex. The custom walker handles them. Don't "simplify" to regex.

**T18 — each heuristic has a meta-self-check.** An in-memory fake source that SHOULD trigger the grep, proving the grep works. A regex typo could leave a silent-pass heuristic; meta-self-checks are the defense.

**T18 — spawn-window check skips comment lines.** Lines starting with `//` or ` *` are filtered before applying the `detached: false within 400 chars` assertion. Doc comments mentioning `spawn()` would otherwise false-trigger.

### From prior sessions (still binding)

All Phase A + B guards remain authoritative. See `handoff/2026-04-19-m3-phase-b-complete-handoff.md` → "Don't undo these" (five-source merge order invariant across 4 adapters, dash-separator Codex namespace, T7 line-based strip idempotency, scope-caveat consistency for anthropic/openai direct, source-grep invariant tests at T6/T8/T9 etc.).

All Phase A guards remain authoritative. See `handoff/2026-04-19-m3-phase-a-complete-handoff.md` → TDR-032 dynamic-import discipline, `supportsPluginMcpServers` catalog column, `loadPluginMcpServers` as sole source of pluginServers, `detached: false` at every spawn, Option A validation model, canonical hash array-order preservation, cosmetic fields excluded from hash, `plugins.lock.bak` written BEFORE primary, `CAPABILITY_VALUES` single source of truth.

---

## Risks and watches for Phase F

### T19 is the highest-value smoke — prioritize it if time-constrained

The golden path. If T19 passes cleanly, TDR-032's module-load-cycle defense is proven. T20 + T21 exercise confinement + lifecycle cycles but don't add new cycle risk.

### Codex config.toml sync may require forcing a Codex runtime invocation

T7 (shipped Phase B) wires `syncPluginMcpToCodex()` into `CodexAppServerClient.connect()` — the sync fires when Codex runtime is actually used, not on every boot. For T19 step 10, you may need to manually switch runtime to Codex and invoke a chat to trigger the sync. If the config.toml section is missing after step 10, that's a real bug, not a smoke-test issue.

### `/api/plugins` shape may need verification

T15 extended the **chat-tool** shape (`list_plugins`). The **HTTP API route** at `/api/plugins` may not yet reflect the same `{ kind5, kind1 }` shape. Check the route at `src/app/api/plugins/route.ts` (or wherever it lives) during T19 step 5 — if it still returns flat `LoadedPlugin[]`, that's a Phase F scope-creep finding. Either extend the route (small T15-followup) or adjust the smoke step to use the chat tool directly.

### T20 fixture mutation is destructive

T20 step 2 edits the echo-server fixture to add `[fs]` capability + seatbelt mode. If you edit the committed repo fixture, you're committing test state. Better: copy echo-server to a new pluginId (`echo-server-confined`) inside the smoke data dir and edit THAT. Don't mutate `src/lib/plugins/examples/echo-server/`.

### T20 Docker test requires building a test image

Step 8 says "supply a test Dockerfile + image." The simplest test image is `python:3.12-slim` with echo-server copied in — a ~3 line Dockerfile. Document the Dockerfile inline in the smoke record.

### T21 safe-mode test depends on bin/cli.ts built

T21 step 9 runs `node dist/cli.js --safe-mode` (not `npm run dev -- --safe-mode` which doesn't parse the flag — it goes to Next.js). Build the CLI first: `npm run build:cli`.

### Phantom LSP warnings — still flaky

Recurring noise pattern: the inline diagnostics panel emits "Cannot find module `@/lib/db/schema`" / "`@/lib/plugins/mcp-loader`" / "`@/lib/agents/runtime/catalog`" warnings that are ALWAYS phantom. `npx tsc --noEmit` is the ground truth. Throughout this session the panel fired ~9 times across T10–T15; `tsc` was clean every time. Do not spend a subagent round-trip chasing phantom LSP errors.

### Subagent-driven-development efficiency — 9 tasks completed in one session

Per-task dispatch with fresh context per subagent (implementer + ambient spec-compliance check via clear acceptance criteria + controller-level code verification) proved fast enough to ship all of Phase C + D + E in one session. The phased serial order (T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T18) avoided file conflicts; T10/T11/T12 all extended `capability-check.ts` so serial was necessary there. T16/T17/T18 could have parallelized safely (disjoint files) but serial kept commit history clean.

### Two chat tools remain at design-time semantics gap

`set_plugin_tool_approval` modes `prompt` and `approve` both route through the same existing DB-notification + modal path in M3 v1. The **SEP-1036 elicitation forms** distinction (prompt = form mode, approve = blocking modal) is ready on the Claude SDK side but ainative's UI surfacing uses the same notification type for both. A follow-up task (M3.5 or M4) may add an elicitation-specific notification type. Not blocking M3 shipping — the resolver already returns distinct modes so the UI layer can differentiate later.

---

## Open decisions deferred

All Phase A + B + prior open decisions still apply.

- **T13 runtime safe-mode toggle** — strategy §13 flags CLI-flag-only as v1; runtime Settings toggle is future consideration. No action needed for M3.
- **T14 per-capability policy corpus** — profiles ship as stubs marked `TODO(M3.5)`. Real policy authoring + testing is M3.5 follow-up.
- **T14 `plugin dry-run` mock-tool-invocation** — v1 dry-run prints the computed wrap args; actual mock invocation is M3.5.
- **T14 AppArmor multi-capability composition** — v1 uses first declared capability's profile only when multiple are declared. Composition strategy (nested profile application) is M3.5.
- **T15 silent-swap guard API surface** — `expectedHash` is optional on `grant_plugin_capabilities`. UI sheet (when it exists) MUST pass the hash it displayed; programmatic callers may omit. No schema change needed if/when UI ships.
- **T12 revoke ↔ stdio child lifecycle** — if a future task introduces a long-lived `childRegistry` in the loader, revoke will need to be extended to SIGTERM the child. Documented in JSDoc at `revokePluginCapabilities`.
- **`list_plugins` kind1 `toolCount` semantic** — today it counts accepted MCP registrations (one per server), not the actual tools each server exposes (that would require an MCP handshake). Clarified in tool description. If a future task adds tool-manifest caching, the count can be refined.
- **Extract `logToFile` to `src/lib/plugins/plugin-logger.ts`** — now present in `registry.ts`, `capability-check.ts`, `mcp-loader.ts`, `transport-dispatch.ts`, `confinement/wrap.ts` (T14's logs). 5 copies. Threshold hit. Flagged in prior handoff — still open.
- **`/api/plugins` route shape alignment with `list_plugins` chat tool** — see Risks above. Verify during T19; follow-up if needed.

---

## Environment state at handoff time

- **Branch:** `main`, working tree clean. `origin/main` current (all 9 Phase C+D+E commits pushed).
- **HEAD:** `7b1e78fc` (T18 drift heuristics).
- **Tests (full plugin suite + chat tools + drift):** 350+ green across all plugin-adjacent files (plugins 218/218, chat/tools 122/122, drift heuristics 10/10). Pre-existing failures (settings validator + router DB setup) unchanged — same baseline as Phase B handoff.
- **`npx tsc --noEmit`:** clean.
- **`package.json` version:** still `0.13.3`. npm publish deferred until post-M5 per Amendment 2026-04-19.
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]`.
- **Smoke data dirs:** `~/.ainative-smoke-m3*` not yet created — will be created during T19/T20/T21.
- **Dev server:** not running.
- **Chat-tool count:** 91 (87 baseline + T10 `set_plugin_tool_approval` + T11 `set_plugin_accept_expiry` + T12 `revoke_plugin_capabilities` + T15 `grant_plugin_capabilities`). End-of-M3 target hit.
- **TDR count:** 35 with TDR-035 still `proposed`. Transitions to `accepted` at M3 shipped (post-Phase F).
- **New artifacts this session (all committed, all pushed):**
  - `src/lib/plugins/capability-check.ts` extended with T10 (tool approvals + resolver) + T11 (expiry) + T12 (revoke) + T15 (grant)
  - `src/lib/agents/tool-permissions.ts` extended with Layer 1.8
  - `src/lib/chat/tools/plugin-tools.ts` extended with 4 new chat tools (7 total)
  - `src/lib/plugins/mcp-loader.ts` extended with safe-mode enumeration, expiry reason, revoke helper, reload helper, confinement integration, disabledDetail field
  - `src/lib/plugins/confinement/wrap.ts` (new, ~440 LOC)
  - `src/lib/plugins/confinement/profiles/` (8 stub files)
  - `src/lib/plugins/confinement/__tests__/wrap.test.ts` (new, 25 tests)
  - `src/lib/plugins/examples/echo-server/` (new dogfood plugin: plugin.yaml + .mcp.json + server.py + README.md)
  - `src/lib/plugins/__tests__/cross-runtime-contract.test.ts` (new, 10 drift heuristic tests)
  - `src/lib/__tests__/cli-safe-mode.test.ts` (new, 4 tests)
  - `docs/plugin-security.md` (new, 248 lines, 8 sections)
  - `bin/cli.ts` extended with `--safe-mode` flag and `plugin dry-run <id>` subcommand
  - Test additions throughout: capability-check (35 → 61, +26), mcp-loader (22 → 37, +15), plugin-tools (4 → 9, +5), tool-permissions (6 → 11, +5), seed (3 → 4, +1)

---

## Session meta — what this handoff captures vs. what the committed artifacts already capture

This handoff focuses on the **Phase C+D+E → Phase F transition**, not on what's in the code. Canonical sources:

- **T10–T18 implementation details** → the code + tests themselves. Everything committed. No WIP.
- **Design decisions** → commit messages + JSDoc in modified files
- **Security rationale** → `docs/plugin-security.md` (T17)
- **Drift invariants** → `src/lib/plugins/__tests__/cross-runtime-contract.test.ts` (T18)
- **M3 plan** → `.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`
- **Feature spec** → `features/chat-tools-plugin-kind-1.md`
- **Strategy** → `ideas/self-extending-machine-strategy.md`
- **Prior state** → `handoff/2026-04-19-m3-phase-b-complete-handoff.md` and earlier handoffs in that dated chain

If in doubt, read the source. This handoff is the routing table, not the authority.

---

*End of handoff. M3 code-complete through T18 across 9 commits in one session. Phase F is 3 live-smoke verification tasks requiring `npm run dev` + real API keys + runtime switching. T19 is highest-value (module-load cycle defense per CLAUDE.md runtime-registry rule). When all three pass, spec + TDR-035 + changelog flip to `shipped` and M3 is done — next milestone is M4 `nl-to-composition-v1` per strategy §9.*
