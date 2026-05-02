# Handoff: Phase 4 (`composed-app-kit-inbox-and-research`) code-complete — browser smoke deferred to next session

**Created:** 2026-05-02 (Phase 4 implementation session, subagent-driven)
**Status:** Phase 4 fully implemented across 8 waves (40 tasks, 19 commits). All unit + integration tests green; tsc clean. Browser smoke is the only remaining verification — manifests + seeds are prepared at `~/.ainative/apps/{customer-follow-up-drafter,research-digest}/`. Working tree clean.
**Author:** Manav Sehgal (with Claude Opus 4.7 + Sonnet 4.6 implementers)
**Predecessor:** `.archive/handoff/2026-05-02-composed-app-kit-phase3-1-handoff.md`

---

## TL;DR for the next agent (or interactive session)

1. **Phase 4 is code-complete and code-reviewed across 8 waves.** Each wave went through implementer (Sonnet) + spec reviewer (Opus) + code-quality reviewer (Opus). All 11 KitView integration tests confirm DOM-level wiring across all 6 kits — Tracker, Workflow Hub, Coach, Ledger, Inbox, Research.

2. **The only remaining step is browser smoke.** This is gated on a dev server + Playwright session that's awkward in subagent-driven flow. Resume in interactive session with these steps:

   ```bash
   PORT=3010 npm run dev &
   # wait for "Ready in <time>"
   ```

   Then via Playwright (or Claude in Chrome):
   - Navigate to `http://localhost:3010/apps/customer-follow-up-drafter`
   - Verify: chip "Triggered by row insert in customer-touchpoints", no Run Now button, 3 queue rows (Acme/Beta/Gamma), empty draft pane initially.
   - Click Acme row → URL becomes `?row=cft-r1`, draft pane shows "Reply to Acme Corp" markdown.
   - Save `output/phase-4-inbox-empty.png` and `output/phase-4-inbox-draft.png`.
   - Navigate to `http://localhost:3010/apps/research-digest`
   - Verify: cadence chip "Scheduled", Run Now button, KPIs (Sources=3, Last synth ~recent), 3 source rows, synthesis markdown, RunHistoryTimeline.
   - Save `output/phase-4-research.png`.
   - Regression check: navigate to `/apps/habit-tracker`, `/apps/<workflow-hub-id>`, `/apps/weekly-portfolio-check-in`, `/apps/finance-pack`. Each should render console-clean.
   - Save `output/phase-4-regression-<kit>.png`.

3. **After browser smoke is clean**, commit the screenshots + a short addendum to `features/composed-app-kit-inbox-and-research.md` noting the verification run, then update HANDOFF.md to "Phase 4 fully shipped".

4. **Next feature** (per spec References): the locked design decisions in this Phase 4 spec deferred two follow-up features:
   - `row-trigger-blueprint-execution` — wires the `trigger.kind: row-insert` manifest field through the workflow engine so blueprints actually fire when rows arrive. This wave's `tasks.context_row_id` column is ready to receive engine writes.
   - `composed-app-auto-inference-hardening` — tightens `pickKit`'s 7-rule decision table against edge cases.

---

## What landed this session (8 waves, 19 commits)

```
W1  bf2e208e  feat(apps): Phase 4 wave 1 — types, manifest trigger field, contextRowId column
W2  e9bd2903  feat(apps): Phase 4 wave 2 — RunHistoryTimeline primitive
    f0950898  refactor(apps): Phase 4 wave 2 nits — design tokens + canonical formatter + workflow icons
W3  ecd6bf90  feat(apps): Phase 4 wave 3 — detectTriggerSource helper
    1d267c09  refactor(apps): Phase 4 wave 3 nit — drop unnecessary structural casts
W4  3ed4e97b  feat(apps): Phase 4 wave 4 — slot extensions + Inbox/Research client components
W5  fbc03ce1  feat(apps): Phase 4 wave 5 — InboxKit + ResearchKit definitions
W6  f985dfd6  feat(apps): Phase 4 wave 6 — data loaders + page wiring
    bffc66f6  refactor(apps): Phase 4 wave 6 nits — vitest mock unstable_cache + blueprint filters
W7  205c1b20  test(apps): Phase 4 wave 7 — KitView integration tests for all 6 kits
W8  a309fa99  docs(features): Phase 4 status → completed + changelog entry
    (this handoff commit — see below)
```

Pre-wave planning commits:
```
    b59db6ed  docs(specs): Phase 4 implementation design — composed-app-kit-inbox-and-research
    eac544bf  docs(plans): Phase 4 implementation plan — composed-app-kit-inbox-and-research
```

---

## Smoke-only artifacts (gitignored, local-only)

