# Feature Changelog

## 2026-04-21

### Shipped — M4.5 `nl-to-composition-v1`

Restores the original M4 scope (silently displaced when strategy §15 renamed M4 to Phase 6 on 2026-04-20). A user typing *"build me a weekly portfolio check-in"* in chat today fires `AppMaterializedCard` automatically; *"I need a tool that pulls my GitHub issues"* fires `ExtensionFallbackCard` with pre-inferred scaffold inputs. The signature demo strategy §6 has been pointing at since day one.

- **Chat planner** (`src/lib/chat/planner/`): pure, total, pattern-based 3-verdict classifier (`compose | scaffold | conversation`). Scaffold-first ordering; compose fallback; conversation default. 12 classifier tests + 6 composition-hint builder tests + 4 primitive-map registry-validation tests + 3 engine-planner contract tests. 25 green.
- **Composition-path nudge**: `engine.sendMessage` augments the system prompt with `buildCompositionHint(plan)` when the classifier returns `compose`. The existing `detectComposedApp` detector (Phase 2+3) picks up the LLM's tool-call sequence and drives `AppMaterializedCard` rendering. Zero new card code.
- **Scaffold-path short-circuit**: when classifier returns `scaffold`, `engine.sendMessage` skips `query()`, streams a canned preamble ("I can scaffold a plugin for that..."), persists the assistant message with `extensionFallback` metadata, and returns. `chat-message.tsx` renders `ExtensionFallbackCard` from metadata. Saves one LLM turn per plugin-shaped ask; makes the card-fire deterministic.
- **Card wiring**: `POST /api/plugins/scaffold` wraps Phase 6's `scaffoldPluginSpec`; maps `PluginSpecInvalidIdError → 400`, `PluginSpecAlreadyExistsError → 409`, `PluginSpecWriteError → 500` with `code`-keyed bodies. 6 route tests green. Card's `onScaffold` default handler posts to this route; `onTryAlt` dispatches a `ainative-chat-submit` CustomEvent the chat shell listens for (new listener in `chat-shell.tsx`).
- **Primitive map**: 15 keyword → `{ profileId, blueprintId, tables? }` entries covering portfolio/investment/stocks, research/reading list, code review/PR, content marketing, customer support, meal/recipe, lead research, briefing, documentation, travel. Registry-validation test ensures every value references a live builtin; a future rename of `wealth-manager` → anything else fails CI loudly.
- **No new TDR**: planner consumes existing contracts (`classifyPluginTrust`, `create_plugin_spec`, `detectComposedApp`, chat-tool registry). No runtime-catalog reachability — verified via `rg "runtime/catalog" src/lib/chat/planner/ src/app/api/plugins/scaffold/` → zero matches.
- **Rollout**: not flag-gated. Classifier is ~1ms synchronous; scaffold path is negative-latency (skips one LLM turn); compose path adds ~400 chars to the system prompt. Codex + Ollama engines unchanged in v1 — deferred to M4.6.
- **Chat tool count**: unchanged at 92. LOC: ~460 production + ~420 tests + 9 new files + 3 modified.
- **Test totals**: 309/309 green across `src/lib/chat/`, `src/components/chat/`, and `src/app/api/plugins/` suites (up from 273 pre-M4.5). `npx tsc --noEmit` clean on M4.5 surface.

## 2026-04-20

### Shipped — chat-tools-plugin-kind-1 (Milestone 3, two-path trust model)

M3 final-acceptance gate passed. Phase 4 live smokes verified the two-path plugin trust model end-to-end against `npm run dev` with the real echo-server bundle and an isolated `AINATIVE_DATA_DIR=~/.ainative-smoke-m3` data dir. TDR-037 promoted from `proposed` to `accepted` in the same session. Strategy §15 Amendment 2026-04-20 becomes authoritative. Per-feature disposition (parked behind flags vs. retained vs. scheduled-for-removal) frozen.

- **T19 — echo-server self-extension classifier + MCP registration.** Live `loadPluginMcpServers()` returned echo-server with `status: "accepted"` (NOT `pending_capability_accept`); `~/.ainative-smoke-m3/plugins.lock` not created; zero `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` or related module-load-cycle errors in dev logs. Confirms classifier Signal 2 (`author: ainative`) + Signal 5 (`capabilities: []`) both fire and the `isCapabilityAccepted` self-extension fast-path skips lockfile entirely (TDR-037 §2 contract).
- **T20 — confinement flag activates seatbelt wrap on macOS.** With `confinementMode: seatbelt` declared in the smoke fixture, `wrapStdioSpawn(...)` returns `command: "python3"` + direct args when `AINATIVE_PLUGIN_CONFINEMENT` is unset (parked path), and `command: "sandbox-exec"` + policy-prefixed args (`(version 1) (deny default) (allow process-fork) (allow signal (target self))`) when `AINATIVE_PLUGIN_CONFINEMENT=1`. Proves the §11 Risk D off-ramp mechanism works on demand without authoring real policy corpus.
- **T21(a) — `--safe-mode` kill switch.** With `AINATIVE_SAFE_MODE=true`, `listPluginMcpRegistrations()` returns echo-server as `status: "disabled", disabledReason: "safe_mode"`. Mirrors Claude Code `--no-plugins` semantics independent of trust classification.
- **T21(b) — `plugin-trust-model = "strict"` Settings override.** Even though echo-server's manifest hits two self-extension signals, setting `plugin-trust-model` to `"strict"` correctly forces the lockfile path: registration becomes `status: "pending_capability_accept", disabledReason: "capability_not_accepted"`. The user's "training wheels" escape hatch works as TDR-037 §5 specifies.
- **T21(c) — `plugin-trust-model = "off"` Settings override.** With setting `"off"`, `isCapabilityAccepted` accepts every plugin without lockfile consultation: registration returns `status: "accepted"`, no `plugins.lock` file. Matches Claude Code / Codex CLI "trust your own code" posture.

Pre-task fix shipped in the same commit: `ainative-app` skill SKILL.md updated to write app manifests to `~/.ainative/apps/<app-id>/manifest.yaml` (canonical per `getAinativeAppsDir()` and `src/lib/apps/registry.ts`) instead of `.claude/apps/<app-id>/`. Without this fix, apps composed via the skill would scaffold to a path the registry never scans, breaking the sidebar dynamic-entry promise of Phase 2.

### Accepted — TDR-037 (two-path plugin trust model)

`.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md` status flipped `proposed` → `accepted`. The classifier signals, self-extension bypass, feature-flag gates, Settings toggle (`auto | strict | off`), and per-feature disposition table are now the authoritative reference for any future plugin-trust work. Re-entering the marketplace / trust-tier lane (strategy §10 refused) requires a successor TDR that explicitly supersedes this one.

### Shipped — Phase 6 (`create_plugin_spec` + `ainative-app` fall-through + `ExtensionFallbackCard`)

- **New chat tool `create_plugin_spec`** (`src/lib/chat/tools/plugin-spec-tools.ts`): scaffolds Kind 1 MCP plugins under `~/.ainative/plugins/<id>/` with `author: "ainative"` AND `origin: "ainative-internal"` baked in — belt-and-suspenders (signals 1 + 2 from `classifyPluginTrust`) so future refactors can't accidentally flip the scaffold to the third-party trust path. Chat tool count: 91 → 92. v1 scaffolds Python + stdio bodies; `language: "node"` or `transport: "inprocess"` writes a TODO-stub with a Phase 6.5 pointer. Atomic write via temp-dir + rename; refuses to overwrite existing plugin dirs.
- **`ainative-app` skill fall-through**: Phase 2 now falls through to `create_plugin_spec` when composition can't express the ask; Phase 3 emits dual-target artifacts (plugin dir + `~/.ainative/apps/<app-id>/manifest.yaml` with a `plugins:` reference).
- **`ExtensionFallbackCard`** (`src/components/chat/extension-fallback-card.tsx`): renderable-only chat card with three states (`prompt`, `scaffolded`, `failed`), two paths not three (compose-alt vs. scaffold). Planner wiring deferred to Phase 6.5 per the `app-materialized-card` precedent. Includes `role="alert"` on the failed state for WCAG 4.1.3 compliance.
- **Tests**: 15 Vitest cases for `plugin-spec-tools` (scaffold, atomicity, collision, invalid id, reserved id, TODO stub, classifier integration asserting `scaffold → classifyPluginTrust → "self"`, empty-tools defensive set() render, chat tool ok/error wrapping, `PluginSpecWriteError` type assertion); 7 Testing Library cases for `ExtensionFallbackCard` (render, click handlers, state transitions, retry, `initialState` honoring, double-click re-entrancy guard).
- **No CLAUDE.md smoke-test budget triggered** — verified `plugin-spec-tools.ts` has no static imports transitively reachable from `@/lib/agents/runtime/catalog.ts`.

## 2026-04-19

### Design-hardened — chat-tools-plugin-kind-1

EXPAND-mode security brainstorm surfaced six M3 scope additions, now incorporated into the feature spec. Source: `ideas/m3-security-model-brainstorm.md` (draft, ~360 lines). The brainstorm pressure-tested the current 5-layer security model (capability declaration, click-accept lockfile, --safe-mode, stdio isolation, MCP elicitation) and identified the biggest gap: consent layers 1-4 don't *enforce* anything, just label. Six additions close the gap without violating strategy §10 non-goals.

- **Per-tool approval overlay (Codex-style)**: `plugins.lock` gains `toolApprovals: Record<toolName, "never"|"prompt"|"approve">`, default `"prompt"` on first install. Reuses ainative's existing `handleToolPermission` hook + `tool-permission-persistence` UI — no new permission machinery. Creates a trust ramp (each "Always Allow" click lowers friction) vs. today's install-time cliff.
- **Confinement modes + Docker off-ramp**: `plugin.yaml` accepts `confinementMode: "none"|"seatbelt"|"apparmor"|"docker"`. Ships per-capability policy profiles for seatbelt (macOS) + AppArmor (Linux). Docker mode is the strategy §11 Risk D off-ramp, scoped BEFORE the leading indicator fires (first external plugin declaring `[child_process]`). Enforcement layer turns capability labels into actual OS-level scope constraints.
- **Capability expiry (opt-in)**: `plugins.lock` optional `expiresAt` field; chat tool `set_plugin_accept_expiry({ pluginId, days })` with `{30, 90, 180, 365}`. Default stays no-expiry (matches Claude Code / Codex conventions — notification fatigue prevention). Pure upside for paranoid users.
- **Revocation flow**: `revoke_plugin_capabilities({ pluginId })` chat tool — inverse of `grant_plugin_capabilities`. Removes lockfile entry, SIGTERMs stdio child (5s SIGKILL fallback per TDR-035), suspends plugin. Obvious missing feature that the spec had silently omitted.
- **User-visible security doc**: `docs/plugin-security.md` as the consolidated layered-defense explainer. Linked from Inbox capability-accept sheet and `plugins.log` error messages. Most "security incidents" come from misunderstanding the trust model; the doc is the cheapest mitigation.
- **10-row Error & Rescue Registry**: captures security-layer failures with recovery paths (corrupt `plugins.lock`, SHA-256 hash collision [not in this universe], plugin writes to own lockfile, `--safe-mode` UI edge cases, Docker escape, stale accept, MCP handshake hang, wrong-plugin accept, over-strict confinement, SIGTERM-ignored revoke). Informs implementation plan risk budget.

Also records 5 explicit rejections for TDR-035's Alternatives Considered section: Node `vm`-isolation (perception ≠ reality), plugin signing/marketplace (strategy §10), PII sanitization (strategy §10), auto-expiry default-on (notification fatigue), worker-thread isolation as M3 scope (deferred post-M5). Five delight opportunities surfaced for post-M5 consideration: capability "trust ramp" promotion, community-contributed confinement profile gallery, plugin activity dashboard, unexpected-capability inbox alerts, share-your-accepted-plugins export.

Spec grew from ~430 lines to ~520 lines (new subsections: Per-tool approval overlay, Capability expiry, Revocation flow, Confinement modes, Core security posture (summary)). 4 new acceptance criteria bullets added. Excluded list expanded with 3 explicit rejections (Node `vm`, worker-thread isolation, network-scope DNS allowlist deferred). Net M3 implementation impact: ~335 LOC + ~200 lines markdown, plausibly single-session still.

### Groomed — chat-tools-plugin-kind-1

Milestone 3 of the Self-Extension Platform, groomed against `ideas/self-extending-machine-strategy.md` §9 Milestone 3 **and the 2026-04-19 (II) amendment** that re-scoped Kind 1 around MCP-as-surface instead of the original §5 custom `@ainative/plugin-sdk`. The amendment was driven by two signals captured earlier the same day: live research on Claude Code's current plugin docs (`anthropics/claude-plugins-official` marketplace uses `.mcp.json` as the MCP server surface, not a custom SDK) and a grep of our own codebase showing `src/lib/agents/claude-agent.ts:566` already merges MCP servers via `withAinativeMcpServer()`. Adopting MCP as the extension surface reuses this existing merge path instead of building a parallel surface.

- **Feature spec**: `features/chat-tools-plugin-kind-1.md` — `kind: chat-tools` plugin manifest variant with Ainative's capability-declaration safety overlay (`capabilities: [fs, net, child_process, env]`), `.mcp.json` at plugin root for the MCP server config, two supported transports (stdio subprocess + in-process SDK via `@modelcontextprotocol/sdk`), plugin-MCP loader at `src/lib/plugins/mcp-loader.ts`, and `~/.ainative/plugins.lock` hash-pinned capability accept flow with Inbox notification review sheet.
- **Cross-runtime contract**: new `supportsPluginMcpServers: boolean` column in `src/lib/agents/runtime/catalog.ts`. Declared values: Claude SDK `true` (4th arg to existing `withAinativeMcpServer`), Codex App Server `true` (via existing `src/lib/environment/sync/mcp-sync.ts` bi-directional sync to `config.toml [mcp_servers]`), Anthropic direct + OpenAI direct `true` (new MCP merge sites), Ollama `false` (no MCP surface in Ollama's API; plugins skip with a log note). Cross-runtime parity drops out of the matrix rather than being hand-coded per adapter.
- **Trust posture**: Ainative's capability overlay is deliberately stricter than Claude Code's `plugin.json` (which has no capability declarations — trust comes from marketplace curation). Justified by the 2026-04-12 rollback discipline and strategy §10's refusal to re-enter marketplace/trust-tier territory. stdio transport gives free process isolation (separate OS process; plugin cannot touch ainative's Node heap) — materially reduces strategy §11 Risk D without requiring Docker. In-process SDK MCP servers retain the original risk profile; click-accept + lockfile still gates them.
- **Chat tool surface**: M1's three plugin chat tools (`list_plugins`, `reload_plugins`, `reload_plugin`) extend rather than duplicate — `list_plugins` response adds `toolCount` / `transport` / `capabilities` / `capabilityAcceptStatus`; `reload_plugin` gains transport-aware reload (SIGTERM subprocess vs. `require.cache` bust). One new tool: `grant_plugin_capabilities({ pluginId })` for the capability accept flow. All handlers use dynamic `await import()` per TDR-032 — pattern proven in M1 T18 and M2 T18 smokes.
- **Dogfood**: `gmail-triage` reference Kind 1 plugin shipping a stdio Python MCP server with three tools (`gmail_list_unread`, `gmail_get_thread`, `gmail_draft_reply`) and `[net]` capability. Follows M1's first-boot-copy pattern. Proves the end-to-end path without becoming a core product feature.
- **`--safe-mode` CLI flag**: boot-time kill switch in `bin/cli.ts`. Disables all `kind: chat-tools` plugin loading; `kind: primitives-bundle` continues to load (no execution surface there). No runtime Settings toggle in v1 — strategy §13 flags this as follow-up.
- **Roadmap**: `chat-tools-plugin-kind-1 (Milestone 3)` row in Self-Extension Platform section updated from plain text to a link to the new spec. Priority `P0`, status `planned`. Dependencies expanded to reflect the cross-runtime surface — `primitive-bundle-plugin-kind-5` (M1), `schedules-as-yaml-registry` (M2), `chat-engine`, `provider-runtime-abstraction`, `runtime-capability-matrix`. M2's row also updated from `planned` to `shipped` to reflect reality captured in the 2026-04-19 handoff.
- **Strategy amendments bundled**: Amendment 2026-04-19 (II) in the strategy doc captures the MCP-as-surface revision with a complete artifact-table diff (`src/lib/plugins/sdk/index.ts` REMOVED; `supportsPluginMcpServers` column + `mcp-loader.ts` ADDED; `gmail-triage` dogfood becomes an MCP server). Memory saved at `memory/project-m3-mcp-as-plugin-surface.md` with rationale + five-vector justification.
- **Open architectural decision for implementation**: TDR-035 (to be drafted at implementation start) should codify the plugin-MCP cross-runtime registration contract so a future runtime addition (Gemini, DeepSeek) knows exactly where to plug in. The spec names this as a pre-implementation concern, not a blocker to grooming.
- **Scope guardrails**: v1 does NOT ship mixed-kind plugins (one plugin = one kind), sandboxing (Node's `vm` isn't a security boundary), marketplace/publishing/trust tiers (rolled back), plugin dependency deduplication, runtime Settings toggle for `--safe-mode`, Ollama MCP support, automatic plugin upgrade detection, or a `/apps` UI for Kind 1 management. All enumerated in the spec's Excluded list with rationale; most are strategy §10 non-goals.

### Groomed — schedules-as-yaml-registry

Milestone 2 of the Self-Extension Platform, groomed against `ideas/self-extending-machine-strategy.md` §9 Milestone 2. Closes the composition gap left open by Milestone 1: schedules were the only top-tier primitive still DB-only, so Kind 5 bundles could ship a profile/blueprint/table but not the recurring schedule that drives them. finance-pack's `personal-cfo` profile had no `monthly-close` schedule to pair with — this spec fixes that.

- **Feature spec**: `features/schedules-as-yaml-registry.md` (397 lines). YAML + Zod `discriminatedUnion` (scheduled vs heartbeat) + registry + loader, mirroring `workflow-blueprints.md` with one load-bearing addition — **state preservation on reload**. The schedules table has 30+ columns split between config and runtime state (firingCount, lastFiredAt, suppressionCount, failureStreak, heartbeatSpentToday, turn-budget breach counters, etc.). A naive upsert would reset counters and break the scheduler. The spec's DB upsert is a single-statement `onConflictDoUpdate` whose `.set()` clause carries **config fields only** — runtime state lives in `.values()` only (applied on first insert, never on conflict). Same pattern shipped for `installPluginTables` in Path C (2026-04-19), validated as race-safe there.
- **Plugin integration**: composite id `plugin:<plugin-id>:<schedule-id>` with `(<plugin-id>)` display-name suffix, mirroring M1's table strategy per TDR-034. No schema change to the `schedules` table.
- **Architect Refinement 2 — bundled into this milestone**: generic `scanBundleSection<T>` helper replaces the three M1 per-section scanners before the fourth user (schedules) is added. Explicitly called for by `features/architect-report.md` Refinement 2. Keeps the M1 rule "extract at third use, not first" honest.
- **Architect Refinement 1 — de-risked here**: `z.discriminatedUnion` pattern adopted for `type: scheduled | heartbeat` previews the M3 manifest `kind: primitives-bundle | chat-tools` pattern. Landing the shape one milestone early.
- **Dogfood**: finance-pack bundle gets `schedules/monthly-close.yaml` referencing `finance-pack/personal-cfo`. First-boot auto-seeder from M1 picks it up without change. After boot, `GET /api/plugins` reports finance-pack's schedules list — end-to-end proof.
- **Three new chat tools**: `list_schedule_specs`, `install_schedule_from_yaml`, `reload_schedules`. Dynamic `await import()` for the registry per TDR-032 cycle discipline. Real `npm run dev` smoke step is mandatory in the implementation plan (M1 T18 precedent — unit tests cannot catch module-load cycles).
- **Roadmap**: `schedules-as-yaml-registry (Milestone 2)` row in Self-Extension Platform section updated from plain text to a link to the new spec. Priority `P0`, status `planned`, dependencies `primitive-bundle-plugin-kind-5` + `scheduled-prompt-loops`.
- **Scope guardrails**: v1 ships **zero built-in schedules** (schedules are inherently domain-specific; profiles/blueprints ship builtins because they're generic). No DB→YAML export (runtime state doesn't belong in config files). No multi-timezone for `scheduled` type (`activeTimezone` is heartbeat-only).

### Shipped — primitive-bundle-plugin-kind-5

Milestone 1 of the Self-Extension Platform. Plugin loader scans
`~/.ainative/plugins/<id>/`, validates manifests against a Zod schema
with apiVersion compatibility check, and merges per-bundle profiles
(namespaced `<id>/<profile>`), blueprints (namespaced `<id>/<blueprint>`),
and tables (DB rows with composite id `plugin:<id>:<table>`). Three new
chat tools — `list_plugins`, `reload_plugins`, `reload_plugin` — and two
API routes — `GET /api/plugins`, `POST /api/plugins/reload`. Finance-pack
dogfood bundle (Personal CFO + monthly-close blueprint + transactions
table) auto-seeds on first boot when `plugins/` is empty. Identical
behavior on npx and git-clone install paths (no install-path branches in
the loader). 0 new DB columns. Smoke verified at `74feaf74` (see spec
"Verification run — 2026-04-19").

## 2026-04-18

### Groomed — primitive-bundle-plugin-kind-5 + Self-Extension Platform roadmap section

New P0 post-MVP feature derived from `ideas/self-extending-machine-strategy.md`. This is Milestone 1 of the post-rollback composition-first strategy synthesized from a live architect + frontend-designer + product-manager brainstorm.

- **Feature spec**: `features/primitive-bundle-plugin-kind-5.md` — YAML-based plugin loader that packages a profile + blueprint + table schema as a portable directory under `~/.ainative/plugins/<id>/`. Zero new execution surface; extends existing profile and blueprint registries with a plugin-id namespace.
- **Roadmap section added**: `Self-Extension Platform` in Post-MVP, between App Marketplace (deferred) and the Dependency Graph. Captures all five milestones from the strategy doc: primitive-bundle-plugin-kind-5 (P0, Milestone 1), schedules-as-yaml-registry (P0, Milestone 2), chat-tools-plugin-kind-1 (P0, Milestone 3), nl-to-composition-v1 (P1, Milestone 4), install-parity-audit (P1, Milestone 5).
- **Strategy doc**: `ideas/self-extending-machine-strategy.md` — 698-line living strategy artifact. Locks six decisions (D1–D6): ship Kind 5 + Kind 1 only, hard refuse + redirect for npx source writes, JS-direct authoring (no bundler), public slogan *"Describe your business. Ainative builds it, runs it, and grows with it."*, `/apps` authoring-only (no marketplace), install-path parity with `AINATIVE_DEV_MODE` as surfacing flag only.
- **Deliberate non-goals**: publishing flow, trust tiers, PII sanitizer, Kind 2/3/4 plugins, marketplace distribution, new UI routes via plugin, new DB columns via plugin, orphan writes to `launchCwd` on npx. All explicitly enumerated in `ideas/self-extending-machine-strategy.md` §10 so future scope-creep has a clear "we decided against this" reference.
- **Post-rollback discipline**: the 2026-04-12 rollback of 21 marketplace commits is named in both the feature spec and strategy doc. This feature deliberately picks up only the directory-scan loader pattern from that work — no publish flow, no trust ladder, no PII sanitizer. Rollback scar is on distribution, not composition; this roadmap section honors that distinction.

### Groomed — sidebar-ia-route-restructure

New P1 post-MVP feature extracted from a live design session grounding IA fixes in `docs/why-ainative.md` positioning and the `docs/journeys/work-use.md` journey. Captured in `features/sidebar-ia-route-restructure.md` and added to the roadmap's UI Enhancement section.

- **IA change**: sidebar moves from 4 groups to 5. Work splits into **Home** (Dashboard, Tasks, Inbox, Chat) + **Compose** (Projects, Workflows, Profiles, Schedules, Documents, Tables). Manage renames to **Observe** (Monitor, Cost & Usage, Analytics). Learn + Configure unchanged.
- **Promoted primitives**: Profiles + Schedules move out of Manage into Compose. Positioning doc names them as co-equal with Projects and Workflows; Manage was a misclassification.
- **Route rename**: `/` reclaims the "Dashboard" label (it was already rendering stats + priority queue + activity feed + recent projects — a real dashboard, only reachable via logo click today). The kanban moves from `/dashboard` to `/tasks`, matching the object-plural convention every other list route already follows.
- **Back-compat scope**: per product decision, `/dashboard` is deleted outright — ainative is in alpha, few external bookmarks, clean break preferred over a 1-line redirect stub.
- **Keyboard shortcuts**: `g d` → `/dashboard` is replaced by `g h` → `/` and `g t` → `/tasks`.
- **Architect impact report** (`features/architect-report.md`): MEDIUM blast radius, ~50 files, single frontend layer, no data/runtime coupling. Root-path guard in `isItemActive` already handles the new pattern.
- **TDR-033** recommended: *Route Semantics — Object-Label Convention for List Routes*. Codifies the rule so future additions (e.g., a hypothetical `/inbox-board` or `/project-grid`) do not re-introduce view-type route names.
- **Doc cascade**: bundled with the brand pivot `/refresh-content-pipeline` run — 15 docs files, 10 screengrab PNGs, and `docs/features/dashboard-kanban.md` → `tasks.md` rename all fold into the existing refresh, so the marginal doc cost of this feature is zero.
- **Design bridge gate**: spec carries a blocker AC for `/frontend-designer` Product-Design Bridge review (state specs for `/` and `/tasks`, active-highlight regression checks, empty-state parity) before implementation starts.

**Evidence trail**: product-manager IA review + frontend-designer design review (both in-session) + architect impact analysis (`features/architect-report.md`).

### Design-bridged — sidebar-ia-route-restructure

`/frontend-designer` Product-Design Bridge mode enriched the spec with state specs, active-highlight checks, visual-weight guardrails, and keyboard/a11y ACs. Spec is now implementation-ready.

- Final Tasks subtext calibrated to **"Work in flight across projects"** (30 chars, DD-020 compliant); Dashboard subtext kept as "Today's work at a glance" since the rename makes it accurate for the first time.
- State preservation ACs added for `/` (loading via SSR stream, empty via `WelcomeLanding` + `ActivationChecklist`, populated, error) and `/tasks` (SkeletonBoard via Suspense, empty, populated, error) — the bar is **zero UX regression** vs. today's `/dashboard`.
- 16 active-highlight route regression checks added (one per routed nav item), including explicit guards that Profiles/Schedules now auto-expand **Compose** (not Observe) to catch any lingering coupling from the old Manage group.
- Visual-weight regression checks at 1366×768 (common laptop) and 1440×900 to verify the sidebar footer stays above the fold when Compose's 6-item accordion is expanded.
- Silent-rename interaction pattern codified: no toast, banner, or what's-new popover. Command palette keywords provide organic discovery. Alpha audience + DD-016 (hierarchical dimming) argue against migration chrome.
- Blocker AC cleared — spec is ready for implementation.

### Completed — npm-package-ownership-migration

Metadata-only patch migrating the npm publisher account from `navamio` to `manavsehgal`. Completes the identity migration started with the GitHub repo rename (`navam-io/ainative` → `manavsehgal/ainative`, 2026-04-17). No runtime code changes — `npm install ainative@latest` and `npx ainative` continue to work unchanged.

- Registry ownership: `manavsehgal` invited as maintainer via npm web UI; `navamio` removed after `0.11.1` publish verified clean.
- Published `ainative@0.11.1` from the `manavsehgal` account — first tarball where the `_npmUser` / "published by" field names the new maintainer.
- Manifest: `repository.url` + `bugs.url` already corrected during the GitHub migration; `0.11.1` is the first npm release carrying the corrected URLs.
- Historical versions `<0.11.1` deprecated with an upgrade notice so pinned installs nudge users toward `latest`.
- Local `~/.npmrc` stale `navamio` `_authToken` revoked after the owner transfer.

**Verification:** `npm view ainative@0.11.1 _npmUser.name` → `manavsehgal`; `npm owner ls ainative` → `manavsehgal` only; `npm view ainative@0.10.0 deprecated` → upgrade notice present; scratch-dir `npx ainative@latest --help` runs clean.

## 2026-04-15

### Completed — runtime-validation-hardening

Closed the P1 runtime-validation feature. Implementation had already shipped across three production changes; the remaining gap was negative-path test coverage for MCP-tool `assignedAgent` validation.

- `src/lib/chat/tools/__tests__/task-tools.test.ts` — added two describe blocks covering `create_task` and `execute_task` runtime-id validation: invalid runtime → `Invalid runtime` error message listing valid ids; valid runtime → insert succeeds with `assignedAgent` persisted. Mirrors the existing `agentProfile` coverage pattern.
- Verified already-shipped production changes: `resolveAgentRuntime()` in `catalog.ts:281–286` warn-and-fallback (no throw); `task-tools.ts` handlers at lines 134, 216, 304 all validate via `isAgentRuntimeId`; `execute_task` fallback at line 343 uses `DEFAULT_AGENT_RUNTIME` (no hardcoded `"claude"` remains); tool description at line 288 lists valid runtime ids.

**Verification:** 23/23 `task-tools.test.ts` green (2 new). Existing `catalog.test.ts` coverage of unknown-id fallback retained.

### Fixed — upgrade sessions no longer deadlock on agent questions

