# Handoff: M3 chat-tools-plugin-kind-1 — GROOM COMPLETE, READY FOR IMPLEMENTATION

**Created:** 2026-04-19 (M3 groom complete — full 6-step sequence executed)
**Supersedes:** `handoff/2026-04-19-self-extending-machine-m2-shipped-handoff.md` (M2 shipped → M3 ungroomed)
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **M3 is GROOMED, TDR'd, BRAINSTORMED, and PLANNED.** All six lifecycle steps (refer → strategy re-read → product-manager spec → architect TDR → brainstorming EXPAND → writing-plans) executed this session. Implementation plan at `.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md` (21 tasks, ~800 lines, gitignored). Strategy doc carries a major Amendment 2026-04-19 (II) that re-scoped Kind 1 around MCP-as-surface. Working tree has **6 uncommitted files** — 4 modified + 2 new — that should be committed as the M3 groom milestone before implementation begins. No code changes yet. No regressions possible yet.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`ideas/self-extending-machine-strategy.md`** — living strategy doc, gitignored local. **Authoritative for decisions D1–D6 and both 2026-04-19 amendments.** The two amendments (npm cadence + MCP-as-surface) sit between §9 Milestone 5 and §10; read them before opening the M3 spec.
3. **`features/chat-tools-plugin-kind-1.md`** — the M3 feature spec (~520 lines post-brainstorm). `status: planned`. Sections to know cold: "Per-tool approval overlay", "Capability expiry (opt-in)", "Revocation flow", "Confinement modes" — all added by the 2026-04-19 EXPAND brainstorm. The cross-runtime table is load-bearing.
4. **`.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md`** — TDR-035 (status: proposed). Six load-bearing decisions. MUST read before editing any adapter code. The drift heuristics at the bottom run on every `/architect` review.
5. **`.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`** — 21-task implementation plan. Ordered by dependency. Phase A (foundation) → B (cross-runtime) → C (security) → D (chat tools) → E (dogfood + docs + invariants) → F (smokes).
6. **`ideas/m3-security-model-brainstorm.md`** — EXPAND-mode artifact. §7 enumerates the six M3 scope additions now baked into the spec. §9 captures five delight opportunities for post-M5 consideration. §10 has open implementation questions worth pulling out before T14 starts.
7. **`features/primitive-bundle-plugin-kind-5.md`** + **`features/schedules-as-yaml-registry.md`** — M1 + M2 precedent specs. Both shipped. Status `completed` in frontmatter, `shipped` in roadmap (intentional asymmetry — skill templates use `completed`; roadmap uses its own vocabulary).
8. **`.claude/skills/architect/references/tdr-034-kind-5-plugin-loader.md`** — M1's load-bearing decisions. TDR-035 explicitly extends it with three M3-specific failure modes (`capability_denied`, `lock_mismatch`, `safe_mode`).
9. **`features/changelog.md`** — top two 2026-04-19 entries capture the groom + design-hardened milestones with full rationale.
10. **Previous handoff** `handoff/2026-04-19-self-extending-machine-m2-shipped-handoff.md` — still authoritative for the state at M2-shipped; this handoff supersedes it from M3-grooming-complete onward.

---

## What shipped in this session

### Step 1 — `/refer chat-tools plugin`
Surveyed captured reference libraries. Claude Agent SDK's `plugins.md` confirmed Anthropic's current plugin model uses `.claude-plugin/plugin.json` manifest + root-level `.mcp.json` for MCP server bundling. Codex CLI's `config.toml [mcp_servers]` pattern matches.

### Step 2 — Live research + strategy re-read
WebFetch of `code.claude.com/docs/en/plugins` + context7 queries on Claude Agent SDK + MCP spec + Codex CLI revealed that Anthropic's plugin.json has **no capability declarations** — trust comes from marketplace curation, not manifest. Grep of own codebase confirmed `withAinativeMcpServer()` at `src/lib/agents/claude-agent.ts:70` already merges MCP servers with two call sites at `:566` (task execution) + `:724` (resume). Adopting MCP-as-surface reuses this merge path.

### Step 3 — `/product-manager` draft spec
`features/chat-tools-plugin-kind-1.md` written, 430 lines initially. Structured per M1/M2 precedent — Description, User Story, Technical Approach (11 subsections), Acceptance Criteria, Scope Boundaries, References. Uses MCP contract throughout; zero mention of the rejected `@ainative/plugin-sdk` custom surface.

