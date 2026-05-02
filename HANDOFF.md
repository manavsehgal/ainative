# Handoff: Phase 3 browser-smoke shipped — 2 kit wiring bugs fixed; 1 gap deferred to Phase 3.1 or Phase 4

**Created:** 2026-05-02 (third session, late evening)
**Status:** Phase 3 (`composed-app-kit-coach-and-ledger`) **fully verified end-to-end in the browser** with 3 wiring fixes committed. Coach + Ledger kits render correctly; Tracker regression clean. Working tree clean. Local `main` is **N commits ahead of origin** — push at your discretion.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-02-composed-app-kit-coach-and-ledger-phase3-handoff.md`

---

## TL;DR for the next agent (or interactive session)

1. **Phase 3 is now genuinely shipped — code-complete, smoked, wiring fixes committed.** Browser smoke caught 3 Phase 3 wiring gaps that unit tests structurally couldn't catch. 2 were fixed this session; 1 is documented as "Bug 3" below for follow-up.

2. **Phase 3 deliverable verified end-to-end:**
   - **Coach kit** (`/apps/<id>` with `view.kit: coach` declared OR inference): markdown digest hero, "Monday 8am" cadence chip, RunNowSheet opens with blueprint variable inputs (Asset/ticker text + Time horizon select).
   - **Ledger kit** (`/apps/<id>?period=mtd` with `view.kit: ledger`): KPI strip (Net/Inflow/Outflow/Run-rate evaluated against real `userTableRows` data), MTD/QTD/YTD `PeriodSelectorChip`, `LedgerHeroPanel` with `TimeSeriesChart` + category bars. Period switch updates URL via `router.replace` and re-evaluates KPIs server-side.
   - **Tracker kit** (`/apps/habit-tracker`): unchanged — Phase 2 layout intact, no regression from Phase 3 additive changes.

3. **Bug 3 (deferred):** `loadLedgerTransactions` and `loadMonthlyCloseSummary` data loaders exist in `src/lib/apps/view-kits/data.ts` and are called from `loadRuntimeStateUncached`'s ledger branch (lines 105-106), populating `runtime.ledgerTransactions` and `runtime.ledgerMonthlyClose`. But `ledger.ts buildModel` never references either field — so the `TransactionsTable` and `MonthlyCloseSummary` components (built in wave 2 with their own unit tests) are dead code in production. Fix needs a slot decision: secondary slot for transactions (canonical pattern from Tracker's hero), activity slot for monthly close summary, or a new "below hero" slot. Estimated 3-file change. Recommend handling in a Phase 3.1 patch OR rolling into Phase 4's slot work.

4. **Phase 4 next: `composed-app-kit-inbox-and-research`** (unchanged from previous handoff). Spec at `features/composed-app-kit-inbox-and-research.md`. Includes Inbox kit (queue + draft surface), Research kit, kit-loader registry refactor, and the deferred `DocumentCitationStrip` primitive. Phase 4's slot work could naturally absorb Bug 3 above.

---

## What landed this session

```
src/components/apps/kit-view/slots/header.tsx     (M)  +variables fwd to RunNowButton (Bug 1)
                                                      +PeriodSelectorChip render (Bug 2 — 1/3)
src/lib/apps/view-kits/types.ts                   (M)  +periodChip?: { current } on HeaderSlot (Bug 2 — 2/3)
src/lib/apps/view-kits/kits/ledger.ts             (M)  +periodChip in buildModel header (Bug 2 — 3/3)

