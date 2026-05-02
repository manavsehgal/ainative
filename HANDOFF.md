# Handoff: Phase 3 shipped (composed-app-kit-coach-and-ledger) — browser smoke + Phase 4 next

**Created:** 2026-05-02 (late evening, second session)
**Status:** Phase 3 (`composed-app-kit-coach-and-ledger`) **code-complete and committed on `main`** across 6 wave commits. Local `main` is **9 commits ahead of origin** — push when ready. Working tree clean. Browser smoke for the new kits is the only outstanding ship gate; it requires an interactive session (compose apps via chat surface + visit `localhost:3010`).
**Author:** Manav Sehgal (with Claude Opus 4.7 assist; subagent-driven execution)
**Predecessor:** `.archive/handoff/2026-05-02-composed-app-kit-tracker-and-hub-phase2-handoff.md`

---

## TL;DR for the next agent (or interactive session)

1. **Phase 3 is code-complete and bundled into 6 wave commits.** `git log --oneline -8` shows the full chain:
   ```
   6842535c feat(apps): Phase 3 wave 6 — page wiring + finance-pack starter
   ca50ca12 feat(apps): Phase 3 wave 4 — coach + ledger data loaders + period cache
   62ff8769 feat(apps): Phase 3 wave 3 — coach + ledger kit definitions
   0d0a71c1 feat(apps): Phase 3 wave 2 — chart primitives + RunNowSheet + Coach/Ledger UI
   328765bd feat(apps): Phase 3 wave 1 — extract VariableInput + tableSumWindowed KPI source
   2a7e2e36 docs(plans): Phase 3 implementation plan — coach + ledger kits
   b88c4ada docs(specs): Phase 3 brainstorm — Coach & Ledger kits design
   ec96b071 docs(handoff): Phase 2 shipped, Phase 3 is next
   ```
   Plus a docs commit you'll want to add covering the feature-spec status flip + roadmap row + changelog entry (uncommitted in working tree right now).

2. **Browser smoke is the only outstanding ship gate** — Phase 3 plan Tasks 32-34. Three checks (each ~5 min):
   - Compose `weekly-portfolio-check-in` from the existing starter (`/apps/<id>` → Coach layout: markdown digest hero + cadence chip + Run Now opens sheet for `investment-research` blueprint variables)
   - Compose `finance-pack` from the new starter (`.claude/apps/starters/finance-pack.yaml`) (`/apps/<id>?period=mtd` → Ledger layout: KPI strip + chart + categories + transactions table; toggle period MTD↔YTD and verify KPI values change)
   - Regression check on `habit-tracker` (`/apps/habit-tracker` → Phase 2 Tracker layout still renders unchanged)

3. **After browser smoke, finalize ship.** Suggested final commit message: `docs(features): Phase 3 status → completed + changelog entry` (covers the status-flip + roadmap update + changelog entry already in the working tree). Then `git push` when ready.