### Step 4 — `/architect` TDR-035
Six load-bearing decisions codified:
1. **Five-source MCP merge contract** — `{ profile, browser, external, plugin, ainative }` with ainative ALWAYS last (JS spread semantics protect against plugins shadowing ainative)
2. **Plugin-MCP loader is authoritative source** — `loadPluginMcpServers()` in `src/lib/plugins/mcp-loader.ts` is the ONLY path that reads plugin manifests for MCP purposes
3. **Capability-accept lockfile hash derivation** — deterministic SHA-256 over canonicalized `plugin.yaml` (sorted keys, excluded `name`/`description`/`tags`/`author`)
4. **Transport dispatch via `.mcp.json` shape** — `command` present → stdio; `transport: "ainative-sdk"` → in-process; matches Claude Code's parser
5. **Reload semantics per transport** — stdio: SIGTERM + 5s + SIGKILL + respawn. In-process: `require.cache` bust + atomic swap
6. **Process ownership and lifecycle** — stdio children owned by ainative; spawn at boot step 7; graceful-shutdown SIGTERM; `detached: false` enforced

Three drift heuristics added to `/architect` (run automatically in review + health modes).

### Step 5 — `/brainstorming` EXPAND
`ideas/m3-security-model-brainstorm.md` (~360 lines). Pressure-tested the 5-layer security model, identified the biggest gap: **layers 1–4 are consent, not enforcement.** Six additions baked into the spec:

- **Per-tool approval overlay** (Codex-style `never`/`prompt`/`approve` per tool) — reuses `handleToolPermission` hook
- **Capability expiry** (opt-in, default off)
- **Revocation chat tool**
- **Confinement modes enum** — `none`/`seatbelt`/`apparmor`/`docker` with per-capability policy profiles
- **Docker off-ramp scoped** — strategy §11 Risk D precommit, before leading indicator fires
- **`docs/plugin-security.md`** — user-visible layered-defense explainer

Spec grew from 430 → ~520 lines. Five explicit rejections logged for TDR-035 Alternatives Considered section.

### Step 6 — `/writing-plans` implementation plan
21 tasks, ~800 lines, at `.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`. Gitignored per project convention. Scope challenge settled on **PROCEED minus gmail integration** — full cross-runtime (4 adapters + Ollama opt-out) and full confinement corpus (seatbelt + AppArmor + Docker) preserved, but gmail-triage full Gmail OAuth + API machinery substituted with a minimal echo-server dogfood.

**Phase structure:**
- Phase A (foundation) — T1–T4: manifest schema, capability-check/lockfile, plugin-MCP loader, transport dispatch
- Phase B (cross-runtime) — T5–T9: runtime catalog + Claude SDK + Codex + Anthropic direct + OpenAI direct
- Phase C (security) — T10–T14: per-tool approval, expiry, revocation, safe-mode, confinement modes
- Phase D (chat tools) — T15: list_plugins/reload_plugin extensions + grant tool
- Phase E (dogfood + docs + invariants) — T16–T18: echo-server, plugin-security.md, drift-heuristic tests
- Phase F (smokes) — T19–T21: Claude SDK end-to-end, confinement/Docker, reload/revoke/safe-mode cycles

---

## Uncommitted state at handoff

**6 files** in working tree, ready for a single groom-milestone commit:

```
 M features/architect-report.md          # TDR-035 creation report (overwritten per arch contract)
 M features/changelog.md                 # 2 new 2026-04-19 entries (groomed + design-hardened)
 M features/roadmap.md                   # M3 row linked; M2 row synced planned → shipped
 M features/schedules-as-yaml-registry.md # frontmatter status planned → completed (reflects handoff-confirmed M2-shipped reality)
?? .claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md  # new TDR
?? features/chat-tools-plugin-kind-1.md  # new M3 spec
```

**Suggested commit sequence** (one commit captures the full groom milestone):