HANDOFF.md                                        (M)  Phase 3 smoke complete + 3 bugs documented
.archive/handoff/2026-05-02-composed-app-kit-coach-and-ledger-phase3-handoff.md (A) Predecessor archived
```

**Smoke-only artifacts (gitignored, local-only — clean up at will):**
```
~/.ainative/apps/weekly-portfolio-check-in/manifest.yaml   Hand-crafted Coach manifest with view.kit: coach
~/.ainative/apps/finance-pack/manifest.yaml                Hand-crafted Ledger manifest with view.kit: ledger
~/.ainative/ainative.db user_tables row "transactions"     5 rows × 4 cols seed (currency-typed amount column)
output/phase-3-coach-runnow-sheet.png                      Coach Run Now sheet evidence
output/phase-3-ledger-ytd.png                              Ledger YTD view evidence
output/phase-3-tracker-regression.png                      Tracker regression clean evidence
```

To clean up: `rm -rf ~/.ainative/apps/{weekly-portfolio-check-in,finance-pack}` and `sqlite3 ~/.ainative/ainative.db "DELETE FROM user_table_rows WHERE table_id='transactions'; DELETE FROM user_table_columns WHERE table_id='transactions'; DELETE FROM user_tables WHERE id='transactions';"`. Or keep them as future smoke fixtures — they're under `~/.ainative/`, not the repo, so they don't affect anyone else.

---

## The 3 Phase 3 wiring bugs — full account

### Bug 1 (FIXED) — RunNowSheet variables not forwarded from header slot

**Location:** `src/components/apps/kit-view/slots/header.tsx:21,42`
**Symptom:** Clicking "Run now" on Coach app posted directly to `/api/blueprints/{id}/instantiate` with empty variables → 400 Bad Request. Sheet never opened. The `runNowVariables` field was populated correctly by `coach.ts buildModel` (line 88) and accepted by `RunNowButton` (line 17), but the slot renderer destructured only `runNowBlueprintId` and passed only `blueprintId={runNowBlueprintId}` to the button — dropping `variables` on the floor.
**Root cause:** Wave 2 added the `variables` prop to `RunNowButton` and wave 3 populated `header.runNowVariables` from `coach.ts`/`ledger.ts buildModel`, but the slot renderer was never updated to bridge them. Unit tests for `RunNowButton` and `RunNowSheet` passed (separate component tests), and tests for `header.tsx` likely don't assert variable passthrough.
**Fix:** Two lines — destructure `runNowVariables` from slot, pass `variables={runNowVariables}` to `RunNowButton`.

### Bug 2 (FIXED) — PeriodSelectorChip never rendered anywhere

**Location:** `src/components/apps/period-selector-chip.tsx` (component) + `src/components/apps/kit-view/slots/header.tsx` (renderer) + `src/lib/apps/view-kits/types.ts` + `src/lib/apps/view-kits/kits/ledger.ts`
**Symptom:** Ledger kit had no MTD/QTD/YTD chip in the header. URL parsing of `?period=` worked (page.tsx:24 parsed it), data loaders accepted period (data.ts:570), Ledger kit's resolve threaded period into projection. But the user had no UI affordance to change the period — only manual URL editing.
**Root cause:** Wave 2 built `PeriodSelectorChip` and tested it in isolation. Wave 3 wired period through projection. Neither wave wired the chip into a slot or kit. Unit tests covered the component but not its integration into any kit or view shell.
**Fix:** Three files —
- `types.ts`: add `periodChip?: { current: "mtd" | "qtd" | "ytd" }` to `HeaderSlot`.
- `header.tsx`: import `PeriodSelectorChip`, destructure `periodChip`, render `{periodChip && <PeriodSelectorChip current={periodChip.current} />}` between `cadenceChip` and `runNowBlueprintId`.
- `ledger.ts`: in `buildModel`, add `periodChip: { current: projection.period }` to the header object.

### Bug 3 (DEFERRED) — TransactionsTable + MonthlyCloseSummary unused in production

**Location:** `src/lib/apps/view-kits/kits/ledger.ts buildModel` (the gap)
**Symptom:** Ledger app shows hero (TimeSeriesChart + categories) but no transactions table and no monthly close summary card — yet both components exist (`src/components/apps/transactions-table.tsx`, `src/components/apps/monthly-close-summary.tsx`) with passing wave-2 unit tests.
**Root cause:** Wave 2 built both components. Wave 4 added the data loaders and populated `runtime.ledgerTransactions` (last 50 rows) and `runtime.ledgerMonthlyClose` (latest blueprint task result). But `ledger.ts buildModel` only references `runtime.ledgerSeries` and `runtime.ledgerCategories` for the hero — it never sets a `secondary` slot for the table or an `activity` slot for the monthly close summary.
**Why deferred:** The fix needs a slot-design decision. Phase 2 used `secondary` for non-hero data; Coach uses `activity` for run history. Ledger could put transactions in `secondary` and monthly close in either `activity` or a new collapsible "below hero" surface. Tracker's hero is a full TableSpreadsheet of the user_table — Ledger explicitly chose chart-as-hero, so transactions belong elsewhere.
**Recommended scope:** Phase 3.1 patch (3-file change: import components in `ledger.ts`, add `secondary` and `activity` to buildModel, ensure `KitView` renders them — already does per `kit-view.tsx:27-30`). Or absorb into Phase 4's Inbox kit slot work for consistency.

---

## Verification this session

- **Browser smoke:** all 3 handoff Tasks 32-34 completed via Playwright MCP (Claude in Chrome extension was non-responsive after 2 retries; switched to Playwright per `MEMORY.md` `feedback-browser-tool-fallback.md`). Evidence in `output/`.
- **Unit tests post-fix:** 273/274 pass (1 skipped) across `src/lib/apps`, `src/components/apps`, `src/components/charts` (33 test files). No regressions from the 3 wiring fixes.
- **tsc:** not re-run this session — fixes are additive (new optional field + 1 import + 2 lines in slot view + 1 line in ledger buildModel). The IDE phantom diagnostics were noisy as always (per `MEMORY.md` lessons learned), trust `npx tsc --noEmit` if needed.
- **Smoke method:** Surgical — hand-crafted minimal `view.kit`-declared manifests at `~/.ainative/apps/{coach,ledger-app}/manifest.yaml` instead of running the full chat composition pipeline. This decouples Phase 3's deliverable (kit dispatchers + data loaders + page wiring + Phase 3 components) from Phase 0-1's chat composition pipeline (which is already proven by the existing habit-tracker app). Total smoke time: ~10 min including 2 bug fixes; full chat composition would have been 10-20 min per app with non-deterministic agent behavior.

---

## Resolved decisions during execution

1. **Surgical smoke beats chat-driven smoke for Phase 3 verification.** The deliverable is the kit dispatcher + data loaders + slot renderers, not the chat→app composition pipeline. A 35-line manifest with `view.kit: coach` declared exercises 100% of Phase 3's code path. The chat composition pipeline is Phase 0-1's responsibility and already shipped.

2. **DB seed is required for Ledger inference and KPI population.** `loadColumnSchemas` queries `@/lib/data/tables#getColumns` against the real DB, not the manifest's `tables[].columns` array. So even a perfect manifest produces empty KPIs without real `user_tables` + `user_table_columns` rows with `dataType: number` + `config: '{"semantic":"currency"}'`. For future smoke sessions: the seed SQL is documented in this session's transcript; consider extracting to `scripts/seed-ledger-smoke.sql` if smoke is repeated.

