# Handoff: Orphan sweep complete + cascade-gap closed → no blocking work open

**Created:** 2026-05-01 (evening)
**Status:** Step 0 (cascade gap fix) shipped to `main`. Steps 1–5 (orphan sweep) executed end-to-end. **No blocking item open.** Working tree clean. The substantive remaining work is the optional follow-ups documented under "Other future work."
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-orphan-sweep-pre-execution.md`

---

## TL;DR for the next agent

1. **Cascade-gap closed.** `deleteAppCascade` (in `src/lib/apps/registry.ts`) now sweeps `~/.ainative/profiles/<appId>--*/` dirs and `~/.ainative/blueprints/<appId>--*.yaml` files alongside the manifest dir + DB project. `DeleteAppCascadeResult` carries new `profilesRemoved: number` + `blueprintsRemoved: number` counts; the DELETE `/api/apps/[id]` route surfaces them. Defense-in-depth: namespaced sweeps only run when `appId` matches a clean slug regex (`^[a-z0-9][a-z0-9-]*$`). Future compose+delete cycles will not regrow orphans.
2. **Orphan sweep done.** Deleted `Daily Journal` + `Habit Loop` projects via `deleteProjectCascade` (cascade-safe path, not raw SQL). Deleted 5 orphan profile dirs (`daily-journal--coach`, `habit-loop--coach`, `meal-planner--coach`, `portfolio-checkin--coach`, `weekly-reading-list--manager`) and 4 orphan blueprint files (`meal-planner--weekly-plan.yaml`, `portfolio-checkin--weekly-review.yaml`, `portfolio-manager--weekly-review.yaml`, `weekly-reading-list--synthesis.yaml`) via per-primitive DELETE routes. `GitHub Issue Sync` (REVIEW-flagged in prior handoff) preserved — has 1 table + 1 schedule but no tasks/workflows; needs human eyes before deciding.
3. **Final state matches the target.** `~/.ainative/apps/` = `habit-tracker/` only. `~/.ainative/profiles/` = `habit-tracker--habit-coach/` only. `~/.ainative/blueprints/` = `habit-tracker--weekly-review.yaml` only. DB: 12 projects (was 14), 13 user_tables, 13 schedules. No new FK orphans introduced.

---

## What shipped this session (1 commit)

```
0cfff7d5 feat(apps): cascade delete reaches namespaced profiles + blueprints
```

### Code

- **`registry.ts`** (`src/lib/apps/registry.ts:217-262`)
  - `DeleteAppCascadeResult` gained `profilesRemoved` + `blueprintsRemoved` (numbers, not booleans — counts can be > 1 for apps with multiple profiles/blueprints).
  - `DeleteAppCascadeOptions` gained `profilesDir` + `blueprintsDir` for hermetic tests; defaults pull from `getAinativeProfilesDir()` / `getAinativeBlueprintsDir()`.
  - `sweepNamespacedProfiles` / `sweepNamespacedBlueprints` are local helpers — iterate the shared dir, match `<appId>--` prefix, `rmSync` matching entries. Re-resolves each target inside the helper for path-traversal defense in case the helper is reused later.
  - `SLUG_RE = /^[a-z0-9][a-z0-9-]*$/` gate before any sweep — protects against e.g. an `appId` of `"."` matching every namespaced entry.
- **`route.ts`** (`src/app/api/apps/[id]/route.ts:24-39`) — 404 logic now treats any of the four halves removing something as "found"; success body carries all four counts.

### Tests (94/94 across apps + components/apps; tsc clean)

- **`registry.test.ts`** — existing `deleteAppCascade` block refactored to be hermetic (each test creates its own `appsDir`, `profilesDir`, `blueprintsDir` under `tmp` and injects `deleteProjectFn` instead of touching the real DB). 3 new tests:
  - `"sweeps `<appId>--*` profile dirs from the shared profiles dir"` — verifies prefix matching, leaves unrelated namespaces alone, and rejects bare `wealth-tracker` (no `--`)
  - `"sweeps `<appId>--*.yaml` blueprint files from the shared blueprints dir"` — verifies extension filter (`.txt` ignored) and prefix matching
  - `"is a no-op for namespaced sweeps when no profile/blueprint matches the appId"` — confirms the no-op shape returns 0/0 counts
- **`route.test.ts`** — 1 new test (`"returns 200 when only namespaced profiles/blueprints existed (zombie cleanup)"`); existing tests updated to include the two new fields.

### Smoke

- Did NOT compose a new app to test the full happy path — the existing test coverage is structurally sufficient (the helpers are exercised on real fs ops in tmp dirs, no mocks). A live compose+delete-with-orphans smoke is recommended next time someone touches this code path.
- Did smoke the 404 path against `npm run dev` (`curl -X DELETE /api/apps/does-not-exist-test → 404 {"error":"App not found"}`), confirming the route picks up the new shape.

---

## Sweep results (audit numbers)

```
~/.ainative/apps/                   1 entry  (habit-tracker — kept)
~/.ainative/profiles/               1 entry  (habit-tracker--habit-coach — kept; 5 orphans removed)
~/.ainative/blueprints/             1 entry  (habit-tracker--weekly-review.yaml — kept; 4 orphans removed)