```
~/.ainative/apps/customer-follow-up-drafter/manifest.yaml   Inbox kit canonical
~/.ainative/apps/research-digest/manifest.yaml              Research kit canonical

DB seeds in ~/.ainative/ainative.db:
  - projects: customer-follow-up-drafter, research-digest
  - user_tables: customer-touchpoints (4 cols, 3 rows), sources (3 cols, 3 rows)
  - tasks: cfd-draft-1 (linked to cft-r1 via context_row_id), rd-synth-1
  - documents: cfd-doc-1 (linked to cfd-draft-1 with sample reply markdown)
```

Note: `tasks.context_row_id` is defined in `bootstrap.ts` (addColumnIfMissing) but was not yet present in the live DB because the dev server had not run after Wave 1. The column was added manually via `ALTER TABLE tasks ADD COLUMN context_row_id TEXT` before seeding. It will be idempotent on next dev server start.

To clean up after smoke: `rm -rf ~/.ainative/apps/{customer-follow-up-drafter,research-digest}` and DELETE statements as needed.

---

## Verification this session

- **Unit tests:** 340 pass (1 skipped) across `src/lib/apps`, `src/components/apps`, `src/lib/db`. Fully green.
- **KitView integration tests (Wave 7):** 11 tests, 6 kits, all DOM-level — would have caught all 3 of Phase 3's wiring bugs.
- **`npx tsc --noEmit`:** exit 0 across the project.
- **Schema deviations from the plan, all caught and adapted:**
  - `user_table_rows.data` (not `values`) — confirmed correct per Wave 6
  - `documents` uses `extracted_text` / `storage_path` / `created_at` (not `content` / `file_path` / `uploaded_at`) — confirmed
  - `user_table_columns` requires `display_name` and `created_at`/`updated_at` (not in plan's seed SQL) — added
  - `user_tables` requires `created_at`/`updated_at` (not in plan's seed SQL) — added
  - `tasks.context_row_id` was not yet in live DB — applied manually via ALTER before seeding
- **No runtime-registry-adjacent files touched** — `claude-agent.ts`, runtime adapters, workflow engine, and chat-tools are all untouched. The CLAUDE.md smoke-test budget rule did not apply, but Wave 8's browser smoke remains valuable for UX-level confidence.

---

## Patterns to remember (this session's additions)

- **The "wiring-bug class" Phase 3 exposed is now closed via integration tests.** 11 tests in `src/lib/apps/view-kits/__tests__/integration/` drive `kit.resolve()` → `kit.buildModel()` → `<KitView>` through React Testing Library, asserting DOM-level slot markers. Future kits should add an integration test as a wave-1 deliverable rather than a final-phase HOLD-mode investment.
- **`unstable_cache` should NOT be wrapped in runtime try/catch.** Wave 6's first attempt did this to silence Vitest errors; the fix replaced it with `vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }))` in test files. Production code stays clean; tests get a passthrough. This pattern is now established for any future loader using `unstable_cache`.
- **Schema deviations from plans are common** — always verify column names with `sqlite3 ".schema <table>"` before writing seed SQL or loader queries. The plan's column names came from a draft; only the actual DB tells the truth.
- **Subagent-driven development with two-stage review (spec + code quality) catches different bug classes.** Spec review caught test-fixture quality issues; code-quality review caught the silent-failure violation in `unstable_cache` and the missing blueprint filter in `loadLatestSynthesis` / `loadRecentRuns`. Single-pass review would have missed at least one.
- **`addColumnIfMissing` in bootstrap.ts requires a running dev server to execute.** A column can be in schema.ts and bootstrap.ts but absent from the live DB until the first server start. When seeding local DBs for smoke fixtures, always verify with `PRAGMA table_info(<table>)` first and apply manually if needed.

---

## Carried-forward gaps (acknowledged, not blocking)

1. **RunNowSheet variable end-to-end coverage gap (Wave 7 review).** The integration tests assert the `Run Now` button renders, but don't click through to assert the sheet opens with the correct `variables` prop. Real coverage exists at the model layer (`coach.test.ts:74`) and the component layer (`run-now-sheet.test.tsx`), but the bridge between them in `<KitView>` isn't exercised end-to-end. Add ~10-line click-through test in a follow-up if RunNow regresses again.

2. **Citation linkage ships empty.** `loadRuntimeStateUncached`'s research branch sets `researchCitations: []` per the locked design decision. The actual citation linkage (mapping synthesis tasks back to source rows) needs follow-up data work — likely a separate feature.

3. **`loadLatestSynthesis` `instanceof Date` defensive code is dead** (Wave 6 nit #5). Drizzle's `integer({ mode: "timestamp" })` always returns a Date. The fallback branch is unreachable. Cosmetic.

4. **`data.ts` is now ~798 lines.** Approaching unwieldy. When a future feature adds more loaders, consider splitting per-kit (`data-coach.ts`, `data-ledger.ts`, `data-inbox.ts`, `data-research.ts`) with `data.ts` as the dispatcher.

---

*End of handoff. Next move: run the browser smoke, save screenshots, commit, then start the next feature (`row-trigger-blueprint-execution` or `composed-app-auto-inference-hardening`).*