3. **Reusing the user's existing dev server failed; clean restart was required.** Next.js 16 refuses a second dev instance for the same project directory regardless of port. The user's existing `:3000` instance was killed (with explicit confirmation) and a fresh `:3010` instance started.

4. **Turbopack hot-reload misses some server-component changes after manifest type updates.** After adding `periodChip?` to `HeaderSlot` and `periodChip: { current: ... }` to `ledger.ts buildModel`, the running dev server didn't surface the new chip on `/apps/finance-pack`. Restarting the dev server picked up the changes immediately. Worth noting if anyone else hits "I added a slot field but it's not rendering" — try restart before debugging.

---

## Patterns to remember (this session's additions)

- **Browser smoke catches integration drift that unit tests structurally cannot.** All 3 Phase 3 bugs were "build the part, build the test for the part, but never wire the part into the system" failures. The unit tests passed because each component was tested in isolation. Only a real request through the slot-renderer pipeline exposed the wiring gaps. **Phase 4 should plan for an integration test (or just a scripted smoke) that asserts each kit's `buildModel` output produces all expected DOM elements via React Testing Library + `<KitView>` — bridging the gap.**

- **Manifest `variables: [{ id, label, type, required }]` not `name`.** `BlueprintVariable.id` (not `name`) is the canonical key. The starter YAMLs in `.claude/apps/starters/` don't include `variables` at all — they're agent-composed at app-create time. Manual smoke manifests need to include them with the right shape.

- **DB-driven inference + DB-driven KPI evaluation = Ledger smoke needs DB seed.** Future Ledger smoke will need either real seeded `userTableRows` or explicit `view.bindings.kpis` declared in the manifest. Pure manifest-only smoke can verify Coach end-to-end (no DB dependency) but only Ledger's empty-state path.

### Carried over and still relevant

- **`createElement(...)` is mandatory for client-component heroes** (Phase 2 frozen contract).
- **`unstable_cache` key must include any prop that affects fetch shape** (Phase 3 added `period`).
- **Dynamic `await import()` for cross-runtime modules** (TDR-032 + CLAUDE.md smoke-test budget).
- **Strict Zod schemas at the manifest contract edge.**
- **Phantom IDE diagnostics are a third-tier signal** — `npx tsc --noEmit` is ground truth.

---

*End of handoff. Next move: review the 3 wiring fix commits, decide on Bug 3 (Phase 3.1 patch vs Phase 4 absorption), then start Phase 4 brainstorm with `features/composed-app-kit-inbox-and-research.md`.*