projects                           12 rows   (was 14; deleted Daily Journal, Habit Loop)
user_tables                        13 rows   (unchanged — both deletes had 0 tables)
schedules                          13 rows   (unchanged — both deletes had 0 schedules)

FK orphans (user_tables, schedules, triggers w/ missing parent): 0 new
```

The Step 3 cross-FK query returned 2 rows, but both are pre-existing **plugin schedules** (`plugin:finance-pack:monthly-close`, `plugin:reading-radar:sunday-synth`) with intentionally-empty `project_id` — they belong to plugins, not projects, and the original LEFT JOIN flagged them because `''` doesn't match any project id. Not caused by this sweep, and not real orphans. The corrected query (canonical recipe for future sweeps) is below.

### FK-orphan audit recipe (canonical, plugin-aware)

Use this in place of the prior-handoff Step 3 query — it ignores rows with empty `project_id` (plugin-owned) and only flags real FK breaks:

```bash
sqlite3 ~/.ainative/ainative.db "
  SELECT 'tables' as kind, t.id FROM user_tables t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.project_id IS NOT NULL AND t.project_id != '' AND p.id IS NULL
  UNION ALL
  SELECT 'schedules', s.id FROM schedules s
    LEFT JOIN projects p ON p.id = s.project_id
    WHERE s.project_id IS NOT NULL AND s.project_id != '' AND p.id IS NULL
  UNION ALL
  SELECT 'triggers', tr.id FROM user_table_triggers tr
    LEFT JOIN user_tables t ON t.id = tr.table_id
    WHERE tr.table_id IS NOT NULL AND tr.table_id != '' AND t.id IS NULL;