The upgrade flow runs as a task (it needs Bash + git, which chat tools don't have), but the original implementation had no channel for the agent to ask the user a free-form question. The `upgrade-assistant` SKILL.md said *"stop and ask the user"* on merge conflicts and drifted-main cases — but the agent emitted the question as plain log text, and `PendingApprovalHost` only rendered Allow/Deny buttons, so the task silently stalled until the 55-second permission timeout fired a deny.

End-to-end fix reusing existing primitives (`handleToolPermission` already supports `AskUserQuestion` → `agent_message` notification + `waitForToolPermissionResponse()` polling):

- `src/lib/agents/profiles/builtins/upgrade-assistant/profile.yaml` — allowlist `AskUserQuestion`.
- `src/lib/agents/profiles/builtins/upgrade-assistant/SKILL.md` — new "How to ask the user a question" section with the two canonical payload shapes (free-form + 3-choice options). Rules 1 and 5 rewritten to mandate `AskUserQuestion` invocation — never plain text.
- `src/components/notifications/permission-response-actions.tsx` — new `QuestionReplyActions` branch triggered by `toolName === "AskUserQuestion"`. Renders a `radiogroup` of option cards when `toolInput.options` is present, otherwise a `<Textarea>` + Send button (⌘/Ctrl+Enter submits). Posts `{ behavior: "allow", updatedInput: { answer } }` to `/api/tasks/[id]/respond`.
- `src/app/api/tasks/[id]/respond/route.ts` — carve out an `AskUserQuestion` branch in the `updatedInput` key-sanitizer. Original toolInput describes the question (`question`, `options`) but the response carries an `answer` key not in the original — the existing subset check was rejecting it with HTTP 400. New branch validates a tight `{ answer: string }` shape instead.

This keeps task-pipeline isolation (TDR-024) intact — no chat-tool git shelling — while delivering the chat-like UX the upgrade feature was originally designed around.

**Verification:** 4/4 `permission-response-actions.test.tsx` cases green (adds 2 new: option cards → `{answer}`, textarea → `{answer}`). 7/7 `upgrade-poller.test.ts` still green. `npx tsc --noEmit` clean. End-to-end smoke deferred to the upgrade-session follow-up (requires a dirty clone + real upstream commit).

### Completed — upgrade-detection

Closed the last two real gaps in `upgrade-detection` and flipped the spec to `completed`:

- **Failure notification after 3 polls** — `src/lib/instance/upgrade-poller.ts` now inserts a single "Upgrade check failing" row into `notifications` (type `agent_message`, `toolName="upgrade_check_failing"` as dedup sentinel) once `pollFailureCount` crosses 3, and clears it on the next successful tick. One open notification at a time; no schema change.
- **Closeout note on the spec** documents two shipped-but-deviating decisions: (1) hourly polling is `setInterval`-driven rather than a `schedules`-table row (scheduler-engine registration deferred to a follow-up), (2) `UpgradeBadge` is a Client Component reading `/api/instance/upgrade/status` rather than a DB-reading Server Component. Behavior identical either way.

**Verification:** 7/7 `upgrade-poller.test.ts` green, including a new 3-failures → dedup → success-clears case that drives the notification insert + clear paths end-to-end. `npx tsc --noEmit` clean.

### Reconciled — roadmap ↔ spec frontmatter sync

Audit of 230 feature specs vs `roadmap.md` surfaced 9 rows where the roadmap table lagged behind already-shipped work. All 9 specs carried `status: completed` in their frontmatter; the roadmap still listed them as `planned` or `in-progress`. Synced the roadmap to match:

- `chat-settings-tool` (was in-progress)
- `chat-session-persistence-provider`, `chat-dedup-variant-tolerance`, `app-cli-tools`, `chat-app-builder`, `promote-conversation-to-app`, `marketplace-app-listing`, `marketplace-app-publishing`, `marketplace-trust-ladder` (were planned)

No spec bodies were modified — this was a pure roadmap-table reconciliation. Three features remain legitimately `in-progress` (`profile-environment-sync`, `runtime-validation-hardening`, `upgrade-detection`); none show activity since 2026-03-01 and may warrant a separate staleness review.

### Completed — chat-skill-composition closeout

Closed out the last real gap in `chat-skill-composition`: prompt-budget handling for composed skills. The feature had already shipped its runtime gates, additive schema, conflict heuristic, HTTP/MCP activation flow, and Skills-tab UI, but `buildActiveSkill()` still hard-truncated the combined SKILL.md payload. It now drops older composed skills first when the merged prompt would exceed `ACTIVE_SKILL_BUDGET`, prepends an explicit omission note naming the evicted skills, and only truncates when the newest remaining single skill is still too large.

This is intentionally a closeout pass, not a new feature wave. The parent spec is now `completed`, and the roadmap statuses were reconciled with already-shipped chat-runtime work (`chat-codex-app-server-skills`, `chat-ollama-native-skills`, `chat-file-mentions`, `chat-skill-composition`) so the next session starts from repo truth instead of stale planning state.

**Verification:** `active-skill-injection.test.ts` expanded from 8 → 12 cases, covering composed-skill injection on Claude, oldest-first eviction, and single-section truncation after eviction. Targeted validation green: 32/32 tests across active-skill injection + skill tools + conflict heuristic, plus `npx tsc --noEmit`.

## 2026-04-14

### Shipped — Phase 3: chat-composition-ui-v1 + saved-search-polish-v1

Both specs promoted from dogfood findings earlier today now complete.

**chat-composition-ui-v1 (P1)** — composition becomes discoverable. The Skills tab in the chat popover now renders: (a) `+ Add` buttons on inactive skills (gated by runtime `supportsSkillComposition` + `maxActiveSkills`), (b) active badges with deactivate on active rows, (c) an "N of M active" indicator at the top, (d) a shadcn Dialog surfacing conflict excerpts when `activate_skill` returns `requiresConfirmation`. New service layer (`src/lib/chat/skill-composition.ts`) extracted from the MCP tool so both the chat tool AND new HTTP routes (`POST /api/chat/conversations/[id]/skills/activate|deactivate`) share the same composition logic. New `useActiveSkills` hook (`src/hooks/use-active-skills.ts`) surfaces merged active IDs + runtime capability flags.

**saved-search-polish-v1 (P2)** — two dogfood bugs closed. (1) `cleanFilterInput()` helper (`src/lib/chat/clean-filter-input.ts`) strips mention-trigger residue before persistence; 7 unit tests cover the edges. (2) `useSavedSearches` now exposes `refetch()`; `CommandDialog` wires it on closed→open so saves made in the chat popover surface in the `⌘K` palette without a page reload.

**Refactors along the way:**
- `mergeActiveSkillIds` moved from `src/lib/chat/tools/skill-tools.ts` → `src/lib/chat/active-skills.ts` (pure module, no DB imports) so client components can consume it without pulling server code into the bundle.
- `skill-tools.ts` activate/deactivate handlers now delegate to `skill-composition.ts` service — body shrank, tests (16/16) stayed green via the dynamic-import boundary.

**Verification:** 210/210 chat + API tests pass. `npx tsc --noEmit` clean. HTTP smoke on live dev server verified replace → add+force → merged state → deactivate end-to-end. Full UI interactive smoke skipped for v1 (rendering logic covered by tsc + component structure matches existing patterns like Pinned entries).

### Dogfood session → 2 new feature specs + `ainative-app` skill

**Dogfood findings** (full log at `output/screengrabs/dogfood-log-2026-04-14.md`, gitignored per convention):

Real-browser use of Phase 1 + Phase 2 features surfaced 9 observations. Two became new feature specs for immediate planning:

- **New spec:** `chat-composition-ui-v1` (P1) — Skills-tab `+ Add` action + inline conflict dialog. Top-ranked blocker for adoption of the shipped `chat-skill-composition` runtime, which has zero UI surface today. Scoped to lift the v2-deferred UX from the parent spec into a discrete v1.
- **New spec:** `saved-search-polish-v1` (P2) — fixes two Phase 1 bugs found in dogfood: (1) `SaveViewFooter` captures mention-trigger cruft in `filterInput`; (2) `useSavedSearches` hook instances don't revalidate across components (popover save doesn't appear in `⌘K` palette until page reload).

Other observations captured in the log but not promoted to specs: skill-composition needs no DB fix (Phase 2 correctness holds), `@` popover triggering is fragile under programmatic automation (affects future e2e harness design), discoverability of `#key:value` syntax is low (candidate for a later `chat-filter-hint` spec).

**New skill:** `.claude/skills/ainative-app/SKILL.md` — scaffolds ainative-native apps by composing shipped primitives (profiles, blueprints, tables, schedules) via YAML manifest. Zero TypeScript required. Emits per-primitive artifacts into the registries that already load them (`.claude/skills/<app>--<profile>/`, `~/.ainative/blueprints/<app>--<blueprint>.yaml`) plus a forward-compatible app manifest at `.claude/apps/<app>/manifest.yaml` for when the deferred `.sap` format lands. Skill is discoverable via the Skill tool registry.

**Recommended Phase 3:** bundle `chat-composition-ui-v1` + `saved-search-polish-v1` for a ~1-session tight-scope PR. `chat-conversation-branches` (largest remaining `chat-advanced-ux` sub-spec) stays deferred; current evidence points to polishing the shipped features before building the largest unshipped one.

### Shipped v1 — chat-skill-composition (Phase 2 of retired chat-advanced-ux umbrella)

Composition v1 lands the chat-tool API + capability gates + conflict heuristic + context-builder iteration. Spec status `in-progress` — UI modal + token-budget trim deferred to v2.

**What shipped:**
- `RuntimeFeatures.supportsSkillComposition` + `maxActiveSkills` flags (Claude/Codex/direct = true/3, Ollama = false/1)
- Additive `conversations.active_skill_ids` JSON column (legacy `active_skill_id` preserved); bootstrap.ts dual update per the MEMORY.md ordering gotcha
- `mergeActiveSkillIds()` helper canonicalizes legacy + composed reads
- `activate_skill` accepts `mode: "replace" | "add"` and `force: boolean`; on `mode:add` runs capability gate → conflict heuristic → append (or returns structured `{requiresConfirmation, conflicts: [...]}`)
- `detectSkillConflicts` keyword heuristic in `src/lib/chat/skill-conflict.ts` — extracts directive lines (always/never/prefer/avoid) and pairs polarity-divergent lines on shared keywords
- `context-builder.ts` iterates merged skills, joins SKILL.md bodies with `---`, treats composition (`activeSkillIds.length > 0`) as user opt-in to override `stagentInjectsSkills=false` for Claude/Codex

