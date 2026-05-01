# Handoff: TDR-037 Phase 6 shipped — M4 is DONE; next session picks up M4.5 (`nl-to-composition-v1`, restored from original roadmap)

**Created:** 2026-04-21 (Phase 6 shipped 2026-04-20 as two commits on `main`: feat `55678765` + hotfix `887ca1cd`. The Self-Extending Machine roadmap was amended the next day to re-introduce `nl-to-composition-v1` as M4.5, since strategy §15 had silently displaced the original M4 scope when it renamed M4 to mean what Phase 6 ended up shipping.)
**Supersedes scope of:** `handoff/2026-04-20-tdr-037-phase-4-shipped-handoff.md` §"What's next — three meaningful choices". That handoff's Option A (Phase 6) is now SHIPPED; Option B (Phase 5 `/plugins` page) stays deferred until a real third-party plugin appears; Option C (original M4 `nl-to-composition-v1`) is what THIS handoff teees up for next session as **M4.5**.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **TDR-037 Phase 6 is shipped — `create_plugin_spec` chat tool + `ainative-app` skill fall-through + `ExtensionFallbackCard` all landed in one atomic commit (`55678765`) plus a small follow-up hotfix (`887ca1cd`) for a UX path-separator bug and spec file-name drift. Strategy §15 M4 (the retitled scope) is DONE. But in the process we realized §15's renaming of M4 effectively dropped the original `nl-to-composition-v1` milestone — the "user types business goal → agent emits composition tool calls → AppMaterializedCard fires" demo that strategy §6 has been promising since day one. This handoff re-introduces that scope as M4.5, sequenced before M5 (install-parity-audit) because M5 is a release gate and M4.5 is the signature demo.** Next session picks up M4.5 with a clear dependency edge: all primitives it orchestrates are already shipped (Phase 2+3's AppMaterializedCard + dynamic sidebar + /apps surface; Phase 6's create_plugin_spec + ExtensionFallbackCard; the existing create_profile / create_blueprint / create_schedule / create_table chat tools). The ONE new thing M4.5 ships is a chat-planner classifier that decides composition vs. plugin vs. conversation.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`handoff/2026-04-20-tdr-037-phase-4-shipped-handoff.md`** — Phase 4 ship (M3 acceptance, TDR-037 `accepted`). Phase 6 is additive on top of Phase 4; M4.5 is additive on top of Phase 6.
3. **`handoff/2026-04-20-tdr-037-phase-2-3-shipped-handoff.md`** — Phase 2+3 ship (`AppMaterializedCard` + dynamic sidebar + `/apps` + 3 starter templates). M4.5's "AppMaterializedCard fires automatically" promise depends entirely on this foundation.
4. **`docs/superpowers/specs/2026-04-20-tdr-037-phase-6-design.md`** — Phase 6 design spec (committed `108924bb`). The `create_plugin_spec` + `ExtensionFallbackCard` + skill fall-through contract. M4.5 orchestrates these artifacts, so read the design for their shapes.
5. **`docs/superpowers/plans/2026-04-20-tdr-037-phase-6-implementation.md`** — Phase 6 implementation plan (committed in `55678765` alongside the code). The bite-sized task plan that executed this session.
6. **`ideas/self-extending-machine-strategy.md` §9 REVISED** — milestone ordering (now updated with M4.5 amendment dated 2026-04-21). Strategy §15 is the authoritative amendment that landed the two-path trust model; §9 is the ordering table.
7. **`features/roadmap.md` §"Self-Extension Platform"** — updated this session: M3 `planned` → `shipped`; M4 row now reads "create-plugin-spec + ainative-app fall-through + ExtensionFallbackCard" with status `shipped`; new M4.5 row inserted between M4 and M5 for `nl-to-composition-v1`.
8. **`.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md`** — TDR-037 is still `accepted` and unchanged. M4.5 does NOT require a new TDR (see §"Architectural classification" below).
9. **CLAUDE.md runtime-registry smoke rule** — M4.5 touches the chat-planner surface at `src/lib/chat/` and potentially `src/lib/agents/claude-agent.ts` for runtime prompt augmentation. Budget an end-to-end smoke if the chat agent's system-prompt path changes — see "Risks and watches" §2.

---

## What shipped this session (Phase 6)

### Three commits on `main`

```
887ca1cd  fix(plugins): TDR-037 Phase 6 follow-up — path separator + spec drift
55678765  feat(plugins): TDR-037 Phase 6 — create_plugin_spec + ainative-app fall-through + ExtensionFallbackCard
108924bb  docs(spec): TDR-037 Phase 6 design — create_plugin_spec + ainative-app fall-through + ExtensionFallbackCard
```