```bash
git add features/chat-tools-plugin-kind-1.md \
        features/roadmap.md \
        features/changelog.md \
        features/schedules-as-yaml-registry.md \
        features/architect-report.md \
        .claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md

git commit -m "docs(m3): groom chat-tools-plugin-kind-1 — spec + TDR-035 + security brainstorm

M3 (chat-tools-plugin-kind-1) groomed end-to-end via the 6-step
lifecycle (refer → strategy re-read → product-manager → architect →
brainstorming → writing-plans). Re-scoped around MCP-as-surface per
strategy Amendment 2026-04-19 (II) — plugins ship .mcp.json, reuse
the existing withAinativeMcpServer merge path at claude-agent.ts:566
as a 5-source spread.

Spec at features/chat-tools-plugin-kind-1.md (~520 lines, status:
planned). TDR-035 codifies six load-bearing decisions — five-source
merge order, loader authority, capability hash derivation, transport
dispatch, reload semantics per transport, process ownership. Security
brainstorm (ideas/m3-security-model-brainstorm.md, gitignored local)
surfaced six additions now in the spec: per-tool approval overlay,
capability expiry, revocation, confinement modes enum, Docker
off-ramp scoped before Risk D fires, docs/plugin-security.md.

Implementation plan at .superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md
(21 tasks, ~800 lines, gitignored). Phase ordering: foundation →
cross-runtime → security → chat tools → dogfood/docs/invariants →
smokes.

M2 status synced — frontmatter planned → completed; roadmap row
planned → shipped. schedules-as-yaml-registry was shipped in the
prior session per the 2026-04-19 M2 handoff, but its frontmatter
hadn't been updated."
```

Do NOT push without user confirmation — the 2026-04-19 handoff lists Path A as deferred until after M5 ships, but pushing groom-milestone commits to `origin/main` was unrestricted at M2-shipped. If in doubt, push.

---

## What's next — two independent on-ramps

### On-ramp A — Start M3 implementation

