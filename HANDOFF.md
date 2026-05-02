# Handoff: Phase 3.1 patch landed (Bug 3 fixed) — ready to start Phase 4 (`composed-app-kit-inbox-and-research`)

**Created:** 2026-05-02 (fourth session, late evening — Phase 3.1 cleanup)
**Status:** Phase 3 fully closed out. Bug 3 from previous session is fixed and committed: `TransactionsTable` (secondary slot) + `MonthlyCloseSummary` (activity slot) are now wired into `ledgerKit.buildModel`. 275 unit tests pass (+2 new), `tsc` clean. Working tree clean. Ready to start Phase 4.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-02-composed-app-kit-ledger-phase3-smoke-handoff.md`

---

## TL;DR for the next agent (or interactive session)

1. **Phase 3 is now genuinely complete and shipped.** The previous session caught + fixed 2 of 3 wiring gaps via browser smoke; this session closed the third. All four kits (Tracker, Workflow Hub, Coach, Ledger) render the full slot pipeline they were designed for.

2. **Bug 3 (FIXED this session):** `ledgerKit.buildModel` now references `runtime.ledgerTransactions` and `runtime.ledgerMonthlyClose` to populate the `secondary` (`TransactionsTable` card titled "Recent transactions") and `activity` (`MonthlyCloseSummary` collapsible card) slots. Both components were already built + unit-tested in wave 2; both data loaders were already populating runtime in wave 4. The only gap was the buildModel wiring — a 1-file change to `src/lib/apps/view-kits/kits/ledger.ts` plus 2 new tests in the kit test file.

3. **Phase 4 is the next move: `composed-app-kit-inbox-and-research`.** Spec at `features/composed-app-kit-inbox-and-research.md`. Scope:
   - **`RunHistoryTimeline`** — new shared primitive (vertical timeline of runs with status, timestamp, click-to-open). Used by Research and exposed for Workflow Hub re-skin in a follow-up.
   - **`InboxKit`** — two-pane queue + draft layout for row-trigger blueprint apps. Header includes a `triggerSourceChip` for event-driven apps (Run Now suppressed when blueprint trigger is `row-insert`).
   - **`ResearchKit`** — sources `DataTable` + synthesis hero with `DocumentChipBar` citations. Activity slot uses the new `RunHistoryTimeline`. Citation chips highlight matching source rows in place (no route change).
   - **Slot renderer additions** — `inbox-split` and `research-split` hero kinds; `throughput-strip` and `run-history-timeline` activity kinds; `triggerSourceChip` in header.
   - **`detectTriggerSource(manifest)`** — pure helper returning `"row-insert" | "schedule" | "manual"`.

4. **Bug 3 was deferred from Phase 3 specifically because it needed a slot-design decision.** The choice landed: `secondary` for transactions (canonical pattern), `activity` for monthly close summary (matches Coach's activity-slot convention). Phase 4 inherits clean precedents — both kits will use `activity` for their primary run/throughput surfaces.

---

## What landed this session

```
src/lib/apps/view-kits/kits/ledger.ts                 (M)  +TransactionsTable + MonthlyCloseSummary imports
                                                            +secondary slot (transactions card)
                                                            +activity slot (monthly close summary)
src/lib/apps/view-kits/__tests__/ledger.test.ts       (M)  +2 buildModel tests (populated + empty cases)

