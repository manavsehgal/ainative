# Handoff: Phase 1.2 shipped (composed-app-manifest-view-field) — Phase 2 is next

**Created:** 2026-05-02 (late evening)
**Status:** Phase 1.2 (`composed-app-manifest-view-field`) complete in working tree, **not yet committed**. Working tree has 6 modified + 5 new files (all under `src/lib/apps/`, `src/app/apps/[id]/`, and `features/`). `main` is clean against `origin/main` — predecessor's "1 commit ahead" was pushed between sessions.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-02-composed-app-view-shell-phase1-1-handoff.md`

---

## TL;DR for the next agent

1. **Phase 1.2 is done. Commit it next.** All work is staged in the working tree but uncommitted because the user did not authorize a commit. Run `git status` to see the 11 modified/added files, then commit with the message in the changelog entry. Recommended split: one commit covering everything in Phase 1.2 (it's a self-contained feature). After committing, push is the user's call — current state will be 1 commit ahead of origin.

2. **Start Phase 2 next: `composed-app-kit-tracker-and-hub`.** This is the gate that matters for the 7-feature initiative — the first phase where users see real domain-aware kits. Spec at `features/composed-app-kit-tracker-and-hub.md`. Two kits ship (`tracker` + `workflow-hub` fallback) plus four shared primitives (KPIStrip, LastRunCard, ScheduleCadenceChip, RunNowButton) and a KPI evaluation engine.

3. **Three open questions for Phase 2:**
   - **KPI evaluation engine boundary**: where does `evaluateKpi(spec, runtime) → string | number` live? Probably `src/lib/apps/view-kits/kpi.ts` adjacent to `inference.ts`. Decide at design time, not implementation time.
   - **Shared primitives location**: spec says ≥2 kits must use a primitive before lifting it to `src/components/apps/kit-view/primitives/`. KPIStrip and LastRunCard are used by ≥2 kits per the spec, so they qualify on day 1.
   - **Real kit registration**: when adding `tracker` and `workflow-hub` to the `viewKits` registry in `src/lib/apps/view-kits/index.ts`, the graceful-fallback to `placeholderKit` continues to work for unregistered kits — Phase 2 just defines the two real entries and Phase 1.2's inference picks them up automatically.

---

## What landed this session

```
src/lib/apps/registry.ts                                # +ViewSchema (strict),
                                                        #   KitIdSchema (enum),
                                                        #   BindingRefSchema (strict union),
                                                        #   KpiSpecSchema (5-arm discriminated union),
                                                        #   AppManifestSchema gains view: optional()

src/lib/apps/view-kits/inference.ts                     # NEW. pickKit(manifest, columns) → KitId.
                                                        #   7 pure rule predicates: ledger, tracker,
                                                        #   research, coach, inbox, multiBlueprint,
                                                        #   fallback. Column-shape probes for
                                                        #   currency/date/boolean using
                                                        #   semantic + name regex.

src/lib/apps/view-kits/index.ts                         # pickKit stub replaced; now delegates to
                                                        #   inference + resolveKit (with placeholder
                                                        #   fallback for unregistered KitIds).
                                                        #   New loadColumnSchemas(app, [getColumns])
                                                        #   reads from data layer with injectable
                                                        #   fetcher for tests.

src/app/apps/[id]/page.tsx                              # Calls loadColumnSchemas → pickKit with
                                                        #   real columns instead of [].

src/lib/apps/__tests__/view-schema.test.ts              # NEW. 13 tests: defaults,
                                                        #   strict-rejection of unknown keys,
                                                        #   discriminated-union rejection of
                                                        #   formula KPIs, binding refs.
src/lib/apps/__tests__/golden-master.test.ts            # NEW. 5 tests: snapshot fixtures
                                                        #   (habit-tracker as installed, minimal,
                                                        #   permissions, explicit-view) + live
                                                        #   scan of ~/.ainative/apps/ when present.
src/lib/apps/view-kits/__tests__/inference.test.ts      # NEW. 37 tests: column probes + per-rule
                                                        #   predicates + first-match-wins +
                                                        #   6 starter intent fixtures
                                                        #   (acceptance criteria).
src/lib/apps/view-kits/__tests__/dispatcher.test.ts     # NEW. 6 tests: resolveKit fallback,
                                                        #   loadColumnSchemas with injected
                                                        #   fetcher (empty / multi-table / error /
                                                        #   malformed JSON config).

features/composed-app-manifest-view-field.md            # status: planned → completed
features/roadmap.md                                     # status column updated
features/changelog.md                                   # new 2026-05-02 entry above Phase 1.1
```

**Frozen contract recap** (no change from Phase 1.1 — Phase 1.2 just plugs into it): kits are pure projection functions. The new piece is the manifest-driven `view:` field + the `pickKit` decision table that picks a kit when `view.kit` is absent or `auto`. The decision table is **first-match-wins, no scoring**: ledger > tracker > research > coach > inbox > multiBlueprint > fallback.

---

## Phase 2 brief — `composed-app-kit-tracker-and-hub`

Spec at `features/composed-app-kit-tracker-and-hub.md`. High-level shape:

- **Tracker kit** — for habit-tracker / reading-radar shape: hero = the entries table with a focused last-N-rows view, KPI strip (active count, weekly completion %, current streak), schedule cadence chip, and a "Run now" button targeting the coach profile.
- **Workflow Hub kit** — fallback for everything that doesn't match a more specific kit: blueprint cards stacked vertically, recent runs timeline, no hero table.
- **Four shared primitives** under `src/components/apps/kit-view/primitives/` (only lift here when ≥2 kits use the same one): `KPIStrip`, `LastRunCard`, `ScheduleCadenceChip`, `RunNowButton`. KPIStrip uses Phase 1.2's `KpiSpec` discriminated union.
- **KPI evaluation engine** — `evaluateKpi(spec, runtime) → string | number`. Probably `src/lib/apps/view-kits/kpi.ts`. Reads from `userTableRows` via `db`. Five spec kinds map to five evaluator branches (one per discriminated arm).

**Phase 2 gate:** habit-tracker renders as a real Tracker (not placeholder) at `/apps/habit-tracker`; an empty multi-blueprint app renders as a Workflow Hub; KPIStrip evaluates `tableCount` and `tableSum` correctly against real data. Browser smoke required (visual change this time, not just internal contract).

**Where Phase 2 will rub against Phase 1.2's contract:**
- Phase 1.2's `pickKit` already returns the right kit id for both Tracker and Workflow Hub — Phase 2 just provides the kit definitions and registers them in `viewKits` (replacing the `undefined` slots in `src/lib/apps/view-kits/index.ts`).
- The graceful `placeholderKit` fallback in `resolveKit` keeps working for the four un-shipped kits (coach, ledger, inbox, research) — they degrade to placeholder until Phases 3-4.

---

## Verification this session

- **Unit tests**: 61 new tests across 4 files. All pass.
- **Apps suite**: 133/134 pass (1 informational skip: live-scan of `~/.ainative/apps/` skipped under vitest's temp `AINATIVE_DATA_DIR`).
- **Full suite**: 1698/1717 pass (12 skipped, 7 pre-existing failures in `router.test.ts` + `settings.test.ts` — confirmed unchanged from `main` via stash check).
- **tsc**: clean for changed files (`grep` of `npx tsc --noEmit` for `src/(app|lib)/apps` returns empty).
- **Smoke**: `curl http://localhost:3000/apps/habit-tracker` → HTTP 200, body contains "Habit Tracker", "View manifest", and `kit-view` markup. Behavior unchanged for users (kit still resolves to `placeholder` until Phase 2); the contract-level seam is what shipped.

**No browser-eval needed this session** because Phase 1.2 is a backend / contract change with zero visual surface delta. Phase 2 will need browser smoke.

---

## Resolved decisions (informational)

1. **Starter prompt files (`.claude/apps/starters/*.yaml`) are not AppManifests.** The spec's golden-master criterion ("every starter manifest under `.claude/apps/starters/` parses") is incorrect about file shape — those are starter prompts with their own `parseStarter` schema. Pragmatic interpretation used: hand-rolled snapshot fixtures cover the canonical AppManifest shapes (habit-tracker as installed, minimal, permissions block, explicit `view:` declaration), plus a live scan of `~/.ainative/apps/` when present. The "inference picks the right kit for each starter" criterion is fully covered by 6 synthetic fixture tests in `inference.test.ts`.
2. **Plugin bundle YAMLs (`src/lib/plugins/examples/*/plugin.yaml`) are not AppManifests either.** They're plugin bundles with their own `apiVersion` / `kind` schema. Excluded from golden-master for the same reason.
3. **Column-shape probes are intentionally approximate** per spec. `hasCurrency` matches `column.config.semantic === "currency"` OR a tight regex (`amount|price|cost|balance|total|revenue|income|spend`). `hasDate` matches `type=date|datetime`, `semantic=date`, or `^date$|_date$|_at$`. `hasBoolean` matches `type=boolean`, `semantic=boolean`, or `^|_(active|completed|done|enabled|verified|is)_|$`. Phase 5 (`composed-app-auto-inference-hardening`) tightens these against edge cases.

---

## Carryover from prior session (still valid)

### Free-form compose hardening (~2 hr)

1. **"Extend existing app" affordance (~1.5-2 hr).** Today the planner has no `extend_app` mode — every compose creates a new app. Independent of the Composed Apps Domain View work; could ship interleaved between Phase 2 and Phase 3 if a session prefers compose-hardening.

2. **30-day soak on the 440-char generic hint.** Passive. Telemetry-gated, not actionable today.

### LLM smoke for noun-aware hint (~5 min when extension is up)

Deterministic side of commit `8acc55fa` is fully covered by unit tests. The LLM-side observation — does the model actually compose without scaffolding when given the new hint? — has not run in 2+ sessions because Claude in Chrome was offline. Still worth checking when extension is back. Quick smoke:
- Send `"build me a github habit tracker"` in chat (dev server up).
- Expected: compose card titled "Habit Tracker" + a prose mention of "you'll need to scaffold a separate plugin to access github."
- Negative signal: a scaffold card means routing didn't land OR the LLM ignored the hint.

### Apps consumers — extract `useDeleteApp(args)` hook

Premature today (only 2 consumers). Wait until a third surface needs delete.

---

## Key patterns to remember

### From this session

- **Strict Zod schemas at the edge of the manifest contract.** `ViewSchema` is the only `.strict()` block in `registry.ts`. Every other schema stays `.passthrough()`. This is by design — the manifest is a forgiving config surface generally, but layout intent gets a hard wall so it can't grow into an HTML escape hatch over time. Phase 5's authoring tools will need to honor this when they emit `view:` blocks.
- **Discriminated unions over expression strings.** `KpiSpec.source` is a 5-arm `z.discriminatedUnion("kind", ...)` — a new KPI kind requires a code change, not a manifest hack. This is the codified version of "no formula strings, no HTML, no component refs" written into the schema doc-comment.
- **Inject the data-layer fetcher for testability.** `loadColumnSchemas(app, [getColumns])` accepts an optional fetcher; production calls omit it and lazy-import the real `@/lib/data/tables#getColumns`. This let me unit-test the malformed-config / fetcher-throws branches without spinning up a temp DB. Pattern is reusable for any future `loadX` that touches the DB but has interesting transformation logic.
- **Snapshot fixtures + live scan is a robust golden-master shape.** The hand-rolled fixtures always run (covers CI / fresh clones). The live scan covers drift on the dogfood instance. When vitest sets `AINATIVE_DATA_DIR` to a temp dir, the live scan correctly skips with no manual gating needed.
- **`\b` boundaries don't break on `_` in JS regex.** `\bbalance\b` does NOT match `balance_usd` because `_` is a word character. Use `(^|[^a-z])(...)([^a-z]|$)` for keyword-anywhere-in-snake_case matching. Caught this in TDD on the first run — saved a full Phase 5 inference miss.

### Carried over and still relevant

- **`APP_INTENT_WORDS` is the cleavage line between scaffold and compose for noun-bearing prompts.**
- **HANDOFF interpretation is itself a skill.** When predecessor language is technically muddy (e.g., "every starter manifest parses" when starters aren't manifests), fall back to: what does the user actually want? Build to that.
- **Phase 2 is the gate that matters** for the 7-feature initiative. Phases 1.1 + 1.2 are necessary plumbing; Phase 2 is when users see the first real domain-aware kit (Tracker + Workflow Hub fallback).
- **`unstable_cache` cache key naming convention**: tag namespace is `app-runtime:<id>` (used in `data.ts`). Phase 2 should reuse `app-columns:<id>` if it adds a cached `loadColumnSchemas` variant.

---

*End of handoff. Next move: ask the user whether to commit Phase 1.2 (the working tree is staged for it), then push, then start Phase 2 by reading `features/composed-app-kit-tracker-and-hub.md` and brainstorming the kit composition + KPI evaluator boundary.*