Plus today's roadmap amendment (not yet committed when you read this — commit at end of this handoff session):

```
<PENDING>  docs(roadmap): re-introduce nl-to-composition-v1 as M4.5 + Phase 6 handoff
```

**HEAD on `main`:** `887ca1cd` before the roadmap commit; one commit ahead after. **`origin/main`:** awaiting user-initiated push (CLAUDE.md risky-action discipline). Working tree clean after the roadmap commit.

### Piece 1 — `create_plugin_spec` chat tool (shipped)

**File:** `src/lib/chat/tools/plugin-spec-tools.ts` (574 LOC — ~200 LOC TS logic + ~370 LOC embedded Python template body).

Scaffolds Kind 1 MCP plugins under `~/.ainative/plugins/<id>/` with the belt-and-suspenders self-extension metadata: `author: "ainative"` AND `origin: "ainative-internal"`. Either alone triggers `classifyPluginTrust()` signals #1 or #2 → `"self"`; both survive future refactors that strip one field. Atomic write: tmp-dir + `fs.renameSync`, with best-effort cleanup on mid-write failure throwing `PluginSpecWriteError`. Three named error classes (`PluginSpecAlreadyExistsError`, `PluginSpecInvalidIdError`, `PluginSpecWriteError`), each with `override name = "..." as const`.

v1 scope: Python + stdio bodies only. `language: "node"` or `transport: "inprocess"` writes TODO-stubs pointing at Phase 6.5. Reserved id list seeded with `echo-server` (protects the reference fixture).

Registered in `src/lib/chat/ainative-tools.ts` immediately after `pluginTools(ctx)`. **Chat tool count: 91 → 92.**

**Tests (15 green, 261ms):**

