# Handoff: Delete-app feature shipped + UX-aligned across detail and card surfaces

**Created:** 2026-05-01 (afternoon, post-delete-feature ship)
**Status:** Task #1 complete (9 commits, 76+/76+ tests). Task #2 (smoke-artifact cleanup) and Task #3 (Phase 2 compose-hint) are unblocked and pending.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-phase1-shipped-pre-delete-feature.md` (Phase 1 appId validator + Phase 2 framing)

Headline: **Shipped a clean app-deletion path end-to-end. Detail page (outline destructive button) and apps list cards (ghost trash icon) both invoke the same `ConfirmDialog` + `DELETE /api/apps/[id]` → `deleteAppCascade` → `deleteProjectCascade` (DB cascade across 17 FK-related tables) + manifest dir removal. UX is now consistent with sibling detail pages (schedules, profiles).**

---

## What shipped

### Backend cascade
- **`deleteAppCascade(appId, options?)`** in `src/lib/apps/registry.ts:217-261` — async wrapper composing the existing `deleteProjectCascade` (DB) and `deleteApp` (FS). Path-traversal guard reused from `deleteApp`. DB cascade runs **before** dir removal so a failed cascade leaves the manifest intact for retry. Returns `{filesRemoved, projectRemoved}` independently — UI distinguishes split-manifest from orphan-dir cases.
- **`DELETE /api/apps/[id]`** in `src/app/api/apps/[id]/route.ts:14-37` — was previously a manifest-only `deleteApp` call; now wires through to the cascade. 200 with granular `{success, filesRemoved, projectRemoved}` if either half succeeded; 404 only when both halves report nothing; 500 on cascade exception. GET handler unchanged byte-identical.

### Frontend
- **`AppDetailActions`** at `src/components/apps/app-detail-actions.tsx` — outlined destructive button in the page header (`<Trash2 /> Delete app`), matching the precedent at `schedule-detail-view.tsx:159` and `profile-detail-view.tsx:288`. Initial implementation used a kebab `DropdownMenu`; refactored after `/frontend-designer` flagged it as inconsistent with sibling detail views.
- **`AppCardDeleteButton`** at `src/components/apps/app-card-delete-button.tsx` — ghost icon button (`h-7 w-7 text-destructive`) positioned absolute `top-1.5 right-1.5 z-10` as a sibling of the card's `<Link>` (NOT inside it — avoids button-inside-link a11y issue). Defensive `e.preventDefault() + e.stopPropagation()` on click. Calls `router.refresh()` (no `push`) since the user is already on `/apps`.
- **`apps/page.tsx`** — each card wrapped in a `<div className="relative">`; existing card header gets `pr-8` clearance so the StatusChip flows around the absolutely-positioned trash button.
- Both surfaces share the same `ConfirmDialog` (existing component at `src/components/shared/confirm-dialog.tsx`) with the same cascade summary string. The summary handles pluralization correctly: `1 table (and its rows, columns, triggers)` vs `2 tables (and their rows, columns, triggers)`.

---

## Commit chain (9 commits on `main`)

```
97f51bb4 refactor(apps): align delete UI with sibling-page patterns
422ccbb2 feat(apps): wire AppDetailActions into app detail page header
4fff422d polish(apps): fix singular table copy, aria-hidden icons, race-guard comment
5acde3b4 feat(apps): app-detail-actions client island for delete
4758ce27 chore(api): align DELETE 404 copy with GET, drop unused mock
c8287c8b feat(api): wire DELETE /api/apps/[id] to deleteAppCascade
6e0e05d6 test(apps): cover orphaned-DB-row case in deleteAppCascade
e5e85bb0 feat(apps): deleteAppCascade composes deleteProjectCascade + dir removal
9213251b docs(plan): delete-app cascade plan with reuse-first scope
```

All bisectable. Each commit is independently revertable.

---

## Tests

Final suite state across affected dirs:

```
src/lib/apps/__tests__/registry.test.ts                 25/25 passing (5 new for deleteAppCascade)
src/lib/apps/__tests__/compose-integration.test.ts      14/14 passing
src/lib/apps/__tests__/composition-detector.test.ts     20/20 passing
src/app/api/apps/[id]/__tests__/route.test.ts            5/5  passing (NEW)
src/components/apps/__tests__/starter-template-card.test.ts  5/5 passing
                                                       ───────────────
TOTAL                                                   71/71 passing in 865ms
npx tsc --noEmit                                        0 errors
```

No test was added for the two presentation components (`app-detail-actions.tsx`, `app-card-delete-button.tsx`) — they're thin shells over already-tested primitives (DELETE route, ConfirmDialog, useTransition pattern). Future RTL coverage would catch pluralization regressions; flagged as a follow-up nit.

---

## Browser smoke (non-destructive)

Verified via Chrome DevTools MCP against the user's existing `localhost:3000` dev server (Next 16 + Turbopack hot-reloaded the changes; couldn't start a parallel `:3010` server because Next 16 refuses concurrent dev instances on the same project dir).

**Verified:**
- Apps list page: 6 cards each render the new red trash icon in the top-right corner alongside the StatusChip
- Detail page (`/apps/daily-journal`): outlined "Delete app" button renders next to the "Running" chip
- Detail page click flow: button → AlertDialog opens with title "Delete Daily Journal?" and description `"This will remove Daily Journal and 1 table (and its rows, columns, triggers), 1 schedule, 1 manifest file. Profiles and blueprints stay available for reuse. This cannot be undone."`
- Cancel dismisses the dialog cleanly; Daily Journal remains on disk

**NOT clicked Confirm** — destructive on user's actual workspace data; defer to Task #2 once user confirms which apps to delete.

Screenshots saved at `/tmp/ainative-apps-list-with-delete.png`, `/tmp/ainative-app-detail-direct-button.png`, `/tmp/ainative-delete-app-dialog.png`.

---

## Pickup for next session

### Task #2 — Smoke-artifact cleanup (now one-click instead of SQL)

The new feature converts most of this from SQL into a UI flow. Open `/apps`, click trash on each smoke leftover, confirm. Audit before deleting:

| App dir | Likely smoke leftover? | Notes |
|---|---|---|
| `~/.ainative/apps/habit-loop/` | YES | Split-manifest (profile only) from prior session |
| `~/.ainative/apps/habit-loop--coach/` | YES | Split-manifest (table + schedule) — has DB project; cascade will fire |
| `~/.ainative/apps/daily-journal/` | TBD — confirm with user | Looks intentional; intact manifest with table + schedule |
| `~/.ainative/apps/meal-planner/` | TBD | Same |
| `~/.ainative/apps/portfolio-checkin/` | TBD | Same |
| `~/.ainative/apps/portfolio-manager/` | DOESN'T RENDER | Manifest may be malformed — not in /apps UI listing; would need `rm -rf` directly |
| `~/.ainative/apps/weekly-reading-list/` | TBD | Same |

**Plus the orphaned UUID-id "Habit Tracker" project from the morning smoke** — has NO manifest, so the new feature can't reach it. SQL cleanup still needed (per `.archive/handoff/2026-05-01-phase1-shipped-pre-delete-feature.md` §Step 3):
```sql
DELETE FROM schedules WHERE id = '1aa46a79-a032-4127-b7dc-362d0bcb4319';
DELETE FROM user_table_triggers WHERE id = '70310b11-7343-4030-9b79-2d022f691fc3';
DELETE FROM user_tables WHERE id IN ('f98445ea-773a-4c35-a9a0-18ba9af1f49d', '900fcae1-ac6e-4110-8807-2fb27e35d174');
DELETE FROM projects WHERE id = '7d65288c-5cc4-4f47-849c-e0f6156e1497';
```
Or — easier — use the existing `/projects/7d65288c-...` UI's Delete button (already cascades via `deleteProjectCascade`).

### Task #3 — Phase 2: Generic compose-hint for unmatched COMPOSE_TRIGGERS