4. **Phase 4 next: `composed-app-kit-inbox-and-research`.** Spec at `features/composed-app-kit-inbox-and-research.md`. Includes: Inbox kit (queue + draft surface), Research kit, kit-loader registry refactor (deferred from Phase 3 because dispatch hits 5+ branches there), and the `DocumentCitationStrip` primitive (deferred from Phase 3 — `DocumentChipBar` was the wrong abstraction; Phase 4's Inbox kit needs document loading anyway, so adding a read-only citation strip there is the natural home).

---

## What landed this session

```
src/lib/workflows/blueprints/validate-variables.ts                # Pure required-field validator
src/lib/workflows/blueprints/__tests__/validate-variables.test.ts # 6 tests

src/components/workflows/variable-input.tsx                       # Extracted from blueprint-preview.tsx
src/components/workflows/__tests__/variable-input.test.tsx        # 5 tests

src/lib/apps/registry.ts                                          # +tableSumWindowed Zod arm
src/lib/apps/__tests__/registry.test.ts                           # +5 tableSumWindowed tests

src/lib/apps/view-kits/evaluate-kpi.ts                            # +KpiContext.tableSumWindowed
                                                                  #   +switch case (2 tests in
                                                                  #   evaluate-kpi.test.ts)

src/lib/apps/view-kits/kpi-context.ts                             # DB-backed tableSumWindowed
                                                                  #   +exported windowStart helper
src/lib/apps/view-kits/__tests__/kpi-context.test.ts              # 9 tests

src/components/charts/time-series-chart.tsx                       # recharts AreaChart wrapper
src/components/charts/run-cadence-heatmap.tsx                     # 12wk × 7d SVG grid
src/components/charts/__tests__/                                  # 4 + 4 = 8 tests

src/components/apps/last-run-card.tsx                             # +variant=hero (react-markdown
                                                                  #   + remark-gfm + ErrorBoundary
                                                                  #   + previous-runs Sheet)
src/components/apps/__tests__/last-run-card.test.tsx              # +6 hero tests

src/components/apps/run-now-sheet.tsx                             # Sheet form + validateVariables
src/components/apps/run-now-button.tsx                            # +variables prop; conditional
                                                                  #   delegation to RunNowSheet
src/components/apps/__tests__/run-now-{sheet,button}.test.tsx     # 5 + 4 = 9 tests

src/components/apps/period-selector-chip.tsx                      # MTD/QTD/YTD; router.replace
src/components/apps/transactions-table.tsx                        # Read-only table (Ledger 2nd)
src/components/apps/ledger-hero-panel.tsx                         # TimeSeriesChart + categories
                                                                  #   bar list (NOT DonutRing —
                                                                  #   see "Resolved decisions")
src/components/apps/run-history-strip.tsx                         # Coach activity strip
src/components/apps/monthly-close-summary.tsx                     # Collapsible markdown card
src/components/apps/__tests__/                                    # 5 component tests, ~15 total

src/components/shared/error-boundary.tsx                          # Minimal class for markdown wrap

src/lib/apps/view-kits/default-kpis.ts                            # +defaultLedgerKpis(table,
                                                                  #   columns, period, blueprintId?)
src/lib/apps/view-kits/__tests__/default-kpis.test.ts             # +4 ledger tests

src/lib/apps/view-kits/kits/coach.ts                              # KitDefinition (5 tests)
src/lib/apps/view-kits/kits/ledger.ts                             # KitDefinition (6 tests)
src/lib/apps/view-kits/__tests__/{coach,ledger}.test.ts           # 11 tests

src/lib/apps/view-kits/types.ts                                   # +Coach/Ledger RuntimeState
                                                                  #   +HeaderSlot.runNowVariables
                                                                  #   +ResolveInput.period?

src/lib/apps/view-kits/index.ts                                   # Register coach + ledger
src/lib/apps/view-kits/__tests__/dispatcher.test.ts               # +2 registration tests

src/lib/apps/view-kits/data.ts                                    # +8 loaders (loadCoach{Latest
                                                                  #   Task,PreviousRuns,Cadence
                                                                  #   Cells}, loadLedger{Series,
                                                                  #   Categories,Transactions},
                                                                  #   loadMonthlyCloseSummary,
                                                                  #   loadBlueprintVariables)
                                                                  #   +coach/ledger branches in
                                                                  #   loadRuntimeStateUncached
                                                                  #   +period in unstable_cache
                                                                  #   key

src/app/apps/[id]/page.tsx                                        # Read ?period= via Zod;
                                                                  #   thread into kit.resolve

vitest.config.ts                                                  # Alias `server-only` →
                                                                  #   Next's empty stub for
                                                                  #   vitest Node env

.claude/apps/starters/finance-pack.yaml                           # New Ledger dogfood starter

# Docs (uncommitted — see TL;DR step 3)
features/composed-app-kit-coach-and-ledger.md                     # status: planned → completed
features/roadmap.md                                               # Phase 3 row → completed
features/changelog.md                                              # New 2026-05-02 (later) entry

docs/superpowers/specs/2026-05-02-coach-and-ledger-design.md      # Brainstorm doc (committed
                                                                  #   b88c4ada)
docs/superpowers/plans/2026-05-02-composed-app-kit-coach-and-ledger.md
                                                                  # 35-task plan (committed
                                                                  #   2a7e2e36)
```

---

## Verification this session

- **Unit tests**: ~82 new across ~17 files. **Full project: 1831/1850 pass + 12 skipped + 7 pre-existing failures** (router.test.ts × 6, settings.test.ts × 1) unchanged from `main` and unrelated to Phase 3 (assertion text "Task task-1 not found" vs "Unknown agent type" — task-lookup-before-agent-validation order in router.ts).
- **Phase 3-relevant scope**: 310/310 across `src/lib/apps`, `src/components/apps`, `src/components/charts`, `src/components/workflows`, `src/lib/workflows/blueprints`, `src/components/shared`.
- **tsc**: clean for `src/(app|lib|components)`. The IDE diagnostics panel showed phantom errors throughout the session (per `MEMORY.md` lessons learned) — trust `npx tsc --noEmit` CLI. The diagnostic noise was particularly heavy on test files referencing newly-created modules (module not found until cache rebuilds) and `toBeInTheDocument`/`toBeDisabled` matchers (jest-dom matchers configured at runtime via vitest setup but not visible to the IDE TS server).
- **Browser smoke**: **deferred**. Phase 3 plan Tasks 32-34 require interactive session — see TL;DR step 2.

---

## Resolved decisions during execution

1. **`DonutRing` is the wrong primitive for Ledger's category breakdown.** The existing `src/components/charts/donut-ring.tsx` is a single-value progress ring (0-100%), not a multi-segment chart. Building a multi-segment donut was out of HOLD scope. The pragmatic adaptation: `LedgerHeroPanel` renders categories as a list with horizontal bars proportional to share-of-total. Phase 4 may revisit if multi-segment becomes necessary.

2. **`TimeSeriesChart` `range` prop doesn't accept `qtd`.** The component declares `range?: "30d" | "90d" | "ytd" | "mtd"`. `LedgerHeroPanel` maps `qtd` → `"90d"` internally as the closest semantic equivalent for "quarter-to-date". The user-visible heading still reads `QTD` correctly. If future work wants distinct quarter granularity, expand the `range` union.

3. **`server-only` alias added to `vitest.config.ts`.** Next.js's `server-only` marker package isn't resolvable from vitest's Node env. Aliased to `node_modules/next/dist/compiled/server-only/empty.js`. **Test-only**, no production effect. Phase 2 didn't need this because Phase 2's data.ts wasn't unit-tested directly; Phase 3's `kpi-context.test.ts` is the first test that imports a `server-only`-marked module.

4. **`KpiSpecSchema` is now exported from `registry.ts`.** Was previously module-private; exporting it lets `registry.test.ts` import it directly for the `tableSumWindowed` arm tests. Matches existing patterns (`AppManifestSchema`, `ViewSchema`, `KitIdSchema` are all exported).

5. **`VariableInput` extraction added explicit `required: false` to test fixtures.** `BlueprintVariable.required: boolean` is non-optional in `src/lib/workflows/blueprints/types.ts`. The plan's verbatim test snippets omitted `required` on optional fields, which would fail TS strict. The defensive `required: false` doesn't change behavior (optional and `false` are semantically equivalent for the validator).

6. **Test queries use `getByRole("textbox")` instead of `getByLabelText`.** `VariableInput`'s `<Label>` has no `htmlFor` and `<Input>` has no `id`, so they're not associated for accessibility purposes. `getByLabelText` can't find form controls. Pre-existing issue not in Phase 3's scope to fix; tests adapted to `getByRole`.

7. **Wave 5 (slot renderers) is a no-op.** `hero.tsx`, `secondary.tsx`, and `activity.tsx` already render `slot.content` as `ReactNode`. Coach + Ledger build their hero content via `createElement(...)` per Phase 2's frozen contract for client-component heroes (TableSpreadsheet pattern). No slot dispatcher changes were needed; Wave 5 verification confirmed this and ran tests to prove no regression.

8. **Inference heuristics in `src/lib/apps/view-kits/inference.ts` already cover Coach + Ledger.** Phase 1.2 added them. The existing 37-test inference suite includes the spec's acceptance fixtures (`weekly-portfolio-check-in → coach`, `finance-pack → ledger`). Wave 6 verification — no `inference.ts` changes required.

9. **Phantom IDE diagnostics dominated this session's noise.** Every new test file produced a flurry of `Cannot find module` and `toBeInTheDocument does not exist` errors in the IDE that weren't reproduced by `npx tsc --noEmit` or `npx vitest run`. Per `MEMORY.md`, this is a known repo behavior; treating them as phantoms saved significant time. Worth re-confirming the `MEMORY.md` lesson if anyone considers "fixing" the IDE config — this is the third feature where it's been documented.

---

## Browser smoke checklist (Phase 3 plan Tasks 32-34)

Once you're ready for browser smoke:

```bash
# 1. Start dev server on free port
PORT=3010 npm run dev

# 2. Compose Coach app (chat surface) — send the starterPrompt verbatim:
#    "Build me a weekly portfolio check-in app."
#    Confirm app appears in ~/.ainative/apps/

# 3. Open http://localhost:3010/apps/<weekly-portfolio-check-in-id>
#    Verify:
#    - Coach hero shows latest digest as full markdown (or empty-state if blueprint never ran)
#    - Cadence chip in header (e.g., "Mondays at 8am")
#    - "Run now" button opens sheet with `asset` + `horizon` form fields (per investment-research blueprint)
#    - Submit POSTs and toasts success
#    - Run cadence heatmap appears in secondary slot
#    Save screenshot: output/phase-3-coach-smoke.png

# 4. Compose Ledger app via chat surface using finance-pack starter prompt
#    "Build me a personal finance dashboard."

# 5. Open http://localhost:3010/apps/<finance-pack-id>?period=mtd
#    Verify:
#    - KPI strip: Net + Inflow + Outflow + Run-rate (4 tiles)
#    - Hero shows TimeSeriesChart (left) + categories-with-bars (right) — or empty-state
#    - PeriodSelectorChip (MTD/QTD/YTD); click YTD and confirm KPIs re-evaluate
#    - Transactions table secondary slot (or "No transactions yet")
#    - Monthly close summary collapsed at bottom (or "no monthly-close blueprint configured")
#    Save screenshot: output/phase-3-ledger-smoke.png

# 6. Regression check on habit-tracker (/apps/habit-tracker)
#    Verify Phase 2 Tracker layout unchanged.
#    Save screenshot: output/phase-3-tracker-regression.png

# 7. Stop dev server. Add the docs commit (status flip + changelog).
#    git push when ready.
```

`output/` is gitignored (per `MEMORY.md` `gitignored-local-folders.md`) — screenshots stay local.

---

## Patterns to remember (Phase 3 additions)

### From this session

- **`createElement(...)` is mandatory for client-component heroes.** Phase 2's frozen contract (Tracker hero pattern). Coach hero (`LastRunCard variant="hero"` — uses `useState` for previous-runs Sheet) and Ledger hero (`LedgerHeroPanel` — composes a client `TimeSeriesChart`) both follow this. Function-call invocation throws `useState outside React renderer`. **Phase 4 Inbox/Research kits will repeat this pattern.**

- **`unstable_cache` key must include any prop that affects fetch shape.** Phase 3 added `period` to the cache key. Without it, MTD↔YTD switches would serve stale state for 30s. Phase 4+ should remember: any new request-scoped prop that influences `loadRuntimeStateUncached`'s output shape must be added to the cache key.

- **Dynamic `await import()` for cross-runtime modules.** `loadBlueprintVariables` uses `await import("@/lib/workflows/blueprints/registry")` instead of a static import to avoid module-load cycles per CLAUDE.md's smoke-test budget guidance. Pattern is from TDR-032; if Phase 4's Inbox loaders touch any chat-tools / runtime modules, they must follow this pattern AND budget a smoke verification.

- **Discriminated-prop variant pattern for shared components.** `LastRunCard` evolved from a single-shape component to `compact | hero` discriminated union. The runtime check `if (props.variant === "hero")` falls through to compact when undefined, preserving backward compatibility. Phase 4 components that need similar evolution (e.g., `LastRunCard` could gain `inbox` variant; `KPIStrip` could gain dense/compact variants) should follow the same pattern.

- **Phantom IDE diagnostics are a third-tier signal.** Treat the IDE TS server's diagnostics panel as a hint, not a verdict. Always confirm with `npx tsc --noEmit` CLI before adjusting code based on a panel error. (Documented in `MEMORY.md` for the third feature now.)

### Carried over and still relevant

- **Strict Zod schemas at the manifest contract edge** (`ViewSchema` is `.strict()`; everything else `.passthrough()`).
- **Discriminated unions over expression strings** for KPI sources. Phase 3 added a 6th arm; Phase 4+ may need a 7th. Add the Zod arm + switch case + KpiContext method together — never weaken the discrimination.
- **Inject the data-layer fetcher for testability.** `kpi-context.ts` exports concrete `createKpiContext()`; tests build mock contexts directly.
- **HANDOFF interpretation is a skill.** Keep "TL;DR for the next agent" honest about state — what's done, what's next, what's deferred. Phase 3's HANDOFF makes the browser-smoke gate explicit so it doesn't get skipped.
- **`unstable_cache` cache key naming**: tag namespace `app-runtime:<id>`; key tuple now `["app-runtime", appId, kitId, period ?? "default"]`.

---

*End of handoff. Next move: run browser smoke for Coach + Ledger, commit the docs (status flip + changelog), then `git push`. After that, Phase 4 brainstorm starts with `features/composed-app-kit-inbox-and-research.md`.*
