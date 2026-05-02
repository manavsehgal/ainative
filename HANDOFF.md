# Handoff: Cascade gap + orphan sweep + apps card relayout shipped → only compose hardening + 1 review item open

**Created:** 2026-05-01 (evening)
**Status:** All 4 orphan-sweep follow-ups completed and pushed (5 commits). Working tree clean, in sync with `origin/main`. **No blocking work open.** Two carryover items remain: the `GitHub Issue Sync` REVIEW (your judgment) and the free-form compose hardening (~2-3 hr).
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-orphan-sweep-cascade-gap-shipped.md`

---

## TL;DR for the next agent

1. **`deleteAppCascade` now reaches profiles + blueprints.** The cascade closes the gap where `~/.ainative/profiles/<appId>--*/` dirs and `~/.ainative/blueprints/<appId>--*.yaml` files were leaking on delete. Result type carries `profilesRemoved` + `blueprintsRemoved` counts; DELETE `/api/apps/[id]` surfaces them. Smoke-verified live (synthetic app delete returned `{filesRemoved:true, profilesRemoved:1, blueprintsRemoved:1}`, all three locations clean).
2. **Orphan sweep done.** 5 orphan profile dirs + 4 orphan blueprint files removed; 2 orphan projects deleted via `deleteProjectCascade`. Final disk: only `habit-tracker/` artifacts across `apps/`, `profiles/`, `blueprints/`. DB: 12 projects, 13 user_tables, 13 schedules.
3. **Apps card relayout shipped.** Trash on the title row, "Running" StatusChip right-aligned on its own row. Used a positioned-link overlay pattern (transparent Link covers `inset-0`, CardContent uses `pointer-events-none`) instead of button-inside-anchor to avoid Firefox auto-closing the anchor. Polished card padding from `p-4 space-y-2` → `p-3 space-y-1.5` + `items-center` to reclaim ~14-18px the new bottom row added.
4. **Next move (in order):** decide on the `GitHub Issue Sync` REVIEW (5 min — see "Outstanding state"), then if you want a substantive feature push, free-form compose hardening (~2-3 hr — see "Other future work"). The compose hardening has 3 sub-items; **`INTEGRATION_NOUNS` check** is the cleanest concrete starting point.

---

## What shipped this session (5 commits)

```
306ccff4 docs(handoff): orphan-sweep follow-ups #1-#4 complete
08af35c3 polish(apps): tighten card, right-align status chip
a22b3822 refactor(apps): trash on title row, status on its own row
c2a5a5bb docs(handoff): orphan sweep complete + cascade gap closed
0cfff7d5 feat(apps): cascade delete reaches namespaced profiles + blueprints
```

### `0cfff7d5` — cascade gap

- **`registry.ts`** (`src/lib/apps/registry.ts:217-262`)
  - `DeleteAppCascadeResult` gained `profilesRemoved: number` + `blueprintsRemoved: number` (counts, not booleans — apps can have multiple of each).
  - `DeleteAppCascadeOptions` gained `profilesDir` + `blueprintsDir` for hermetic tests; defaults pull from `getAinativeProfilesDir()` / `getAinativeBlueprintsDir()`.
  - `sweepNamespacedProfiles` / `sweepNamespacedBlueprints` are local helpers — iterate the shared dir, match `<appId>--` prefix, `rmSync` matching entries.
  - `SLUG_RE = /^[a-z0-9][a-z0-9-]*$/` gate before any sweep — defense-in-depth against e.g. an `appId` of `""` matching every namespaced entry.
- **`route.ts`** (`src/app/api/apps/[id]/route.ts:24-39`) — 404 logic now treats any of the four halves removing something as "found"; success body carries all four counts.

### `a22b3822` + `08af35c3` — apps card relayout

- **Card structure** (`src/app/apps/page.tsx:29-69`):
  - `<Card relative>` — was a `<div relative>` wrapping a `<Link><Card>` before
  - `<Link absolute inset-0 z-0>` — transparent overlay, captures click-through
  - `<CardContent pointer-events-none relative p-3 space-y-1.5>` — non-interactive children pass clicks to the Link
  - Title row: `flex items-center justify-between` with `<Package /> <name>` left, `AppCardDeleteButton` (in `<div pointer-events-auto -my-1 -mr-1>`) right
  - Description + primitives summary unchanged
  - StatusChip in `<div className="flex justify-end">` for right alignment

- **Why not button-inside-anchor:** Firefox's HTML5 parser auto-closes the `<a>` at the `<button>` start tag. That breaks click-through for the description, primitives, and status sections below the title row. The positioned-link overlay sidesteps this entirely — button is OUTSIDE the anchor in DOM order, so no Firefox quirk.

### Tests

- 94/94 across `src/lib/apps`, `src/app/api/apps`, `src/components/apps` (unchanged tests + 4 new — 3 cascade-helper coverage + 1 zombie-cleanup case for the route).
- `npx tsc --noEmit` clean.

---

## Outstanding state (audited 2026-05-01 18:15 PT)

### Repo
- `main` is in sync with `origin/main` after the 5-commit push. Working tree clean.

### Database
- 12 projects, 13 user_tables, 13 schedules, 4 user_table_triggers, 19 documents, 12 workflows, 59 tasks, 35 notifications.
- **`GitHub Issue Sync` (`a5a436b0…`) — REVIEW pending your judgment.** Audit findings: project description is a real intent ("Automated daily sync of GitHub issues assigned to me"), table schema is well-formed (10 columns), schedule is active and a complete agent prompt — BUT `firing_count = 0`, `last_fired_at = NULL`, 0 rows in 3 weeks. Two reasonable paths:
  - **Keep** if you still want to use it (just needs `GITHUB_TOKEN` and a manual first run)
  - **Delete** via `curl -X DELETE http://localhost:3000/api/projects/a5a436b0-6278-4e3f-a3c8-516803ad5009` if it was a planning exercise that didn't pan out