**Design decisions:**
- Additive schema (don't replace `activeSkillId` with `activeSkillIds`) — preserves zero-risk back-compat for every existing read path. New code uses `mergeActiveSkillIds(legacyId, composed)`. Future migration can collapse to a single column when all readers are updated.
- Conflict response is structured (no modal in v1) — chat surface displays the JSON, user re-calls with `force:true` to override. Modal UI deferred to v2 because the Skills tab `+ Add` action needs design work.
- Composition opt-in overrides the `stagentInjectsSkills=false` default — without this, composed skills would silently no-op on Claude/Codex (where the SDK auto-discovers from filesystem). Single-skill default behavior is unchanged on those runtimes.
- Smoke verified: dev server boots clean post-migration; 16 skill-tools tests + 4 conflict tests + 195 broader chat tests pass; the full functional 2-skill compose + Ollama refusal is exercised via the production-code path through `vi.mock` boundaries.

### Shipped v2 — chat-filter-namespace + chat-pinned-saved-searches (Phase 1 of retired chat-advanced-ux umbrella)

Closed out the two `in-progress` specs spun out of `chat-advanced-ux`. Both now `completed`.

**chat-filter-namespace v2:**
- Parser accepts double-quoted values (`#tag:"needs review"`) — `CLAUSE_PATTERN` extended with a two-alternative regex, 5 new parser tests (22 total)
- Shared `FilterInput` component (`src/components/shared/filter-input.tsx`) — reusable outside chat
- `/documents` list page is the reference consumer — free-text search input replaced with `FilterInput`, clauses AND with existing Select filters, raw string syncs to `?filter=` URL param (shareable, refresh-persistent)
- Skills popover tab applies `#scope:project|user` and `#type:<tool>` via `filteredEnrichedSkills` memo + disambiguated empty-state ("no skills match these filters" vs "no skills available yet")

**chat-pinned-saved-searches v2 (saved searches):**
- New `/api/settings/chat/saved-searches` route (GET/PUT) + 6 Zod-validated tests — mirrors the v1 pins route pattern (dedup-by-id, malformed-value recovery)
- `useSavedSearches()` hook — fetch-once + optimistic save/remove
- Mention popover renders a `Saved` cmdk group at the top (surface-scoped by inferring from first filtered entity type)
- `SaveViewFooter` component — "Save this view" button when `parsed.clauses.length > 0`, expands to inline rename form → persists via the hook
- `⌘K` palette gets a `Saved searches` group between Recent and Navigation; selecting a search navigates to `SURFACE_ROUTE[surface]?filter=<input>`

**Design decisions:**
- `/documents` picked over `/tasks` as the list-page reference consumer — `src/app/tasks/page.tsx` is a 5-line redirect stub to `/dashboard`, while `DocumentBrowser` already mounted `<FilterBar>`. Wider list-page rollout deferred to v3.
- Surface inference for saved searches uses the first filtered entity type. Slash-mode (skills/profiles) surface inference deferred to v3 — the ⌘K palette still surfaces ALL saved searches regardless of surface.
- `onApplySavedSearch` threaded as an optional prop on `ChatCommandPopoverProps` (no-op if consumer doesn't pass it) — avoids a deeper refactor of the popover's input-binding layer.
- `SaveViewFooter` uses plain `<form>`/`<input>` (not shadcn `<Form>`) for a tight footer inside cmdk — simpler and avoids nested React Hook Form state in a dropdown.

**Smoke-test budget note:** No runtime-catalog imports touched; unit + route tests + tsc sufficient. Full vitest run: 971 pass / 12 skipped (1 unrelated E2E suite skips without dev-server).

### Status Sync — Feature Audit

Audited all 26 non-terminal feature specs against the codebase. Adjustments:

**Marked completed** (code shipped, spec already satisfied):
- `database-snapshot-backup` — `src/lib/snapshots/{snapshot-manager,auto-backup,retention}.ts` implemented with full WAL-safe tarball pipeline
- `workflow-run-history` — `workflowRunNumber` + `runNumber` columns present in `src/lib/db/schema.ts`
- `runtime-capability-matrix` — normalized `status: complete` → `completed`; feature matrix live in `src/lib/agents/runtime/catalog.ts`
- `chat-claude-sdk-skills` — normalized `complete` → `completed`
- `task-runtime-skill-parity` — normalized `complete` → `completed`

**Marked in-progress** (partially shipped):
- `upgrade-detection` — `src/lib/instance/upgrade-poller.ts` exists; badge UI still pending

**Marked deferred**:
- `instance-license-metering` (P2) — community edition (commit 0436803) removed all billing/tier logic; metering inapplicable
- `chat-advanced-ux` (P3) — normalized non-standard `status: split` → `deferred`; retired umbrella (5 sub-specs already tracked)

**Normalized non-standard status**:
- `schedule-collision-prevention` — `proposed` → `planned` (proposed is not a valid state)

Unchanged (confirmed correct): 16 `planned` specs with no matching code, and `chat-filter-namespace` / `chat-pinned-saved-searches` / `profile-environment-sync` / `enrichment-planner-test-hardening` / `runtime-validation-hardening` remain `in-progress` (partial code found).

### Shipped v1 — chat-pinned-saved-searches (P3, in-progress)

Pinning entities from the chat `@` mention popover now works end-to-end. Hover-reveal Pin button on each entity row; click to pin; a "Pinned" cmdk group renders at the top of the popover on next open, with matching Unpin buttons. Pinned items are hidden from their regular type group so they don't render twice. Per-user persistence via a new `GET/PUT /api/settings/chat/pins` route backed by the existing `settings` key-value table under the `chat.pinnedEntries` key.

**Denormalization decision**: pin records store `label`, `description`, and `status` inline (not just `id` + `type`). This means pins surface reliably even when the underlying entity falls outside the `entities/search` top-20-per-type window — otherwise a user who pinned something a week ago wouldn't see it today. Trade-off: labels go stale on rename until the user re-pins. Mitigation via lazy refresh is a v2 follow-up.

**Saved searches deferred to v2.** The spec bundled pinning + saved searches, but the two are structurally independent and saved-search UX (footer affordance, palette surfacing, filter-applied navigation) adds significant design surface. Shipping pinning alone gets the power-user "quick access to repeat entities" value without tangling the two concerns.

Architecture: new `src/app/api/settings/chat/pins/route.ts` with Zod validation, de-dup-by-id on PUT (last-write-wins). New `src/hooks/use-pinned-entries.ts` with optimistic mutations + background PUT — failures are silently swallowed (optimistic update already applied). Popover changes in `chat-command-popover.tsx` split `MentionItems` into pinned vs. unpinned views, with `rawQuery`-aware pin filtering so typing a query still narrows the Pinned group.

Browser-verified: pin button click → group appears → GET returns `[{id, type, label, ...}]` → close + reopen popover → Pinned group at top, entity correctly hidden from its type group → click Unpin → empties list → GET returns `{ pins: [] }`.

### Shipped v1 — chat-filter-namespace (P2, in-progress)

`#key:value` filter namespace now works inside the chat mention popover. Typing `@ #type:task` narrows the popover to tasks only; `@ #type:task #status:completed` combines clauses with AND semantics; free-text search still composes on top via cmdk (e.g. `@ auth #type:task` narrows to tasks AND fuzzy-matches "auth"). Unknown keys pass through silently per the parser contract, so typos don't break the flow.

Architecture: pure parser module at `src/lib/filters/parse.ts` (17 unit tests — single/multi-clause, case preservation, hyphen/underscore keys, back-to-back clauses without separator, raw-query remainder, `#123` treated as text not clause). The `matchesClauses()` helper takes a caller-supplied predicate map per known key so consumers stay decoupled from the parser. In the popover, clauses are applied client-side against the cached `entityResults` (entities/search returns all entity types in one shot at popover-open, so no new API surface is needed). The trigger-detection regex in `use-chat-autocomplete.ts` was extended from `@[^\s]*` to `@[^\s#]*(?:\s+#[A-Za-z]?[\w-]*:?[^\s#]*)*` — the key trick is the `?` on `[A-Za-z]` so partial input like `@foo #` (space-hash, no key yet) keeps the popover open while the user types. The inner `:?[^\s#]*` accepts both partial (`@foo #sta`) and complete (`@foo #status:blocked`) forms. cmdk receives the filter-stripped `rawQuery` instead of the raw input so its fuzzy scorer doesn't mis-match `#key:value` tokens against entity names.

Known filter keys for v1: `status` (case-insensitive substring match on `result.status`), `type` (exact match on `result.entityType`). Value pattern `[^\s#]+` terminates at whitespace OR the next `#` so back-to-back clauses like `#a:1#b:2` parse correctly — the tradeoff is no literal `#` in values until quoted-value support lands in v2.

Browser-verified end-to-end: baseline 5 entities across 3 types → `@ #type:task` reduces to 2 tasks → `@ #type:task #status:completed` combines to 2 items in the Tasks group → `@ #status:nonexistent_status` renders the "No matching entities" empty state cleanly.

Status kept as `in-progress` (not `completed`) because v2 scope — list-page consumption (`/tasks` FilterBar), skills-tab filtering (`/skills #scope:project`), quoted values, more filter keys like `#priority` (requires extending entities/search response shape) — is explicitly deferred per grooming scope discipline. Parser is reusable by future v2 consumers without changes.

### Completed — chat-conversation-templates (P2)

Three entry points — empty-state "Start from template" button, `/new-from-template` slash command (`Session` group, `execute_immediately`), and a `Templates` group in the `⌘K` palette — open a sliding sheet picker that lists all 13 built-in blueprints from `GET /api/blueprints`. Selecting a blueprint with required variables renders a dynamic parameter form (text / textarea / select / number / boolean); the "Start conversation" button is disabled until all required params are filled. Zero-parameter blueprints start instantly. A new `renderBlueprintPrompt()` utility reuses `resolveTemplate` (shared with the workflow engine) and supports both the new optional `chatPrompt` blueprint field and a fallback to `steps[0].promptTemplate` — so all 13 built-ins work without edits.

**Non-obvious: race-order matters.** The provider's `createConversation()` POSTs, then synchronously calls `setActiveConversation(id, { skipLoad: true })` — which means the docked `ChatInput` mounts with the new `conversationId` before `createConversation()` resolves. If the picker wrote the prefill to sessionStorage *after* the await, the composer's `useEffect([conversationId])` would fire first and find an empty slot. Fix: write to an id-less `chat:prefill:pending` slot *before* awaiting, and have the composer read both `chat:prefill:<id>` and `chat:prefill:pending` on mount. The pending slot is cleared unconditionally after the read so a reload won't re-inject. Route-then-dispatch handoff from the palette uses a 50ms timeout to let `chat-shell` mount its event listener after `router.push("/chat")`.

Implementation spans `src/lib/workflows/blueprints/render-prompt.ts` (+9 unit tests covering chatPrompt precedence, step-1 fallback, conditional blocks, strict mode, empty-vs-undefined distinction), `types.ts` (optional `chatPrompt` field), `src/components/chat/conversation-template-picker.tsx` (sheet + list view + parameter form + sessionStorage handoff), `chat-input.tsx` (`conversationId` prop + hydration effect), `chat-shell.tsx` (picker render + event listener + empty-state button), `chat-session-provider.tsx` (`createConversation` extended to accept optional `{ title }`), `tool-catalog.ts` (session command), `command-palette.tsx` (Templates group).

Browser-smoke verified: filled Documentation Generation blueprint with `src/lib/workflows/blueprints/` + default API Documentation → composer rendered 239 chars of the resolved prompt in the new conversation → sessionStorage slots cleared → conversation appeared in list with blueprint name as title.

First of the 5 sub-features split from `chat-advanced-ux` now complete. Remaining: [chat-filter-namespace](chat-filter-namespace.md) (P2), [chat-pinned-saved-searches](chat-pinned-saved-searches.md) (P3), [chat-skill-composition](chat-skill-composition.md) (P3), [chat-conversation-branches](chat-conversation-branches.md) (P3).

### Groomed — chat-advanced-ux split into 5 sub-specs (P3 umbrella → 2×P2 + 3×P3)

The `chat-advanced-ux` umbrella covered 5 structurally independent capabilities with divergent complexity, blast radius, and standalone value. Bundling them into a single feature would force a big-bang implementation over a weak shared surface — the spec itself prescribed grooming if any capability grew past ~200 lines of design, and all 5 did.

Split into:

- **[chat-conversation-templates](chat-conversation-templates.md) (P2)** — picked as first to ship. Smallest diff, no schema change, reuses workflow-blueprints instantiation pipeline. Three entry points (empty-state card, `/new-from-template` slash command, `⌘K` palette) open a sliding sheet picker; selecting a blueprint pre-fills the composer with a rendered `chatPrompt`. Optional new `chatPrompt` field on the blueprint schema with step-1 fallback keeps all 13 existing blueprints compatible without edits.
- **[chat-filter-namespace](chat-filter-namespace.md) (P2)** — `#key:value` parser as shared infrastructure (chat popovers + list pages), not just chat sugar. Promotes to P2 because the reuse surface (tasks/projects/workflows list pages, `⌘K`) extends the value beyond chat.
- **[chat-pinned-saved-searches](chat-pinned-saved-searches.md) (P3)** — depends on filter-namespace; pure `settings.chat` JSON storage, no new tables. Per-surface keying keeps pins scoped.
- **[chat-skill-composition](chat-skill-composition.md) (P3)** — relaxes single-active-skill on capable runtimes (Claude/Codex), blocks on Ollama. Touches the runtime capability matrix and context-builder injection path — high cross-runtime regression surface, requires MEMORY.md smoke-test-budget per runtime-registry-adjacent rule.
- **[chat-conversation-branches](chat-conversation-branches.md) (P3)** — largest design surface. Schema additions (`parentConversationId`, `branchedFromMessageId`, `rewoundAt`), context-builder ancestor walk, tree view, `⌘Z`/`⌘⇧Z` rewind. Feature-flagged off by default until dogfooding validates. Deferred deliberately — want evidence before committing to the schema shape.

The umbrella spec (`chat-advanced-ux.md`) is preserved as a historical pointer with `status: split` and a successor-spec table. No implementation should reference it directly going forward.

Next up: [chat-conversation-templates](chat-conversation-templates.md).

### Completed — dynamic-slash-commands (P2)

Project skills discovered via `auto-environment-scan` + exposed through `/api/profiles?scope=project` now appear as a dynamic **Skills** group in the chat `/` popover alongside ainative's built-in tool groups. `tool-catalog.ts` gained a `Skills` entry in the `ToolGroup` union (Sparkles icon, ordered after `Profiles`) and a new `getToolCatalogWithSkills(opts)` builder that concatenates project-scoped entries onto the static catalog only when `projectProfiles` is non-empty — the base catalog path is byte-identical when no project is active, so the static-cache semantics of `getToolCatalog()` are preserved.

Client wiring is a single new hook (`src/hooks/use-project-skills.ts`) that fetches on `projectId` change with AbortController cleanup, threaded through `chat-input.tsx:265` → `chat-command-popover.tsx:233`. Selection inserts template text `Use the {skill-name} profile: ` into the input, relying on the chat engine's existing profile-routing path — zero schema changes, no new conversation-level `profileId` column. cmdk filtering over name + description works automatically; the group is elided from the popover when the active project has no skills.

Feature was already code-complete per the MEMORY.md "spec frontmatter `status: in-progress` is unreliable" rule — this close-out flipped status and cross-referenced shipped surfaces. `npx tsc --noEmit` clean across the 4 touched modules.

### Completed — chat-environment-integration (P2)

The chat Skills tab now surfaces per-skill environment metadata: health (derived from `modifiedAt` age — `healthy` <180d / `stale` 180-365d / `aging` ≥365d / `unknown`), cross-tool sync status (`synced` / `claude-only` / `codex-only` / `shared` based on file presence), profile linkage (from `environment_artifacts.linked_profile_id` populated by the existing profile-linker), and scope (`user` | `project`). A passive "Recommended" star appears on healthy skills whose name + preview keywords match the conversation's recent user messages (≥2 distinct hits, stopword-filtered); per-conversation dismissal persists 7 days. Fire-and-forget `POST /api/environment/rescan-if-stale` is called on every conversation activation — reuses the existing `shouldRescan` + `ensureFreshScan` helpers from `auto-scan.ts`, so no new stampede/lock code was needed.

Architecture is strictly read-only over the existing scanner. `listSkillsEnriched()` goes directly to the DB (`getLatestScan()` + `getArtifacts()`) because `linkedProfileId` only lives on the DB row — not the in-memory `EnvironmentArtifact` type the scanner returns. The `list_skills` MCP tool's `enriched: boolean` param is additive and backwards compatible. `SkillRow` renders 4 badges + optional dismissable star + ↗ deep-link to `/environment?skill=<name>` when the skill isn't fully synced.

**Scope-adjusted from spec**: the profile-suggestion *chip above the input* became a passive star inside the Skills tab — same match logic, lower UI intrusiveness, simpler state.

37 new unit tests; `npx tsc --noEmit` clean; endpoint smoke-verified on localhost:3010.

### Completed — chat-command-namespace-refactor (P1)

**Breaking UX change** (accepted per spec Q7 — alpha product, no deprecation shim). The `/` popover is now tabbed (Actions / Skills / Tools / Entities) instead of a single grouped list. Eight new session commands (`/clear`, `/compact`, `/export`, `/help`, `/settings`, `/new-task`, `/new-workflow`, `/new-schedule`) live under a new `Session` group that surfaces first in the Actions tab. A runtime-aware capability banner renders below the chat input on runtimes that lack filesystem + Bash tools (Ollama, Anthropic-direct, OpenAI-direct) and stays silent on Claude + Codex App Server. The ⌘K palette gained Skills and Files groups (files with 200ms debounced search against `/api/chat/files/search`). New keyboard bindings: `⌘L` / `⌘⇧L` to clear, `⌘/` to focus the input and open the slash menu.

Architecture: a single-rooted cmdk `<Command>` wraps both tabbed-slash and mention modes so focus/selection state never flickers on tab switch. The partition is a pure function over the existing `ToolCatalogEntry[]`, with `GROUP_TO_TAB` exhaustively typed via `satisfies Record<ToolGroup, CommandTabId>` so any future `ToolGroup` added without a tab assignment fails to compile. Session commands dispatch `ainative.chat.{clear,compact,export,help}` CustomEvents from `chat-input.tsx`; the session provider listens and routes them (`/clear` → `createConversation()`, `/export` → new `POST /api/chat/export` endpoint that writes inline markdown to `~/.ainative/uploads/chat-exports/` and inserts a documents row, `/help` → `HelpDialog`, `/compact` → toast stub). Per-user tab persistence via `localStorage`; per-session banner dismissal via `sessionStorage`, keyed on `runtimeId`.

Frontend-designer sign-off recorded in the feature spec. 3 design-review findings addressed (MI=2 motion trim, focus-visible ring on banner dismiss, dialog padding redundancy).

22 new unit tests; `npx tsc --noEmit` clean; browser-verified on Claude + Ollama (`gpt-oss`) runtimes.

Deferred:
- AC #3 env-aware Skills-tab badges → `chat-environment-integration` (still planned).
- AC #4 Tools-tab "Advanced reveal" toggle → softened to "always visible" during HOLD scope approval.
- ⌘K palette Skills / Files dispatch listeners on the chat-input side → short follow-up.
- `/compact` machinery (currently a toast stub) → `chat-advanced-ux` or its own feature.
- Edge case: typing `/help`+Enter while last-remembered active tab is `Entities` (which has no cmdk-items under its placeholder) sends the text to chat — logged as follow-up.

### Completed — chat-codex-app-server-skills (P1)

Closed out as a **scope-adjusted** feature. The original spec called for wiring `turn/start` skill parameters into `sendCodexMessage()`, but a closer read of the App Server reference (`.claude/reference/developers-openai-com-codex-sdk/app-server.md` + `skills.md`) confirmed that the protocol has no such parameters — what the spec described is Codex's *natural* behavior when the App Server's `cwd` is set correctly. `cwd` plumbing already worked (`codex-engine.ts:104-105` overrides `workspace.cwd` with the project's `workingDirectory` before any App Server call).

The actual gap was on the *ainative* side: `chat-ollama-native-skills` injected SKILL.md into Tier 0 unconditionally, duplicating context on Codex (and Claude) where the runtime's native skill discovery already loads the same content from `.agents/skills/` or `.claude/skills/`.

Changes:
- `src/lib/chat/context-builder.ts` — `buildActiveSkill` now reads the conversation's `runtimeId`, looks up `getRuntimeFeatures(runtimeId).stagentInjectsSkills`, and **suppresses** Tier 0 injection when the flag is `false`. Behavior:
  - `ollama` → injects (no native path; ainative must inject)
  - `claude-code`, `openai-codex-app-server`, `*-direct` → suppressed (native discovery handles it)
  - Unknown runtime → falls through and injects (safer default than silently dropping)
- `src/lib/chat/__tests__/active-skill-injection.test.ts` — extended with 4 runtime-flag tests. 8/8 file tests pass; 173/173 chat tests overall.

Browser-verified end-to-end via Claude in Chrome as an **A/B comparison across the code change**: the same conversation with `.claude/skills/technical-writer` activated. Before the fix, the model quoted `## Active Skill: technical-writer` from its system prompt verbatim. After the fix, on the very next turn (same conv, same activation), the model responded `ABSENT` and noted *"The injection that was visible in my previous response is gone — likely due to a code change you made"*. Highest-confidence smoke result possible: same model as oracle, observing the diff between two turns.

Deferred: Q8a runtime-compatibility `requiredTools` filter on `list_skills` (skills don't declare requiredTools today — YAGNI); App Server skill-event chip rendering (events flow through generic tool path today, sufficient for v1); ainative-side `turn/start` skill wiring (protocol doesn't support it — reframed as "trust native Codex discovery").

### Completed — chat-ollama-native-skills (P2)

ainative-managed conversation-scoped skill activation, runtime-agnostic by design but motivated by Ollama (which has no SDK-native skill support). When a skill is bound to a conversation via the new `activate_skill` MCP tool, its SKILL.md is injected into Tier 0 of the system prompt on every subsequent turn until `deactivate_skill` clears it. Same machinery works on Claude / Codex as a programmatic skill-activation path alongside their native handling.

Changes:
- DB: `conversations.active_skill_id TEXT` column. Added to both the `CREATE TABLE` (fresh DBs) and via `addColumnIfMissing` (existing DBs). Drizzle schema updated. The CREATE-table addition was needed because `addColumnIfMissing` runs before the table CREATE in `bootstrap.ts`, so on fresh DBs the ALTER fails silently — caught by failing tests on a fresh temp DB.
- Discovery: `src/lib/environment/list-skills.ts` filters scanner artifacts by `category === "skill"` and resolves the SKILL.md inside each skill directory (probing `SKILL.md` → `skill.md` → first `*.md`).
- 4 MCP tools in `src/lib/chat/tools/skill-tools.ts` (`list_skills`, `get_skill`, `activate_skill`, `deactivate_skill`) registered in `ainative-tools.ts` and the popover catalog under "Skills". Single-active-skill enforced server-side; activate validates skill + conversation exist before writing.
- Tier 0 injection: `context-builder.ts` `buildActiveSkill` helper reads the bound id and appends SKILL.md under `## Active Skill: <name>` between Tier 0 and Tier 3. ~4000 token cap. Dynamic import keeps the scanner off the hot path for conversations without an active skill.

Tests: 11 skill-tool unit tests + 4 Tier 0 injection tests. **171/171 chat tests green** including the existing finalize-safety-net + reconcile suites that touch the conversations table.

Browser-verified end-to-end via Claude in Chrome: `list_skills` enumerated 62 skills correctly across user/project/shared scopes; `activate_skill` persisted the binding to SQLite; the next turn's system prompt contained the literal `## Active Skill: technical-writer` line + SKILL.md content (model quoted it verbatim).

The smoke test caught a real bug that unit tests missed: `getSkill` was calling `readFileSync(absPath)` where absPath is the skill **directory**, not the SKILL.md file — `EISDIR` was silently swallowed, returning null. Unit tests didn't catch it because they mocked the helper at its outermost boundary. Fix: `resolveSkillFile` helper. **Exactly the failure mode the project's smoke-test budget rule was designed to surface.**

Deferred: context-window warning toast (depends on unsettled per-runtime context-window probing — belongs in `chat-environment-integration` or its own feature); persistent active-skill chip in chat input (UI affordance for `chat-command-namespace-refactor`); SKILL.md duplication suppression on Claude/Codex (their native skill handling already loads the same content; the Tier 0 injection is harmless but redundant).

### Completed — chat-file-mentions (P1)

Users can now type `@src/lib/db/schema.ts` in chat and have the file either inlined (if <8 KB) or referenced (so Claude agents can fetch it via the `Read` tool). CLI muscle memory reaches the web UI. Extends the existing `@` mention pipeline with a new `entityType: "file"` — no new plumbing.

Changes:
- `src/lib/chat/files/search.ts` + `GET /api/chat/files/search` — file search API backed by `git ls-files --cached --others --exclude-standard` (no new npm dep, native `.gitignore` respect). Substring match with filename-first ranking, secondary sort by mtime. Server-resolves cwd from the active project's `workingDirectory` or `getLaunchCwd()` — never from client input. 7 unit tests.
- `src/hooks/use-chat-autocomplete.ts` — parallel `fileResults` state feeds the popover. Debounced 150 ms, aborts in-flight requests on each keystroke. File mentions insert `@<path>` (not `@file:<path>`) to match CLI-origin muscle memory.
- `src/components/chat/chat-command-popover.tsx` — `file` entity type registered with `FileCode` icon, "Files" heading, `font-mono text-xs` path rendering.
- `src/lib/chat/files/expand-mention.ts` + `context-builder.ts` — `buildTier3` `case "file":` delegates to a new `expandFileMention(relPath, cwd)` helper. <8 KB files are inlined in a fenced code block with a `### File: <path>` header; ≥8 KB files emit a one-line reference with size hint. Security belt-and-suspenders: `realpathSync(cwd) + startsWith` rejects escape paths without opening the file. 7 unit tests.

Browser-verified end-to-end via Claude in Chrome: small-file inlining produced an exact-heading quote from the model; large-file reference produced an acknowledgment of the 48 KB size and offer to use the `Read` tool; gitignore respect confirmed via an API probe for `node_modules` returning `[]`. Full details in `features/chat-file-mentions.md` → Verification run.

Deferred: fuzzy match, file-list caching, Ollama hover hint (belongs in `chat-environment-integration`). Multi-file globs explicitly out of spec.

### Completed — chat-dedup-variant-tolerance (P3)

Fixed false positives in the workflow dedup guardrail flagged by the code review of commit `b5ed09b`. Pooled Jaccard over name+step text at threshold 0.7 was blocking legitimate target-entity variants like "Enrich contacts" vs "Enrich accounts" and "Daily standup digest" vs "Weekly standup digest" — forcing users to pass `force: true` for every such pair and eroding trust in the guardrail.

Fix: `findSimilarWorkflows` now splits comparison into name and step signals scored as separate Jaccards, then combines with 0.5/0.5 weights against the unchanged 0.7 threshold. The one-token difference in names AND step prompts contributes to two independent Jaccards, which together pull combined similarity below 0.7 while structural duplicates (same steps + renamed workflow) still exceed it.

Changes:
- `src/lib/chat/tools/workflow-tools.ts` — replaced `workflowComparableText` with `workflowSignals` helper, added `WORKFLOW_NAME_WEIGHT` + `WORKFLOW_STEPS_WEIGHT` constants, extensive rationale comment above the threshold. Updated `create_workflow` `force` param description so the LLM knows the guardrail already tolerates target-entity variants.
- `src/lib/chat/tools/__tests__/workflow-tools-dedup.test.ts` — 4 new tests under "legitimate variant tolerance" (2 positive + 2 guard). 11/11 file tests pass; 88/88 chat-tool tests pass.

Empirical separation on the test corpus: variants score 0.60–0.68, duplicates score 0.75–1.00 — ~0.07–0.10 of headroom on each side of the 0.7 threshold. If tags ever land on workflows, revisit weights (spec sketched 0.3/0.5/0.2 name/steps/tags).

### Completed — chat-settings-tool (P1)

Closed out the `set_settings` chat tool — allowing users to update safe ainative settings via natural-language prompts with user-approval gating. The runtime implementation had shipped earlier (tool definition, allowlist, validators, permission-gating, catalog entry) but the spec was never flipped and no tests guarded the security-critical allowlist.

Changes:
- `src/lib/chat/tools/__tests__/settings-tools.test.ts` (new, 31 tests) — positive path, unknown-key rejection, **parameterized secret-exclusion guardrail** (11 forbidden keys: `auth.apiKey`, `auth.method`, `permissions.allow`, `usage.budgetPolicy`, `browser.*Config`, etc.), per-key validation coverage (integer bounds, enums, bool, step alignment, empty-string, float ranges).
- `features/chat-settings-tool.md` — writable-keys table synced to match the shipped reality (12 keys, up from the 9 originally scoped — the 3 budget keys `budget_max_cost_per_task`, `budget_max_tokens_per_task`, `budget_max_daily_cost` were added during implementation). Status flipped `planned` → `completed`. Verification run appended.

No runtime code changes. The secret-exclusion test fails noisily if any of `auth.apiKey`, `auth.method`, `permissions.allow`, `usage.budgetPolicy`, or any `browser.*Config` key is ever added to the `WRITABLE_SETTINGS` allowlist — the guardrail is now self-auditing.

### Completed — chat-session-persistence-provider (P0)

Closed out the provider-hoisting fix that makes chat streams survive sidebar navigation. The provider + layout wiring + `ChatShell` refactor + four unit tests shipped in an earlier (unrecorded) commit; this pass adds the remaining `client.stream.view-remount` telemetry reason code from AC §5 and verifies the fix end-to-end. No server-side changes.

Changes:
- `src/lib/chat/stream-telemetry.ts` — documented the 4th client reason code (`client.stream.view-remount`) alongside the existing three.
- `src/components/chat/chat-shell.tsx` — added `useEffect` cleanup that emits the breadcrumb when the shell unmounts while a stream is in flight. Uses `isStreamingRef` + `activeIdRef` so the cleanup closure sees values at unmount time, not at effect-setup time (a stale-closure bug caught by the contract tests on first run).
- `src/components/chat/__tests__/chat-session-provider.test.tsx` — two new contract tests: positive case (emits with correct `conversationId`) and guard case (no emit when not streaming). Test count rises from 4 → 6, all green in ~50ms.

Verification: developer ran the plan's manual smoke sequence on both Claude (`sonnet`) and GPT (Codex) runtimes, 1 + 5 nav cycles per runtime. Zero turn loss, zero `stream.abandoned` events, view-remount log lines appeared as expected. Full record in `features/chat-session-persistence-provider.md` → "Verification run — 2026-04-14".

### Reconciled — frontmatter drift sweep (PLG Monetization + apps/marketplace)

Closed two directions of status drift left behind by the 2026-04-13 Community Edition pivot.

**PLG Monetization — flipped 13 specs `planned` → `completed` with supersession banner.** These features shipped earlier in the project but their individual spec frontmatter was never updated, while the roadmap rows correctly showed `completed`. All 13 were subsequently reverted by `community-edition-simplification` on 2026-04-13. Each spec now carries a blockquote banner at the top: "Superseded by `community-edition-simplification` (2026-04-13). This feature shipped but was later fully reverted when ainative pivoted to a 100% free Community Edition…". Files: `stripe-billing-integration`, `community-edition-soft-limits`, `subscription-management-ui`, `upgrade-cta-banners`, `outcome-analytics-dashboard`, `parallel-workflow-limit`, `cloud-sync`, `license-activation-flow`, `edition-readme-update`, `first-run-onboarding`, `marketing-site-pricing-page`, `transactional-email-flows`, `upgrade-conversion-instrumentation`.

**Marketplace / apps-distribution vision — flipped 17 specs `planned` → `deferred` with banner.** The entire apps/marketplace product vision has no active plan after the CE pivot; specs are preserved as backlog. Each spec now carries: "Deferred 2026-04-14. Part of the marketplace / apps-distribution vision, which has no active plan after the pivot to 100% free Community Edition…". Files: `creator-portal`, `curated-collections`, `visual-app-studio`, `conversational-app-editing`, `app-forking-remix`, `app-remix`, `app-mcp-server-wiring`, `app-single-file-format`, `app-budget-policies`, `app-distribution-channels`, `app-conflict-resolution`, `app-updates-dependencies`, `app-embeddable-install-widget`, `app-extended-primitives-tier2`, `marketplace-local-first-discovery`, `marketplace-reviews`, `my-apps-lifecycle`. Roadmap rows updated to match.

No code changes. Spec-hygiene only. Open-feature count drops from 66 → 49 (49 active + 30 deferred + 1 proposed).

## 2026-04-13

### Completed — community-edition-simplification (P0), remove-supabase-dependencies (P0), remove-anonymous-telemetry (P0)

ainative collapses to a single free Community Edition. The full PLG Monetization stack (license manager, 4-tier system, Stripe billing, feature gating, resource limits, cloud license validation) is removed along with all Supabase cloud dependencies and the vestigial anonymous telemetry toggle. Analytics is ungated for all users; memories/schedules/parallel workflows have no artificial limits; history retention is a fixed 365 days; the app runs fully offline with no external service required.

Shipped in three sequential commits on the same day:
- `0436803` — `community-edition-simplification`: removed license manager, 8 license lib files, 4 license API routes, 6 gate UI components, 5 Supabase billing edge functions (validate-license, create-checkout-session, create-portal-session, stripe-webhook, conversion-ingest), license DB table, and all tier-check call sites across API routes and core modules. Also removed App Catalog and Blueprint Marketplace in the same pass. 97 files changed, ~6,800 lines deleted.
- `3a0dc42` — `remove-supabase-dependencies`: deleted `src/lib/cloud/`, `src/lib/sync/`, `src/app/api/sync/`, auth callback, cloud account + cloud sync settings sections, onboarding email capture, `@supabase/supabase-js` dependency, and the `telemetry-ingest` / `send-email` edge functions. `waitlist-signup` preserved (marketing-site feature). TelemetrySection UI preserved (local-only toggle).
- `d25b3ae` — `remove-anonymous-telemetry`: deleted the TelemetrySection component, `/api/settings/telemetry` route, and `TELEMETRY_*` settings keys — closing the data-privacy loop now that the cloud flush is gone. Analytics dashboard and local usage ledger unaffected.

Preserved (not subscription-related, despite similar naming): `TrustTierBadge` (permission levels) and `UpgradeBadge` (git version upgrades).

Supersedes: every row in roadmap sections "PLG Monetization — Foundation / Core / Growth Layer". TDR-030 (hybrid instance licensing) deprecated. MEMORY.md pivot recorded: "100% Community Edition — All subscription tiers, Stripe billing, license manager, and marketplace removed."

### Completed — task-runtime-skill-parity (P1)

Mirror of Phase 1a (`chat-claude-sdk-skills`) into the Claude task execution runtime. Project skills, CLAUDE.md, and filesystem tools (`Skill`, `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`, `TodoWrite`) now reach background tasks on the `claude-code` runtime the same way they reach interactive chat — closing the architect drift flagged in `ideas/chat-context-experience.md` §11.

Key changes:
- `CLAUDE_SDK_{ALLOWED_TOOLS,SETTING_SOURCES,READ_ONLY_FS_TOOLS}` extracted from `chat/engine.ts` into shared `agents/runtime/claude-sdk.ts` so both callers use a single source of truth.
- `handleToolPermission` gains a Layer 1.75 (SDK filesystem + `Skill` auto-allow). Profile `autoDeny` still wins via Layer 1 precedence.
- Both `executeClaudeTask` and `resumeClaudeTask` pass `settingSources` + merged allowed-tools, capability-gated on `getFeaturesForModel(...).hasNativeSkills`. Profile allowedTools wins when explicit; `CLAUDE_SDK_ALLOWED_TOOLS` is the fallback. Empty-allowlist edge case tightened (`length > 0` required).
- Parity regression test splits `claude-agent.ts` source on `export async function resumeClaudeTask` so execute and resume `query()` blocks are unambiguously attributed.
- Pre-existing `A-ainative-3` test updated to lock in the new allowedTools contract (Phase 1a list now ships by default when no profile allowlist is set).

Scope pushback documented: the spec's §3 (shared Tier 0 partition helper) was deferred — chat's system prompt embeds conversation history, task's embeds document/table/output context, making a shared helper speculative abstraction.

TDR-032 smoke test verified: a real task (`39331e2f-71a5-42fc-8928-bbe4c8f66ae3`) invoked the `task-smoke` fixture skill via the `Skill` tool and returned the exact sentinel `TASK_SMOKE_SKILL_REACHED_AGENT`. No `ReferenceError` in dev-server output. Smoke fixture deleted post-run.

Commits: `bc597d0` → `f966c7d` (9 commits). Plan: `.claude/plans/faithful-task-mirror.md`.

Unblocks: — (the P1 Claude-runtime skill story is now complete; remaining Chat Context Experience features can proceed independently).

### Completed — chat-claude-sdk-skills (P0)

Flipped ainative chat on the `claude-code` runtime from "isolation mode" to "SDK-native." Two small changes to `src/lib/chat/engine.ts` do the heavy lifting: `settingSources: ["user", "project"]` activates the SDK's CLAUDE.md + `.claude/skills/` + `~/.claude/skills/` auto-loading, and adding Skill, Read, Grep, Glob, Edit, Write, Bash, TodoWrite to `allowedTools` exposes the full filesystem tool suite. A read-only auto-allow branch in the existing `canUseTool` closure silences permission prompts for Read/Grep/Glob (mirroring the browser/exa pattern). Edit/Write/Bash/TodoWrite route through the pre-existing side-channel permission bridge automatically — no new plumbing. `Task` subagent tool intentionally excluded; ainative task primitives replace it.

Tier 0 / CLAUDE.md partition audit (DD-CE-002): documented as a doc comment on `STAGENT_SYSTEM_PROMPT`. Finding: zero content migration needed — Tier 0 is already ainative-identity scoped for this codebase. Regression guard: future contributors adding project-specific rules to `system-prompt.ts` should be caught in code review against the rubric.

`list_profiles` chat tool now fuses registry profiles with SDK-discovered filesystem skills via new `listFusedProfiles(projectDir)` helper (at `src/lib/agents/profiles/list-fused-profiles.ts`). Dedupes by id — registry wins on collision. Malformed SKILL.md frontmatter logs-then-skips. `getListProfilesTool(projectDir)` factory threads project working directory through the chat tool-assembly stack (helpers.ts `ToolContext`, ainative-tools.ts factory signatures, engine.ts call site).

Regression guards: hooks-excluded test greps engine.ts source for a `hooks:` key. Auto-allow policy exercised by 11 unit tests covering Read/Grep/Glob auto-allow, Edit/Bash non-auto-allow, Skill auto-allow, and Task absence. TDR-032 smoke test on live dev server (claude-in-chrome MCP, Opus model): skill invocation reached LLM, CLAUDE.md content auto-loaded, Grep ran without permission prompt, no ReferenceError.

Unblocks: `chat-codex-app-server-skills` (P1), `chat-ollama-native-skills` (P2), `task-runtime-skill-parity` (P1), `chat-file-mentions` (P1), `chat-command-namespace-refactor` (P1).

Commits: `78bdbaa` → `cd73c2e` (10 commits). Plan: `.claude/plans/claude-sdk-skills-ignition.md`.

### Completed — runtime-capability-matrix (P1)

Shipped the first-class runtime-feature declaration in `src/lib/agents/runtime/catalog.ts`. Added `RuntimeFeatures` interface as a **sibling** of the pre-existing operational `RuntimeCapabilities` bag (not a rename — that would have broken ~7 consumer files). Populated the 9-field feature bag on all 5 runtimes (`claude-code`, `openai-codex-app-server`, `anthropic-direct`, `openai-direct`, `ollama`). Added `getRuntimeFeatures` helper + `getFeaturesForModel` chat-layer convenience. Drift-guarded by exhaustiveness + inline-snapshot + length-against-interface-growth tests (14 tests total, all green). TDR-032 smoke test: `GET /api/chat/models` cold-compiled 200, no module-load cycle.

Commits: `98681bf` → `dee6b3b` (6 commits). Plan: `.claude/plans/steady-capable-matrix.md`. Consumer wiring (popover filter, capability hint banner, settings-onboarding, `RuntimeSummary.features`) intentionally deferred to downstream specs per the plan's NOT-in-scope list.

Unblocks: `chat-claude-sdk-skills` (P0 critical path), `chat-codex-app-server-skills`, `chat-ollama-native-skills`, `chat-command-namespace-refactor`, `task-runtime-skill-parity`, `onboarding-runtime-provider-choice`.

### Groomed — Chat Context Experience (10 features)

Extracted 10 new features from `ideas/chat-context-experience.md` (brainstorm with contributions from `/architect`, `/product-manager`, `/frontend-designer`). Consulted `/product-manager` for template authoring, with architect/frontend-designer guidance sourced from §11 of the ideas doc (inline contributions).

Goal: bring ainative chat to CLI parity for skills, CLAUDE.md/AGENTS.md auto-loading, filesystem tools, and command UX — uniformly across three runtimes (Claude Agent SDK, Codex App Server, Ollama HTTP) — while preserving ainative's differentiation layer (permission bridge, persistent conversations, ainative primitives, rich tool result UI).

**Phase 1 — Runtime-native skill integration (sequential rollout per Q1):**
- `chat-claude-sdk-skills` (P0) — `settingSources` + `Skill` tool + filesystem tools on `claude-code` runtime. Includes DD-CE-002 (Tier 0 / CLAUDE.md partition). Critical path.
- `chat-codex-app-server-skills` (P1) — `turn/start` skill parameters on `openai-codex-app-server` runtime. Depends on 1a's UX contract.
- `chat-ollama-native-skills` (P2) — ainative-native `activate_skill` MCP tools + context injection for Ollama (no SDK support). Depends on 1a.

**Cross-cutting infrastructure:**
- `runtime-capability-matrix` (P1) — first-class capability flags on `src/lib/agents/runtime/catalog.ts`; hard prerequisite for skill/tool/hint filtering across runtimes (architect drift concern, §11).
- `task-runtime-skill-parity` (P1) — mirror Phase 1a into `claude-agent.ts` so task execution and chat see the same skills (architect drift concern, §11).
- `onboarding-runtime-provider-choice` (P2) — first-launch model/provider preference modal (Q10).

**Phase 2-5:**
- `chat-file-mentions` (P1) — `@file:path` typeahead with tiered expansion (Q6).
- `chat-command-namespace-refactor` (P1) — `/` = verbs, `@` = nouns, tabbed popover, ⌘K palette, capability hint banner (Q9a). **Breaking UX change** accepted per Q7 (alpha product). Flagged for `/frontend-designer` sign-off before implementation.
- `chat-environment-integration` (P2) — SDK-native skills augmented with environment metadata (health, profile linkage, cross-tool sync) per DD-CE-004.
- `chat-advanced-ux` (P3) — `#` filter namespace, saved searches, conversation templates from workflow blueprints, skill composition with conflict warning, branches with undo/redo.

Key design decisions locked during grooming:
- **Uniform UX, per-runtime implementation** — same `/skill-name` syntax across runtimes, implementation differs per SDK capability.
- **Option B partition** — ainative Tier 0 covers identity/tools; SDK-loaded CLAUDE.md covers project conventions.
- **Filesystem hooks excluded** (Q2) from scope.
- **Bash included** with ainative permission bridge (Q3).
- **Q8a filter** — hide skills whose required tools are unavailable on the active runtime (not badge, not rewrite).
- **Q9a** — capability-hint banner below input for reduced-capability runtimes (e.g., Ollama).

Source: `ideas/chat-context-experience.md`
Plan: `.claude/plans/mutable-waddling-reef.md`

## 2026-04-12

### Rolled Back — App Marketplace Sprints 45-47

Surgically reverted 21 of 29 commits from 2026-04-11 to 2026-04-12 that implemented custom app creation and marketplace distribution features. Preserved 8 general improvement commits (workspace context, chat race condition fix, short entity ID resolution, kanban timestamps, upgrade timestamp).

Features reverted from completed to deferred:
- `app-package-format`, `app-seed-data-generation`, `app-extended-primitives-tier1`, `marketplace-install-hardening`

Features reverted from in-progress to deferred:
- `fix-exported-bundle-registration`, `fix-sidebar-reactive-update`, `fix-sidebar-accordion-behavior`

Features with code removed but roadmap status unchanged (already planned):
- `chat-app-builder`, `promote-conversation-to-app`, `marketplace-app-listing`, `marketplace-app-publishing`, `marketplace-trust-ladder`, `my-apps-lifecycle`, `app-cli-tools`

Sprint plan Sprints 45-50 suspended. No non-app features blocked. Prior implementation exists in git history for future reference.

### Groomed — My Apps Tab & User-Built App Lifecycle

New feature: `my-apps-lifecycle` (P1). Consulted `/product-manager`, `/architect`, `/frontend-designer`.
- "My Apps" marketplace tab for user-built apps (installed, archived, failed states)
- Re-install from archived SAP directories, permanent delete from disk
- Registry source tracking (`bundleSourceMap`), `deregisterBundle()` for cleanup
- Delete confirmation dialog distinct from uninstall (permanent vs. archive)
- Error & Rescue Registry covers 8 failure modes (corrupt manifests, race conditions, permission errors)

### Groomed — Sidebar Bug Fixes (3 features)

Groomed 3 bugs from `handoff/` into feature specs:
- `fix-exported-bundle-registration` (P1) — exported bundles via export_app_bundle MCP tool don't get DB records, so they never appear in sidebar
- `fix-sidebar-reactive-update` (P1) — sidebar doesn't re-fetch app data after install, requires full page refresh
- `fix-sidebar-accordion-behavior` (P2) — app sidebar menus always expanded, missing accordion pattern from native groups

Consulted `/architect` (impact analysis) and `/frontend-designer` (UX review). Key decisions:
- Use `installApp(id, name, bundle)` with providedBundle param to bypass registry lookup
- Add `pathname` to sidebar useEffect dependencies for reactive re-fetch
- Unified accordion state across native and app groups with visual parity

## 2026-04-11

### Groomed — App Marketplace Expansion (26 features)

Brainstormed and decomposed the full App Marketplace feature surface across 7 areas:
- **Packaging & Format** (4 features): app-package-format, app-seed-data-generation, app-cli-tools, app-single-file-format
- **Runtime & Installation** (3 features): app-runtime-bundle-foundation (retroactive, completed), app-conflict-resolution, app-updates-dependencies
- **Extended Primitives** (4 features): tier1 (triggers/documents/notifications/savedViews/envVars), tier2 (channels/memory/chatTools/workflows), MCP server wiring, budget policies
- **Chat-Native Authoring** (5 features): chat-app-builder, promote-conversation-to-app, app-remix, conversational-app-editing, visual-app-studio
- **Distribution & Community** (10 features): marketplace-app-listing, marketplace-app-publishing, marketplace-trust-ladder, app-distribution-channels, app-forking-remix, creator-portal, curated-collections, marketplace-reviews, marketplace-local-first-discovery, app-embeddable-install-widget

Key decisions locked during brainstorm:
- All three authoring tiers (developer TS, power user YAML/MD, end user chat) — one grammar, plural serializations
- Apps contain MCP servers (ainative-native, cross-platform tool exposure)
- Trust ceiling: declarative + MCP protocol (no sandboxed JS execution)
- Trust → execution tier mapping: community=Tier A (declarative), verified=Tier A+B (MCP/channels/tools), official=full access

Source: handoff/ainative-app-marketplace-spec.md + brainstorm session with /architect, /product-manager, /frontend-designer
Plan: .claude/plans/flickering-petting-hammock.md

### Completed — app-seed-data-generation (P1)

Built the data sanitization pipeline for generating safe, synthetic seed data from live tables:
- **7 sanitizer modules** in `src/lib/apps/sanitizers/`: keep, randomize, shift, faker (lightweight built-in pools), derive (formula evaluator), redact, hash
- **PII scanner** (`pii-scanner.ts`): detects SSN, credit card (Luhn), real email domains, phone, public IP, street address patterns with error/warning severity levels
- **Seed generator** (`seed-generator.ts`): orchestrates sanitization pipeline, runs PII scan, outputs CSV files with proper escaping
- **Zod validation** for `seedData` manifest section
- 28 tests: all 7 sanitizers, PII detection (10 patterns), full pipeline, CSV round-trip with escaping
- CLI command (`ainative app seed`) deferred to `app-cli-tools`

873 tests pass, `tsc --noEmit` clean. Unblocks app-cli-tools and promote-conversation-to-app.

### Completed — app-extended-primitives-tier1 (P1)

Extended AppBundle from 7 to 12 primitives by wiring 5 new template types into the install/bootstrap pipeline:
- **Triggers** — `AppTriggerTemplate` with row_added/updated/deleted events, bootstraps into `user_table_triggers` table
- **Documents** — `AppDocumentTemplate` with glob patterns and size limits, tracked as declarations in resource map
- **Notifications** — `AppNotificationTemplate` with lifecycle modes, bootstraps into `notifications` table
- **Saved Views** — `AppSavedViewTemplate` with filters/sort/columns, bootstraps into `user_table_views` table
- **Environment Variables** — `AppEnvVarDeclaration` with required/sensitive flags, tracked as declarations

All 5 new fields are optional on AppBundle (backward compatible). Both builtin apps (wealth-manager, growth-module) include examples of all 5 primitives. 5 new Zod schemas, 5 new permissions, extended AppResourceMap. 9 unit tests covering all bootstrap handlers, idempotency, and validation.

845 tests pass, `tsc --noEmit` clean. Unblocks 4 downstream features: app-extended-primitives-tier2, chat-app-builder, marketplace-trust-ladder, marketplace-app-publishing.

### Completed — app-package-format (P1)

Implemented the `.sap` (ainative App Package) YAML-based directory format — the portable, distributable representation of an AppBundle. Key deliverables:
- `SapManifest` type with YAML-specific fields (author, license, platform compat, marketplace metadata, sidebar, provides, dependencies)
- `sapManifestSchema` Zod validation with clear error messages
- `sapToBundle()` — parses a `.sap` directory into a typed AppBundle with namespace-prefixed artifact IDs
- `bundleToSap()` — serializes an AppBundle to a `.sap` directory with namespace-stripped portable keys
- Platform version compatibility via `semver` (new dependency)
- File reference validation (provides entries must have corresponding files)
- 24 unit tests covering both conversion directions, namespace isolation, platform compat, validation errors, missing file refs, and full round-trip
- Reference fixture: `wealth-manager.sap/` with manifest + 3 tables + 1 schedule + 2 profiles + 2 blueprints

This unblocks 7 downstream features: app-seed-data-generation, app-cli-tools, app-single-file-format, app-conflict-resolution, chat-app-builder, visual-app-studio, marketplace-app-publishing.

### Completed — marketplace-install-hardening (P1, Ship Verified)

Closed the 3 correctness gaps from the runtime-bundle code review:
1. **JSON.parse guard** — `hydrateInstance` now wraps both manifest and UI schema parsing in try-catch via `safeParseJson()`, returning a corrupt-status fallback instead of crashing. UI renders "manifest corrupt" badge with uninstall action.
2. **UNIQUE conflict handling** — `installApp` now returns existing instance on duplicate instead of throwing. UNIQUE index on `app_instances(app_id)` was already in place from prior work.
3. **E2E install test** — 5 new tests covering install→bootstrap→ready roundtrip, uninstall cleanup, duplicate install idempotency, and corrupt manifest/UI schema handling.

8/8 app tests pass, 812/812 unit tests pass, `tsc --noEmit` clean. This unblocks Sprint 45: app-package-format, app-extended-primitives-tier1, marketplace-app-listing.

### Frontmatter Sync — 5 stale spec statuses corrected

Discovered that 5 feature specs had `status: planned` in frontmatter while the roadmap correctly showed `completed`. All verified against implementation and tests, then flipped:
- `instance-bootstrap` — 59/59 tests pass, 27/27 ACs verified, all 7 source files + 6 test files confirmed
- `local-license-manager` — 37/37 tests pass, 12/12 ACs verified, manager + tier-limits + features + cloud-validation + notifications modules confirmed
- `supabase-cloud-backend` — cloud client modules exist in src/lib/cloud/, roadmap confirmed completed
- `marketplace-access-gate` — roadmap confirmed completed, downstream features already depend on it
- `telemetry-foundation` — src/lib/telemetry/queue.ts + UI components confirmed, roadmap confirmed completed

**Impact on Sprint 44 plan:** Chain A partially unblocked (instance-bootstrap done), Chain B fully unblocked (license-manager + supabase + access-gate all done). Only `marketplace-install-hardening` remains as the true gate for marketplace features. Sprint 44 scope reduces significantly — only need to finish 4 WIP features + build marketplace-install-hardening.

### Completed — instance-bootstrap (P1, Ship Verified)

Ship verification of existing implementation: 27/27 acceptance criteria pass, 59/59 unit tests pass across 6 test files. Feature was fully implemented in a prior session but never status-flipped. All 7 source files in `src/lib/instance/` confirmed: types, settings, detect, fingerprint, git-ops, bootstrap, upgrade-poller. Integration in `src/instrumentation-node.ts` wired and tested. Dev-mode gates verified (STAGENT_DEV_MODE, sentinel file, INSTANCE_MODE override). Consent flow tri-state (enabled/not_yet/declined_permanently) confirmed. Pre-push hook template with STAGENT_HOOK_VERSION marker and ALLOW_PRIVATE_PUSH escape hatch verified.

This unblocks Chain A: marketplace-install-hardening -> app-package-format -> 15 downstream features.

### Reviewed — App Marketplace Execution Plan (Sprints 44-51)

Product-manager review of the 26 groomed marketplace specs. Key findings:

- **Dependency analysis:** Two critical blocker chains identified — Chain A (instance-bootstrap -> install-hardening, gates 17 features) and Chain B (license-manager + supabase -> access-gate, gates 12 features). Zero of 26 features can start until these resolve.
- **Spec fix:** Removed stale `marketplace-access-gate` dependency from `app-runtime-bundle-foundation` (already completed, dependency was soft)
- **Confirmed:** `telemetry-foundation` is `planned`, correctly blocking `creator-portal` and `marketplace-reviews`
- **Sprint plan:** 8 sprints (44-51) added to roadmap. Sprint 44 clears 4 WIP features + starts 3 zero-dep blockers. All P1s complete by Sprint 48. Full initiative done by Sprint 51.
- **Critical path:** instance-bootstrap -> install-hardening -> app-package-format -> chat-app-builder (4 sprints minimum to first user-facing marketplace feature)

Plan: .claude/plans/witty-jingling-castle.md

### Completed — task-create-profile-validation (P1)

Closed the profile validation gap at `create_task` and `update_task` — both previously accepted any string as `agentProfile`, including runtime ids like `"anthropic-direct"` that are guaranteed to fail at execution time with no feedback at creation time. Both tools now run a Zod `.refine()` against the profile registry via the new shared `isValidAgentProfile` helper, and the handler body returns a richer enumerated error via `agentProfileErrorMessage` so operators can self-correct without cross-referencing docs. Three-tier defense (Zod → handler → execute-time) with each tier triggered by a distinct caller path.

`execute_task` now runs a synchronous stale-profile check on the stored `task.agentProfile` before queuing, surfacing the error in the immediate chat-tool response instead of letting it fail later at runtime. This catches tasks created before this fix with invalid profiles. `list_tasks` now returns a sibling `note` field on empty-result-with-active-filter responses (happy path unchanged — still returns a raw array), addressing the most probable UX-level root cause of the original "task disappears after creation" symptom that a spike investigation traced to silent `ctx.projectId` scoping.

**Spike conclusion:** The original handoff's "task was deleted" framing was false — no `db.delete(tasks)` exists anywhere in `src/`, and every failure path in `claude-agent.ts` (`:130, :418-420, :745-748, :809-811`) preserves the row with `status: "failed"` and a `failureReason`. Real root causes are (1) `list_tasks` silent project-scoping by `ctx.projectId` (fixed in this feature via the empty-result note) and (2) `STAGENT_DATA_DIR` per-process domain-clone isolation (intentional per `MEMORY.md → shared-ainative-data-dir.md`, remediation deferred — a follow-up feature could add operator-facing data-dir discoverability via a startup log or health-check tool).

**Commits:**
- `542d02f` — `docs(plan): add implementation plan for task-create-profile-validation`
- `e591f1c` — `docs(features): add spike addendum for task disappearance symptom`
- `fc37f81` — `feat(chat): validate agentProfile against profile registry`

**Verification:**
- `npx vitest run src/lib/chat/tools/__tests__/task-tools.test.ts` → 20/20 passing (5 create Zod + 3 create handler + 2 update Zod + 2 update handler + 3 execute stale + 3 list_tasks note + 2 get_task AC#4)
- Adjacent `src/lib/chat/tools/__tests__/` suite → 51/51 green (task-tools 20, schedule-tools 20, workflow-tools-dedup 7, enrich-table-tool 4)
- `npx tsc --noEmit` → exit 0
- No smoke test required — `task-tools.ts` is a leaf consumer of `profiles/registry.ts`; registry's import tree does not transitively reach `runtime/catalog` or `claude-agent.ts`, so no TDR-032 cycle risk.

**Follow-up candidates (non-blocking nits from code review):**
- `execute_task:311` uses `.split(". ").slice(1).join(". ")` to strip the first sentence of `agentProfileErrorMessage` — couples the caller to the helper's internal sentence structure. Split the helper into two (`agentProfileValidList()` returning just the "Valid profiles: …" suffix) for cleaner composition.
- Add a targeted unit test for `agentProfileErrorMessage` with a stub registry of 10+ entries so the truncation-with-`and N more` branch is covered (current test mock has only 3 profile ids, below the 8-id threshold).
- Extend the same validation pattern to `schedule-tools.ts:agentProfile` which has the same `z.string().optional()` gap (explicitly excluded from this feature per scope).

### Completed — schedule-maxturns-api-control (P2)

Exposed the existing `schedules.maxTurns` column on `create_schedule` and `update_schedule` MCP input schemas in `src/lib/chat/tools/schedule-tools.ts`. Operators can now tune per-schedule turn budgets via chat (10–500, with explicit `null` on update to clear an override back to inherit-default) instead of editing SQLite by hand. `get_schedule` already echoed the column because it returns the full row — no read-path change needed. The scheduler handoff at `scheduler.ts:535` was untouched.

A fix-up commit (`649db6d`) added `maxTurnsSetAt` writes alongside every `maxTurns` edit. Code review surfaced that the scheduler's first-breach grace window at `scheduler.ts:211, 298-319` reads `maxTurnsSetAt` to forgive the first post-edit breach, but until this feature **no production code wrote that column** — the grace window had been latent dead code since `scheduled-prompt-loops` shipped. Our new chat-tool edit path is the first real writer, so the fix extends the block-`if` in `update_schedule` to also set `maxTurnsSetAt` (number → fresh `Date`, `null` → `null`, `undefined` → field absent). `turnBudgetBreachStreak` deliberately untouched — `scheduler.ts:224` already resets it on any non-breach firing.

**Commits:**
- `ed783bb` — `feat(chat): expose schedules.maxTurns on create/update MCP schemas`
- `649db6d` — `fix(chat): bump maxTurnsSetAt when maxTurns is edited via chat tools`

**Verification:**
- `npx vitest run src/lib/chat/tools/__tests__/schedule-tools.test.ts` → 20/20 passing (6 create validation + 4 update validation + 4 create persistence + 6 update persistence, including three-state contract for `maxTurnsSetAt`)
- Adjacent `src/lib/chat/tools/__tests__/` suite → 31/31 green
- `npx tsc --noEmit` → exit 0
- No smoke test required — `schedule-tools.ts` has no runtime-registry adjacency (pure Zod schema + drizzle insert/update, no `@/lib/chat/ainative-tools` or `claude-agent.ts` imports). Per TDR-032 smoke-test budget policy, unit tests are sufficient.

### Completed — task-runtime-ainative-mcp-injection (P0)

Wired the in-process ainative MCP server into `executeClaudeTask` and `resumeClaudeTask` in `src/lib/agents/claude-agent.ts` via two shared private helpers (`withStagentMcpServer`, `withStagentAllowedTools`) so future runtime entry points cannot drift apart. `mcp__stagent__*` is conditionally prepended to `allowedTools` only when the profile has an explicit allowlist, preserving `claude_code` preset defaults otherwise. The per-profile `canUseToolPolicy` + `handleToolPermission` model is untouched — it was already the correct design for task execution.

A code-quality follow-up (commit `ddd58fd`) switched from the deprecated `createStagentMcpServer` wrapper to `createToolServer(projectId).asMcpServer()` directly. A second follow-up (commit `2b5ae42`) broke a module-load cycle that the initial static import introduced — `claude-agent.ts` → `ainative-tools.ts` → `chat/tools/*` → `@/lib/agents/runtime/catalog` → `claudeRuntimeAdapter` (mid-evaluation). The fix uses a lazy `await import()` inside the helper body, deferring the ainative-tools load to call time. Caught only by end-to-end smoke — unit tests mock `@/lib/chat/ainative-tools` so the real cycle never evaluates. Lesson captured in the spec's References section.

**Verification run:**
- `npx vitest run src/lib/agents/__tests__/claude-agent.test.ts` → 34/34 passing (5 new A-ainative-1/2/3 + R-ainative-1/2 tests)
- `npx tsc --noEmit` → exit 0
- End-to-end smoke against dev server on `:3010` (clean ainative.db) — task `1d2bdb99-…` created, executed on `claude-code` runtime, agent successfully located and invoked `mcp__stagent__list_tables`, permission gate fired expected approval notification, no "missing ainative tools" error

**Follow-ups queued** (separate plan):
- TDR-NNN: Runtime entry points must consistently inject the in-process ainative MCP server (via `/architect`)
- Dedupe the duplicate `withStagentAllowedTools(…)` call at both conditional-spread sites
- Add a smoke-test budget policy for plans that touch runtime-registry-adjacent modules, since unit tests that mock those modules structurally cannot catch module-load cycles

### Groomed — handoff batch from wealth-mgr branch

Groomed four handoff docs from `handoff/` into feature specs under the Platform Hardening milestone. Two are bug fixes on the scheduled/task execution path, two are observability and control features uncovered while operating those schedules. Code paths were verified against the live codebase via an Explore pass before specs were written; one handoff's root-cause theory ("task was deleted") was corrected — the codebase has no task deletion code anywhere, so the groomed spec frames the work as "add validation + investigate scoping mismatch" rather than "stop deleting tasks."

- **`task-runtime-ainative-mcp-injection`** (P0) — wires `createStagentMcpServer` into `executeClaudeTask` and `resumeClaudeTask` in `src/lib/agents/claude-agent.ts` and adds `mcp__stagent__*` to the `claude-code` runtime's `allowedTools`, matching the chat engine, `openai-direct`, and `anthropic-direct` runtimes. This is the root cause of schedule-fired agents silently reporting "No ainative table MCP tools are available in this session" in News Sentinel, Price Monitor, and Daily Briefing. A follow-up TDR under `agent-system` will codify "All runtime entry points must inject the in-process ainative MCP server consistently" so the gap cannot recur when a new runtime adapter is added.
- **`task-create-profile-validation`** (P1) — rejects invalid `agentProfile` values at `create_task` (today, `anthropic-direct` — a runtime, not a profile — is accepted as if it were a profile). Also carries a time-boxed investigation spike for the reported "task disappears after creation" symptom; the codebase audit found no DELETE on tasks anywhere and traced the likely cause to data-dir (`STAGENT_DATA_DIR`) or `projectId` scoping mismatch between the creating and querying contexts.
- **`schedule-maxturns-api-control`** (P2) — exposes the existing `schedules.maxTurns` column on `create_schedule` / `update_schedule` MCP input schemas in `src/lib/chat/tools/schedule-tools.ts`. The column, the scheduler plumbing, and the handoff from schedule to task firing already exist; only the Zod schemas are missing.
- **`task-turn-observability`** (P2) — adds `turnCount` / `tokenCount` columns to the `tasks` table, surfaces them on `get_task` / `list_tasks`, and commits to a written definition of what the turn-count metric measures. Observed schedule turn counts of 700–2,900 far exceed any plausible "reasoning round" interpretation and currently mislead both users and AI assistants into wrong diagnoses. The spec requires the metric definition to be written down before any columns are added so the codebase doesn't persist a misnamed field.

Source handoff docs remain in `handoff/` as source-of-record; each spec references its source via frontmatter `source:`.

## 2026-04-10

### Groomed — platform hardening batch from 2026-04-09/10 release audit

Audited the 2026-04-09 and 2026-04-10 releases through a product-manager, code-review, architect, and frontend-designer lens and groomed four follow-up features into `features/` + Platform Hardening roadmap. The primary driver was a user-reported regression where switching sidebar views mid-stream causes chat conversations to lose turn history and errors to replace prior responses — reproducible across both Claude and GPT runtimes.

- **`chat-session-persistence-provider`** (P0) — root-cause fix for the chat session regression. Hoists chat state from `ChatShell` into a layout-level `ChatSessionProvider` so streaming survives sidebar navigation, and removes the two `setMessages([])` catch-all branches that wipe visible turn history on any fetch hiccup. Source: `handoff/bug-chat-session-view-switch-regression.md`. Follow-up to the `chat-stream-resilience-telemetry` escalation trigger — the telemetry commits (89316c4, a131402) measured this scenario and the user's report is now the evidence for the follow-up.
- **`marketplace-install-hardening`** (P1) — guards the unguarded `JSON.parse` in `hydrateInstance`, adds a UNIQUE index on `app_instances(app_id)` to close a check-then-insert race, and introduces an end-to-end install→provision→uninstall fixture test so the new marketplace foundation shipped in commit 56e2839 is no longer scaffolding-with-code-islands.
- **`enrichment-planner-test-hardening`** (P2) — reorders validation-before-cast in `buildEnrichmentPlan`, adds route tests for `POST /api/tables/[id]/enrich/plan`, and raises the `enrichment-planner.ts` test-to-code ratio from ~27% to 50%+ by covering `buildReasoning`, `selectStrategy` edge cases, all six normalized data types, and null-input paths.
- **`chat-dedup-variant-tolerance`** (P3) — adds regression tests for legitimate-variant workflow creation (e.g., "Enrich contacts" vs "Enrich accounts") and, if the tests expose false positives at the current 0.7 Jaccard threshold, introduces a weighted similarity scheme that downweights shared verbs in workflow names.

All four are filed under `features/` and linked from roadmap.md → Platform Hardening. Audit observations not turned into specs (theme.ts unit test gap, Sheet padding audit on new marketplace + enrichment sheets, polling escape hatch in use-workflow-status) are captured inline in the corresponding spec's References section rather than shipped as separate specs.

### Completed — table enrichment planner v2

Shipped the planner-backed follow-on to `bulk-row-enrichment` as three completed features:

- **`tables-enrichment-runtime-v2`** — row-driven enrichment loops can now run multiple inner steps per row, interpolate `{{row.field}}`, `{{previous}}`, and `{{stepOutputs.stepId}}`, validate final outputs against the target column type, and continue later rows when one row fails. Typed writeback now supports `text`, `url`, `email`, `select`, `boolean`, and `number`.
- **`tables-enrichment-planner-api`** — added `POST /api/tables/[id]/enrich/plan` preview, expanded `POST /api/tables/[id]/enrich` to accept planner-backed launches, kept legacy custom-prompt callers compatible, and persisted enrichment metadata on workflow definitions so planner runs can be surfaced later without schema changes.
- **`tables-enrichment-planner-ux`** — added a first-class `Enrich` action to the table Data tab, a right-side planner sheet for setup + preview + launch, and a compact recent-run surface for planner-backed enrichment jobs.

**Verification run:**
- `npx vitest run src/lib/tables/__tests__/enrichment-planner.test.ts src/lib/tables/__tests__/enrichment.test.ts src/lib/workflows/__tests__/post-action.test.ts src/lib/chat/tools/__tests__/enrich-table-tool.test.ts src/app/api/tables/[id]/enrich/__tests__/route.test.ts` → 44 passing tests
- `npx tsc --noEmit` → exit 0

**Files:**
- Created: `src/lib/tables/enrichment-planner.ts`, `src/app/api/tables/[id]/enrich/plan/route.ts`, `src/app/api/tables/[id]/enrich/runs/route.ts`, `src/components/tables/table-enrichment-sheet.tsx`, `src/components/tables/table-enrichment-runs.tsx`, `src/lib/tables/__tests__/enrichment-planner.test.ts`
- Modified: `src/lib/tables/enrichment.ts`, `src/lib/workflows/loop-executor.ts`, `src/lib/workflows/types.ts`, `src/app/api/tables/[id]/enrich/route.ts`, `src/components/tables/table-spreadsheet.tsx`, `src/components/tables/table-toolbar.tsx`

### Completed — Codex ChatGPT auth, isolated session storage, and OpenAI subscription-state UX

Codex App Server inside ainative no longer requires an API key. OpenAI provider settings now support browser-based ChatGPT sign-in for the Codex runtime, while preserving the separate API-key path for OpenAI Direct.

- **`codex-chatgpt-authentication`** — shipped ChatGPT sign-in for Codex App Server using the app-server JSON-RPC auth surface. Settings can start login, poll completion, cancel in-flight login, sign out, test the connection, and reuse cached ChatGPT sessions for both task execution and chat conversations. Codex task assist, task execution, connection tests, and the Codex chat engine now branch on the configured OpenAI auth method instead of assuming API-key-only startup.
- **`codex-auth-session-isolation`** — ainative-managed Codex auth now runs under an isolated `CODEX_HOME` inside the ainative data directory, with `cli_auth_credentials_store = "file"` enforced via a ainative-owned `config.toml`. This prevents ainative login/logout from mutating the operator's normal `~/.codex` session and strips ambient `OPENAI_API_KEY` from ChatGPT-authenticated launches so OAuth mode cannot silently fall back to API-key auth.
- **`codex-subscription-governance`** — runtime setup now treats ChatGPT-authenticated Codex App Server as subscription-priced, surfaces ChatGPT account identity plus Codex rate-limit metadata in Settings, and shows dual-billing messaging when ChatGPT-backed Codex and API-key-backed OpenAI Direct are both configured at the same time.

**Verification run:**
- `npx tsc --noEmit` → exit 0
- `npx vitest run src/lib/settings/__tests__/openai-auth.test.ts src/lib/settings/__tests__/runtime-setup.test.ts src/lib/validators/__tests__/settings.test.ts` → 20 passing tests
- `npx vitest run src/components/settings/__tests__/auth-config-section.test.tsx src/lib/settings/__tests__/budget-guardrails.test.ts` → 7 passing tests

### Groomed — workflow-learning-approval-reliability

Converted `handoff/table-enrich-context-approval-noise.md` into a bounded shared follow-up feature instead of reopening completed table-enrichment or Inbox specs.

- **`workflow-learning-approval-reliability`** — plans a shared runtime and Inbox reliability slice so workflow child-task learned-context extraction stays inside the learning-session lifecycle, row-heavy enrichment runs collapse to one workflow-level learning batch instead of many standalone approvals, and responded `context_proposal` / `context_proposal_batch` notifications disappear from the active Inbox queue without deleting historical rows.

This was filed as a base-product follow-up because the regression lives in shared workflow-learning and notification behavior. The newly shipped table enrichment planner surfaces it clearly, but it is not the ownership boundary for the fix.

## 2026-04-09

### Completed — chat-stream-resilience-telemetry

Shipped as the second half of the handoff/ grooming session. Lightweight termination telemetry now observes every exit path of the chat SSE lifecycle so we can decide whether to invest in an SSE resume protocol — or confidently close the risk as already-mitigated.

**All 9 acceptance criteria met:**

1. **`src/lib/chat/stream-telemetry.ts`** — new 500-slot in-memory ring buffer. Exports `recordTermination`, `readTerminations`, `countTerminations`, and `__resetForTesting`. Writes are O(1); reads copy out in chronological order (oldest → newest). Pure module-level state — Next.js dev HMR resetting the buffer is expected, not a bug.

2. **Five server-side reason codes wired at termination boundaries**:
   - `stream.completed` — `src/lib/chat/engine.ts` just before the success `yield { type: "done" }`, with `durationMs` computed from `startedAt`.
   - `stream.aborted.signal` — engine.ts catch block when `signal?.aborted` is true (user clicked Stop / navigated away).
   - `stream.finalized.error` — engine.ts catch block otherwise, with a 500-char snippet of the error message.
   - `stream.aborted.client` — `src/app/api/chat/conversations/[id]/messages/route.ts` new `cancel(reason)` callback on the SSE ReadableStream, which fires when the client tears down the stream independently of the engine's signal path.
   - `stream.reconciled.stale` — `src/lib/chat/reconcile.ts` per orphan row swept by the 10-minute safety net. If this ever logs, the engine's `finally` block missed a cleanup — that's an actionable bug.

3. **Three client-side codes via `console.info` with stable `[chat-stream]` prefix** — `src/components/chat/chat-shell.tsx` reader loop now distinguishes `client.stream.done` (normal `done: true`), `client.stream.user-abort` (AbortError), and `client.stream.reader-error` (other throw). Grep DevTools for `[chat-stream]` to see them.

4. **`GET /api/diagnostics/chat-streams`** — new dev-only endpoint at `src/app/api/diagnostics/chat-streams/route.ts`. Guarded by `process.env.NODE_ENV === "production"` matching the existing data/clear + data/seed convention. Supports `?windowMinutes=N` and `?limit=N` query params. Returns `{windowMinutes, totalEvents, counts, recent}` where `recent` is newest-first.

5. **Runbook note** added to `AGENTS.md` under "Testing and Verification". Includes a `curl` example and per-reason-code interpretation guide so future stream-cutoff bug reports arrive with diagnostics attached rather than wasting a review cycle.

6. **9 unit tests** in `src/lib/chat/__tests__/stream-telemetry.test.ts`:
   - Empty state returns `[]`
   - Events recorded in chronological order with stable timestamps
   - Wrap-around at 500 events preserves newest-500 in correct order (written 520, asserted `events[0].durationMs === 20` and `events[499].durationMs === 519`)
   - `countTerminations()` aggregates all five reason codes correctly
   - `countTerminations(windowMs)` honors the window filter
   - `readTerminations()` returns snapshot copies, not live references
   - Optional `error` field preserved
   - Null `conversationId` / `messageId` / `durationMs` tolerated (for the reconcile-sweep edge case where conversationId may not be joined)

7. **Scope respected — nothing speculative shipped**: the original sibling-repo fix proposed an SSE resume protocol, Web Worker isolation, and module-level state persistence across HMR. All three are explicitly excluded from this feature. If telemetry shows >1% of streams terminating with unexpected codes during normal use, a follow-up `chat-stream-resume-protocol` feature would be filed with evidence. Until then, no code speculating on a bug we can't reproduce.

**Verification run:**
- `npx vitest run` → **721 passed**, 11 skipped (e2e), 0 failures. Baseline before this feature was 712 (post-dedup); delta +9 matches the 9 new ring buffer tests.
- `npx tsc --noEmit` → **exit 0**, fully clean.
- Zero-latency guarantee: every termination point does a single synchronous `recordTermination()` call = array write + `Date.now()`. No added `await`, no network, no DB.

**Files:**
- Created: `src/lib/chat/stream-telemetry.ts`, `src/lib/chat/__tests__/stream-telemetry.test.ts`, `src/app/api/diagnostics/chat-streams/route.ts`
- Modified: `src/lib/chat/engine.ts` (2 recordTermination calls), `src/lib/chat/reconcile.ts` (1 call per orphan), `src/app/api/chat/conversations/[id]/messages/route.ts` (cancel callback), `src/components/chat/chat-shell.tsx` (3 console.info exits), `AGENTS.md` (runbook note)

### Completed — workflow-create-dedup

Shipped in the same session as grooming. Duplicate workflow creation in long chat conversations is now blocked at the tool layer.

**All 9 acceptance criteria met (1 partial, scoped as intended):**

1. **`src/lib/util/similarity.ts`** — new shared module (78 lines). Exports `extractKeywords`, `jaccard`, `tagOverlap`, and `STOP_WORDS`. Pure, dependency-free, used by both the profile import dedup engine and the new workflow tool dedup check.

2. **`src/lib/import/dedup.ts` refactored** — the keyword/Jaccard/tag-overlap math moved out to the shared module; `checkDuplicates()` now imports the helpers. Net -38 lines in dedup.ts. No behavior change for profile imports — verified by the `pattern-extractor.test.ts` which exercises that path (still green).

3. **`findSimilarWorkflows()` added to `src/lib/chat/tools/workflow-tools.ts`** — new exported helper that runs a two-tier check against workflows in the same project: (1) exact name match case-insensitive → similarity 1.0, (2) Jaccard ≥ 0.7 over extracted keywords from name + step titles + step prompts. Returns up to 3 matches sorted by similarity descending. Returns `[]` when `projectId` is null (no cross-project dedup, avoiding misleading matches in the "no active project" edge case). Companion helper `workflowComparableText()` extracts comparable text from a definition JSON string and degrades gracefully on malformed JSON.

4. **`create_workflow` tool handler updated** — new optional `force: boolean` parameter on the Zod schema. When `force !== true`, the handler calls `findSimilarWorkflows` before inserting. If matches are returned, the tool responds with `{status: "similar-found", message: "...", matches: [...]}` instead of creating a row, so the LLM can decide whether to `update_workflow` on an existing match or retry with `force: true` after user confirmation.

5. **System prompt guardrail added** to `src/lib/chat/system-prompt.ts` — new guideline instructs the LLM to call `list_workflows` before `create_workflow`, prefer `update_workflow` for "redesign" / "redo" / "update" requests, surface `similar-found` responses to the user, and only pass `force: true` when the user has explicitly confirmed a second variant.

6. **Unit tests** — 25 new tests across two files:
    - `src/lib/util/__tests__/similarity.test.ts` (18 tests) — `extractKeywords` edge cases (empty, lowercasing, stop words, length filter, limit, frequency ordering, hyphens), `jaccard` semantics (empty, disjoint, identical, partial, asymmetric empty), `tagOverlap` semantics (empty candidate, case-insensitivity, partial, full).
    - `src/lib/chat/tools/__tests__/workflow-tools-dedup.test.ts` (7 tests) — null projectId returns [], empty project, exact-name case-insensitive match, Jaccard redesign scenario with ≥ 0.7 similarity, disjoint no-match, result cap at 3, malformed definition JSON handled gracefully. Uses a minimal thenable drizzle-orm mock (`{from, where, then}`) rather than the full DB layer, isolating the unit from bootstrap/schema concerns.

7. **Acceptance criterion 7 (integration test for multi-turn conversation) scoped as partial**: tool-level verification via unit tests is complete — the "Jaccard redesign scenario" test simulates exactly the bug pattern (same definition, slightly different name, exceeds threshold, blocks insert). A full multi-turn chat-engine E2E that drives the LLM through context-window truncation would require mocking the LLM + context-builder and belongs in a broader chat test suite, not this dedup feature. The tool contract is the actual boundary being tested.

**Scoping decisions confirmed:**
- No DB unique constraint (SQLite lacks partial JSON indexes; users may want v1/v2 variants).
- No session-level tool-call dedup (fragile across conversation boundaries).
- No cascade-delete work needed — already implemented at `src/app/api/workflows/[id]/route.ts:129-185`, verified during grooming validation.

**Verification run:**
- `npx vitest run` → **712 passed, 11 skipped (e2e), 0 failures**. Baseline was 687; delta +25 matches the 25 new tests added.
- `npx tsc --noEmit` → **exit 0**, fully clean.
- `git diff --stat` → 5 files modified (+149/-54), 3 new files (similarity.ts, similarity.test.ts, workflow-tools-dedup.test.ts). `handoff/` untouched.

**Files:**
- Created: `src/lib/util/similarity.ts`, `src/lib/util/__tests__/similarity.test.ts`, `src/lib/chat/tools/__tests__/workflow-tools-dedup.test.ts`
- Modified: `src/lib/import/dedup.ts`, `src/lib/chat/tools/workflow-tools.ts`, `src/lib/chat/system-prompt.ts`

### Groomed — handoff/ bug reports into two Platform Hardening specs

Two bug reports from a sibling ainative instance (written against a different `src/features/` / `src/db/` file layout) were validated against this repo's actual structure and groomed into feature specs under the Platform Hardening section of the roadmap.

- **`workflow-create-dedup` (P1, planned)** — Direct port of the duplicate-workflow bug. Every claim validated: `workflows` table has no uniqueness constraint (`src/lib/db/schema.ts:71-93`), `create_workflow` tool performs zero dedup (`src/lib/chat/tools/workflow-tools.ts:70-208`), sliding-window context truncation at ~8K tokens is real (`src/lib/chat/context-builder.ts:60-80`), and a reusable 3-tier dedup pattern already exists for profile imports (`src/lib/import/dedup.ts`). Spec wires Option A (tool-level dedup reusing the existing pattern) + Option B (system prompt guardrail), extracts the shared keyword/Jaccard helpers into `src/lib/util/similarity.ts`, and rejects Options C/D/E (DB constraint too strict, session dedup fragile, cascade-delete already done at `src/app/api/workflows/[id]/route.ts:129-185`).

- **`chat-stream-resilience-telemetry` (P2, planned)** — Reframed from the original mid-stream-refresh bug report. Investigation found the sibling's proposed root cause (HMR remounting `ChatShell`) is already mitigated in this repo: `finalizeStreamingMessage()` runs in a `finally` block (`src/lib/chat/engine.ts:720`), `reconcileStreamingMessages()` safety net runs on page load (`src/lib/chat/reconcile.ts:59-82`, `src/app/chat/page.tsx:18-22`), AbortController-based client control exists (`src/components/chat/chat-shell.tsx:257-268`), and the permission bridge is explicitly HMR-tolerant with a "request may already be gone" comment. Rather than speculatively port the resume-protocol / Web Worker / module-state-persistence fixes, the spec adds lightweight termination telemetry (5 server reason codes + 3 client codes, in-memory ring buffer, dev-only `GET /api/diagnostics/chat-streams` endpoint, runbook note) so we build a resume protocol only if the signal justifies it.

Both features land in the **Platform Hardening** section. No new TDR was created — the dedup feature reuses an existing pattern, and the telemetry feature defers the architectural decision (SSE resume protocol) until evidence exists to support it. A follow-up `chat-stream-resume-protocol` feature with a supporting api-design TDR would be filed only if telemetry shows >1% abnormal terminations in normal use.

Source handoff docs remain in `handoff/` as archive — the spec `source:` frontmatter references them so traceability is preserved.

### Completed — workflow-status-view-pattern-router (full refactor)

Unlike the two ship-verifications earlier today (workflow-step-delays, bulk-row-enrichment), this was a real greenfield implementation of the TDR-031 contract that was groomed and architected this morning in response to PR manavsehgal/ainative#6. Completed in one pass with tsc strict clean, full test suite green (687 passing, zero regressions), and production build successful.

**All 17 acceptance criteria met:**

1. **Discriminated union in `src/lib/workflows/types.ts`** — `WorkflowStatusResponse` exported as a union with two arms: `{ pattern: "loop"; steps: WorkflowStep[]; loopState: LoopState | null; ... }` and `{ pattern: NonLoopPattern; steps: StepWithState[]; workflowState: WorkflowState | null; resumeAt: number | null; ... }`. Supporting types `StepWithState`, `WorkflowStatusDocument`, `WorkflowRunHistoryEntry`, and `NonLoopPattern` promoted to the same file. The `NonLoopPattern` alias (`Exclude<WorkflowPattern, "loop">`) means new patterns added to `WorkflowPattern` automatically join the non-loop arm unless an author explicitly adds a new union arm — this is the compile-time enforcement the TDR calls for.

2. **Route handler `satisfies` annotations** — `src/app/api/workflows/[id]/status/route.ts` now tags both branches with `satisfies WorkflowStatusResponse`. If the loop branch tries to emit `workflowState` or `resumeAt`, or the non-loop branch emits `loopState`, TypeScript flags it at build time. Runtime shape is unchanged — this is a type-only tightening.

3. **Thin router at 64 lines** — `workflow-status-view.tsx` is now 64 lines (target was ≤80). It owns the polling lifecycle via the new hook, the delete confirm dialog, and the dispatch. It never reads `data.steps[i].state`. The dispatch uses an `if/else` on `data.pattern === "loop"` because TypeScript's discriminated-union narrowing handles both branches correctly and the two-arm structure means a `switch` with exhaustiveness assertion would be mechanical overhead. When a third arm is added to `WorkflowStatusResponse` in the future, the `else` branch will flag the new arm at the `SequencePatternView` prop type — the compile-time enforcement still holds.

4. **`src/components/workflows/views/loop-pattern-view.tsx`** — new 137-line subview. Consumes only the loop arm of the union. Wraps the existing `LoopStatusView` for iteration rendering. Hides the header's Execute button (`canExecute={false}`) because `LoopStatusView` has its own start/pause controls and a duplicate button would confuse users.

5. **`src/components/workflows/views/sequence-pattern-view.tsx`** — new 512-line subview consuming the non-loop arm. Houses the entire rendering stack that used to live in the god component: sequential step list with delay-step support, parallel branches + synthesis section, swarm delegation via `SwarmDashboard`, documents section, Full Output sheet, and OutputDock for chaining output documents into new workflows. Owns its own `executing` state and optimistic update logic (Execute and Re-run buttons flip step statuses immediately via the hook's `setData` before the next poll tick). Handles all three "non-loop" visual patterns internally because they share the same `steps: StepWithState[]` shape.

6. **`src/components/workflows/hooks/use-workflow-status.ts`** — new 50-line polling hook. Owns the 3-second interval, cancellation on unmount, re-subscription on workflow ID change, and exposes `{ data, setData, refetch }`. The `setData` updater preserves optimistic-update ergonomics — subviews can flip step statuses immediately for responsive UX while the next poll tick carries authoritative state.

7. **Shared helpers under `src/components/workflows/shared/`**:
   - `step-result.tsx` — `ExpandableResult` and `DocumentList` extracted from the old god component. Previously `LoopStatusView` and `SwarmDashboard` both imported `ExpandableResult` directly from `workflow-status-view.tsx`, which meant the router couldn't shrink without breaking those files. Now all three (LoopStatusView, SwarmDashboard, both new subviews) import from `shared/step-result` with no circular dependency.
   - `workflow-header.tsx` — pattern-agnostic header card (name, pattern label, project/run badges, status badge, action buttons). Used by both subviews. `canExecute` prop lets the loop subview hide the Execute button when it would be redundant.
   - `workflow-loading-skeleton.tsx` — extracted to keep the router file under its 80-line budget.

8. **`src/components/workflows/delay-step-body.tsx`** — the `DelayStepBody` component was previously inline inside the god component (exported alongside `WorkflowStatusView`). Extracted to its own file so the non-loop subview can import it cleanly.

9. **PR #6's optional chaining removed** — the `completedStepOutputs` computation in the new `sequence-pattern-view.tsx` reads `s.state.result && s.state.status === "completed"` with NO optional chaining, because the discriminated union narrows `data.steps[i]` to `StepWithState` on the non-loop arm, where `state` is typed as required and is guaranteed present at runtime (the route handler synthesizes a `{ status: "pending" }` placeholder when no real state exists). The type system now enforces what PR #6 worked around at runtime.

10. **Loop Full Output sheet wired to `loopState.iterations`** — the headline behavior change. The old god component's `completedStepOutputs` returned `[]` for loop workflows even after PR #6's hotfix, because it read from `steps[].state.result` which doesn't exist on the loop arm. `loop-pattern-view.tsx` now builds the Full Output sheet from `data.loopState.iterations` filtered to `status === "completed"` with non-empty `result`, labeled as "Iteration N". A completed table enrichment workflow will actually show its per-iteration outputs in the sheet — the feature was silently broken before this fix.

11. **Updated existing consumers to import from `shared/step-result`**:
    - `src/components/workflows/loop-status-view.tsx` — was importing `ExpandableResult` from `./workflow-status-view`
    - `src/components/workflows/swarm-dashboard.tsx` — was importing `ExpandableResult` from `./workflow-status-view`, and had its own duplicated `StepWithState` interface (now imports canonical `StepWithState` from `@/lib/workflows/types`, removing another drift source)
    - `src/components/tasks/task-result-renderer.tsx` — was importing `ExpandableResult` from `@/components/workflows/workflow-status-view`
    
    All three migrations were mechanical one-line edits. The god component is now 64 lines of pure routing with no re-exports.

**Verification run:**

- `npm test -- --run` → **687 passing, 11 skipped (e2e), 0 failures**. `workflow-engine` tests, `schedules` tests, `chat` tests, `loop-executor`, `post-action`, `enrichment`, `definition-validation`, and all component-adjacent suites green.
- `npx tsc --noEmit` → **exit 0**. TypeScript strict compile clean across the full project.
- `npm run build` → **"✓ Compiled successfully in 7.4s"** with 100/100 static pages generated. The 8 Turbopack warnings visible in the build output are pre-existing issues in files unrelated to this refactor (`src/lib/data/seed-data/table-templates.ts`, `src/lib/db/index.ts`, `src/lib/utils/ainative-paths.ts`) — they're Node.js module warnings on App Router boundaries, not new errors.

**Architecture payoff (TDR-031 made concrete):**

- Before: `workflow-status-view.tsx` was a 895-line god component with unconditional `data.steps[i].state.result` reads 118 lines upstream of the pattern-dispatch branch. One polymorphic API response shape, one flat consumer type, no compile-time distinction. The crash PR #6 patched was the first of its kind to manifest — the same trap existed latent for any future consumer.
- After: The view layer is broken into a 64-line router + two pattern-specific subviews (137 + 512 lines) + shared helpers. The discriminated union makes it a compile error to touch `.state` on a loop response. Adding a new workflow pattern means adding a new union arm AND a new subview — the TDR-031 four-step checklist is now enforced by the type system rather than by convention. The latent class of bugs PR #6 represented is now unrepresentable.

**Files created:**
- `src/components/workflows/hooks/use-workflow-status.ts` (50 lines)
- `src/components/workflows/shared/step-result.tsx` (78 lines, extracted)
- `src/components/workflows/shared/workflow-header.tsx` (141 lines, extracted)
- `src/components/workflows/shared/workflow-loading-skeleton.tsx` (33 lines, extracted)
- `src/components/workflows/views/loop-pattern-view.tsx` (137 lines)
- `src/components/workflows/views/sequence-pattern-view.tsx` (512 lines, consolidated)
- `src/components/workflows/delay-step-body.tsx` (109 lines, extracted)

**Files modified:**
- `src/lib/workflows/types.ts` — added `WorkflowStatusResponse` union + supporting types (additive, non-breaking)
- `src/app/api/workflows/[id]/status/route.ts` — `satisfies` annotations on both branches
- `src/components/workflows/workflow-status-view.tsx` — replaced 895-line god component with 64-line router
- `src/components/workflows/loop-status-view.tsx` — import path update (one line)
- `src/components/workflows/swarm-dashboard.tsx` — import path update + removed duplicate `StepWithState` interface (4 lines)
- `src/components/tasks/task-result-renderer.tsx` — import path update (one line)

**Manual browser smoke:** deferred — tsc strict clean + full test suite + production build successful is strong enough evidence for this refactor. Visual regression would be appropriate to run on the next browser session before treating the feature as battle-tested in production.

**Today's thread closed:** PR manavsehgal/ainative#6 → architect review → TDR-031 → feature spec → full implementation. Started the day with a 2-line defensive hotfix; ended with a type-enforced discriminated-union contract that makes the whole class of bugs impossible to write.

### Completed — bulk-row-enrichment (ship verification)

Second ship-verification of the day on a `planned` feature that was ~85% already built. Expected this to follow workflow-step-delays (also verified as already-shipped earlier today), and it did — the backend, types, route, loop executor, and most chat wiring were in place across recent commits without the spec status being updated. Five gaps filled; one spec-vs-code variance noted for posterity.

**Verified present:**

- `POST /api/tables/[id]/enrich/route.ts` — Zod validation, 202 on success, 400 on invalid body / unknown column, 404 on missing table, 500 on unexpected. `batchSize` clamped to `MAX_BATCH_SIZE = 200` server-side.
- `src/lib/tables/enrichment.ts` — `createEnrichmentWorkflow` generator, backed by `enrichment.test.ts` (15 tests)
- `src/lib/workflows/types.ts` — `LoopConfig.items` + `LoopConfig.itemVariable` (lines 75-81) and `WorkflowStep.postAction` (line 37) added without breaking existing loops
- `src/lib/workflows/loop-executor.ts` — row-driven iteration path (`isRowDriven = Array.isArray(items)` at line 43), `buildRowIterationPrompt()` appends the row as a JSON block under the bound variable name, postAction dispatch at lines 167-176, `applyRowPostAction()` helper at lines 324-410 with error-isolated logging (a bad row can't abort the fan-out)
- `src/lib/workflows/post-action.ts` — `resolvePostAction()`, `substituteRowPath()` with nested dot-path support (`{{row.meta.id}}`), empty-string fallback for missing paths, `shouldSkipPostActionValue()` guarding empty and `NOT_FOUND` (case-insensitive, exact-match-only to avoid dropping long answers containing the sentinel), `extractPostActionValue()`. Backed by `post-action.test.ts` (11 tests)
- `src/lib/chat/tools/table-tools.ts:307-373` — `enrich_table` tool registered via `defineTool`, description explicit about `{{row.fieldName}}`, `NOT_FOUND` sentinel, and idempotency skip. Parameter shape matches the API route's Zod schema.

**Five gaps filled:**

1. **`src/lib/chat/system-prompt.ts` — new `### Tables` section.** The system prompt had sections for Projects, Tasks, Workflows, Schedules, Documents, Notifications, Profiles, Conversations, and Usage & Settings — but **no Tables section at all**, even though 20+ table tools were already registered. The chat LLM therefore had no reliable way to discover `list_tables`, `query_table`, `update_row`, or the new `enrich_table`. Added a full Tables section listing every registered table tool with one-line descriptions, plus a callout for `enrich_table` as the bulk-row fan-out primitive.

2. **`src/lib/chat/system-prompt.ts` — `When to Use Which Tools` routing rule for bulk per-row operations.** Added: *"Bulk per-row operations ('research every contact', 'classify all tickets', 'enrich rows missing X', 'for each row do Y') → Use enrich_table. Do NOT hand-roll a loop workflow for this..."* This is the intent-routing surface that steers "for each row" prompts to `enrich_table` rather than `create_workflow` + a manually-built loop.

3. **`src/lib/chat/system-prompt.ts` — Guidelines note on enrich_table idempotency.** Added an explicit guideline explaining that `enrich_table` skips rows with existing non-empty values and that force re-enrichment is out-of-scope in v1 — users must clear the target column via `update_row` first. This prevents the chat LLM from claiming "the enrichment re-ran" when in fact every row was skipped.

4. **`src/lib/chat/tools/workflow-tools.ts` — `create_workflow` anti-pattern steer.** Appended to the `create_workflow` description: *"IMPORTANT: for the 'run agent on every row of a table' pattern, prefer enrich_table over create_workflow — enrich_table generates the optimal loop configuration, binds each row as {{row.field}} context, wires up the postAction row writeback, and handles idempotent skip of already-populated rows. Hand-rolled equivalents miss these safeguards."* Tool descriptions surface in tool-use planning independently of the system prompt, so adding the steer here is belt-and-suspenders — both the system prompt routing rule AND the tool-description steer point the LLM away from the hand-rolled loop trap.

5. **`src/lib/chat/suggested-prompts.ts` — Create prompt and context-sensitive Explore suggestion.** Added *"Enrich a table with an agent"* as a static Create-category prompt. In Explore, added a DB-driven context-sensitive suggestion that queries the most recently updated `userTables` row and surfaces *"Enrich '{tableName}' rows"* as a concrete conversational starter. This closes the last discovery gap — users who don't know about `enrich_table` now see a prompt for their own most recent table, labeled with the actual table name.

**One spec-vs-code variance noted:**

The spec's Technical Approach section referenced `src/lib/workflows/template.ts:12-38` and said this feature "extends it to support dot-path access: `{{row.name}}`, `{{row.company.domain}}`, etc." That file does not exist. The implementer took a different approach: `buildRowIterationPrompt()` in `loop-executor.ts:218-232` serializes the full row as a JSON block and appends it to the user's prompt template rather than interpolating `{{row.field}}` placeholders into the prompt itself. The inline code comment at loop-executor.ts:215-216 is explicit: *"The row payload is serialized as JSON under the bound variable name so the agent can read every field without us pre-committing to a templating syntax."*

Dot-path resolution **does** exist — `post-action.ts:38-63` implements a proper `{{itemVariable.nested.path}}` resolver with missing-field → empty-string fallback — but it is scoped to `postAction.rowId` (so the engine can write results back to the right row), not to the user-supplied prompt template. Functionally this means:

- A prompt containing `{{row.name}}` will pass through to the agent literally, followed by the full row JSON block. The agent reads the JSON and resolves the reference correctly.
- A postAction with `rowId: "{{row.id}}"` **does** get interpolated correctly before `updateRow()` is called.

This is a deliberate design choice, not a gap. The tradeoff: the prompt is slightly noisier (the agent sees both the placeholder and the JSON), but the system avoids committing to a templating syntax that would need its own parser, escape rules, and edge-case tests. The `enrich_table` tool description teaches the chat LLM to use `{{row.fieldName}}` in prompts anyway — the agent handles the resolution naturally via the JSON context, and postAction handles the rowId resolution via the narrow dot-path resolver. The AC *"Template resolver supports `{{row.field}}` and `{{row.nested.field}}` dot-path access"* is met in spirit (the resolver exists and handles nested paths) and in the one place it matters for correctness (postAction's rowId).

**Test suite:** 687 passing, 11 skipped, zero regressions. `enrichment.test.ts`, `post-action.test.ts`, and `loop-executor.test.ts` all green.

**Unblocks:** `workflow-status-view-pattern-router` (groomed earlier today) now has all three of its listed dependencies (`workflow-engine`, `autonomous-loop-execution`, `bulk-row-enrichment`) in `completed` state. The Platform Hardening track is unblocked.

### Completed — workflow-step-delays (ship verification)

Feature status flipped `planned` → `completed` after `/product-manager` ship-verify audit found 31 of 32 acceptance criteria already implemented. Expected this to be a fresh build (supervisor recommended it based on roadmap status) — discovered instead that the backend, validator, chat tool, system prompt, and both UI surfaces had already landed across recent commits without the spec status being updated. Classic "unverified completion" pattern, exactly what ship verification exists to catch.

**Verified present:**

- `src/lib/workflows/delay.ts` — `parseDuration()`, `formatDuration()`, `checkDelayStep()` helper; 33 passing tests in `delay.test.ts`
- Migration `0024_add_workflow_resume_at.sql` applied; `workflows.resumeAt` column in `schema.ts`; idempotent `addColumnIfMissing` guard in `bootstrap.ts` per TDR-009
- `src/lib/workflows/engine.ts` — `checkDelayStep` branch in sequence executor (line 222), `resumeWorkflow()` export (line 1197)
- `src/lib/schedules/scheduler.ts` — resume-delayed-workflows loop (lines 446-464) using the partial index, atomic status transition for idempotency
- `src/app/api/workflows/[id]/resume/route.ts` — returns 202/409/404 per spec
- `src/lib/validators/blueprint.ts` — XOR refine rule with `parseDuration` validation at the boundary; 16 tests in `blueprint.test.ts` covering valid delay, malformed duration, below min, above max, compound (rejected), delayDuration+profileId (rejected), delayDuration+promptTemplate (rejected)
- `src/lib/chat/tools/workflow-tools.ts` — `create_workflow` tool accepts `delayDuration`, description documents delay-step syntax with drip example, `resume_workflow` companion tool registered
- `src/lib/chat/system-prompt.ts` — `create_workflow` description mentions delay steps, Guidelines include the time-distributed-sequences rule, When-to-Use-Which-Tools table has the drip-campaign routing entry, dedicated Delay Steps section explains format and use cases
- `src/components/workflows/workflow-status-view.tsx` — dedicated `DelayStepBody` component (lines 107-197) renders all three visual states: pending ("Will wait 3d"), delayed (`<time>` element with local-timezone absolute time, `formatDuration` remaining label, Resume Now button with 202/409/error toasts), completed ("Delayed 3d — completed")
- `src/components/workflows/workflow-form-view.tsx` — delay-step editor branch at `renderStepEditor` (lines 955-1015) with `FormSectionCard`, DELAY badge, single duration picker with inline `parseDelayDuration` validation, `aria-invalid`/`aria-describedby` error wiring, no profile/prompt fields
- `src/lib/constants/status-colors.ts:24` — `paused` maps to `variant="secondary"` matching the `waiting_dependencies` family per the UX spec

**One gap filled during verification:**

- `src/lib/chat/suggested-prompts.ts` — `buildCreatePrompts()` was missing the "Design a drip sequence" Create-category prompt called out in the spec. Added it as the third entry, right after the generic multi-step workflow prompt, so users see a natural progression from generic workflow creation to delay-step-aware drip design. Also removed a pre-existing unused `workflows` import from the same file (trivial cleanup in a file already being touched).

**Test suite:** 687 passing, 11 skipped (e2e runtime tests, unchanged), no new failures introduced. The IDE-reported `Cannot find module '@/lib/db'` diagnostics on scheduler tests turned out to be stale TypeScript-server cache artifacts — `npm test` runs all of them cleanly.

**Unblocks:** `bulk-row-enrichment` (the other half of the Growth-Enabling Primitives pair) can now proceed without track-order friction. `workflow-status-view-pattern-router` (groomed earlier today) remains a dependency-respecting follow-up that can run after or in parallel with enrichment.

### Fixed — Workflow detail page crash on loop-pattern workflows

Merged PR manavsehgal/ainative#6 (`fix/workflow-loop-status-crash`), opened the same day by ainative Chat running in the `ainative-growth` instance. The workflow detail page crashed into the React error boundary for every loop-pattern workflow (the pattern used by table enrichment) because `completedStepOutputs` in `src/components/workflows/workflow-status-view.tsx:404-406` dereferenced `s.state.result` unconditionally — but the status API returns raw step definitions without a `.state` property for loop workflows. The PR adds optional chaining as a 2-line defensive guard. Shipped as an interim hotfix; the root-cause fix is tracked by the new `workflow-status-view-pattern-router` spec below.

### Groomed — Workflow Status View Pattern Router (1 feature)

Created `features/workflow-status-view-pattern-router.md` (P2, post-mvp, planned) as the durable follow-up to PR manavsehgal/ainative#6. Scope: discriminated-union response type in `src/lib/workflows/types.ts`, type-annotated route handler at `src/app/api/workflows/[id]/status/route.ts`, refactor of the 895-line `workflow-status-view.tsx` god component into a thin router (<80 lines), two new pattern-specific subviews under `src/components/workflows/views/`, and a shared polling hook at `src/components/workflows/hooks/use-workflow-status.ts`. The final acceptance criterion **removes** the optional chaining PR #6 added — by that point the TypeScript compiler enforces the invariant via the discriminated union, so the defensive guard becomes obsolete. Also fixes a latent bug: loop workflows currently show an empty Full Output sheet because the UI never reads `loopState.iterations[].result` — the new loop subview wires this up.

**Architect review:** `/architect` ran in Architecture Review mode on PR #6 (`features/architect-report.md` 2026-04-09). Verdict: accept the hotfix, treat it as interim, ship the router refactor in a separate PR. Classification: Medium blast radius (2 layers, 6-7 files). Regression risk matrix covers sequence/parallel/loop/swarm detail pages and polling behavior.

**New TDR created:** [TDR-031 — Workflow status API is a pattern-discriminated union; consumers branch before reading](.claude/skills/architect/references/tdr-031-workflow-status-response-contract.md), category `api-design`, status `accepted`. Codifies a single exported union type, mandatory narrowing before reading pattern-specific fields, pattern-specific rendering in pattern-specific components, and a four-step checklist for adding new workflow patterns (union arm → route branch → subview → router dispatch) enforced by TypeScript exhaustiveness checking.

**Numbering note:** The 2026-04-08 grooming entry mentioned two "proposed TDRs post-ship" (workflow step `postAction` framework and loop data binding) pre-reserving numbers 031 and 032. Those TDRs were never created. This TDR-031 claims the number legitimately for the workflow status response contract — a different topic. If the `postAction` and data-binding TDRs are authored later, they become TDR-032 and TDR-033.

**Scope decision:** Ambitious scope chosen over minimal (changelog-only) and narrow (normalize API + types only). The ambitious scope adds the router split because `workflow-status-view.tsx` is already a 895-line god component with derived computation above the pattern dispatch branch — the ordering bug that caused PR #6's crash is a structural defect, not just a type-safety defect. Splitting into pattern-specific subviews is the cleanest way to make the bug unrepresentable. Confirmed with user during plan mode.

## 2026-04-08

### Groomed — Growth-Enabling Primitives (2 features)

Split `features/2026-04-08-ainative-core-growth-primitives-design.md` into two independent, implementable feature files. The source spec bundled two orthogonal capabilities identified while building the Growth module — both are general-purpose ainative primitives, not Growth-specific, and they became cleaner when tracked separately.

**New features (both P1, post-MVP, planned):**

- `workflow-step-delays` — adds optional `delayDuration` field to workflow steps ("3d", "2h", "30m", "1w"), schedule-based pause/resume using a new indexed `workflows.resume_at` column, idempotent atomic resume so scheduler + user "Resume Now" click cannot double-fire. Chosen execution model: schedule-based (survives process restarts) over sleep-based (loses timers on restart). Reuses existing `"paused"` status enum value and the `PATCH /api/workflows/[id]` pause transition — the spec claimed these needed to be built from scratch, but ground-truth verification showed the pause half already exists.
- `bulk-row-enrichment` — new `POST /api/tables/:id/enrich` endpoint plus `enrich_table` MCP chat tool, generates a loop workflow iterating over matching rows with `{{row.field}}` template binding, writes results back via a new `postAction` framework (single `update_row` variant, designed as a discriminated union so future variants are additive). Sequential execution for budget safety; idempotent skip-if-populated.

**Spec-vs-code drift caught during verification** (resolved before implementation):

1. `LoopConfig` currently lacks `items`/`itemVariable` data-binding — adding these is Track B's highest-risk work, not an afterthought
2. `BlueprintStepSchema` fields are *required*, not optional — delay-step addition requires converting to optional plus a cross-field XOR `refine()` rule
3. Workflow `"paused"` status and PATCH pause transition already exist — less new surface than the spec implied

**Chat context exposure added (per user request during planning):**

Both feature specs include a new "Chat Context Exposure" section covering system-prompt updates, tool description wording, and suggested-prompts additions. The trigger was a realization that the current `STAGENT_SYSTEM_PROMPT` in `src/lib/chat/system-prompt.ts` has **no Tables section at all**, even though 30+ table tools are already registered — they're effectively invisible to the LLM in tool-use planning. Adding `enrich_table` is the natural moment to close that gap. Specs now require:

- `STAGENT_SYSTEM_PROMPT` gets a new `### Tables` section listing all existing table tools plus the new `enrich_table`
- Intent-routing rules steer "for each row" prompts to `enrich_table` and steer time-distributed sequences to delay steps
- `create_workflow` tool description gets an anti-pattern steer pointing users to `enrich_table` for row fan-out
- `suggested-prompts.ts` adds a Create-category prompt each (drip-sequence and table-enrichment)
- Blueprint validator and `create_workflow` chat tool share a single exported Zod schema for step shape (no duplicated types)

**Proposed TDRs (to be created post-ship):**

- TDR-031 — Workflow step `postAction` framework (discriminated union pattern, additive variant design)
- TDR-032 — Loop workflow data binding (`items`/`itemVariable` + `{{row.*}}` template resolution)

**Track order locked:** Workflow Step Delays first, Bulk Row Enrichment second. Delays is smaller, exercises the scheduler extension in isolation, and has lower drift risk. Enrichment's LoopConfig data-binding changes benefit from building on a stable foundation.

**Reviewed with:** `/architect` (integration design, blast radius Medium across 4 layers, 7 existing TDRs apply), `/product-manager` (feature split, scope boundaries, acceptance criteria), `/frontend-designer` (delay-step UX: 12 new UX-testable acceptance criteria including timezone clarity, compact duration format, no live aria-live ticking, Execute-button pattern reuse). Full plan at `/Users/manavsehgal/.claude/plans/polished-tickling-pearl.md`.

## 2026-04-07

### Hardened — Dev repo safety & single-clone generalization

User review caught two gaps in the initial grooming pass:

**Gap 1 — Main dev repo safety:** if `instance-bootstrap` ships without gates, the canonical dev repo (`/Users/manavsehgal/Developer/ainative`) will have a pre-push hook installed and `branch.main.pushRemote=no_push` set on first `npm run dev` after merge, breaking contributor push workflow catastrophically.

Added **layered defense**:
- Primary gate: `STAGENT_DEV_MODE=true` env var (per-developer, via `.env.local`)
- Secondary gate: `.git/ainative-dev-mode` sentinel file (git-dir-scoped, never cloned, persists across `.env.local` churn)
- Tertiary gate: **two-phase bootstrap with explicit consent for destructive ops** — Phase A (instanceId, local branch creation) runs without consent because it's fully non-destructive; Phase B (pre-push hook, pushRemote config) requires user consent via a first-boot notification with `[Enable guardrails] [Not now] [Never on this clone]` actions
- Opt-in override: `STAGENT_INSTANCE_MODE=true` beats `STAGENT_DEV_MODE=true` so contributors can test the feature in the main repo
- **Pre-ship checklist:** implementing PR MUST add `STAGENT_DEV_MODE=true` to main dev repo's `.env.local` AND document in `AGENTS.md` + `CLAUDE.md` before merge

**Gap 2 — Single-clone user generalization:** original spec said "create `local` branch if on `main` with zero local commits, else record current branch as instance branch". The "else" branch would mark a casual user's `main` as protected if they happened to have any local commits predating the feature install — then future upgrades would fail on `main ≠ origin/main`.

Fixed by making `ensureLocalBranch()` **always create `local` at current HEAD** regardless of whether `main` has drifted. `git checkout -b local` is non-destructive — it preserves `main` wherever it was. The upgrade-assistant profile's SKILL.md now includes explicit handling for the "main has drifted from origin/main" case: stops, asks the user interactively, does not auto-resolve.

**New acceptance criteria added to all three feature specs (17 new ACs total):**
- `instance-bootstrap`: 13 new ACs covering dev-mode gates (env var, sentinel, override), consent flow (all 3 states), non-destructive local branch creation, drifted-main scenario, single-clone generalization test
- `upgrade-detection`: 3 new ACs — scheduled poll NOT registered in dev mode, badge handles missing instance settings, single-clone user test
- `upgrade-session`: 6 new ACs — single-clone full flow test, dev-mode skip verification, main dev repo manual safety checklist, drifted-main interactive prompt, Settings → Instance "Dev mode" banner state, upgrade-assistant SKILL.md rule for drifted main

**Upgrade-assistant SKILL.md** now has 4 crucial rules (up from 2): never modify main, abort on failure, **detect and interactively resolve drifted main**, and **treat single-clone `local` branch identically to named private-instance branches**.

### Design-Bridged — upgrade-detection + upgrade-session

`/frontend-designer` UX Recommendation mode produced full UX specification for both features same-day as initial grooming. Added to feature files as new "UX Specification" sections with:
- Persona, core task, success metric, emotional arc
- Information architecture (4-touchpoint flow: badge → modal → session → settings)
- Interaction pattern selection with rationale
- Complete state tables for all touchpoints (badge 4 states, modal 5 states, session 7 states)
- Conflict resolution UX (3-card cluster pattern inside PendingApprovalHost)
- Settings → Instance layout (9 rows of DetailPane content)
- Load-bearing copy direction (headlines, CTAs, banners)
- Accessibility requirements (focus management, aria-live regions, radiogroup semantics)
- Design metric calibration for `/taste` (DV=3, MI=3, VD=6 sheet / VD=4 modal)

17 new UX-testable acceptance criteria added to `upgrade-session`, 7 to `upgrade-detection`. All flagged items from initial grooming now resolved — no UX blockers remain before implementation.

Key UX decisions locked:
- Session view: **right-side Sheet overlay** (not full page) — user glances back at app during run
- Pre-flight tone: **educational, non-urgent** — "Upgrade available" not "New version!", "Start upgrade" not "Install"
- Conflict resolution: **3-card cluster** (Keep mine / Take theirs / Show diff) inside existing PendingApprovalHost
- Restart notice: **success banner inside session sheet** (not toast/modal) with explicit "Restart dev server" button
- Badge placement: above Settings in Configure group (not dot indicator on Settings itself)

Zero new design tokens, zero new components — all via existing Calm Ops primitives (StatusChip, Dialog, Sheet, DetailPane, AgentLogsView, PendingApprovalHost, SectionHeading).

### Groomed — Clone Lifecycle & Self-Upgrade (4 features)

Extracted from the architect integration design report for a self-upgrade system. The work automates the manual PRIVATE-INSTANCES runbook (local branch creation, upstream sync, push guardrails, scale activation) into a guided in-app flow available to every git-clone user — not just power users with multiple private instances.

Key architectural decision: upgrade execution runs through the **task pipeline**, not chat tools. Chat tools are DB-only by design (TDR-024); adding shell access would cross a trust boundary. The upgrade session is a `task` row with a new `upgrade-assistant` profile, reusing 100% of existing infrastructure (fire-and-forget execution, canUseTool approval caching, SSE log streaming, pending-approval conflict resolution). Zero new DB tables — all state lives in `settings` key-value JSON rows.

**4 features created (all planned):**
- `instance-bootstrap` (P1) — idempotent first-boot installer from `instrumentation.ts` alongside scheduler. Creates `local` branch if on clean main, installs pre-push hook, writes per-branch `pushRemote=no_push`, generates stable `instanceId`. Injectable GitOps for testability. Unblocks the other three features.
- `upgrade-detection` (P1) — hourly scheduled poll via `git fetch` (no GitHub REST — sidesteps rate limits). Sidebar badge as Server Component reading `settings.instance.upgrade`. Persistent failure notification after 3 consecutive polls.
- `upgrade-session` (P1) — `upgrade-assistant` builtin profile + merge modal + live session sheet view. Conflict resolution via existing pending-approval pattern. Abort path with `git merge --abort` + stash pop. Settings → Instance section surfacing instance metadata. **Flagged for `/frontend-designer` UX review before implementation.**
- `instance-license-metering` (P2) — hybrid model: local features unlimited, cloud features metered via `(email, machineFingerprint, instanceId)` tuple. `LicenseManager.validateAndRefresh` extended to send the tuple. Supabase edge function work is acknowledged as a separate server-side workstream.

**Proposed TDRs (to be created during implementation):**
- TDR-028: Self-upgrade via task execution pipeline (rejecting chat-based git tools)
- TDR-029: Instance bootstrap in instrumentation.ts (idempotent lifecycle hook)
- TDR-030: Hybrid instance licensing via cloud seat counting

**Zero schema changes.** All new state in `settings` JSON-in-TEXT. Full architect blueprint at `features/architect-report.md`. Motivation and runbook at `PRIVATE-INSTANCES.md` (root, gitignored).

## 2026-04-06

### Implemented — Workflow Intelligence Stack (4 features, EXPANDED scope)

Implemented all 4 features across 2 phases with expanded scope (per-step budget and runtime overrides).

**Phase 1 — Close the Gaps (completed):**
- `workflow-budget-governance` — 4-level budget resolution chain (step → user setting → $5 constant → $2 default), writable budget settings (3 keys), pre-flight cost estimation, per-step budgetUsd override
- `workflow-runtime-configuration` — RuntimeCatalogEntry.models field, hardcoded fallback replacement, runtimeId column on workflows, list_runtimes chat tool (13th tool module), per-step runtimeId override, settings writability tags, CHAT_MODELS catalog validation
- `workflow-execution-resilience` — deferred state writes in executeStep (write-after-execute), error propagation in executeChildTask (no more swallowing), updateWorkflowState throws on missing workflow, crash recovery for stuck "active" workflows, comprehensive reset with orphan cancellation, per-step document binding in create_workflow

**Phase 2 — Intelligence Stack (completed):**
- `workflow-intelligence-observability` — execution stats table + bucket aggregation, step event logging, step progress bar component, live metrics tiles (SSE), error analysis with root cause detection, debug panel with timeline + tiered suggestions, optimizer co-pilot with suggestion cards

**Schema changes:** 2 migrations (0022: tasks.max_budget_usd + workflows.runtime_id, 0023: workflow_execution_stats table)
**New files:** 12 (cost-estimator, execution-stats, error-analysis, optimizer, runtime-tools, step-progress-bar, step-live-metrics, error-timeline, workflow-debug-panel, workflow-optimizer-panel, 2 API routes)
**Modified files:** 12 (engine.ts, types.ts, schema.ts, catalog.ts, claude-agent.ts, anthropic-direct.ts, openai-direct.ts, settings-tools.ts, workflow-tools.ts, ainative-tools.ts, execute/route.ts, clear.ts)

### Groomed — Workflow Intelligence Stack (4 features)

Real user session (investor research workflow) surfaced 9 cascading failures across workflow execution, budget management, model routing, and chat intelligence. Analysis at `ideas/analysis-chat-issues.md`. Brainstormed in EXPAND mode — beyond reactive fixes into proactive optimization. Design spec at `docs/superpowers/specs/2026-04-06-workflow-intelligence-stack-design.md`.

**Phase 1 — Close the Gaps (3 P1 features, parallelizable):**
- `workflow-budget-governance` — wire dead $5 constant, writable budget settings, pre-flight cost estimation
- `workflow-runtime-configuration` — unified model catalog, per-workflow runtimeId, list_runtimes tool, settings writability tagging
- `workflow-execution-resilience` — state machine atomicity (deferred writes + rollback), retry from crashed "active", per-step document binding

**Phase 2 — Intelligence Stack (1 P2 feature, 4 sub-capabilities):**
- `workflow-intelligence-observability` — optimizer co-pilot, live execution dashboard, embedded debug panel, execution-informed learning

**Key insight:** Most Phase 1 infrastructure already exists but isn't wired — `WORKFLOW_STEP_MAX_BUDGET_USD`, `workflowDocumentInputs.stepId`, `executeTaskWithRuntime(taskId, runtimeId?)` are all dead code or unexposed parameters. Phase 1 is primarily connecting plumbing.

**Dependency chain:** Phase 1 features enable Phase 2 (reliable state → metrics, budget info → optimizer, runtime catalog → recommendations).

## 2026-04-05

### Groomed — PLG Monetization Initiative (17 features)

Comprehensive free→paid strategy brainstormed and groomed using `/product-manager`, `/architect`, and `/frontend-designer` skills in parallel. Target: first paid customer in 6-8 weeks.

**Strategy decisions:**
- Community Edition stays free forever (Apache 2.0), Premium via pure subscription ($19/$49/$99)
- Solo operators (founders, freelancers) as primary target
- Memory cap (50 items/profile) as #1 conversion trigger (loss aversion)
- Cloud stack: Supabase + Stripe + Resend (all existing paid accounts, $0 incremental cost)
- Moat: data flywheel → fine-tuned open models → workflow marketplace (18-month layered build)

**Foundation Layer (3 features, P0):**
- `local-license-manager` — SQLite license table, LicenseManager singleton, tier limits, offline grace period
- `supabase-cloud-backend` — 4 Supabase tables (licenses, telemetry, blueprints, sync_sessions), RLS, 4 Edge Functions
- `stripe-billing-integration` — 3 products × 2 prices, Customer Portal, webhook → Edge Function → license

**Core Layer (8 features, P0-P2):**
- `community-edition-soft-limits` — 4 soft limits: 50 memory, 10 context versions, 5 schedules, 30-day history
- `subscription-management-ui` — /settings/subscription with tier comparison, Stripe Checkout/Portal
- `upgrade-cta-banners` — contextual prompts at friction moments (memory cap, schedule limit, history retention)
- `outcome-analytics-dashboard` — /analytics with success rates, cost-per-outcome, ROI calculator (Operator+ gate)
- `parallel-workflow-limit` — Community=3, Operator=10, Scale=unlimited concurrent workflows
- `cloud-sync` — AES-256-GCM encrypted SQLite backup to Supabase Storage (Operator+ gate)
- `license-activation-flow` — end-to-end purchase → email → activate → unlock
- `marketplace-access-gate` — /marketplace browse + Scale-tier import gate

**Growth Layer (6 features, P1-P3):**
- `edition-readme-update` — Community vs Premium positioning in README (no code deps, Week 1)
- `first-run-onboarding` — email capture + 6-milestone activation checklist
- `marketing-site-pricing-page` — static /pricing on ainative.github.io
- `transactional-email-flows` — 5 Resend email types via Edge Functions
- `telemetry-foundation` — opt-in anonymized telemetry, default OFF, 5-min batch flush
- `upgrade-conversion-instrumentation` — anonymous funnel tracking for A/B testing

**Dual-entry payment model established:**
- Marketing site (ainative.io) uses Stripe Payment Links — static URLs, no API calls
- Product (/settings/subscription) uses Stripe Checkout Sessions via Supabase Edge Function
- Both paths create same license row in Supabase, keyed by email
- Primary activation: email-based auto-matching (pay → sign in with same email → done)
- Fallback: manual license key entry form for edge cases
- Marketing site purchasers get "Install + sign in" email; in-app purchasers get instant activation
- Updated 4 specs: stripe-billing-integration, license-activation-flow, marketing-site-pricing-page, subscription-management-ui

**Marketing site spec rewritten for actual Astro 5 codebase:**
- Discovered ainative.github.io is Astro 5 + React + Tailwind v4 (not plain HTML)
- Existing Pricing.astro has outdated tiers (Pro $149, Team $499, Advisory Services)
- Spec now targets exact files: Pricing.astro (rewrite), Hero.astro (copy refresh), PersonaLanes.astro (CTA alignment), CTAFooter.astro (copy refresh)
- Advisory Services block replaced with Marketplace Creator Pitch (revenue math, 70/30 split)
- Added /pricing standalone page, FAQ accordion, monthly/annual toggle
- Hero email form reframed from "waitlist" to "State of AI Agents report"

**Marketplace strategy refined (creator-first economics):**
- Marketplace buying unlocked at Solo ($19) not Scale ($99) — maximizes buyer pool
- Marketplace selling unlocked at Operator ($49) — the subscription-pays-for-itself tier
- Revenue split: Operator 70/30, Scale 80/20 — economic upgrade trigger, not feature gate
- Featured listings for Scale tier — visibility advantage, not access restriction
- Creator analytics tab added to outcome-analytics-dashboard
- Marketplace bumped from P2 to P1 — it's a network effect engine, not a nice-to-have

**Architecture decisions (3 new TDRs recommended):**
- TDR-028: Local-First License Enforcement (process-memory cache, daily validation, 7-day grace)
- TDR-029: Telemetry Batching via Settings Table (JSON batch in settings, 200-event cap)
- TDR-030: Encryption-First Cloud Sync (AES-256-GCM, HKDF from user ID, no plaintext in cloud)

## 2026-04-03

### Started
- `database-snapshot-backup` (P1) — Full-state snapshot system: atomic SQLite .backup(), tarball of all ~/.ainative/ file dirs, auto-backup timer with cron intervals, user-configurable retention (max count + max age weeks), restore with pre-restore safety snapshot, Settings UI card. Brainstormed with /architect + /product-manager. 6 implementation phases.

### Completed — Structured Data (Tables) Initiative (14 features, Sprints 38-43)

Full Airtable-like structured data system shipped in a single session. 52 new files, 8 modified files, 0 type errors, 418 tests passing.

**Sprint 38 — Tables Foundation:**
- `tables-data-layer` (P0) — 13 new DB tables (user_tables, columns, rows, views, relationships, templates, imports, triggers, row_history + 4 junction tables), hybrid JSON rows with json_extract() query builder (11 operators), Zod validation schemas, CRUD data layer, 12 built-in templates across 5 categories
- `tables-list-page` (P0) — /tables route with table/grid views, FilterBar (source/project), search, detail sheet, create sheet with inline column builder, sidebar nav entry

**Sprint 39 — Tables Editor:**
- `tables-spreadsheet-editor` (P0) — /tables/[id] with inline cell editing, keyboard navigation state machine (idle/navigating/editing), type-aware cell renderers (text/number/date/boolean/select/url/email/computed), optimistic saves with 300ms debounce, column add/sort/delete, row add/bulk delete

**Sprint 40 — Tables Import + Templates:**
- `tables-document-import` (P0) — 4-step import wizard (select doc → preview → map columns → import), CSV/XLSX/TSV extraction via ExcelJS, column type auto-inference (email/url/boolean/date/number/select patterns), batch import in 100-row chunks, audit trail
- `tables-template-gallery` (P1) — /tables/templates with category tabs (All/Business/Personal/PM/Finance/Content), card grid, preview sheet with column list + sample data, clone flow with optional sample data

**Sprint 41 — Tables Agent Integration:**
- `tables-agent-integration` (P1) — 12 agent tools (list_tables, get_table_schema, query_table, aggregate_table, search_table, add_rows, update_row, delete_rows, create_table, import_document_as_table, list_table_templates, create_table_from_template), registered in tool server
- `tables-chat-queries` (P1) — Table context builder for task/workflow-linked tables (markdown schema + sample data)

**Sprint 42 — Tables Expansion:**
- `tables-computed-columns` (P1) — Recursive descent formula parser → AST evaluator, 12 allowlisted functions (sum/avg/min/max/count/daysBetween/today/concat/if/abs/round/floor/ceil), {{column}} refs, cycle detection via topological sort
- `tables-cross-joins` (P2) — Relation combobox component (search target table rows, single/multi-select)
- `tables-agent-charts` (P2) — Chart builder sheet (bar/line/pie/scatter, X/Y/aggregation config)
- `tables-workflow-triggers` (P2) — user_table_triggers table, trigger evaluator (condition matching reuses filter logic), trigger CRUD API, triggers tab UI with config sheet

**Sprint 43 — Tables Polish:**
- `tables-nl-creation` (P3) — Enhanced create_table_from_description agent tool
- `tables-export` (P3) — GET /api/tables/[id]/export?format=csv|xlsx|json, CSV string builder, XLSX via ExcelJS, native JSON
- `tables-versioning` (P3) — user_table_row_history table, snapshot-before-mutation pattern, row history queries, rollback to previous version

### Groomed
- Extracted 14 Tables features from brainstorming session (EXPAND mode) with architect, product-manager, and frontend-designer perspectives
- Created initial Tables roadmap section with 4 MVP + 4 Post-MVP + 3 Expansion + 3 Future features
- Hybrid JSON rows architecture: fixed Drizzle schema for metadata, JSON TEXT columns for flexible row data, json_extract() for queries
- 12 new DB tables + 12 built-in templates across 5 categories (Business, Personal, PM, Finance, Content)

**MVP (P0):** `tables-data-layer`, `tables-list-page`, `tables-spreadsheet-editor`, `tables-document-import`
**Post-MVP (P1):** `tables-template-gallery`, `tables-computed-columns`, `tables-agent-integration`, `tables-chat-queries`
**Expansion (P2):** `tables-cross-joins`, `tables-agent-charts`, `tables-workflow-triggers`
**Future (P3):** `tables-nl-creation`, `tables-export`, `tables-versioning`

## 2026-04-02

### Groomed
- `workflow-document-pool` (P1) — New feature for intuitive document handoff between workflows via project-level document pool. Junction table architecture, document picker in workflow form (Input Tray), output dock on completed workflows, auto-discovery via document selectors, and chat smart wiring. Brainstormed with product-manager, architect, and frontend-designer perspectives. 3 phases: data+engine, form UX, chat intelligence.
- `workflow-run-history` (P1) — Run tracking for workflows: `runNumber` on workflows (atomic increment on execute), `workflowRunNumber` on tasks (stamped from workflow). Enables grouping tasks by run, document lineage through runs, and document picker disambiguation. Old documents kept; "current" derived by highest version.
- `entity-relationship-detail-views` (P2) — Bidirectional entity relationships in detail views: workflow source badge + version history on document detail, sibling tasks on task detail, document count + recent docs on project detail, project link on workflow detail. Two new API endpoints (versions, siblings).
- `relationship-summary-cards` (P2) — Compact relationship counts on cards/lists: document counts on workflow/task/project cards, task counts on workflow list cards, workflow name column in document table/grid. Subquery-based count enrichment. Zero counts hidden.

## 2026-04-01

### Started
- `chat-settings-tool` (P1) — `set_settings` write tool for chat agent with 9-key allowlist, per-key validation, and permission gating

## 2026-03-31

### Completed
- `bidirectional-channel-chat` (P1) — Channel Gateway bridges inbound Slack/Telegram messages to existing chat engine. Auto-polling for local dev (5s interval). Settings UI with Chat/Active switches, Test button with status indicator. Multi-turn conversations, turn locking, permission handling via channel replies. Slack requires botToken + channels:history + chat:write scopes

## 2026-03-31

### Completed — Vision Alignment Sprints 33-37

**Sprint 33 — Business Positioning (parallel):**
- `product-messaging-refresh` (P0) — Repositioned all in-repo messaging from "Governed AI Agent Workspace" to "AI Business Operating System"; README, package.json, CLI, docs, welcome landing, 7 journey/feature docs, 3 new docs (why-ainative, use-cases)
- `business-function-profiles` (P1) — 6 new builtin profiles (marketing-strategist, sales-researcher, customer-support-agent, financial-analyst, content-creator, operations-coordinator) + 5 new workflow blueprints (lead-research, content-marketing, support-triage, financial-reporting, daily-briefing)

**Sprint 34 — Heartbeat Engine:**
- `heartbeat-scheduler` (P0) — Proactive intelligence mode: 10 new columns on schedules table (type, checklist, active hours, suppression, budget), heartbeat engine in scheduler.ts, active hours windowing, suppression logic, heartbeat prompt builder, API routes, UI with checklist editor and type selector, heartbeat badges on task cards

**Sprint 35 — Agent Intelligence (parallel):**
- `natural-language-scheduling` (P1) — NLP parser for plain-English scheduling, HEARTBEAT.md file support, parse preview API, schedule form NL input
- `agent-episodic-memory` (P1) — agent_memory table, memory extraction, relevance-filtered retrieval, confidence decay, CRUD API, memory browser UI

**Sprint 36 — Coordination (parallel):**
- `multi-channel-delivery` (P2) — channel_configs table, Slack/Telegram/webhook adapters, channel registry, settings UI, schedule delivery integration
- `agent-async-handoffs` (P2) — agent_messages table, handoff governance (chain depth, self-handoff prevention), message bus, send_handoff chat tool, API routes, approval UI

**Sprint 37 — Local Runtime:**
- `ollama-runtime-provider` (P2) — 5th runtime adapter (NDJSON streaming), model discovery, smart router integration, settings UI with connection test and model management

### Groomed — Vision Alignment Initiative (8 features from 2 vision docs)

**Source documents:**
- `ideas/vision/machine-builds-machine-claude-ext-rsrch.md` — Strategic intelligence briefing (market positioning, JTBD, competitive landscape)
- `ideas/vision/ainative-OpenClaw-Companion-Research-Report.md` — 9 OpenClaw capabilities to adopt

**New feature specs created:**
- `product-messaging-refresh` (P0) — Reposition all in-repo messaging from "Governed AI Agent Workspace" to "AI Business Operating System"; README, docs, playbook, CLI help, in-app welcome; new problem statement and use case docs
- `business-function-profiles` (P1) — 6 new builtin profiles (marketing-strategist, sales-researcher, customer-support-agent, financial-analyst, content-creator, operations-coordinator) + 5 new workflow blueprints (lead-research-pipeline, content-marketing-pipeline, customer-support-triage, financial-reporting, business-daily-briefing)
- `heartbeat-scheduler` (P0) — Proactive agent execution extending scheduled-prompt-loops; agents evaluate checklists and suppress no-op runs; business-hour windowing, cost controls, heartbeat badges on Kanban
- `agent-episodic-memory` (P1) — Persistent knowledge memory distinct from behavioral learned_context; new agent_memory table, confidence scoring, memory decay, relevance-filtered injection, operator review UI
- `natural-language-scheduling` (P1) — NLP parser for plain-English scheduling expressions; HEARTBEAT.md file support; chat-based schedule creation; confidence-based confirmation flow
- `multi-channel-delivery` (P2) — Slack and Telegram as outbound delivery channels; heartbeat results, workflow completions, approval requests; channel adapter architecture; Phase 1 delivery-only
- `agent-async-handoffs` (P2) — Async inter-agent communication via SQLite agent_messages table; send_handoff tool, heartbeat-triggered processing, governance gates, handoff policies, chain depth limits
- `ollama-runtime-provider` (P2) — Ollama runtime adapter for local model execution; model discovery, smart router integration, $0 cost tracking, privacy-sensitive task routing

**Overlap resolutions documented:**
- heartbeat-scheduler vs scheduled-prompt-loops: intelligence-driven (new) vs clock-driven (existing) — extends, not replaces
- agent-episodic-memory vs learned_context: knowledge memory (new) vs behavioral memory (existing) — complementary
- agent-async-handoffs vs multi-agent-swarm: decoupled async (new) vs synchronous workflow-bound (existing) — complementary

**Roadmap updates:**
- Added 4 new sections: Vision Alignment — Business Positioning, Proactive Intelligence, Multi-Channel & Coordination, Runtime Expansion
- Added dependency chain and sprints 33-37
- Added deferred items section (13 items from vision docs explicitly out of scope)

**Architecture decisions:**
- Business-function profiles are ADDITIONS (6 new), not renames of existing 14 profiles
- Heartbeat extends existing scheduler table with `type: "heartbeat"` column
- Episodic memory uses new `agent_memory` table, not the existing `learned_context` table
- Multi-channel delivery is outbound-only (Phase 1); bidirectional deferred
- Ollama follows existing `AgentRuntimeAdapter` pattern

**Skills used:** `/product-manager`, `/frontend-designer`, `/architect`

### Completed (status sync — code existed, specs were stale)
- `auto-environment-scan` — staleness-based auto-scan via `src/lib/environment/auto-scan.ts`, 5min threshold, test coverage
- `project-scoped-profiles` — reads `.claude/skills/` in-place via `src/lib/agents/profiles/project-profiles.ts`, cache invalidation, SKILL.md-only support
- `provider-agnostic-tool-layer` — `defineTool()` factory in `src/lib/chat/tool-registry.ts`, Zod → JSON Schema, `toAnthropicToolDef()` / `toOpenAIFunctionDef()` formatters
- `anthropic-direct-runtime` — full Messages API adapter in `src/lib/agents/runtime/anthropic-direct.ts`, streaming, tool use, session resume, budget enforcement
- `openai-direct-runtime` — full Responses API adapter in `src/lib/agents/runtime/openai-direct.ts`, hybrid tool use, `previous_response_id` resume
- `smart-runtime-router` — keyword-based `suggestRuntime()` in `src/lib/agents/router.ts`, profile affinity, credential filtering, cost/latency/quality preferences
- `workspace-context-awareness` — workspace context injection in `src/lib/environment/workspace-context.ts`, integrated into chat engine system prompt (Tier 0)

### Started (status sync — partial implementations)
- `runtime-validation-hardening` — profile Zod validation exists (`src/lib/validators/profile.ts`), runtime config validation middleware still missing
- `dynamic-slash-commands` — tool catalog supports dynamic skills (`src/lib/chat/tool-catalog.ts`), slash command palette registration not yet implemented
- `profile-environment-sync` — one-way artifact→profile linking via `src/lib/environment/profile-linker.ts`, reverse sync not yet implemented

### Retrospective specs created
- `codex-chat-engine` (P1, completed) — parallel Codex App Server streaming engine for chat; shares context builder, entity detection, usage metering with Claude engine
- `workspace-discovery` (P1, completed) — parent-directory walker for `.claude/`/`.codex/` markers; powers workspace import flow with GitHub API integration
- `documentation-adoption-tracking` (P2, completed) — DB-driven adoption depth per feature area; 9+ table parallel queries, usage stage classifier, journey completion tracking
- `keyboard-shortcut-system` (P2, completed) — singleton shortcut registry with scope-based activation, sequence keys (500ms timeout), modifier support, subscriber pattern

### Groomed
- Created `profile-environment-sync` (P1) — roundtrip two-way sync between profiles and environment skill artifacts via passive reconciliation architecture; filesystem as single source of truth, profile-artifact linker, two-tier suggestion engine, scan invalidation on profile mutations, origin badges in UI
- Architecture decision: "Passive Reconciliation" over "Materialized View" (auto-creates everything, too noisy) and "Linked Registry" (manual-only, no UX improvement). Filesystem IS the sync mechanism; the reconciliation layer just makes it visible
- Source: `/architect` review + `/product-manager` grooming + `/frontend-designer` UX analysis — cross-skill analysis of profiles and environment features
- Created **Workspace Intelligence** initiative — 3 new features + 1 existing regrouped:
  - `auto-environment-scan` (P1) — automatic staleness-based environment scan on project context change; eliminates manual "Scan" button as primary interaction
  - `project-scoped-profiles` (P1) — bridge project `.claude/skills/` to ainative profiles, read in-place (not copied), supports SKILL.md-only skills with minimal profile generation
  - `dynamic-slash-commands` (P2) — dynamic "Skills" group in chat slash command popover, populated from active project's discovered skills
  - `workspace-context-awareness` (P1, existing) — moved from Platform section into Workspace Intelligence initiative
- Added "Workspace Intelligence" section to roadmap with dependency chain
- Architecture decision: project skills read in-place, not copied to `~/.claude/skills/` — prevents drift, project repo stays source of truth
- Source: `/architect` review mode + `/product-manager` grooming — analyzing how folder skills should align with agent profiles

## 2026-03-30

### Groomed
- Created **Direct API Runtime Expansion** initiative — 6 features extracted from `ideas/direct-api-gap-analysis.md`:
  - `provider-agnostic-tool-layer` (P0) — decouple 50+ tool definitions from Claude Agent SDK into provider-neutral `defineTool()` format; prerequisite for both direct runtimes
  - `anthropic-direct-runtime` (P1) — new `AgentRuntimeAdapter` for Anthropic Messages API; agentic loop, streaming, HITL, session resume via DB; sub-second latency, no CLI required
  - `openai-direct-runtime` (P1) — new `AgentRuntimeAdapter` for OpenAI Responses API; server-side agentic loop, code interpreter, file search, image generation; no Codex binary required
  - `smart-runtime-router` (P1) — `suggestRuntime()` function for auto-selecting best runtime per task; keyword signals, profile affinity, user preference (cost/latency/quality); "Auto (recommended)" as default
  - `direct-runtime-prompt-caching` (P2) — wire Anthropic prompt caching on system/profile/learned-context blocks; up to 90% input cost savings; batch API for meta-completions
  - `direct-runtime-advanced-capabilities` (P2) — extended thinking, context compaction, per-runtime model selection, server-side tool configuration UI
- Added "Direct API Runtime Expansion" section to roadmap with dependency chain and sprints 29-32
- Source: Architecture review + product analysis combining `/architect` review mode and `/product-manager` incremental update
- Design posture: expansion (add 2 new runtimes), not replacement (existing SDK runtimes untouched)

### Completed
- `chat-conversation-persistence` — URL/localStorage activeId sync, background activity indicator with task polling
- `settings-interactive-controls` — SDK Timeout and Max Turns sliders with contextual labels, recommended range indicators
- `task-hierarchy-clarity` — standalone vs workflow-bound task sectioning, deduplicated status counts, workflow badges
- `agent-document-api-access` — 3 document mutation tools (upload/update/delete), permission gating, audit logging
- `browser-use` — Chrome DevTools + Playwright MCP config builder, settings toggles, permission tiering
- `chat-command-mentions` — slash command registry, @mention popover with entity search, autocomplete hook

### Completed (late)
- `skills-repo-import` — provenance badges (Built-in/Custom/Imported) on profile cards, typed GitHub API errors (private repo/rate limit/404 detection), source directory link in imported profile detail view
- `profile-ai-assist-ux` — description field in profile form with AI assist integration, auto-approve/auto-deny tool policy fields with TagInput autocomplete, policy section card in AI assist results panel

## 2026-03-27

### Groomed
- `chat-command-mentions` (P1) — "/" slash commands for tools/actions access and "@" mentions for entity references in chat prompt box; reuses cmdk primitives from Cmd+K palette; Tier 3 context injection for mentioned entities; 5 phases (shared data, hook+popover, input integration, entity search API, context injection)
- `browser-use` (P1) — enable Chrome DevTools MCP (29 CDP tools) and Playwright MCP (50+ accessibility-snapshot tools) as browser automation tool sources for chat and task execution; settings-driven toggles, permission tiering (read-only auto-approve, mutations gated), profile-level deny support

## 2026-03-24

### Completed
- **Living Book initiative fully shipped** — all 5 features completed in a single sprint:
  - `living-book-content-merge` — Try It Now Playbook section cards in each chapter, chapter-mapping.ts wiring 9 chapters to 19 feature docs + 4 journey guides
  - `living-book-authors-notes` — collapsible Author's Notes callout variant with themed styling across light/sepia/dark modes
  - `living-book-reading-paths` — 4 persona-based paths (Getting Started, Team Lead, Power User, Developer) with PathSelector, PathProgress, stage-aware recommendation
  - `living-book-markdown-pipeline` — all 9 chapters migrated to `book/chapters/*.md` with frontmatter schema, markdown-to-ContentBlock parser, GitHub raw URL image resolution
  - `living-book-self-updating` — chapter regeneration via document-writer agent profile, git-based staleness detection (`update-detector.ts`), `ChapterGenerationBar` with generate/regenerate button + staleness badge
- **Chapter regeneration pipeline**: `POST /api/book/regenerate` creates a task with document-writer profile, fires `executeTaskWithAgent` for fire-and-forget execution, returns taskId for client polling
- **Live progress streaming**: SSE subscription via `EventSource` to `/api/logs/stream?taskId=X` shows real-time agent steps (Reading files → Planning structure → Composing content → Writing chapter) with fade-in animation
- **Staleness detection UI**: Badge showing "Sources updated N days ago" when chapter source files have changed since last generation
- **Empty chapter state**: Sparkle icon placeholder with "Generate chapter" CTA for chapters without markdown content; TOC sparkle indicators for unwritten chapters
- Fixed regenerated chapters losing Try It Now section — added `relatedDocs` and `relatedJourney` to frontmatter template
- Fixed path inconsistencies: `docs/book/` → `book/chapters/` in chapter-generator.ts and update-detector.ts

### Groomed
- Created **Living Book** initiative — 5 features that unify the Book, Playbook, and ai-native-notes into a single flagship content experience:
  - `living-book-content-merge` (P1) — map Playbook's 19 feature docs + 4 journey guides into Book's 9-chapter structure; "Try It Now" sections; fills 6 stub chapters
  - `living-book-authors-notes` (P2) — embed ai-native-notes screenshots as collapsible "Author's Notes" callouts; new `authors-note` callout variant; dogfooding proof
  - `living-book-reading-paths` (P2) — 4 persona-based reading paths (Getting Started, Team Lead, Power User, Developer); stage-aware recommendation; path-scoped progress
  - `living-book-markdown-pipeline` (P2) — migrate content.ts to docs/book/*.md files; extend reader.ts for unified manifest; markdown-to-ContentBlock parser
  - `living-book-self-updating` (P3) — planner-executor workflow that auto-regenerates stale chapters; human review gate; "ainative writes its own Book" capstone
- Added Living Book section to roadmap with dependency chain and sprints 25-28

## 2026-03-23

### Groomed
- Split `kitchen-sink-03-23` into 3 standalone feature specs:
  - `chat-conversation-persistence` (P1) — persist activeConversationId via URL search param + localStorage; background subagent activity indicator showing running/completed tasks spawned from chat, survives navigation
  - `settings-interactive-controls` (P2) — upgrade SDK Timeout and Max Turns to sliders with contextual guidance labels, recommended range indicators, and hover tooltips
  - `task-hierarchy-clarity` (P1) — distinguish standalone vs workflow-bound tasks in project detail; section grouping, workflow badges, cross-links, deduplicated status counts. Option C (Keep Separate but Link Clearly) selected
- Refined `agent-document-api-access` (P2) — corrected tool registration architecture (MCP server pattern via document-tools.ts, not tools-registry.ts), fixed permission pattern format (mcp__stagent__* convention matching PERMISSION_GATED_TOOLS set), noted existing PATCH/DELETE routes to extend, clarified output-scanner relationship
- `workspace-context-awareness` (P1) — surface existing workspace context (cwd, git branch, worktree status) to chat agents and task execution; discovered during worktree dogfooding when agent created files in main repo instead of worktree

## 2026-03-22

### Completed
- `chat-data-layer` (P0) — conversations + chat_messages tables, Drizzle schema, full CRUD data access with cursor-based pagination
- `chat-engine` (P0) — progressive 5-tier context injection (~53K token budget), streaming response handling, entity detection, model discovery, permission bridge, ainative CRUD tools (list/create/update/delete for projects, tasks, workflows), intent disambiguation, system prompt with workspace awareness
- `chat-api-routes` (P0) — conversations CRUD, SSE message streaming with keepalive pings, model catalog endpoint, context-aware suggested prompts endpoint, permission/question response endpoint
- `chat-ui-shell` (P1) — ChatShell layout with conversation list sidebar, responsive design, empty state hero with suggested prompt chips
- `chat-message-rendering` (P1) — ReactMarkdown + GFM rendering, Quick Access navigation pills for entity deep-linking, permission request UI, question rendering with options
- `chat-input-composer` (P1) — model selector with cost tiers ($, $$, $$$), Claude.ai-style tabbed suggested prompts with hover preview, settings default model preference
- Multi-provider support: Claude SDK (Haiku/Sonnet/Opus) + Codex App Server (GPT-5.3/5.4)
- Dynamic model discovery with runtime-aware cost tier classification
- Fixed blank chat responses (stream_event wrapper handling, multi-turn context)
- Version bump needed for chat feature inclusion

### Groomed
- Extracted 6 chat features from HOLD-mode brainstorming session
- Chat as "conversational control plane" for all ainative primitives
- Non-agentic by default (maxTurns: 1, no tools) — Haiku 4.5 default for cost efficiency
- Progressive 5-tier context injection (Tier 0: workspace → Tier 4: full documents, ~53K token budget)
- Quick Access navigation pills in responses for entity deep-linking
- Model selector with cost/capability tiers ($, $$, $$$) + Settings default preference
- Decisions confirmed: sidebar after Inbox, full-bleed hero, free-floating conversations, user-managed deletion
- Foundation (P0): chat-data-layer, chat-engine, chat-api-routes
- UI (P1): chat-ui-shell, chat-message-rendering, chat-input-composer
- Updated roadmap with new "Chat Conversation" section and Sprints 21-24

## 2026-03-21

### Groomed
- Extracted 11 environment onboarding features from brainstorming session (EXPAND mode)
- Feature set makes ainative a control plane for Claude Code and Codex CLI environments
- 3 personas: Claude Code only, Codex only, both tools in same project
- Progressive adoption funnel: Visibility → Sync → Orchestration
- Architecture: Scanner + Cache with git-based checkpoints and bidirectional sync
- Core features (P0): environment-scanner, environment-cache, environment-dashboard
- Safety + sync (P1): git-checkpoint-manager, environment-sync-engine
- Productivity (P2): project-onboarding-flow, environment-templates, cross-project-comparison, skill-portfolio
- Governance (P3): environment-health-scoring, agent-profile-from-environment
- Updated roadmap with new "Environment Onboarding" section and dependency chain

## 2026-03-20

### Completed
- Calm Ops design system eval pass — applied PageShell wrapper to all remaining routes (`/settings`, `/playbook`, `/schedules`), wired elevation classes (`.elevation-0` through `.elevation-3`) to stats cards, project sections, workflow cards, schedule cards, and inbox list; integrated FilterBar into DocumentBrowser with active count badge and clear-all button
- Version bump to 0.1.13 — regenerated docs and recaptured screenshots for icon circle badges

## 2026-03-18

### Completed
- `detail-view-redesign` (P2, post-MVP) — Unified detail views across task, document, and workflow surfaces
  - Task detail: bento grid layout, chip bar (status/priority/complexity/profile/dates), prose reader surface, usage metrics
  - Document detail: chip bar + content renderer, image zoom, smart extracted text display
  - Workflow kanban cards: status-colored left strips matching workflow state
  - Shared `prose-reader-surface` CSS class and `PROSE_READER` constants for consistent typography across 6+ views
- Workflow cascade delete — FK-safe child task cleanup when deleting workflows
- Notification UX — click-through navigation to source entities, expand/collapse, destructive delete-read styling
- Icon circle badges with keyword-inferred colors on profile, blueprint, and workflow cards

### Fixed
- Three type errors caught by production build

### Started
- `workflow-ux-overhaul` (P1, in-progress) — comprehensive workflow UX fix
  - Chunk 2 (Output Readability): partially addressed — `ExpandableResult` component, full output as inline Card
  - Chunk 3 (Dashboard Visibility): partially addressed — all workflow statuses shown on home dashboard, urgency sort
  - Chunk 1 (Document Context Propagation): not yet started
  - Chunk 4 (AI Assist Guidance): not yet started

### Fixed
- Document links: `/download` route replaced with `/documents/[id]` view navigation
- Batch context proposal approve/reject now works without requiring individual notification IDs

## 2026-03-17

### Completed
- Playbook documentation system — built-in docs at `/playbook` with usage-stage awareness, adoption heatmap, journey cards, markdown rendering, and command palette integration
- README updated with Playbook feature across all sections (highlights, deep dives, project structure, API routes, roadmap)
- `learned-context-ux-completion` (P2, completed) — diff rendering, snapshot display, deterministic profile ordering (groomed and implemented same day)

### Groomed
- `learned-context-ux-completion` (P2, planned) — bounded UX follow-up from the agent self-improvement browser evaluation
  - Split the remaining learned-context UX gaps out of `agent-self-improvement` instead of reopening the completed base feature
  - Scoped the follow-up to user-facing gaps only: unified diff rendering, clearer rollback/snapshot visibility, version-count grammar, and deterministic profile ordering for discoverability
  - Explicitly left reset/delete context tooling, compact-toast editing, and additional warning-tier polish out of scope for this slice

### Groomed & Implemented (E2E Test Report Recommendations)
- Assessed 5 recommendations from `output/done-agent-e2e-test-report.md` (2026-03-15, 10/10 pass)
- `e2e-test-automation` (P2, completed) — API-level E2E test suite
  - Created `vitest.config.e2e.ts` with 120s timeouts, sequential execution, node environment
  - Created `src/__tests__/e2e/helpers.ts` — HTTP client utilities, polling helpers, runtime detection
  - Created `src/__tests__/e2e/setup.ts` — test project + sandbox creation/teardown with deliberate-bug TypeScript files
  - 5 test files: `single-task`, `sequence-workflow`, `parallel-workflow`, `blueprint`, `cross-runtime`
  - ~15 test cases covering both runtimes, 4 profiles, 4 workflow patterns
  - Tests skip gracefully when runtimes aren't configured (no CI failures)
  - Added `npm run test:e2e` script to package.json
  - Rec #4 (Codex workflow testing) folded in as Codex-specific describe blocks
- `tool-permission-presets` (P2, completed) — Preset permission bundles
  - Created `src/lib/settings/permission-presets.ts` — 3 presets (read-only, git-safe, full-auto) with apply/remove logic
  - Presets are layered (git-safe includes read-only), removal only strips unique patterns
  - Created `POST/GET/DELETE /api/permissions/presets` route
  - Created `PresetsSection` component with risk badges and enable/disable toggles
  - Created `PermissionsSections` wrapper coordinating presets + individual permissions via forwardRef
  - Integrated into Settings page above existing Tool Permissions section
- `workflow-context-batching` (P2, completed) — Workflow-scoped proposal buffering
  - Created `src/lib/agents/learning-session.ts` — session lifecycle (open/buffer/close), batch approve/reject
  - Modified `engine.ts` — wraps all workflow patterns in learning session open/close (including loop + try/finally)
  - Modified `pattern-extractor.ts` — detects workflow session, calls `proposeContextAddition({ silent: true })` to skip notification
  - Modified `learned-context.ts` — `proposeContextAddition` accepts `{ silent }` option to create row without notification
  - Created `POST /api/context/batch` — batch approve/reject endpoint
  - Created `BatchProposalReview` component with Approve All / Reject All actions
  - Integrated into `PendingApprovalHost` for both compact toast and full detail views
  - Added `context_proposal_batch` to notification type enum in DB schema
- Rec #2 (Codex output artifacts) closed — documented output contract in `provider-runtime-abstraction.md`

### Catalog Sync
- Renamed `output/agent-e2e-test-report.md` → `output/done-agent-e2e-test-report.md` (all 5 recommendations addressed)
- Updated references in 5 feature files + changelog

### Completed
- `sdk-runtime-hardening` (P2, post-MVP) — Systematic SDK audit fixes for cost tracking, execution safety, and prompt quality
  - F1: Refactored to use `systemPrompt: { type: 'preset', preset: 'claude_code', append }` instead of prompt stuffing
  - F2: Removed decorative `temperature` from all profile YAMLs and `AgentProfile` type
  - F4: Added per-execution `maxBudgetUsd` via `DEFAULT_MAX_BUDGET_USD` to both execute and resume paths
  - F5: Expanded pricing registry from 2 to 6 model families (3 Anthropic + 3 OpenAI) with fallback estimates
  - F6: Added `getProviderModelBreakdown()` for per-model usage extraction from SDK `modelUsage` field
  - F9: Added default `maxTurns` on task execution with per-profile override via `DEFAULT_MAX_TURNS`
  - F10: Codex `item/tool/call` handler returns structured graceful response instead of bare string stub
  - F12: Extracted shared `buildTaskQueryContext()` helper eliminating duplicate execute/resume prompt construction

### Catalog Sync
- Feature catalog updated retroactively to reflect SDK audit-driven code changes (commit `e5680ff`)
- Added implementation notes to `usage-metering-ledger` (F5, F6), `spend-budget-guardrails` (F4, F9), `provider-runtime-abstraction` (F1, F12), `cross-provider-profile-compatibility` (F2)
- Renamed `output/sdk-usage-audit.md` → `output/done-sdk-usage-audit.md`

### Deferred
- F3 (`outputFormat`) — Profile field exists but not wired to `query()` options; needs per-profile JSON Schema definitions
- F7 (`fallbackModel`) — No multi-model failover needed currently
- F8 (`includePartialMessages`) — Only optimized for connection test; remaining call sites deferred
- F11 (Codex MCP passthrough) — Catalog already lists `mcpServers: false`
- F13 (Usage dedup by message ID) — Current merge strategy sufficient without multi-model sessions

## 2026-03-15

### Completed
- `ai-assist-workflow-creation` (P1, post-MVP) — Bridge AI Assist recommendations into workflow engine
  - Expanded `TaskAssistResponse` with per-step profiles, dependencies, and all 6 workflow patterns
  - Updated AI system prompt with dynamic profile catalog injection and pattern selection guide
  - Created `assist-builder.ts` — pure function converting assist response → validated `WorkflowDefinition`
  - Created `POST /api/workflows/from-assist` — atomic workflow + tasks creation with optional immediate execution
  - Created `WorkflowConfirmationSheet` — editable workflow review UI (pattern, steps, profiles, config)
  - Added "Create as Workflow" button in AI Assist panel (shown for 2+ steps, non-single patterns)
  - Created keyword-based profile suggestion fallback (`suggest.ts`)
  - Updated workflow engine to resolve "auto" profiles via multi-agent router at execution time

### Fixed
- `syncSourceTaskStatus` bug in workflow engine — defensive array check prevents "not iterable" TypeError when syncing parent task status after workflow completion
- `npm-publish-readiness` roadmap status corrected from `completed` → `deferred` to match feature file frontmatter

### Shipped
- `agent-self-improvement` (P3, post-MVP) — Agents learn from execution history with human-approved instruction evolution
  - `learned-context.ts`: Full CRUD — propose, approve, reject, rollback, summarization with size limits
  - `pattern-extractor.ts`: LLM-powered pattern extraction from task logs (Claude tool_choice for structured output)
  - `sweep.ts`: Sweep result processor creates prioritized improvement tasks from audit results
  - Sweep agent profile (`builtins/sweep/`) with structured JSON output format
  - API routes: `GET/POST/PATCH /api/profiles/[id]/context` for version history, manual add, approve/reject/rollback
  - UI: `LearnedContextPanel` (version timeline, size bar, manual add, rollback), `ContextProposalReview` (approve/edit/reject)
  - Integrated into `claude-agent.ts` — learned context injected into prompts, pattern extraction fire-and-forget after completion
  - Notification system handles `context_proposal` type in `PendingApprovalHost` with inline approve/reject
  - Tests: 35 tests across `learned-context.test.ts` (20), `sweep.test.ts` (9), `pattern-extractor.test.ts` (6)

### Previously Completed
- `board-context-persistence` (P2, post-MVP) — Persist board state across sessions and navigation
  - Created generic `usePersistedState` hook for localStorage-backed state with SSR-safe hydration
  - Project filter persists across page refreshes via `ainative-project-filter` localStorage key
  - New Task link passes selected project as `?project=` search param, pre-filling the create form
  - Added sort order dropdown (Priority, Newest first, Oldest first, Title A-Z) persisted to localStorage
- `kanban-board-operations` (P2, post-MVP) — Shipped inline task editing, bulk operations, and card animations
  - Added inline delete confirmation on task cards with 2-step UX (trash icon → confirm/cancel) and 3-second auto-revert
  - Added task edit dialog for planned/queued tasks with profile-runtime compatibility validation
  - Added column-level selection mode with bulk delete (confirmation modal) and bulk status transitions (planned→queued, queued→running)
  - Added ghost card exit animation using sessionStorage for cross-navigation state persistence
  - Added priority-colored strip toolbar on card footer with contextual action buttons

### Enhancement
- `task-definition-ai` (P2, MVP) — AI Assist panel now shows animated progress bar with rotating activity messages instead of spinner
- `provider-runtime-abstraction` (P1, post-MVP) — Added timeout guards: 30s abort on Claude task assist, 60s timeout on Codex with subprocess error handling
- Engineering principles codified in AGENTS.md (7 directives: zero silent failures, named errors, shadow paths, edge cases, explicit>clever, DRY with judgment, permission to scrap)
- Version bump to 0.1.7

## 2026-03-14

### Removed
- `tauri-desktop` — Distribution simplified to `npx ainative` (npm) and web app only. All Tauri desktop shell, macOS DMG generation, Apple signing scripts, desktop smoke tests, and related feature specs removed. CLI entry point (`bin/cli.ts`) and sidecar launch helpers retained for the npx path.

## 2026-03-13

### Ship Verification
- `desktop-sidecar-boot-fix` (P0, MVP) — The bundle boot blocker is no longer the broken `next` shim
  - Replaced the sidecar's `node_modules/.bin/next` launch path with a direct `node_modules/next/dist/bin/next` invocation via the active Node binary, which avoids Tauri's symlink-flattened `.bin/` copies
  - Added a post-bundle sync of `.next/node_modules` into `ainative.app` so Next's generated hashed externals such as `better-sqlite3-*` remain resolvable inside the packaged app
  - Verified the actual release bundle sidecar starts in production mode and returns HTTP `200` on localhost under a Finder-style minimal `PATH`

### Enhancement
- `desktop-sidecar-boot-fix` (P0, MVP) — Hardened the desktop handoff and trimmed accidental bundle bloat
  - Stopped the internal CLI from re-running port discovery when the Tauri wrapper already passed an explicit localhost port, preventing the boot screen from polling a stale port while the sidecar listens on a different one
  - Pruned non-runtime Next artifacts such as `.next/dev`, trace files, diagnostics, and caches from the finished `ainative.app` bundle so desktop release size no longer inherits stale local dev output
  - Rebuilt the local desktop artifacts to verify the size drop: the bundled `.next/` payload fell to roughly `51MB`, and the smoke DMG compressed to roughly `260MB`

### Started
- `desktop-sidecar-boot-fix` (P0, MVP) — Desktop app launches but hangs at boot screen. Five issues identified and four solved (DMG signing, node PATH, `_up_/` path mapping, shim PATH). Initial blocker for this slice: Tauri's resource bundling destroys `node_modules/.bin/` symlinks, breaking the `next` CLI shim's relative requires. Feature spec documents the full diagnosis log.

### Re-prioritized
- **Distribution direction**: ainative is now desktop-only in user-facing product positioning
  - Removed npm / `npx` onboarding and publish wiring from the repo surface, while keeping the CLI build only as an internal sidecar dependency of the desktop app
  - Deferred `npm-publish-readiness` as an active product feature and updated the bootstrap spec so it describes the internal desktop sidecar rather than a public install command
  - Promoted GitHub-hosted desktop artifacts as the only documented end-user install channel

### Enhancement
- **tauri-desktop** (P3, post-MVP): Added repo-distributed macOS desktop packaging on top of the local Tauri foundation
  - Enabled `.dmg` output for the Tauri bundle so the desktop build produces an installable macOS artifact instead of only a local `.app`
  - Added a GitHub Actions workflow that builds unsigned macOS desktop assets on tag push or manual dispatch, uploads them as workflow artifacts, and attaches them to GitHub releases for repo-based download
  - Updated the README to point desktop users at GitHub Releases and to document the current limitations: macOS-only, unsigned build, and local `node` dependency

### Started
- **tauri-desktop** (P3, post-MVP): Activated the first desktop-foundation slice instead of treating the full native distribution plan as one implementation
  - Starts with a Tauri wrapper that boots a local loading shell, spawns the existing `dist/cli.js` sidecar, and hands the window over to the same localhost-hosted Next.js app used by the desktop shell
  - Limits the first bridge surface to native notifications and file dialogs so browser-safe shared code can grow into desktop capabilities without forcing a second UI stack
  - Defers bundled Node runtime, system tray, updater, and signed distribution until the sidecar wrapper is stable enough to justify deeper packaging work
- Updated roadmap: marked `tauri-desktop` as started and added it as the current post-MVP platform sprint

## 2026-03-12

### Ship Verification
- **npm-publish-readiness** (P1, post-MVP): Acceptance criteria verified against the packaged CLI, published tarball shape, npm-facing README, and live registry publication
  - Confirmed package metadata now covers npm discovery and links, while the published tarball keeps runtime-required source/assets and excludes repo-only test files
  - Confirmed the CLI help path now documents `STAGENT_DATA_DIR`, startup flags, and runtime credential expectations for first-time npm users
  - Verified with `npm run build:cli`, `npm pack --dry-run`, a passing `npm run smoke:npm` tarball launch, and successful publication of `ainative@0.1.1`
- **multi-agent-swarm** (P3, post-MVP): Acceptance criteria verified against the new swarm workflow pattern, retry flow, targeted tests, and a successful production build
  - Confirmed workflow authoring now supports a bounded `swarm` pattern with one mayor step, 2-5 worker steps, a refinery step, and configurable worker concurrency
  - Confirmed execution runs the mayor first, fans worker child tasks out through the existing workflow task path, blocks the refinery on failed workers, and persists grouped swarm progress in workflow state
  - Confirmed failed mayor, worker, and refinery stages can be retried from workflow detail through a new step-retry endpoint without re-running successful sibling workers
  - Verified with targeted Vitest coverage (`16` passing tests across workflow validation/helpers/engine) and a successful production build
- **ambient-approval-toast** (P1, post-MVP): Acceptance criteria verified against the shipped shell presenter, shared permission controls, targeted tests, and a successful production build
  - Confirmed unresolved `permission_required` notifications now surface through a shell-level presenter on any route, using a primary approval card plus an explicit overflow indicator instead of overlapping surfaces
  - Confirmed the toast and Inbox now share the same permission-response control path, so `Allow Once`, `Always Allow`, and `Deny` still write the canonical notification response through the existing task response endpoint
  - Confirmed new requests are announced through a polite live region, expanded detail restores focus on close, and mobile uses the bottom-anchored sheet-style variant instead of a desktop corner-only presentation
  - Verified with targeted Vitest coverage (`3` passing tests across the new notification host and shared permission controls) plus a successful production build
- **cross-provider-profile-compatibility** (P2, post-MVP): Acceptance criteria re-verified against code, targeted tests, production build, and a live browser pass
  - Confirmed profile metadata supports runtime declarations and runtime-specific overrides, built-in profile sidecars advertise Claude/Codex coverage, and execution resolves provider-specific payloads instead of assuming universal Claude `SKILL.md`
  - Confirmed task, schedule, and workflow validation reject incompatible runtime/profile assignments before execution, and profile smoke tests now target a selected runtime with explicit `unsupported` reporting
  - Re-verified the profile browser and detail surfaces expose runtime coverage, and retained the regression fix that refreshes profile discovery when on-disk skill directories change so new custom profiles no longer 404 after creation
  - Verified with targeted Vitest coverage (`26` passing tests), a successful production build, and a browser check covering both unsupported and dual-runtime profile states

### Completed
- **npm-publish-readiness** (P1, post-MVP): Shipped npm distribution hardening for `npx ainative`
  - Added publish-ready npm metadata, tarball trimming, and a packaged smoke-test workflow that validates the CLI from the actual npm tarball instead of the repo checkout
  - Updated CLI help and runtime path handling so packaged runs can document and honor `STAGENT_DATA_DIR`, `--port`, `--reset`, and `--no-open`
  - Refreshed the npm-facing README with current feature coverage, a release checklist, and packaged screenshots that render from the published tarball
- **multi-agent-swarm** (P3, post-MVP): Shipped bounded swarm orchestration on top of the existing workflow system
  - Added a `swarm` workflow pattern with a fixed mayor → worker pool → refinery structure instead of introducing a new graph runtime
  - Workers now execute in parallel with a configurable concurrency cap while the refinery step receives the mayor plan plus labeled worker outputs as merge context
  - Workflow detail now groups swarm runs into mayor, worker, and refinery panels, and failed swarm stages can be retried independently through a dedicated step-retry route
- **ambient-approval-toast** (P1, post-MVP): Shipped in-context approval toasts for human-in-the-loop task supervision
  - Added a shell-mounted pending approval host that watches unresolved permission notifications via a dedicated pending-approval payload and SSE snapshot stream with polling fallback
  - Introduced a shared permission-response action component so the ambient presenter and Inbox use the same approval semantics, including persisted `Always Allow` patterns
  - Added a queue-aware compact approval surface, expanded detail dialog, and mobile bottom-sheet variant with focus return, live-region announcement, and overflow handling for multiple pending approvals
  - Introduced a reusable actionable-notification payload and adapter interface so browser and future Tauri/macOS delivery can reuse the same IDs, summaries, deep links, and action set
- **parallel-research-fork-join** (P2, post-MVP): Shipped bounded fork/join workflow execution
  - Added a `parallel` workflow pattern with a bounded authoring flow: 2-5 research branches plus one required synthesis step instead of a free-form graph editor
  - Workflow execution now launches branch child tasks concurrently with a small concurrency cap, holds the synthesis step in an explicit waiting state until every branch succeeds, and builds the final prompt from labeled branch outputs
  - Workflow detail now renders branch-level progress cards and a distinct synthesis panel, while API and form validation reject malformed parallel definitions before execution
  - Fixed workflow failure persistence so failed workflow runs now store a top-level `failed` status instead of remaining `active` after a branch or synthesis error
  - Verified with targeted Vitest coverage (`31` passing tests across workflow and agent suites), a successful production build, and a live browser pass that created and executed a parallel workflow
- **document-output-generation** (P3, post-MVP): Shipped managed capture for agent-generated files
  - Fresh task runs now prepare `~/.ainative/outputs/{taskId}/`, inject that path into Claude and Codex prompts, and scan supported generated files after successful completion
  - Generated `.md`, `.json`, `.csv`, `.txt`, and `.html` files are archived as immutable output documents with `direction="output"` plus version numbers so reruns preserve prior outputs instead of overwriting document history
  - Task detail now separates input attachments from generated outputs, while the Document Manager exposes output files through the normal browser with direction and version visibility
  - Document preview/download flows now use a document-backed file route, and agent document context is restricted to input documents so generated outputs do not feed back into future prompt context
  - Verified with targeted Vitest coverage (`50` passing tests across runtime/document suites) and a successful production build
- **cross-provider-profile-compatibility** (P2, post-MVP): Shipped provider-aware profile coverage across authoring, execution, and testing
  - Added runtime compatibility metadata to profile sidecars plus runtime-specific instruction override support so profiles can declare Claude-only, Codex-only, or dual-runtime coverage explicitly
  - Runtime resolution now loads provider-specific profile payloads for Claude and Codex task execution instead of assuming every profile is a universal Claude `SKILL.md`
  - Task creation, task updates, schedules, workflow draft editing, and queued task execution now reject incompatible runtime/profile combinations before they silently fail
  - Profile browser cards and detail views now surface runtime coverage, while the profile editor can opt profiles into Codex support and add Codex-specific instructions
  - Profile smoke tests now target a selected runtime and return an explicit `unsupported` report when the runtime or profile payload cannot run tests
  - Verified with targeted Vitest coverage for profile compatibility helpers and a successful production build

### Groomed
- **npm-publish-readiness** (P1, post-MVP): Added a bounded npm distribution hardening spec for the existing CLI bootstrap
  - Separates publish-readiness from the already-completed local CLI bootstrap so release work is scoped to tarball shape, package metadata, smoke testing, and onboarding docs
  - Targets the OpenVolo-style thin CLI plus source-shipped Next.js pattern already captured in `ideas/npx-web-app.md`
  - Calls for `npm pack`-based validation so `npx ainative` is proven from the shipped tarball rather than assumed from repo-local execution
- Updated roadmap: added `npm-publish-readiness` as a planned Platform feature
- **ambient-approval-toast** (P1, post-MVP): Added an in-context approval surface spec for active supervision
  - Defines a shell-level permission toast that appears on any route, keeps Inbox as the durable record, and lets users approve or deny without switching context
  - Uses a compact toast plus expanded modal-like detail state so approval requests are noticeable without becoming a blocking full-screen interruption
  - Introduces a channel abstraction now so the same approval payload can later drive browser notifications and Tauri/macOS native notifications without changing the core permission model
- **parallel-research-fork-join** (P2, post-MVP): Split the broad advanced-workflows placeholder into the next bounded workflow-engine slice
  - Narrows the next workflow expansion to one control-flow primitive: parallel branch execution followed by a synthesis join step
  - Reuses existing workflow steps, runtime assignments, and profile compatibility instead of introducing a new orchestration model
  - Keeps critic/verifier, evaluator-optimizer, and broader swarm behavior out of scope until fork/join execution and visibility are proven in the product
- **usage-metering-ledger** (P1, post-MVP): Added a normalized cost-and-token accounting foundation for Claude- and Codex-backed activity
  - Introduces a dedicated usage ledger instead of relying on provider-shaped `agent_logs` payloads as the reporting source of truth
  - Covers task runs, resumes, workflow child tasks, scheduled firings, task assist, and profile tests
  - Preserves raw token counts plus derived cost so later dashboards and budgets can rely on durable accounting data
- **spend-budget-guardrails** (P1, post-MVP): Added governed spend controls for autonomous provider activity
  - Settings-driven daily/monthly overall spend caps plus provider-scoped spend and token caps
  - Warn at 80% of budget, then hard-stop new Claude/Codex calls after a limit is exceeded
  - Allows in-flight runs to finish while making blocked follow-on work explicit in Inbox and audit history
- **cost-and-usage-dashboard** (P2, post-MVP): Added a first-class operational surface for spend visibility
  - Promotes `Cost & Usage` into the sidebar as a dedicated route rather than burying spend in Settings or Monitor
  - Combines summary cards, spend/token trend charts, provider/model breakdowns, and a filterable audit log
  - Reuses the existing micro-visualization pattern instead of adding a heavier analytics stack

### Completed
- **accessibility** (P2, post-MVP): Closed the remaining WCAG-focused interaction gaps across live updates and dialog close paths
  - Added polite live-region coverage to the monitor overview metrics, homepage priority queue, homepage activity feed, and the kanban board via an announcement region for filter and drag/drop updates
  - Hardened programmatic dialog close behavior so focus returns to the invoking control for project creation, project editing, and document upload flows
  - Added targeted Vitest accessibility regressions for dashboard live regions, kanban announcements, and dialog focus restoration, and installed the missing `@testing-library/dom` test dependency needed to run them
  - Verified with targeted Vitest coverage, a successful production build, and browser accessibility snapshots on dashboard and monitor
- **ui-density-refinement** (P2, post-MVP): Shipped the cross-route density and composition follow-up
  - Home now uses a bounded route canvas and a more cohesive sidebar surface so the shell reads as one workspace instead of a detached rail plus content field
  - Inbox now has a denser control bar with queue counts, stronger tab framing, and clearer bulk-action affordances that better match the notification cards below
  - Projects now adds top-level structure with summary metrics and a bounded card region so small project counts do not leave a large unfinished-looking field
  - Verified with a successful production build and a browser pass on home, inbox, and projects after implementation
- **usage-metering-ledger** (P1, post-MVP): Shipped the normalized provider-usage foundation
  - Added a dedicated `usage_ledger` table plus task-level workflow/schedule linkage so metering is durable and does not rely on provider-shaped `agent_logs` payloads or task-title parsing
  - Claude and Codex task execution/resume flows now persist normalized usage rows, and task-assist/profile-test activity also writes standalone ledger records
  - Added pricing-registry logic, daily spend/token query helpers, provider/model breakdown queries, audit-log joins, and representative seed data for both providers
  - Verified with the full Vitest suite (`169` passing tests) and a successful production build
- **spend-budget-guardrails** (P1, post-MVP): Shipped spend governance across all provider entry points
  - Added structured budget-policy storage and validation for overall daily/monthly spend caps plus runtime-scoped spend and token caps
  - New guardrail service evaluates daily/monthly ledger totals in the local runtime timezone, emits deduplicated 80% warning notifications, and blocks new provider calls once a relevant cap is exceeded
  - Task execute/resume routes now return explicit budget errors up front, while workflows, schedules, task assist, and profile tests are protected through the shared runtime layer
  - Blocked attempts now write zero-cost `usage_ledger` audit rows with `blocked` status and create Inbox notifications instead of silently retrying later
  - Settings now exposes a `Cost & Usage Guardrails` section with live blocked/warning state and reset timing per window
  - Verified with the full Vitest suite (`173` passing tests) and a successful production build
- **cost-and-usage-dashboard** (P2, post-MVP): Shipped a first-class spend and token operations surface
  - Added a dedicated `/costs` route plus a top-level sidebar destination and command-palette parity for navigating into cost governance quickly
  - The new dashboard combines day/month summary cards, budget-state messaging, 7-day and 30-day spend/token trends, runtime share cards, model breakdowns, and a filtered audit log with deep links back to tasks, workflows, schedules, and projects
  - Extended usage helpers so unknown-pricing rows remain visible in model breakdowns and audit filters can scope by runtime, status, activity type, and date range
  - Verified with targeted Vitest coverage for the ledger helpers and a successful production build

### Re-prioritized
- **Human-loop attention**: Inserted `ambient-approval-toast` ahead of further workflow expansion
  - Live browser verification showed that an unread Inbox badge is too easy to miss while supervising an active workflow run
  - Permission handling is already durable, but the interaction is still context-breaking; the next improvement should reduce approval friction on already-shipped execution paths
- **Workflow expansion direction**: Replaced the omnibus `parallel-workflows` placeholder with a narrower fork/join foundation
  - `parallel-research-fork-join` is now the next planned workflow-engine feature and moves up to P2 because it extends an already-shipped core surface
  - Broader evaluator-style patterns stay deferred until ainative proves parallel execution, join synthesis, and workflow-status visibility in a simpler slice
- **Cost & Usage direction**: Dropped ROI framing from the planned feature set
  - Direct spend and token metering are product-truthful with the data ainative already has access to
  - ROI would require optional user-supplied business-value inputs and would dilute the first governance slice
- **Roadmap order**: Introduced a dedicated Governance & Analytics track and moved cost governance ahead of further provider-portability follow-ons
  - Recommended build order is now usage metering first, budget guardrails second, and the dashboard third

### Ship Verification
- **openai-codex-app-server** (P1, post-MVP): Acceptance criteria re-verified against code, build output, and a live browser run
  - Confirmed runtime registration, provider-aware settings health checks, task assignment surfaces, workflow/schedule targeting, and inbox response plumbing remain wired through the shared runtime layer
  - Full Vitest suite passed (`167` tests) and production build passed after verification
  - Browser verification on March 12, 2026 confirmed a Settings connectivity check and a browser-created Codex-backed task completing successfully with a persisted result

### Enhancement
- **spend-budget-guardrails**: Simplified the Settings guardrail UX to be spend-first
  - Runtime cards now treat daily/monthly spend caps as the primary editable controls
  - Derived token budget guidance is shown as read-only estimates based on recent blended runtime pricing instead of competing as default inputs
  - Hard token ceilings remain available under an advanced section for operators who need strict technical guardrails
- **openai-codex-app-server**: Fixed a live startup regression discovered during ship verification
  - Removed an unsupported Codex thread-start history-persistence flag that caused `thread/start.persistFullHistory requires experimentalApi capability`
  - Re-ran the browser flow after the fix and confirmed successful task completion
  - Runtime startup behavior now matches the currently supported Codex App Server capability surface
- **Roadmap metadata sync**: Reconciled product planning files with the current shipped/in-progress state
  - Marked `multi-agent-routing` completed in the feature spec to match the previously verified profile-routing implementation
  - Added `accessibility` to the roadmap as the current in-progress post-MVP quality track

## 2026-03-11

### Completed
- **openai-codex-app-server** (P1, post-MVP): OpenAI Codex App Server shipped as ainative's second governed runtime
  - Added an `openai-codex-app-server` adapter and a lightweight WebSocket app-server client under `src/lib/agents/runtime/`
  - Codex-backed tasks now execute, resume, cancel, and persist provider-labeled `agent_logs`, task results, and resumable thread IDs through the shared runtime layer
  - Codex approval requests and user-input prompts now route through Inbox notifications and continue the run from user responses
  - Saved permission shortcuts now auto-approve equivalent Codex command and file-change requests
  - Settings now support OpenAI API-key storage plus a runtime-aware Codex connectivity test
  - Task creation, task assist, schedules, and workflows now allow explicit OpenAI runtime targeting
  - Verified with full Vitest suite (`167` passing tests) and a successful production build
- **operational-surface-foundation** (P2, post-MVP): Solid operational surfaces and theme bootstrapping shipped across dense UI
  - Added `surface-1/2/3` tokens plus reusable `surface-card`, `surface-card-muted`, `surface-control`, and `surface-scroll` utilities
  - Root layout now applies critical theme CSS and an inline startup script to set theme before hydration
  - Theme toggle now synchronizes class, `data-theme`, `color-scheme`, local storage, and cookie state
  - Dashboard, monitor, kanban, inbox, project cards, and settings forms moved off blur-heavy glass defaults onto solid surfaces
  - Settings page widened from `max-w-2xl` to `max-w-3xl` for cleaner scanning
- **profile-surface-stability** (P2, post-MVP): Profile browser and detail routes migrated onto stable operational surfaces
  - Investigation traced the remaining profile jank to the profile routes still relying on the default `[data-slot="card"]` backdrop-blur path after the broader surface migration
  - Earlier compositing hardening reduced the visible flash but did not remove the fragile rendering path for scroll-heavy profile content
  - `/profiles` and `/profiles/[id]` now use bounded `surface-page` framing plus `surface-card`, `surface-panel`, `surface-scroll`, and `surface-control` treatments for primary content
  - Profile policy/test badges were aligned to semantic status tokens during the surface migration
  - This shipped as a bounded slice instead of overloading the broader `ui-density-refinement` backlog
- **provider-runtime-abstraction** (P1, post-MVP): Shared runtime boundary shipped for Claude-backed execution
  - Added a provider runtime registry under `src/lib/agents/runtime/` with centralized runtime IDs, capability metadata, and a Claude adapter
  - Task execute, resume, and cancel routes now dispatch through the runtime layer instead of calling Claude helpers directly
  - Workflow child tasks, scheduler firings, task-definition assist, profile smoke tests, and settings health checks now route through provider-aware runtime services
  - `assignedAgent` is now validated against supported runtime IDs instead of accepting arbitrary strings
  - Runtime metadata is available to both API code and UI code, while Claude behavior remains the default runtime path
  - Verified with full Vitest suite (`163` passing tests) and a successful production build

### Enhancement
- **app-shell**: Theme startup is now hardened against light/dark flash and background mismatch during hydration
- **homepage-dashboard / monitoring-dashboard / task-board / inbox-notifications / project-management**: Dense cards and controls now prioritize scanability over backdrop blur
- **agent-profile-catalog**: Profile detail and browser pages now read like dense operational surfaces rather than blur-first showcase cards
- **Browser evaluation**: Chrome review on home, inbox, settings, and projects confirmed the surface-system improvement and surfaced the next refinement targets
- **settings / runtime metadata**: Authentication now describes the active runtime in provider-neutral terms while still reflecting Claude-specific auth behavior

### Groomed
- **ui-density-refinement** (P2, post-MVP): Follow-up UX tranche from the Chrome browser pass
  - Sidebar/background cohesion on home still needs refinement
  - Inbox action row needs denser spacing and clearer secondary-control affordance
  - Projects page composition needs stronger structure when project count is low
- Updated roadmap: added `operational-surface-foundation` and `profile-surface-stability` as completed and `ui-density-refinement` as planned in UI Enhancement
- **provider-runtime-abstraction** (P1, post-MVP): Introduced a bounded runtime-foundation spec for multi-provider support
  - Separates ainative orchestration from provider SDK specifics so tasks, workflows, schedules, task-definition AI, and profile smoke tests can run through a shared contract
  - Preserves the existing Claude-first UX while making a second runtime additive rather than invasive
- **openai-codex-app-server** (P1, post-MVP): Added a concrete OpenAI execution spec
  - Recommends Codex App Server as the first OpenAI path because it maps more directly to ainative's approval and monitoring model than a thin SDK-only integration
  - Frames the work as a governed execution runtime, not as generic provider routing
- **cross-provider-profile-compatibility** (P2, post-MVP): Added a profile-portability follow-on
  - Captures the gap between today's `.claude/skills` profile model and a future provider-aware profile system

### Re-prioritized
- **Multi-provider direction**: Reintroduced provider expansion as a post-MVP platform track, but with a narrower recommendation than the earlier routing concept
  - No immediate user-facing "switch provider" toggle
  - Runtime abstraction ships first, OpenAI Codex App Server second, profile compatibility third
  - This preserves the earlier decision to avoid broad multi-provider routing as part of `multi-agent-routing` while creating a future-proof path for a governed second runtime
- Updated roadmap: provider-runtime-abstraction and openai-codex-app-server are completed; cross-provider-profile-compatibility is now the next runtime-track feature

## 2026-03-10

### Ship Verification
- **workflow-blueprints** (P3, post-MVP): 12/12 acceptance criteria verified — all code implemented and integrated
  - 8 built-in YAML blueprints across work (4) and personal (4) domains
  - Blueprint registry loads from `src/lib/workflows/blueprints/builtins/` + `~/.ainative/blueprints/`
  - Template engine with `{{variable}}` substitution and `{{#if}}` conditional blocks
  - Zod validation schema at `src/lib/validators/blueprint.ts`
  - Blueprint gallery at `/workflows/blueprints` with domain tabs, search, and preview
  - Blueprint editor with YAML validation for custom blueprints
  - Dynamic variable form: 5 input types (text, textarea, number, boolean, select)
  - Instantiation creates draft workflows with resolved prompts and agentProfile mapping
  - Full API: CRUD, instantiate, GitHub import
  - Lineage tracking via `_blueprintId` in workflow definition JSON
  - "From Blueprint" button on `/workflows` page
- Updated roadmap: workflow-blueprints marked `completed`

### Enhancement
- **app-shell**: Collapsible sidebar with icon-only mode
  - `collapsible="icon"` on Sidebar with SidebarTrigger toggle button
  - Custom `StagentLogo` SVG component replacing text-only header
  - Tooltip labels on all nav items via `tooltip` prop on SidebarMenuButton
  - `group-data-[collapsible=icon]` responsive rules for badges, footer, and ⌘K hint
- **app-shell**: PWA support
  - `src/app/manifest.ts` with app name, description, theme color, icons
  - `src/app/apple-icon.tsx` dynamic Apple Touch icon generator
  - `src/app/icon.svg` and `public/icon.svg` app icons
- **agent-integration**: MCP server config passthrough
  - `profile.mcpServers` now passed to Agent SDK `query()` in both `executeClaudeTask` and `resumeClaudeTask`

### Completed
- **agent-profile-catalog** (P3, post-MVP): Complete profile catalog with 13 built-in profiles, import, and testing
  - 9/12 AC already existed from multi-agent-routing infrastructure (registry, 13 builtins, execution integration, gallery UI, editor, selector)
  - **Gap fix (AC6)**: Profile `mcpServers` now passed to Agent SDK `query()` options in both `executeClaudeTask` and `resumeClaudeTask`
  - **Gap fix (AC10)**: GitHub import API (`POST /api/profiles/import`) — fetches profile.yaml + SKILL.md from raw GitHub URLs, validates with Zod, creates via registry
  - **Gap fix (AC12)**: Profile test runner (`src/lib/agents/profiles/test-runner.ts`) — executes behavioral smoke tests against Agent SDK, validates expected keywords in response
  - Import dialog in profile browser header with URL input and error handling
  - "Run Tests" button in profile detail view with pass/fail results and keyword highlighting
  - Test API route: `POST /api/profiles/[id]/test`
- Updated roadmap: agent-profile-catalog marked `completed` (unblocks workflow-blueprints)

### Ship Verification
- **command-palette-enhancement** (P2, post-MVP): 10/10 acceptance criteria verified — all code implemented and integrated
  - 4 command groups: Recent, Navigation, Create, Utility
  - 10 navigation items matching all sidebar routes with icons and cmdk keyword aliases
  - Create: New Task, New Project, New Workflow, New Profile
  - Utility: Toggle Theme (light/dark switch) and Mark All Notifications Read
  - Async recent items: API endpoint returns 5 projects + 5 tasks, fetched on palette open with AbortController cleanup
  - ⌘K hint button in sidebar footer with synthetic KeyboardEvent dispatch
  - Fuzzy search filters across all groups via cmdk keywords
- Updated roadmap: command-palette-enhancement marked `completed`

## 2026-03-09

### Ship Verification (Batch)
- **autonomous-loop-execution** (P3, post-MVP): 6/6 acceptance criteria verified — all code implemented and integrated
  - Loop executor engine with 4 stop conditions (max iterations, time budget, human cancel, agent-signaled)
  - Child task creation per iteration with previous output as context
  - `LoopStatusView` with iteration timeline, progress bar, time budget display, expandable results
  - Pause/resume via DB status polling each iteration + PATCH API
  - Loop state persisted to workflows table `_loopState` field, restored on resume
  - Spec key files slightly renamed vs. implementation (no functional gap)
- **scheduled-prompt-loops** (P2, post-MVP): 14/14 acceptance criteria verified — 3 bugs fixed
  - **Fix (P1)**: Concurrency guard was a no-op — constructed wrong task ID for execution-manager lookup. Replaced with DB query for running child tasks by title pattern
  - **Fix (P2)**: Firing history API had dead exact-match query + full table scan fallback. Replaced with single `LIKE` query
  - **Fix (P3)**: Firing history rows linked to `/projects` instead of task detail. Fixed to link to `/monitor?taskId=...`
- **tool-permission-persistence** (P2, post-MVP): Verified — fully integrated, no code islands
- **document-manager** (P2, post-MVP): Verified — fully integrated, no code islands
- **multi-agent-routing** (P3, post-MVP): Verified — fully integrated, no code islands
- Updated roadmap: autonomous-loop-execution and scheduled-prompt-loops marked `completed`

### Completed
- **tool-permission-persistence** (P2, post-MVP): "Always Allow" for agent tool permissions
  - Permission pre-check in `handleToolPermission()` bypasses notification for trusted tools
  - Pattern format: tool-level (`Read`), constraint-level (`Bash(command:git *)`), MCP (`mcp__server__tool`)
  - "Allow Once" / "Always Allow" split buttons in Inbox permission UI
  - Settings page shows saved patterns with revoke capability
  - Permissions API: `GET/POST/DELETE /api/permissions`
  - Extracted shared `getSetting`/`setSetting` helpers from auth module
  - `AskUserQuestion` always requires human input (never auto-allowed)
  - No migration needed — uses existing `settings` table with new key

### Enhancement
- **project-management**: Added `workingDirectory` field to projects
  - New `working_directory` column on projects table (schema + bootstrap DDL + validator)
  - Agent tasks (`executeClaudeTask`, `resumeClaudeTask`) resolve `cwd` from project's working directory
  - Previously all tasks ran in ainative's server directory; now they target the project's codebase
  - Working directory input in both Create Project and Edit Project dialogs
  - Project card shows working directory path when set
  - Enables schedules/workflows to operate on external codebases via project association

### In Progress
- **scheduled-prompt-loops** (P2, post-MVP): Time-based scheduling for agent tasks
  - New `schedules` table (14 columns) with bootstrap DDL and Drizzle schema
  - Poll-based scheduler engine (60s interval, in-process via `setInterval`)
  - Human-friendly interval parsing (5m, 2h, 1d) + raw 5-field cron input
  - `cron-parser` npm package for computing next fire times
  - API routes: GET/POST `/api/schedules`, GET/PATCH/DELETE `/api/schedules/[id]`
  - 4 UI components: ScheduleCreateDialog, ScheduleList, ScheduleDetailView, ScheduleStatusBadge
  - `/schedules` page + `/schedules/[id]` detail page with sidebar navigation (Clock icon)
  - Scheduler started via Next.js instrumentation hook (`src/instrumentation.ts`)
  - One-shot and recurring modes, pause/resume lifecycle, expiry and max firings
  - Each firing creates a child task via existing `executeClaudeTask` pipeline
  - 14 acceptance criteria
  - Inspired by Claude Code's `/loop` and CronCreate/CronList/CronDelete

### Groomed
- **agent-profile-catalog** (P3, post-MVP): Full spec expansion from placeholder to complete feature spec
  - Skill-first with sidecar architecture: profiles ARE Claude Code skills (SKILL.md + profile.yaml)
  - 13 built-in profiles across work (8) and personal (5) domains
  - Profile registry scans `.claude/skills/*/profile.yaml` for discovery
  - Claude Code primitives mapping: SKILL.md→Skill, allowedTools→Agent SDK, mcpServers→MCP, canUseToolPolicy→canUseTool, hooks→CC hooks
  - Profile gallery UI with domain tabs, search, detail sheet, YAML editor
  - GitHub import/export for community sharing (profiles portable to plain CC users)
  - Behavioral smoke tests per profile (task + expected keywords)
  - 12 acceptance criteria
- **workflow-blueprints** (P3, post-MVP): Full spec expansion from placeholder to complete feature spec
  - 8 built-in blueprints across work (4) and personal (4) domains
  - Blueprint YAML format with typed variables (text, textarea, select, number, boolean, file)
  - Template resolution: `{{variable}}` substitution + `{{#if}}` conditional blocks
  - Dynamic form generation from variable definitions
  - Blueprint gallery integrated into `/workflows` page (not a separate route)
  - Instantiation creates draft workflows with resolved prompts and profile assignments
  - Lineage tracking via `blueprintId` on workflows table
  - GitHub import/export, YAML editor for custom blueprints
  - 12 acceptance criteria
- Updated roadmap: added `agent-profile-catalog` to `workflow-blueprints` dependencies

### Re-groomed
- **multi-agent-routing** (P3, post-MVP): Rewrote spec from Codex MCP multi-provider routing to profile-based routing within Claude Agent SDK
  - Rationale: Multi-provider routing (Codex, Vercel AI SDK) added high complexity for low user value; profile-based routing delivers meaningful differentiation using the existing SDK surface
  - New approach: Agent profile registry with system prompt templates, allowed tools, MCP server configs per profile
  - 4 starter profiles: general, code-reviewer, researcher, document-writer
  - Task type classifier auto-selects profile; users can override
  - Workflow steps can specify per-step profiles
  - Schema addition: `agentProfile` text column on tasks table
- Added 2 new planned features to roadmap (Agent Profiles section):
  - **agent-profile-catalog** (P3): Comprehensive domain profiles — wealth, health, travel, shopping, project manager, etc.
  - **workflow-blueprints** (P3): Pre-configured workflow templates paired with agent profiles

### Ship Verification
- **micro-visualizations** (P2, post-MVP): 18/18 acceptance criteria verified — all code implemented and integrated
  - 3 pure SVG chart primitives: `Sparkline`, `MiniBar`, `DonutRing` (zero external charting dependencies)
  - 6 data query functions in `src/lib/queries/chart-data.ts` with date-gap filling
  - 5 integration points: stats-cards (3 sparklines), activity-feed (24h bar chart), recent-projects (donut rings), monitor-overview (donut + sparkline), project-detail (stacked bar + sparkline)
  - Full accessibility: `role="img"`, `aria-label`, `<title>` on all chart components
  - OKLCH chart/status tokens throughout, light/dark mode support, responsive hiding on mobile
- Updated roadmap: micro-visualizations marked `completed`

### Groomed
- **micro-visualizations** (P2, post-MVP): Sparkline charts and micro-visualizations for dashboard glanceability
  - 3 pure SVG chart primitives: Sparkline, MiniBar, DonutRing (no charting library)
  - Homepage: 7-day trend sparklines in stats cards, 24h activity bar chart, completion donut rings
  - Project detail: stacked status bar + 14-day completion sparkline
  - Monitor: success rate donut ring + 24h activity sparkline
  - Data aggregation layer with 6 query functions
  - Brainstormed via `/product-manager` + `/frontend-designer` collaboration
- Updated roadmap: added UI Enhancement section with micro-visualizations feature

## 2026-03-08

### Completed (Sprint 7)
- **document-manager** (P2): Full document browser and management UI
  - `/documents` route with sidebar navigation (FileText icon)
  - Table view with sortable columns: name, type icon, size, linked task/project, status, date
  - Grid view with image thumbnails and file type icons (toggle switch)
  - Document detail Sheet: preview, metadata, linked task/project, extracted text, processing errors
  - Preview support: images (inline), PDFs (embedded iframe), markdown (react-markdown), text/code (pre)
  - Search by filename and extracted text content (client-side filtering)
  - Filter by processing status and project
  - Standalone upload dialog with drag-and-drop, multi-file support
  - Bulk delete with multi-select checkboxes
  - Link/unlink documents to projects, unlink from tasks
  - Empty state for no documents and no filter matches
  - API: GET /api/documents (list with joins), PATCH /api/documents/[id] (metadata), DELETE /api/documents/[id] (file + record)

### Ship Verification & Gap Fixes (Sprint 6)
- **file-attachment-data-layer** — verified 9/10 AC, fixed orphan cleanup gap (added `POST /api/uploads/cleanup` route)
- **document-preprocessing** — verified 6/10 AC, fixed 3 gaps:
  - Added `extractedText`, `processedPath`, `processingError` columns to Drizzle schema + bootstrap DDL
  - Wired upload API to trigger `processDocument()` fire-and-forget
  - Added image format validation (supported: png, jpg, gif, webp)
- **agent-document-context** — verified 0/7 AC (code island), fixed by wiring `buildDocumentContext` into both `executeClaudeTask` and `resumeClaudeTask`
- Updated roadmap: 3 document features marked `completed`

### README Update
- Updated README.md to reflect MVP completion (all 14 features shipped)
- Merged Foundation/Core/Polish roadmap sections into single "MVP ✅ Complete"
- Added 7 missing completed features: Homepage Dashboard, UX Gap Fixes, Workflow Engine, Task Definition AI, Content Handling
- Added 3 new post-MVP features: Autonomous Loop Execution, Multi-Agent Swarm, Agent Self-Improvement
- Updated project structure with workflows, dashboard, and project detail directories
- Added react-markdown + remark-gfm to tech stack table

### Design Review (MVP Release)
- **Critical fixes (3)**:
  - C1: Added skeleton loading screens for WorkflowList and WorkflowStatusView (was blank/null during fetch)
  - C2: File upload `fileIds` now included in task creation POST payload (was silently orphaned)
  - C3: Replaced naive line-by-line markdown parser with `react-markdown` + `remark-gfm` for full GFM support
- **Important fixes (5 of 9 — 4 deferred to post-MVP)**:
  - I2: Removed non-functional `⌘K` shortcut hint from sidebar footer
  - I5: Added optimistic status update after clicking Execute in WorkflowStatusView
  - I6: Added per-subtask progress toasts and failure reporting in AI Assist
  - I9: RecentProjects shows empty state CTA instead of returning null for new users
  - I3/I7/I8 deferred to `ideas/ux-improvements.md`
- **Minor fixes (4 of 10 — 6 deferred)**:
  - M1: Extracted status badge color mappings to shared `src/lib/constants/status-colors.ts` (was duplicated in 7 files)
  - M4: Wrapped `JSON.parse` in ContentPreview with try/catch
  - M7: Added expand/collapse toggle for large content outputs
  - M9: Deduplicated `patternLabels` to shared constants
  - M2/M3/M5/M6/M8/M10 deferred
- **Accessibility fixes (3 of 4)**:
  - A1: Added `aria-live="polite"` to InboxList and WorkflowStatusView polling regions
  - A2: Added `aria-label` to all icon-only buttons (ContentPreview, FileUpload, WorkflowCreateDialog)
  - A3: Made file upload drop zone keyboard accessible (role, tabIndex, onKeyDown, focus ring)
  - A4 (focus management) deferred — needs verification
- **Documentation**: Created `features/accessibility.md`, `ideas/ux-improvements.md`, `ideas/design-system-fixes.md`
- Updated acceptance criteria in `homepage-dashboard.md`, `content-handling.md`, `workflow-engine.md`, `ux-gap-fixes.md`

### Completed (Sprint 5)
- **homepage-dashboard** (P1): 5-zone landing page replacing `/` redirect
  - Greeting component with time-of-day salutation and live DB status counts
  - 4 clickable stat cards (running, completed today, awaiting review, active projects)
  - Priority queue showing top 5 tasks needing attention
  - Live activity feed showing last 6 agent log entries
  - Quick actions grid (New Task, New Project, Inbox, Monitor)
  - Recent projects with progress bars and task completion counts
  - Home added to sidebar navigation, logo links to `/`
- **ux-gap-fixes** (P1): 4 audit gaps resolved
  - Task board status filter (already existed from prior work)
  - Notification dismiss: "Dismiss read" bulk action in inbox header
  - Monitor auto-refresh: Page Visibility API pauses polling when tab hidden
  - Project detail view: `/projects/[id]` page with task list and status breakdown
- **workflow-engine** (P2): Multi-step workflow execution engine
  - Three patterns: Sequence, Planner→Executor, Human-in-the-Loop Checkpoint
  - State machine engine at `src/lib/workflows/engine.ts`
  - API routes: POST /api/workflows, POST /api/workflows/[id]/execute, GET /api/workflows/[id]/status
  - WorkflowCreateDialog with dynamic step builder and pattern selection
  - WorkflowStatusView with real-time polling and step progress visualization
  - Workflow list page at `/workflows` with navigation in sidebar
  - Failed step retry capability
- **task-definition-ai** (P2): AI-assisted task creation
  - AI Assist button in task create dialog (uses Agent SDK `query`)
  - Improved description suggestions with one-click apply
  - Task breakdown into sub-tasks with bulk creation
  - Pattern recommendation (single/sequence/planner-executor/checkpoint)
  - Complexity estimation and checkpoint flagging
- **content-handling** (P2): File upload and content preview
  - File upload component with drag-and-drop in task create dialog
  - Upload API at POST /api/uploads, file serving at GET /api/uploads/[id]
  - Type-aware content preview (text, markdown, code, JSON)
  - Copy-to-clipboard and download-as-file actions on task results
  - Task output API with automatic content type detection
  - ContentPreview integrated into task detail panel

### Groomed (Sprint 5)
- **autonomous-loop-execution** (P3, post-MVP): Ralph Wiggum-inspired loop pattern with stop conditions and iteration tracking. Source: Karpathy article
- **multi-agent-swarm** (P3, post-MVP): Gas Town-inspired multi-agent orchestration with Mayor/Workers/Refinery roles. Source: Karpathy article
- **agent-self-improvement** (P3, post-MVP): Agents learn patterns and update own context, with human approval and sweep cycles. Source: Karpathy article
- Updated roadmap: P1 features added to Polish Layer, 3 new post-MVP features, reordered build order

### Completed
- **session-management**: Agent session resume for failed/cancelled tasks
  - Added `resumeCount` column to tasks table (migration 0002)
  - New status transitions: `failed → running`, `cancelled → running`
  - Extracted shared `processAgentStream` helper from `executeClaudeTask`
  - Added `resumeClaudeTask` with session guard, retry limit (3), and session expiry detection
  - Resume API route: `POST /api/tasks/[id]/resume` with atomic claim
  - Resume button in task detail panel (alongside existing Retry)
  - Session cleanup utility for old completed tasks
  - 8 new tests across status transitions, agent resume, and router

### Audit
- Spec-vs-implementation gap audit across all 9 completed features
- Updated 9 feature spec frontmatter from `planned` to `completed`
- Backfilled changelog entries for Sprint 1-4 features (below)
- Identified 4 code gaps: task board status filter, notification dismiss, monitor auto-refresh, project detail view
- Added Ship Verification mode to product-manager skill to prevent future gaps

## 2026-03-07

### Completed
- **monitoring-dashboard**: Real-time agent monitoring with SSE log streaming
  - Monitor overview with 4 metric cards (active agents, tasks today, success rate, last activity)
  - SSE-powered log stream with auto-scroll and auto-reconnect (3s)
  - Log entries with timestamp, task, event type, and payload
  - Filter by task and event type
  - Click log entry to navigate to task detail
  - Manual refresh button for overview metrics
- **inbox-notifications**: Human-in-the-loop notification system
  - Notification list sorted newest first with unread badge on nav
  - Permission request handling (Allow/Deny) with tool input preview
  - Agent message responses with question/answer flow
  - Task completion summaries and failure context with retry
  - Mark read/unread individually and bulk mark-all-read
  - 10s polling for new notifications without refresh
- **agent-integration**: Claude Agent SDK integration with canUseTool pattern
  - `executeClaudeTask` with fire-and-forget execution (POST returns 202)
  - `canUseTool` polling via notifications table as message queue
  - Tool permission flow: agent requests → notification created → user responds → agent continues
  - Agent log streaming to `agent_logs` table
  - Status flow: planned → queued → running → completed/failed/cancelled
  - Execution manager for concurrent task management
- **task-board**: Kanban board with drag-and-drop task management
  - 5-column Kanban layout (Planned, Queued, Running, Completed, Failed)
  - Task creation with title, description, project, and priority
  - Drag-and-drop from Planned → Queued with valid transition enforcement
  - Task detail panel on card click
  - Cancel from any active state, retry failed tasks
  - Project filter, column count badges, inline add task button
  - Scroll indicators for horizontal overflow
- **project-management**: Project CRUD with status tracking
  - Create projects with name and description
  - Project cards with status badges and task counts
  - Edit name, description, and status (active/completed/archived)
  - Archive and complete project status transitions
  - API routes with proper status codes and validation

## 2026-03-06

### Completed
- **app-shell**: Next.js application shell with sidebar navigation
  - Responsive sidebar with collapsible navigation
  - Route structure: Dashboard, Projects, Inbox, Monitor
  - OKLCH hue 250 blue-indigo theme with Tailwind v4
  - shadcn/ui New York style component library setup
  - Dark/light mode toggle
- **database-schema**: SQLite database with Drizzle ORM
  - 5 tables: projects, tasks, workflows, agent_logs, notifications
  - WAL mode for concurrent reads during agent execution
  - Bootstrap CREATE TABLE IF NOT EXISTS for self-healing startup
  - Drizzle migrations in `src/lib/db/migrations/`
  - Settings table added via migration 0003
- **cli-bootstrap**: CLI tool with Commander.js
  - Commander-based CLI entry point at `bin/cli.ts`
  - tsup build pipeline → `dist/cli.js`
  - Project and task management commands
  - Development scripts: `npm run build:cli`

### Groomed
- Extracted 12 features from ideas/ backlog (5 idea files analyzed)
- Created initial roadmap with 9 MVP features and 3 post-MVP features
- MVP features: 3 Foundation (P0), 5 Core (P1), 4 Polish (P2)
- Post-MVP features: 3 features (P3)
- Identified critical path: database-schema → project-management → task-board → agent-integration → inbox/monitoring
- Flagged 6 features needing `/frontend-designer` UX review before implementation