HANDOFF.md                                            (M)  Phase 3.1 done, Phase 4 next
.archive/handoff/2026-05-02-composed-app-kit-ledger-phase3-smoke-handoff.md (A)  Predecessor archived
```

**Smoke-only artifacts from previous session (gitignored, local-only — clean up at will):**
```
~/.ainative/apps/weekly-portfolio-check-in/manifest.yaml
~/.ainative/apps/finance-pack/manifest.yaml
~/.ainative/ainative.db user_tables row "transactions" + 5-row seed
output/phase-3-coach-runnow-sheet.png
output/phase-3-ledger-ytd.png
output/phase-3-tracker-regression.png
```

To clean up: `rm -rf ~/.ainative/apps/{weekly-portfolio-check-in,finance-pack}` and the SQL from the previous handoff. Or keep them as Phase 4 smoke fixtures — Phase 4's Inbox kit will need a row-insert-triggered manifest, and Research will need a sources-table fixture, so the existing seed is half the work for the inbox/research smoke.

---

## Verification this session

- **Unit tests:** 275 passing across `src/lib/apps`, `src/components/apps`, `src/components/charts` (33 test files). Up from 273 — the 2 added tests cover populated + empty `runtime.ledgerTransactions` / `runtime.ledgerMonthlyClose` paths.
- **`npx tsc --noEmit`:** exit 0, zero errors.
- **No browser smoke this session.** The fix is *not* runtime-registry-adjacent (no `@/lib/agents/runtime/catalog.ts` lineage), so the CLAUDE.md smoke-test budget rule doesn't apply. The wiring pattern is identical to existing kits (`createElement(Component, props)` against an already-tested slot renderer). Risk surface = limited; cost of regression = one-line revert. If verifying visually before Phase 4, the fastest path is: start `npm run dev`, hit `/apps/finance-pack` (the previous session's seeded manifest), confirm transactions table + collapsible monthly close summary appear below the chart hero.

---

## Resolved decisions during execution

1. **Phase 3.1 patch beat absorbing Bug 3 into Phase 4.** The Phase 4 spec adds 4 new slot renderers and a new primitive — bundling Bug 3 into that diff would obscure bisectability. The Bug 3 fix is a pure 1-file addition to an already-working kit; it deserved its own commit.

2. **Slot mapping: transactions → `secondary`, monthly close → `activity`.** Considered putting transactions in `activity` (since it's a stream-like list) but `secondary` is the established pattern for "card with a tabular surface adjacent to the hero" (Phase 2 used it for Workflow Hub's per-blueprint last-run summaries). Monthly close → `activity` matches Coach's "single-collapsible-recent-output" convention.

3. **`format: "currency" as const`** — needed the `as const` because `KpiFormat` is a string-literal union and TS infers plain `string` from a JSX/createElement prop literal otherwise. Same trick used for `kind: "custom" as const` in the hero spec.

---

## Patterns to remember (this session's additions)

- **The kit pattern's "buildModel sees runtime, slot views see model" boundary is the place where wiring drift happens.** All 3 Phase 3 wiring bugs lived at this seam: data loaders populated runtime, components were tested in isolation, but `buildModel` either didn't pull the field through or didn't shape it for the slot. **Phase 4's spec already calls for tests that assert each kit's `buildModel` output produces all expected DOM elements via React Testing Library + `<KitView>`.** Strongly recommend implementing those integration tests as part of Phase 4 — they would have caught all 3 Phase 3 wiring bugs at the unit test layer.

- **`createElement` is mandatory for `.ts` kit files** (not new — Phase 2 frozen contract). When adding `TransactionsTable` and `MonthlyCloseSummary` to `ledger.ts`, the pattern is identical to the existing `LedgerHeroPanel` call: `createElement(Component, props)`. Don't try to introduce JSX into kit files; they're plain TypeScript on purpose so they remain pure data transforms.

### Carried over and still relevant

- **`unstable_cache` key must include any prop that affects fetch shape** (Phase 3 lesson; relevant when Phase 4 adds Inbox's row-selection state to the data loader signature — though Inbox row selection is intra-page client state, not server-cached, so likely no cache key impact).
- **Dynamic `await import()` for cross-runtime modules** (TDR-032 + CLAUDE.md smoke-test budget) — relevant if Phase 4's `detectTriggerSource` or Research's citation lookup ends up needing chat-tools or runtime catalog access.
- **Strict Zod schemas at the manifest contract edge** — Phase 4 introduces `trigger: { kind: "row-insert", table: <id> }` on blueprint manifests. The blueprint schema needs an additive `trigger` field; check `src/lib/apps/registry.ts` and `src/lib/workflows/blueprints/types.ts` for the right place.
- **Phantom IDE diagnostics are noisy after every edit.** During this session, editing `ledger.ts` produced ~30 phantom "Cannot find module" / "Property 'toBeInTheDocument' does not exist" errors that all resolved against `npx tsc --noEmit` with zero real errors. Trust the CLI, not the panel.

---

## Phase 4 starter checklist (kicking-off prep)

When you (or the next session) start Phase 4:

1. **Brainstorm first** (`superpowers:brainstorming` skill) — Phase 4 introduces 1 new primitive + 2 kits + 4 slot renderers + 1 helper. That's net-new creative scope; the spec is detailed but the implementation order matters (primitive → slot renderers → kits → registry registration → page wiring → smoke).
2. **Read upstream specs first via `/refer` against `.claude/reference/`** if any of Phase 4's deliverables touch SDK contracts (e.g., row-insert trigger semantics in workflow engine).
3. **Plan via `superpowers:writing-plans`** — 6 numbered waves likely (matching Phase 2/3 structure): types/contract additions → primitive(s) → slot renderers → kit definitions → data loaders → page wiring + smoke fixtures.
4. **Mind the smoke-test budget** — Phase 4 doesn't touch the runtime catalog directly, but adding `trigger: row-insert` semantics may. If yes, plan a real `npm run dev` smoke step (per CLAUDE.md).
5. **Phase 4's planned integration test for `<KitView>` would have caught all 3 Phase 3 wiring bugs**, per the pattern note above. Prioritize it.

---

*End of handoff. Next move: brainstorm Phase 4 (`features/composed-app-kit-inbox-and-research.md`), then write a wave-by-wave implementation plan, then execute.*