- Scaffold happy-path — all 4 files land at `~/.ainative/plugins/<id>/`.
- `plugin.yaml` contains `author: ainative` AND `origin: ainative-internal` (belt-and-suspenders assertion).
- `.mcp.json` has `stdio+python` config with `${PLUGIN_DIR}/server.py` args (expanded by `mcp-loader.ts:142`).
- `server.py` has a handler stub per declared tool; structurally identical to `echo-server/server.py`.
- README references echo-server + origin contract.
- Refuses to overwrite existing plugin dir → `PluginSpecAlreadyExistsError`.
- Rejects uppercase id, leading-digit id, reserved `echo-server` id → `PluginSpecInvalidIdError`.
- Node+inprocess writes TODO-stub with "Phase 6.5" markers.
- **Classifier integration (test #10):** load scaffolded manifest, call `classifyPluginTrust(manifest, pluginDir, { userIdentity: "someone-else-entirely", appsBaseDir: elsewhere })` → expects `"self"`. Proves belt-and-suspenders works via signals #1+#2 alone (not path or user-identity).
- Temp-dir cleaned up on mid-scaffold failure (throws `PluginSpecWriteError` with type assertion).
- Chat tool happy-path returns `ok: true`; invalid id returns `isError: true` with `PluginSpecInvalidIdError` name prefix.
- **Defensive empty-tools render:** when `tools: []` (bypassing Zod min(1)), emits `_TOOL_NAMES = set()` not `{  }` (which Python parses as empty dict).

### Piece 2 — `ainative-app` skill fall-through (shipped)

**File:** `.claude/skills/ainative-app/SKILL.md` — two new subsections.

Phase 2 gained "Fall-through: when composition can't express the ask" with three canonical example gaps (external HTTP, custom parsers, domain CLI wrappers), the exact `create_plugin_spec` invocation parameters to use, and the sticky `origin: ainative-internal` contract callout.

Phase 3 gained "Dual-target emit when a plugin is scaffolded" documenting the two artifact targets: `~/.ainative/plugins/<slug>/` (executable, written by `create_plugin_spec`) AND `~/.ainative/apps/<app-id>/manifest.yaml` (thin composition manifest with `plugins:` reference key, so `/apps` surfaces the composed app). The warning against collapsing the two dirs is preserved from Phase 4's manifest-location fix.

### Piece 3 — `ExtensionFallbackCard` (shipped, renderable-only)

**File:** `src/components/chat/extension-fallback-card.tsx` (241 LOC including JSDoc).

Renderable-only in v1. Three states: `prompt` (two-path UI with compose-alt "Try this" outline button + scaffold "Scaffold + open" default button), `scaffolded` (Sparkles icon + collapsed edit-server.py instruction), `failed` (destructive-toned AlertCircle + font-mono error message + Retry button).

- **`role="alert"` on failed state container** — WCAG 4.1.3 (Status Messages, AA).
- **Re-entrancy guard in `handleScaffold`** — `if (scaffolding) return;` before `setScaffolding(true)` serializes double-clicks.
- **Trailing-slash normalization** — hotfix `887ca1cd` fixed a UX bug where live-flow `result.pluginDir` (absolute path with no trailing slash) rendered as `<dir>server.py` (missing separator). Now: `result.pluginDir.endsWith("/") ? result.pluginDir : result.pluginDir + "/"` at setState.
- **Calm Ops compliant** — `rounded-xl border bg-card p-4 my-2` opaque surface, no `backdrop-filter`/`rgba()`/`glass-*`/`gradient-*` (MEMORY.md discipline verified via grep).

**Tests (7 green):** prompt-state rendering, `onTryAlt` click, `onScaffold` click → scaffolded transition (with separator assertion post-hotfix), failure → retry, retry returns to prompt, `initialState="scaffolded"` honoring, **double-click re-entrancy guard** (uses never-resolving promise, verifies `onScaffold.toHaveBeenCalledTimes(1)`).

**Planner wiring is out of scope for Phase 6 — deferred to 6.5 OR absorbed into M4.5** (see §"What's next").

### Hotfix commit `887ca1cd` — three small fixes from final cross-task review

1. **Path separator bug in `ExtensionFallbackCard` scaffolded state** — `setState` now normalizes trailing slash on `result.pluginDir`. Test strengthened from permissive `/server\.py/` to explicit `/github-mine\/server\.py/` so the regression can't slip through again.
2. **Design spec filename drift** — the Phase 6 design spec referenced `create-plugin-spec-tool.ts` in 7 places but the implementation shipped as `plugin-spec-tools.ts`. All 7 occurrences replaced via two `Edit replace_all` calls. Future readers running the spec's verification commands will now hit real files.
3. **Spec comment drift** — spec said `files` returns "relative paths" but `scaffoldPluginSpec` returns absolute paths. Comment updated.

### Test totals at handoff time

- **Phase 6 test suites:** 15 + 7 = **22/22 passing** (plugin-spec-tools + extension-fallback-card).
- **Broader regression:** `npx vitest run src/lib/chat/ src/components/chat/` → **273/273 passing** across 29 test files.
- **Typecheck:** `npx tsc --noEmit` clean. LSP diagnostic panel is consistently flaky per MEMORY.md (multiple phantom "Cannot find module" and `toBeInTheDocument`/`toHaveAttribute` warnings surfaced during this session and can be safely ignored — ground truth is `tsc`).

### Total diff `a6618e25..887ca1cd` (Phase 4 ship → Phase 6 hotfix)

```
 .claude/skills/ainative-app/SKILL.md                           |   58 +
 docs/superpowers/plans/2026-04-20-tdr-037-phase-6-implementation.md | 1569 ++++++++++++++++++++
 docs/superpowers/specs/2026-04-20-tdr-037-phase-6-design.md    |  405 ++++
 features/changelog.md                                          |    8 +
 src/components/chat/__tests__/extension-fallback-card.test.tsx |  174 +++
 src/components/chat/extension-fallback-card.tsx                |  246 +++
 src/lib/chat/ainative-tools.ts                                 |    2 +
 src/lib/chat/tools/__tests__/plugin-spec-tools.test.ts         |  208 +++
 src/lib/chat/tools/plugin-spec-tools.ts                        |  574 +++++++
 9 files changed, 3244 insertions(+)
```

### Roadmap amendment this session (pending commit)

**File:** `features/roadmap.md` — three rows touched in the "Self-Extension Platform" section:

- M3 row: status `planned` → `shipped`.
- M4 row: title changed from `nl-to-composition-v1 (Milestone 4)` → `create-plugin-spec + ainative-app fall-through + ExtensionFallbackCard (Milestone 4)`; status `planned` → `shipped`; dependencies updated.
- **New M4.5 row inserted:** `nl-to-composition-v1 (Milestone 4.5)`, P1, planned, dependencies = `create-plugin-spec (M4), AppMaterializedCard, ExtensionFallbackCard, chat planner layer`.
- M5 row: dependency updated from `nl-to-composition-v1` to same (unchanged name, re-linked to M4.5 position).

**File:** `ideas/self-extending-machine-strategy.md` §9 REVISED — M3-γ and M4 marked shipped inline; new paragraph adds M4.5 amendment dated 2026-04-21. `ideas/` is gitignored so this edit is local-only but captured here for future-session visibility.

---

## Architectural classification: does M4.5 need a new TDR?

**No.** Analyzed against the architect skill's drift-detection heuristics:

- **M4.5 consumes existing contracts** — `classifyPluginTrust`, `create_plugin_spec`, `withAinativeMcpServer`, the Phase 2+3 `AppMaterializedCard` event surface, the existing chat-tool registry via `ainative-tools.ts`. No new surface is introduced.
- **No runtime-registry changes** — M4.5 doesn't alter `src/lib/agents/runtime/catalog.ts`, doesn't add/remove fields from `RuntimeAdapter`, doesn't change provider-registration semantics. CLAUDE.md smoke-test budget rule does not structurally apply, though see "Risks and watches" §2 for a softer requirement (system-prompt path).
- **Planner lives in chat layer** — the new code is a classifier module at `src/lib/chat/*` that receives chat turns, classifies intent, and emits tool calls via the already-shipped registry. That's the same level of abstraction as the existing chat-tool dispatcher; no architectural tier added.
- **TDR-037 stays authoritative** — M4.5's scaffold path (when it triggers `create_plugin_spec`) lands on the self-extension trust path already codified. M4.5 doesn't reopen the trust model.

If M4.5's classifier evolves to call LLM-based intent detection (e.g., a cheap Haiku pass on incoming messages before dispatch), **that** would warrant a TDR — because it would introduce a second LLM hop at chat-dispatch time with cost and latency implications. Expected but not load-bearing for the v1 planner, which can start with pattern matching (see "Planner v1 scope" below).

---

## What's next — M4.5 (`nl-to-composition-v1` restored), sequenced before M5

### Why M4.5 is the recommended next milestone

Strategy §15 amendment dated 2026-04-20 renamed M4 to be what Phase 6 shipped. That rename effectively **dropped** the original M4 scope — the "user types business goal → agent emits composition tool calls → `AppMaterializedCard` fires automatically" flow that strategy §6 has promised since day one. Without it, a user typing *"build me a weekly portfolio check-in"* in chat today gets a plain text response. None of the beautiful composition infrastructure fires.

This is the **signature demo** the strategy has been pointing at. M5 (install-parity-audit) is a release gate — it has no user-facing value on its own. Shipping M5 before M4.5 means the baseline it audits has no demo to justify auditing. **M4.5 before M5** is the right order.

### M4.5 scope — three additive deliverables

**Piece 1 — Chat-planner classifier** (`src/lib/chat/planner/`, new module, ~200 LOC)

Receives: the inbound user message + recent chat context + available tool inventory.

Emits: one of three verdicts:

1. `{ kind: "compose", plan: { profile, blueprint, schedule?, tables?, ... }, rationale }` — the ask maps to existing primitives. Agent proceeds to call `create_profile` / `create_blueprint` / `create_schedule` / `create_table` / `instantiate_blueprint` as a sequence.
2. `{ kind: "scaffold", plugin: CreatePluginSpecInput, rationale }` — the ask requires a primitive composition can't express. Agent emits `ExtensionFallbackCard` with the pre-inferred `create_plugin_spec` inputs.
3. `{ kind: "conversation" }` — not an app ask. Agent falls through to normal chat behavior.

**v1 planner approach**: pattern-based. Starts with an explicit trigger phrase list ("build me", "build an app", "create an app for", "I need a tool that", "set up a workflow for", "make me an app", + the `ainative-app` skill's Phase 1 trigger phrases). Pattern match → suggest primitives by keyword correlation (portfolio → wealth-manager profile, research → researcher profile, etc.). If no confident match, return `conversation`.

**v2 planner approach (deferred)**: small Haiku-based intent detection pass. Adds LLM hop cost; warrants TDR.

**Piece 2 — Planner → ExtensionFallbackCard wiring**

When planner returns `{ kind: "scaffold", ... }`, the chat agent emits the `ExtensionFallbackCard` via the existing message-renderer pipeline. This is the **Phase 6.5 item folded into M4.5** — one continuous chat session from "I want X" to "X is scaffolded". Card's `onScaffold` handler calls `create_plugin_spec` with planner-inferred inputs; `onTryAlt` re-enters the planner with the compose-alt prompt.

**Piece 3 — Planner → AppMaterializedCard wiring**

When planner returns `{ kind: "compose", plan: ... }`, the chat agent sequences the composition tool calls. When the sequence completes (all primitives created), the **existing** `AppMaterializedCard` fires via the Phase 2+3 message-renderer hook. No new card work — Phase 2+3 already shipped the card and its tool-call-sequence detector; we just need the planner to actually drive those tool calls.

### M4.5 implementation plan skeleton

1. **Spec phase** — `docs/superpowers/specs/2026-04-21-m4.5-nl-to-composition-design.md`. Clarify: pattern-based vs LLM-based planner for v1? Trigger phrase whitelist? Intent taxonomy? Acceptance criteria for "composition vs scaffold vs conversation" judgment?
2. **Planner module** — `src/lib/chat/planner/classifier.ts` + `planner.ts` + tests. Pure functions where possible; one side-effecting adapter for tool-call dispatch.
3. **Chat integration** — hook planner into the existing chat message-received path. Most likely site: `src/lib/chat/ainative-tools.ts` or `src/lib/chat/chat-engine.ts` (the actual wiring point needs exploration in the next session's first 10 minutes).
4. **Card wiring** — replace the Phase 6.5 TODO in `ExtensionFallbackCard`'s consumer side with the planner's scaffold-verdict emit path.
5. **AppMaterializedCard end-to-end** — verify the existing detector in `src/components/chat/message-renderer.tsx` (or wherever it lives — Phase 2+3 handoff has the pointer) fires when the planner-driven tool-call sequence completes.
6. **Tests** — classifier unit tests (trigger phrase matches, primitive-suggestion correlation, non-app conversations don't trigger). Integration tests for the three verdict paths.
7. **Smoke** — end-to-end in a real `npm run dev` session: type "build me a weekly reading-list app" in chat, verify planner fires, verify `create_profile`/`create_blueprint`/`create_table` tool calls emit, verify `AppMaterializedCard` renders with a "Reading List is live" message + sidebar entry populates (dynamic-sidebar promise from Phase 2+3). Separately: type "I need a tool that pulls my GitHub issues" and verify `ExtensionFallbackCard` fires with the right inferred plugin inputs.
8. **Changelog + handoff** — `## 2026-04-21` (or whatever date M4.5 ships) entry under `features/changelog.md`. Hand off to M5.

### M4.5 blast radius

- **Adds:** `src/lib/chat/planner/*` module, planner integration point in chat message path, card-wiring adapters.
- **Modifies:** the chat message dispatch path (one hook point).
- **Does NOT touch:** plugin trust machinery, TDR-037 classifier, `create_plugin_spec`'s scaffold logic, the cards' visual surfaces, `src/lib/agents/runtime/*`, `mcp-loader.ts`, `capability-check.ts`.
- **LOC estimate:** ~400–500 LOC of new code + ~100 LOC of tests. Similar scope to Phase 6.

### Open decisions for M4.5 implementer

1. **Planner v1 — pattern-based vs. LLM-based?** Recommendation: pattern-based for v1 (no new LLM hop, no TDR, cheap, deterministic). LLM-based (Haiku intent pass) as v2 once the pattern-based classifier surfaces its accuracy ceiling with real use.
2. **Where to hook into chat dispatch** — candidates: `src/lib/chat/ainative-tools.ts` (tool-level), `src/lib/chat/chat-engine.ts` (dispatch-level), or a new `src/lib/chat/planner/hook.ts` (planner-specific hook point). Most surgical is probably the dispatch level.
3. **Trigger phrase scope** — ship with a curated list OR broaden to any message with an imperative verb + noun pattern? Curated list is safer for v1; can broaden once accuracy is measured.
4. **Chat history context** — planner sees only the current message, or last N messages? Context helps disambiguate "build me an app" (new ask) vs "build that into the app" (reference to existing ask). Recommendation: current message + last 2 turns for v1.
5. **Confidence threshold** — if planner's match is low-confidence, fall through to conversation or prompt the user to confirm? Recommendation: fall through silently — no false-positive costs beat rare false negatives.

---

## Alternative options (not recommended, captured for completeness)

### Option B: Phase 5 — `/plugins` page

Still deferred per Phase 4 handoff. No new third-party plugin exists in the repo, so the page would show one row for `mcp__echo-server__echo` with a "trust path: self" badge — not meaningful UX. **Defer until a real third-party plugin arrives** (leading indicator: first plugin with `capabilities` non-empty AND `author` neither `"ainative"` nor the current user email).

### Option C: Phase 6.5 follow-ups as a standalone milestone

Smaller scope than M4.5 but much lower user-facing leverage. The 5 items:

- Planner wiring for `ExtensionFallbackCard` → already rolled into M4.5 Piece 2.
- Node/inprocess template bodies in `create_plugin_spec` → useful when someone actually needs Node; no urgency.
- Unmount guard pattern across `handleScaffold` (card) + `handleUndo` (`AppMaterializedCard`) → cross-cutting cleanup; cosmetic in React 18.
- `initialState="failed"` dedicated test → test-coverage polish.
- `initialFailedMessage` prop slot → forward-looking for state serialization; Phase 6.5 or later.

Folding #1 into M4.5 leaves #2-#5 as scattered polish that can ship opportunistically.

### Option D: Skip to M5 (install-parity-audit)

M5 is a release gate with no user-facing value on its own. Shipping it before M4.5 would "audit install parity" on a baseline that has no demo to justify auditing. **Strongly not recommended.**

---

## Uncommitted state at handoff

**Working tree state BEFORE the roadmap commit:** clean. After this session's roadmap amendment is committed: clean again.

**Not pushed** — CLAUDE.md risky-action discipline; pushing waits for explicit user approval. Run `git push origin main` when ready (will push 5 commits ahead of `origin/main`: `108924bb` Phase 6 spec + `55678765` Phase 6 feat + `887ca1cd` Phase 6 hotfix + this handoff's roadmap commit + this handoff file itself).

**Not committed** (intentional):
- `ideas/self-extending-machine-strategy.md` §9 REVISED amendment for M4.5 — `ideas/` is gitignored per MEMORY.md. Lives locally; mirrored in this handoff for future-session visibility.
- `/Users/manavsehgal/.claude/plans/time-to-consult-the-clever-rose.md` — plan outside the repo, unchanged since Phase 4.

---

## Regression guards — don't undo these

### From Phase 6 (shipped 2026-04-20)

**`plugin-spec-tools.ts` MUST stay out of the runtime-registry import chain.** The file has zero static imports from `@/lib/plugins/*` or `@/lib/agents/*`. Adding one — even a seemingly-innocent `import type` — risks the module-load cycle documented in TDR-032. A future contributor "tidying up" by consolidating plugin-adjacent imports must be stopped. Verify with: `grep -n "from .@/lib/\(plugins\|agents\)" src/lib/chat/tools/plugin-spec-tools.ts` → expected zero matches.

**Scaffold must emit BOTH `author: "ainative"` AND `origin: "ainative-internal"`.** Belt-and-suspenders across classifier signals #1 + #2. Either alone is sufficient; both are load-bearing across refactors. A future contributor stripping one thinking it's redundant breaks the contract. Test #2 in `plugin-spec-tools.test.ts` asserts both lines are present; keep it green.

**Reserved id list.** `echo-server` is reserved to protect the reference fixture. Future reserved ids go in the same `RESERVED_IDS` Set in `plugin-spec-tools.ts:68`.

**`ExtensionFallbackCard` trailing-slash normalization.** The hotfix in `887ca1cd` added `result.pluginDir.endsWith("/") ? result.pluginDir : result.pluginDir + "/"` at the `setState` call for the scaffolded state. The test now asserts against `/github-mine\/server\.py/` (separator-aware) instead of the permissive `/server\.py/`. Don't regress.

**`role="alert"` on the card's failed-state container.** WCAG 4.1.3 compliance. A future contributor removing it "for style reasons" breaks screen-reader discoverability of scaffold failures.

### From Phase 4 (shipped 2026-04-20)

All regression guards from `handoff/2026-04-20-tdr-037-phase-4-shipped-handoff.md` still stand. Key ones that intersect with M4.5:

- **TDR-037 stays `accepted`.** M4.5 does not reopen the trust model. Re-entering the marketplace / trust-tier lane (strategy §10 refused) requires a successor TDR.
- **`features/chat-tools-plugin-kind-1.md` stays `shipped`.** M4.5 is additive on M3, not a re-scope.
- **Self-extension bypass bypasses the lockfile entirely.** M4.5's planner routes scaffolded plugins through `create_plugin_spec`, which inherits the Phase 4 classifier bypass. A regression that makes the planner write to `plugins.lock` for self-extension bundles would surface as unexpected lockfile entries; watch for it.
- **Settings toggle `plugin-trust-model` has THREE values: `auto | strict | off`.** Collapsing to a boolean would lose the `strict` lane (training wheels) and the `off` lane (CLI-grade trust). Planner must respect the setting when deciding whether to invoke `create_plugin_spec` in strict mode (probably: don't auto-invoke; let user explicitly request).

### New for this session

**Strategy §15 amendment 2026-04-20 is still authoritative.** §9 REVISED (updated 2026-04-21 with M4.5) is the milestone ordering; §15 is the trust-model decision. Both live in `ideas/self-extending-machine-strategy.md` (gitignored) and are mirrored in TDR-037 + this handoff.

**Roadmap row titles:** M4 is now "create-plugin-spec + ainative-app fall-through + ExtensionFallbackCard", NOT "nl-to-composition-v1". The `nl-to-composition-v1` title belongs to M4.5. A future contributor "fixing the milestone names" by reverting M4 to `nl-to-composition-v1` would erase the shipped-status signal. Preserve the new labels.

---

## Risks and watches for next session (M4.5)

### 1. Chat-dispatch hook point may cross the runtime-catalog chain

M4.5 adds a planner classifier that runs on inbound chat messages. The natural hook point is somewhere in `src/lib/chat/chat-engine.ts` or a peer. If that file (or anything transitively reachable from it) imports `src/lib/agents/runtime/catalog.ts`, then adding a new import from the planner module back into the chat-engine hook point could introduce a module-load cycle. Budget an early-session grep: `rg "runtime/catalog" src/lib/chat/` to see the current reachability map before picking the hook point.

### 2. System-prompt path — soft CLAUDE.md smoke-test budget

If M4.5's planner adjusts the chat agent's system prompt (e.g., injecting "available composition primitives: ..." into the context), that touches the system-prompt construction path. The CLAUDE.md runtime-registry rule applies loosely here — smoke-test to verify no `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` surfaces at first `npm run dev` request. The Tier 0 capability matrix at `src/lib/agents/runtime/catalog.ts` (`hasNativeSkills`, `stagentInjectsSkills`, `autoLoadsInstructions`) is the authority for whether Stagent should do X or trust the runtime.

### 3. Trigger-phrase false positives

A pattern-based planner is prone to false positives ("build me a list of books" → planner fires "build me a" + "list" → incorrectly classifies as app ask). Mitigations:

- Ship with a conservative phrase list; measure false-positive rate via the existing chat history.
- Add a confidence threshold; below it, fall through to conversation silently.
- Consider adding a "was this helpful?" inline chip on the `AppMaterializedCard` / `ExtensionFallbackCard` so accidental triggers can be dismissed without noise.

### 4. Composition primitive suggestion drift

As new profiles/blueprints/tables are added to the registry, the planner's primitive-suggestion map (portfolio → wealth-manager, research → researcher, etc.) will drift. Acceptable for v1; worth adding a test that asserts the map can enumerate all builtin primitives without hitting unknown ids.

### 5. AppMaterializedCard detector is not well-documented

Phase 2+3 shipped the `AppMaterializedCard` with a tool-call-sequence detector somewhere in the chat message renderer. The exact file is probably `src/components/chat/message-renderer.tsx` or `chat-message.tsx` — M4.5's first task should be to locate the detector and confirm its trigger contract before wiring the planner to drive it. If the detector is tightly coupled to specific tool-call shapes, M4.5 might need to adjust one or the other.

### 6. Phantom LSP warnings will continue

MEMORY.md: "The TS diagnostic panel is consistently flaky." Phase 6 session saw many phantom "Cannot find module" + `toBeInTheDocument` warnings. They're false positives. Trust `npx tsc --noEmit` over the panel. Add to the session-start checklist if not already: run `npx tsc --noEmit` once early and treat it as ground truth.

### 7. Composition-only vs. scaffold-required disambiguation

Some user asks are genuinely ambiguous: "I need a GitHub issues tool" could mean (a) compose a workflow that fetches issues via existing web-fetch + documents or (b) scaffold a Kind 1 plugin. Planner needs a decision rule. Recommendation: default to composition (cheaper, no reload); only suggest scaffold when the ask explicitly requires capabilities composition can't express (external API auth, native CLI invocation, long-running subprocess). Surface the decision rationale in the card copy.

---

## Open decisions deferred to M4.5 / later

- **Planner v1 architecture — pattern-based vs. Haiku LLM pass.** Recommend pattern-based for v1 to avoid new LLM hop; Haiku pass as v2 once the pattern classifier surfaces accuracy limits. (Has TDR implications if v2 ships.)
- **Intent taxonomy.** What's the canonical set of verdict kinds? Current proposal: `compose | scaffold | conversation`. Is there a 4th (e.g., `query` — user asking about an existing app)? Decide in M4.5 spec phase.
- **Confidence threshold for planner dispatch.** Numeric threshold, or binary "match or don't"? Recommendation: binary for v1; numeric once real usage data exists.
- **Planner dry-run mode.** Should `AINATIVE_PLANNER_DRY_RUN=1` emit the planner verdict to a log without actually dispatching tool calls? Useful for tuning the classifier; not blocking for ship.
- **Multi-turn composition.** v1 planner treats each message atomically. "Build me a reading list. Actually, make it also track ratings" needs multi-turn understanding. Defer to M4.6 or a later iteration.
- **Planner cost at scale.** If chat traffic grows 10x, does the pattern classifier become a bottleneck? v1 is O(n) regex over a short phrase list; not a real concern. Revisit if v2 adds a Haiku pass.

---

## Environment state at handoff time

- **Branch:** `main`, working tree clean after the roadmap commit lands.
- **`origin/main`:** awaiting user-initiated push (4 commits ahead pre-roadmap-commit; 5 commits ahead post-commit).
- **HEAD:** `887ca1cd` (Phase 6 hotfix) before the roadmap commit; new SHA after.
- **Tests:** Phase 6 suites (15 plugin-spec-tools + 7 extension-fallback-card) all green. Broader chat + components regression: 273/273 green. No new tests in the roadmap-amendment commit.
- **`npx tsc --noEmit`:** clean.
- **`package.json` version:** still `0.13.3`. npm publish still deferred until post-M5 per strategy amendment 2026-04-19 (unchanged).
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]` (unchanged).
- **Dev server:** not running (this session didn't start `npm run dev`).
- **Chat-tool count:** 92 (91 before Phase 6 + 1 from `create_plugin_spec`).
- **TDR count:** 37 (no new TDRs this session; TDR-037 stays `accepted`).
- **Feature spec status:**
  - `chat-tools-plugin-kind-1` stays `shipped`.
  - `nl-to-composition-v1` is **not yet a feature spec**. M4.5 implementer should write it under `features/nl-to-composition-v1.md` during the spec phase.
- **Feature flags (both default OFF, unchanged):**
  - `AINATIVE_PER_TOOL_APPROVAL=1` — activates Layer 1.8 per-tool approval resolver.
  - `AINATIVE_PLUGIN_CONFINEMENT=1` — activates seatbelt/apparmor/docker wrap + Docker boot sweep.
- **Settings key (unchanged):** `plugin-trust-model` (`auto` default, `strict`, `off`).

### New artifacts this session (Phase 6 + roadmap amendment)

Committed:

- `docs/superpowers/specs/2026-04-20-tdr-037-phase-6-design.md` (405 lines — file-name drift fixed in hotfix).
- `docs/superpowers/plans/2026-04-20-tdr-037-phase-6-implementation.md` (1569 lines — bundled into the Phase 6 feat commit).
- `src/lib/chat/tools/plugin-spec-tools.ts` (574 LOC).
- `src/lib/chat/tools/__tests__/plugin-spec-tools.test.ts` (208 LOC, 15 tests).
- `src/components/chat/extension-fallback-card.tsx` (246 LOC post-hotfix).
- `src/components/chat/__tests__/extension-fallback-card.test.tsx` (174 LOC, 7 tests).
- `.claude/skills/ainative-app/SKILL.md` (modified — 58 lines added).
- `features/changelog.md` (modified — 8 lines added for Phase 6 H3).
- `src/lib/chat/ainative-tools.ts` (modified — 2 lines added for chat tool registration).

Pending commit (this handoff session):

- `features/roadmap.md` (modified — M3 status flip + M4 title + M4.5 row insertion).
- `handoff/2026-04-21-tdr-037-phase-6-shipped-handoff.md` (new — this file).

Not committed (intentional):

- `ideas/self-extending-machine-strategy.md` §9 REVISED amendment — gitignored local doc.

---

## Session meta — canonical sources

This handoff focuses on **Phase 6 shipped → M4 done → M4.5 as the next user-facing milestone**. Don't re-read Phase 6 internals here; read the source:

- **Phase 6 design + implementation** → `docs/superpowers/specs/2026-04-20-tdr-037-phase-6-design.md` + `docs/superpowers/plans/2026-04-20-tdr-037-phase-6-implementation.md`.
- **TDR-037 status + content** → `.claude/skills/architect/references/tdr-037-two-path-plugin-trust-model.md` (still `accepted`).
- **Roadmap** → `features/roadmap.md` §"Self-Extension Platform" (M3 + M4 shipped, M4.5 new + planned, M5 unchanged).
- **Changelog** → `features/changelog.md` `## 2026-04-20` `### Shipped — Phase 6` H3.
- **Strategy** → `ideas/self-extending-machine-strategy.md` §9 REVISED (M4.5 amendment 2026-04-21).
- **Commits** → `git show 887ca1cd`, `git show 55678765`, `git show 108924bb`.

If in doubt, read the source. This handoff is the routing table, not the authority.

---

*End of handoff. Phase 6 shipped as two commits (feat + hotfix) plus a design-spec commit. M4 per strategy §15 amendment is DONE. M4.5 (`nl-to-composition-v1` restored, original M4 scope) is teed up as the next milestone — chat-planner classifier + end-to-end wiring of already-shipped `AppMaterializedCard` and `ExtensionFallbackCard` primitives. Recommended next session: write the M4.5 design spec, implement the pattern-based v1 planner, wire end-to-end, smoke in a real `npm run dev` with "build me a weekly reading-list app" as the golden-path prompt. M5 (install-parity-audit) stays the final milestone; it's a release gate, not user-facing value, so it ships after M4.5 delivers the signature demo the strategy has been promising. One atomic npm release after M5 passes parity per amendment 2026-04-19.*