"
```

Verified 0 rows on 2026-05-01 post-sweep.

---

## Outstanding state (audited 2026-05-01 17:55 PT)

### Repo
- `main` is one commit ahead of `origin/main` after `0cfff7d5`. Working tree clean once this handoff lands. No push attempted yet — leaving for the user to verify and push.

### Database
- 12 projects, 13 user_tables, 13 schedules, 4 user_table_triggers, 19 documents, 12 workflows, 59 tasks, 35 notifications.
- `GitHub Issue Sync` (`a5a436b0…`) still present — needs human review (1 table + 1 schedule but 0 tasks/0 workflows; check whether the table contains data before deciding).

### Disk (`~/.ainative/`)
- Confirmed clean: only `habit-tracker` artifacts remain across `apps/`, `profiles/`, `blueprints/`.

---

## Other future work (separate from the sweep)

**`GitHub Issue Sync` REVIEW (~5 min).** Audit `~/.ainative/ainative.db` table contents for the 1 user_table belonging to project `a5a436b0…`. If it's empty or stub data, delete the project; if it has real data the user wants to keep, leave it. The schedule's cron + active state should also factor into the decision.

**Free-form compose hardening (~2-3 hr).** Carryover from prior handoff. Phase 2 covers the `COMPOSE_TRIGGERS`-but-no-`PRIMITIVE_MAP` branch. Some hardening worth considering:
- The generic hint doesn't include the `INTEGRATION_NOUNS` check, so `"build me a github habit tracker"` would still scaffold a GitHub plugin instead of composing.
- The Phase 2 smoke showed the LLM narrated "I'll wire the app into the existing Habit Loop project" but actually created a fresh `habit-tracker` project. If a user asks `"add to my Habit Loop app"` the planner has no path for that. Affordances for "extend an existing app" would close that gap.
- 30-day soak on whether the generic hint's 440 chars is pulling its weight.

**Apps card UI: relocate trash + status (~10 min).** Carryover from prior handoff. On `/apps` (`src/app/apps/page.tsx:33-54`):
- **Top row:** `<Package /> <name>` on the left, trash icon on the right (drop the absolute positioning; render `AppCardDeleteButton` as the right-side flex child where StatusChip is today, and remove the `pr-8` clearance + the outer `<div className="absolute top-1.5 right-1.5 z-10">` wrapper)
- **Bottom row:** `<StatusChip status="running" size="sm" />` on its own line below the primitives summary

The existing `e.preventDefault() + e.stopPropagation()` guards on `AppCardDeleteButton` keep clicks from bubbling to the surrounding `<Link>`. The RTL "stopPropagation" test in `app-card-delete-button.test.tsx:67` covers it.

**Extract shared `useDeleteApp(args)` hook.** Premature today (only 2 consumers; CLAUDE.md DRY-with-judgment says extract on third). Wait until a third surface needs delete.

**Live compose+delete-with-orphans smoke for Step 0.** The new tests cover the helpers in tmp dirs, but no smoke has exercised the full path against the dev server. Next time you compose a real app and then delete it, eyeball the `profilesRemoved` + `blueprintsRemoved` counts in the response.

---

## Key patterns to remember (carryover + new)

- **Existing-test refactors carry hidden risks.** When extending `DeleteAppCascadeOptions`, the existing `"removes the manifest dir and reports project=false when no DB project exists"` test was implicitly hitting the real DB (`deleteProjectCascade("wealth-tracker")` against the user's actual DB) because it didn't inject `deleteProjectFn`. Pre-existing fragility, but my Step 0 change extended the same fragility to profiles/blueprints. I made the tests hermetic (every test now passes all three dirs + injects `deleteProjectFn`). Pattern to remember: when adding new I/O surfaces to a function, audit whether existing tests are silently touching real-world state.
- **Path-traversal guards must compose with regex slug guards.** The new `SLUG_RE` check is redundant with the existing `path.resolve` guard for `..` cases, but catches edge cases the path resolver wouldn't (e.g. `appId === ""` matching all `--` files via the prefix). Belt + suspenders is correct here because the cost of an over-broad sweep is destroying user data.
- **`{"ok":true}` is not the same as "the file is gone."** During Step 4, the first listing after the DELETE call showed `weekly-reading-list--manager` still present even though the API returned ok. Re-listing 30s later showed it gone. The DELETE was async-ish (file removal raced with the response). Always re-verify with a fresh `ls` before declaring victory.
- **The Step 3 orphan-check query had a false-positive surface (now corrected).** Plugin schedules with empty `project_id` aren't orphans; they're plugin-owned. The "FK-orphan audit recipe" section above is now the canonical query.
- **Spec-driven scope can drift from the audit.** The prior handoff said "5 profile dirs and 4 blueprint files on disk have no matching app." Today's count agrees with the file count but the disposition is more subtle: `weekly-reading-list--manager` had a corresponding `~/.codex/skills/reading-list-manager` (the original Codex skill it was forked from). Deleting the ainative profile didn't touch the Codex skill. If a future session wants to "delete everything related to weekly-reading-list," it should check both surfaces. Carryover-noting because the disposition isn't obvious.

---

*End of handoff. Working tree clean after this file lands. Recommended next move: push `main`, then look at `GitHub Issue Sync` REVIEW or move to one of the carryover items above.*