### Disk (`~/.ainative/`)
- `apps/` — `habit-tracker/` only
- `profiles/` — `habit-tracker--habit-coach/` only
- `blueprints/` — `habit-tracker--weekly-review.yaml` only

### FK-orphan audit recipe (canonical, plugin-aware)

The original Step 3 query flagged plugin schedules with empty `project_id` as orphans (false positive). The corrected version below is the one to use:

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

## Other future work

### Free-form compose hardening (~2-3 hr)

Carryover from prior handoffs. Phase 2 (committed `9ecdda3f`) covered the `COMPOSE_TRIGGERS`-but-no-`PRIMITIVE_MAP` branch with a generic compose hint. Three sub-items remain:

1. **`INTEGRATION_NOUNS` check in the generic hint** — best concrete starting point. Today, `"build me a github habit tracker"` would match `COMPOSE_TRIGGERS` ("build me") but the LLM may still scaffold a GitHub plugin instead of composing. The `primitive_matched` branch checks `INTEGRATION_NOUNS` (it's part of the routing logic in `src/lib/chat/planner/classifier.ts`), but the generic branch doesn't carry the same guard. ~30 min plus a smoke. The fix is plumbing the same noun check into the generic-hint emit path.

2. **"Extend existing app" affordance.** The Phase 2 smoke saw the LLM narrate "I'll wire the app into the existing Habit Loop project" but actually create a fresh `habit-tracker` project. Today the planner has no `extend_app` mode — every compose creates a new app. If a user says `"add to my Habit Loop app"`, there's no path. New planner mode + chat-tool + classifier branch. ~1.5-2 hr including tests.

3. **30-day soak on the 440-char generic hint.** The hint includes "MUST NOT invoke the Skill tool" because of a Phase 2 smoke where the LLM tried to call the Skill before composing. If 30 days of real chat traffic show the LLM never tries to invoke Skill anyway, the guard line could shrink to ~250 chars. Not actionable today; needs telemetry from compose conversations.

### Apps consumers — extract `useDeleteApp(args)` hook

Premature today (only 2 consumers: `app-detail-actions.tsx` + `app-card-delete-button.tsx`). CLAUDE.md DRY-with-judgment says extract on third. Wait until a third surface needs delete.

### Soak validation for cascade gap (passive)

Step 0 is unit-tested + live-smoked, but real-world coverage will only come from organic compose+delete cycles over the next few weeks. If `profilesRemoved` or `blueprintsRemoved` ever shows up as 0 when the user expected non-zero, the heuristic (slug prefix match) needs revisiting. The current contract: **only `<appId>--*` named profiles/blueprints are app-owned.** A profile named without the `--<artifact>` suffix is treated as standalone (manual) and not swept. That's intentional.

---

## Key patterns to remember (carryover + new from this session)

- **Existing-test refactors carry hidden risks.** When extending `DeleteAppCascadeOptions`, the existing "removes the manifest dir" test was implicitly hitting the real DB (no `deleteProjectFn` injection) — pre-existing fragility, but my Step 0 change extended it to profiles/blueprints. I made the tests hermetic (every test now passes all three dirs + injects `deleteProjectFn`). When adding new I/O surfaces, audit whether existing tests are silently touching real-world state.
- **Path-traversal guards must compose with regex slug guards.** The new `SLUG_RE` check in `deleteAppCascade` is redundant with `path.resolve` for `..` cases, but catches edges the resolver wouldn't (e.g. `appId === ""` matching all `--` files via the prefix). Belt + suspenders is correct here because the cost of an over-broad sweep is destroying user data.
- **`{"ok":true}` is not the same as "the file is gone."** During Step 4 of the sweep, the first `ls` after a DELETE call still showed `weekly-reading-list--manager`. Re-listing later showed it gone. The DELETE was async-ish (file removal raced with the response). Always re-verify with a fresh `ls` before declaring victory.
- **`<button>` inside `<a>` is invalid HTML and Firefox auto-closes the anchor.** The original handoff suggestion (button-inside-anchor + stopPropagation) breaks click-through to content after the button in Firefox. Use the positioned-link overlay pattern instead: Card is `relative`, an absolute Link covers `inset-0`, CardContent uses `pointer-events-none` so non-interactive children pass clicks to the Link, and only the trash wrapper has `pointer-events-auto` to capture its own clicks.
- **Adding a new card row visibly grows the card.** Going from 3 rows (title-with-status) to 4 rows (title-with-trash + status-on-its-own) added ~36px of card height. Reclaim some via `p-4 → p-3`, `space-y-2 → space-y-1.5`, and `items-center` (so a tall trash button doesn't push the title row taller than the text). Wrap small-button overlays with negative margins (`-my-1 -mr-1`) to bleed into the card padding rather than dominate the row.
- **Turbopack HMR can silently get stuck.** During the apps-card change, the dev server kept serving the old layout despite file edits and `touch`es. `find .next -newer page.tsx` showed no recompile. Fix: kill the `:3000` PID **and** its parent (`next dev` wrapper), wait 2s, `npm run dev`. Worth checking `find .next -newer <file> | head -5` before assuming HMR works.
- **The Step 3 orphan-check query had a false-positive surface (now corrected).** Plugin schedules with empty `project_id` aren't orphans; they're plugin-owned. The "FK-orphan audit recipe" section above is now the canonical query.
- **Spec-driven scope can drift from the audit.** The pre-sweep handoff said "5 profile dirs and 4 blueprint files on disk have no matching app." The file count agreed, but disposition was subtler: `weekly-reading-list--manager` had a corresponding `~/.codex/skills/reading-list-manager` (the original Codex skill it was forked from). Deleting the ainative profile didn't touch the Codex skill. If a future session wants to "delete everything related to weekly-reading-list," it should check both surfaces.

---

*End of handoff. Working tree clean. `main` in sync with `origin/main`. Recommended next move: `GitHub Issue Sync` REVIEW decision (5 min), then start on `INTEGRATION_NOUNS` check in the generic compose hint (the cleanest sub-item of free-form compose hardening, ~30 min).*