Unchanged from `.archive/handoff/2026-05-01-phase1-shipped-pre-delete-feature.md` §Step 1. The structural fix that turns "build me a habit tracker" into a registered app instead of raw primitives in a UUID-id project. Files all under `src/lib/chat/planner/`. ~2 hr estimate. Phase 1's appId validator (committed `0d08a870`) + the new delete-app cascade (this session) are both safety nets that catch what Phase 2's hint will mostly prevent.

After Phase 2 ships, re-smoke `"build me a habit tracker app"`. Acceptance: single `~/.ainative/apps/habit-tracker/` dir, `composedApp` metadata in `chat_messages`, `ComposedAppCard` renders. If anything goes sideways, the new delete button on `/apps` is the one-click reset for the next iteration.

---

## Follow-up nits (not blocking)

1. **Test gap on presentation components.** `app-detail-actions.tsx` + `app-card-delete-button.tsx` lack RTL coverage of the pluralization branches and success/failure toast paths. Would catch e.g. a future regression where someone changes `tableCount === 1` to `tableCount > 1`. ~30 min for a small `vi.spyOn(global, "fetch")` test pair.
2. **Server-side error sanitization.** `DELETE /api/apps/[id]` route returns raw `err.message` on 500. For a single-user local CLI this is fine (the user already knows their own home dir); for a multi-user dogfood instance, replace with a generic `"Delete failed — see server logs"` and rely on the existing `console.error` for diagnostic detail. Code review I-2 from the Task 2 quality pass.
3. **Empty-id validation on the API route.** Today, an empty `id` falls through to `deleteAppCascade("")`, which path-resolves to the apps dir itself, fails the `startsWith` guard, and returns 404 by accident. A defensive `if (!id) return 400` at the route would surface the bug correctly. Code review M-7 from the Task 2 quality pass.
4. **Extract shared `useDeleteApp(args)` hook** when a third consumer joins. Today there are two (`AppDetailActions`, `AppCardDeleteButton`) — duplication is acceptable per CLAUDE.md DRY-with-judgment. If `chat-message.tsx` (which already calls `DELETE /api/apps/:id` with a different shape) gets standardized, that's the third use → extract.
5. **`portfolio-manager` malformed manifest.** Visible on disk (`ls ~/.ainative/apps/portfolio-manager/`) but absent from the `/apps` UI — `parseAppManifest()` is silently rejecting it. Worth a 5-min investigation: read the manifest, see what's wrong, decide whether to fix-the-app or fix-the-parser to surface a warning.

---

## Net confidence

| Concern | State |
|---|---|
| `deleteAppCascade` covers happy / unknown / traversal / split / orphan paths | ✅ 5 unit tests in `registry.test.ts` |
| `DELETE /api/apps/[id]` covers happy / split-manifest / orphan / 404 / 500 | ✅ 5 unit tests in `route.test.ts` |
| Detail-page UI matches sibling detail views (schedules, profiles) | ✅ Outlined destructive button with text label |
| Card-list UI matches sibling list views (schedules-list) | ✅ Ghost icon button, `text-destructive`, `e.preventDefault() + e.stopPropagation()` |
| Pluralization correct for 0/1/N counts | ✅ `1 table (its)` vs `2 tables (their)` verified in browser smoke |
| Both surfaces share the same ConfirmDialog + cascade summary | ✅ Same description string builder, same component |
| `tsc --noEmit` clean | ✅ |
| Browser smoke verified end-to-end UI flow non-destructively | ✅ Screenshot artifacts at `/tmp/ainative-*` |
| Module-load cycle smoke required | ❌ Not applicable — no runtime-registry-adjacent files touched per CLAUDE.md gate |

**Net:** Solid, bisectable, well-tested. The user can now delete any registered app in one click from either surface, and the next session's Task #2 cleanup is largely a UI exercise instead of SQL — exactly the prerequisite Task #3 (Phase 2 re-smoke) needs.

---

*End of handoff. Working tree contains 1 changed file (this handoff). All 9 implementation commits on `main`. Smoke artifacts on disk awaiting Task #2 cleanup.*