Load the plan file and execute via `superpowers:subagent-driven-development` (the M1/M2 precedent) or `superpowers:executing-plans`. Per-task pattern:
1. Implementer subagent (Haiku for mechanical tasks per plan's model preference column; Sonnet for most; Opus reserved for unusual complexity)
2. Spec-compliance reviewer subagent (catches deviations from the spec's acceptance criteria)
3. Code-quality reviewer subagent (catches DRY violations, error-path gaps, TDR-032 dynamic-import discipline)

**Start sequence:** T1 (manifest schema, Haiku, ~15 min) → T2 (capability-check + lockfile hash, Sonnet, ~45 min) → T3 (plugin-MCP loader skeleton, Sonnet, ~90 min) → T4 (transport dispatch, Sonnet, ~60 min). First four tasks have no cross-dependencies with adapter code and can land back-to-back before any smoke budget is required.

**First smoke budget triggers at T6** (Claude SDK merge extension). Plan T19 covers it. Do NOT skip — TDR-032's module-load cycle is undetectable by unit tests that mock `@/lib/chat/ainative-tools`.

### On-ramp B — Ship the groom commit and stop

If the next session is time-boxed, commit the groom artifacts per §"Uncommitted state" above and write a micro-handoff pointing at the plan file. The groom artifacts are self-contained; M3 implementation can pick up days or weeks later without degradation.

---

## Regression guards — don't undo these

### From this session (M3 groom)

- **Strategy doc §9 Amendments 2026-04-19 AND 2026-04-19 (II)** — both live together in the doc. Amendment 1 defers npm publish until all 5 milestones ship. Amendment 2 rescopes Kind 1 around MCP-as-surface. Both are authoritative. Removing either reopens settled decisions.
- **`capabilities: []` declarative overlay in plugin.yaml** — the Ainative safety overlay on MCP's install-time trust model. Claude Code's `plugin.json` has no equivalent; we are deliberately stricter. If a future contributor argues "Anthropic doesn't do this, why should we?", the answer is in strategy §10 + §11 + the 2026-04-12 rollback discipline.
- **`supportsPluginMcpServers: boolean` in `RuntimeCapability` — Ollama declares `false`**. Ollama's API has no MCP support; flipping to `true` would silently lose plugin tools on every Ollama request. The invariant test in the plan (T5) asserts these values.
- **Five-source merge order with ainative LAST** — TDR-035 §1 non-negotiable. A plugin's `.mcp.json` declaring `mcpServers: { ainative: ... }` MUST be silently dropped by the spread. JS semantics protect this, but a contributor reordering the spread (moving `ainative:` before `pluginServers`) would break the guarantee.
- **`plugins.lock` hash excludes cosmetic fields only** — `name`, `description`, `tags`, `author`. Any NEW manifest field MUST be explicitly categorized as "hashed" or "cosmetic" at addition time. The capability-check test suite (T2) asserts this list.
- **Both `withAinativeMcpServer` call sites pass the same `pluginServers`** — `claude-agent.ts:566` (task execution) + `:724` (resume). The plan's T6 reviewer check calls this out. A task that paused with plugin A installed and resumed after plugin A's capabilities were revoked MUST see the post-revoke state — both call sites re-call `loadPluginMcpServers()` within the same request.

### From prior sessions (still binding)

- Everything from `handoff/2026-04-19-self-extending-machine-m2-shipped-handoff.md` → "Don't undo these" section (M1 + M2 + Path C + Post-M2 fix). Especially: `lastLoadedPluginIds` tracker, boot-order comment in instrumentation-node.ts, dynamic `await import` in all three chat tools, `scanBundleSection<T>` generic helper, column-coverage invariant test, `removeOrphanSchedules` + install-first pattern in `loadOneBundle`, eager `pluginCache` population.

---

## Risks and watches for implementation

### T14 is the highest-complexity task
Confinement modes ship seatbelt + AppArmor policy DSL + Docker wrapper + platform detection + dry-run CLI. Plan pre-authorizes splitting into T14a (enum + stubs) + T14b (seatbelt+AppArmor profiles) + T14c (Docker wrapper) if the monolithic scope feels dense during implementation. This is the "permission to scrap" principle applied to task granularity.

### T19/T20/T21 smoke tests are load-bearing
**Per CLAUDE.md's runtime-registry-adjacent smoke-test budget rule.** Unit tests structurally cannot catch module-load cycles when `@/lib/chat/ainative-tools` is `vi.mock`'d. Precedents:
- M1 T18 caught the state-preservation bug after 19 unit tests passed
- Pre-M1 commits `092f925` → `2b5ae42` shipped with 34/34 green unit tests and 0 TypeScript errors, then crashed at first real request with `ReferenceError`

The three smokes each cover a different integration surface: T19 = cross-runtime execution; T20 = confinement enforcement + Docker lifecycle; T21 = reload atomicity + revocation + safe-mode. Do NOT collapse them.

### Subagent review lanes are earning their keep
M1 T5 spec reviewer missed a stale comment that quality caught. M2 T7 quality caught a DRY violation (private `computeNextFire` parallel to exported `computeNextFireTime`) that spec review missed. M2 T10 quality caught an error-path gap + log-format inconsistency. M3 will likely produce similar asymmetric findings. **Run both lanes on every task.** The cost is small; the catch rate is >2x either lane alone.

### Docker image reproducibility
Plan §T14 acceptance criteria note: `confinementMode: "docker"` requires plugin author to pin image by sha256 digest. `:latest` tags are explicitly rejected. This is a plan-level contract, not a runtime check — the loader doesn't enforce it (can't, in a useful way). But `docs/plugin-security.md` (T17) and the Inbox capability-accept sheet MUST warn loudly when a plugin's `dockerImage` uses a tag rather than a digest.

### First external `[child_process]` plugin is the leading indicator
Strategy §11 Risk D. The Docker off-ramp is pre-scoped into M3 (T14). But when a real external plugin ships with `[child_process]`, we ALSO want:
- A `plugins.log` entry explicitly flagging "external plugin declaring child_process capability" at boot
- A one-time user-facing notification in Inbox: "The plugin `X` declares child_process capability. Consider running with confinementMode: 'docker'. See docs/plugin-security.md."

Neither of these is in T14 scope. Add to the handoff for the session that ships M3 — they're polish/UX, not architecture.

---

## Subagent model mix for M3 implementation

Informed by M1 + M2 runs:

- **Haiku** — T1 (schema), T5 (catalog column), T11 (expiry), T13 (safe-mode), T16 (echo-server fixture), T18 (invariant tests). Works well when output is prescribed or mechanical.
- **Sonnet** — T2 (capability-check), T3 (loader), T4 (transport dispatch), T6–T9 (adapters), T10 (per-tool approval), T12 (revocation), T14 (confinement — unless split, in which case Sonnet per sub-part), T15 (chat tools), T17 (plugin-security.md).
- **Opus** — not allocated. No task in the plan currently requires it. If during implementation a task reveals unexpected architectural tension (new TDR needed), escalate to Opus for the TDR draft, not for the task itself.

---

## Open decisions deferred (still — none block M3 implementation)

- **Per-tool-call audit log** — beyond TDR-034's load/reload/disable events, brainstorm Idea 9. Retention UX deserves its own design. Defer to M3.5 or post-M5.
- **Network-scope DNS allowlist per capability** — brainstorm Idea 6. Manifest shape reserved in spec's Excluded list. Requires confinement enforcement to be useful. Defer.
- **Worker-thread isolation for in-process SDK plugins** — brainstorm Idea 8. stdio covers isolation for M3. Revisit when in-process SDK perf demands it.
- **Cross-plugin MCP session scoping** — brainstorm Idea 5 option A. Theoretical threat. Document the non-issue in `docs/plugin-security.md` (T17) rather than build the mechanism.
- **Runtime Settings toggle for `--safe-mode`** — strategy §13. Boot-time CLI flag only in M3.
- **Capability trust-ramp auto-promotion** — brainstorm delight Idea 1. After 30 `Always Allow` clicks without a deny, suggest "promote to trusted". Post-M3 UX.
- **Confinement profile community gallery** — brainstorm delight Idea 2. Per-capability seatbelt/AppArmor profiles from community contributors. Post-M5.
- **Plugin activity dashboard** — brainstorm delight Idea 3. Requires per-tool-call audit log first. Post-M5.
- **Share-your-accepted-plugins export** — brainstorm delight Idea 5. Team-level plugin-trust propagation without marketplace. Post-M5.
- **M4 (`nl-to-composition-v1`) grooming** — strategy §9 Milestone 4. Depends on M3 shipping. The groom prep is cheap but not needed until M3 is in the rear-view.

---

## Environment state at handoff time

- **Branch:** `main`, 6 files uncommitted (4 modified + 2 new) — all from this session's groom
- **HEAD:** `90487b95` (M2 verification record, pre-groom)
- **Origin:** up to date with HEAD
- **Tests (last known full run):** 192/192 in 30 files at M2-shipped. No new code in this session, so suite unchanged.
- **Known pre-existing test failure:** `src/lib/validators/__tests__/settings.test.ts` → "rejects missing method field" — confirmed pre-existing; track separately.
- **`package.json` version:** still `0.13.3`. npm publish deferred until post-M5 per Amendment 2026-04-19.
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]` — bridge value, tighten at end-of-strategy release.
- **Smoke data dirs:** `~/.ainative-smoke-plugins-m1` (M1) + `~/.ainative-smoke-m2` (M2) still live. `~/.ainative-smoke-m3*` not yet created — will be created during T19/T20/T21.
- **Dev server:** not running.
- **Chat-tool count:** 87 (M2-shipped). M3 adds 4 new chat tools: `grant_plugin_capabilities`, `revoke_plugin_capabilities`, `set_plugin_tool_approval`, `set_plugin_accept_expiry`. End-of-M3 target: 91.
- **TDR count:** 34 → 35 with TDR-035 proposed. TDR-035 transitions to `accepted` at M3 shipped.

---

## Session meta — what this handoff captures vs. what the docs already capture

This handoff intentionally focuses on **what's specific to the continuation**, not what's already in the committed artifacts. For anything not in this handoff, the canonical source is:

- **M3 architectural intent** → `features/chat-tools-plugin-kind-1.md`
- **M3 design decisions** → `.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md`
- **M3 security rationale** → `ideas/m3-security-model-brainstorm.md`
- **M3 implementation ordering** → `.superpowers/plans/2026-04-19-chat-tools-plugin-kind-1.md`
- **Overall strategy** → `ideas/self-extending-machine-strategy.md`
- **Prior state** → `handoff/2026-04-19-self-extending-machine-m2-shipped-handoff.md`

If in doubt, read the doc. This handoff is the routing table, not the authority.

---

*End of handoff. M3 is groomed, TDR'd, brainstormed, and planned. Implementation can begin with T1 (Haiku, ~15 min), and the first smoke budget triggers at T6 (Claude SDK merge). The groom artifacts are commit-ready and represent a clean session boundary.*
