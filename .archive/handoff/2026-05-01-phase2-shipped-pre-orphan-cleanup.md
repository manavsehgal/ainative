# Handoff: Delete-app feature + Task #2 cleanup shipped → Phase 2 is next

**Created:** 2026-05-01 (end of afternoon)
**Status:** Tasks #1 + #2 complete (11 commits on `main`, ahead of `origin/main` until pushed). **Task #3 — Phase 2 generic compose-hint — is the only pending item.**
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-phase1-shipped-pre-delete-feature.md`

---

## TL;DR for the next agent

1. **You can now delete any composed app in one click** from either `/apps` (ghost trash icon on each card) or `/apps/[id]` (outlined destructive button in the header). Both surfaces invoke `DELETE /api/apps/[id]` → `deleteAppCascade(appId)` → `deleteProjectCascade(appId)` (DB cascade across 17 FK-related tables) + manifest dir removal. Granular response `{success, filesRemoved, projectRemoved}` lets the route map split-manifest and orphan-dir cases to 200 instead of 404.
2. **`~/.ainative/apps/` is empty.** All 7 leftover apps were swept via the new endpoint at the end of this session. DB went `19 projects / 16 user_tables / 17 schedules` → `13 / 11 / 12` — exactly the cascade math (6 apps had matching DB projects; `portfolio-manager` had only a manifest dir, which exercised the orphan-dir path on real data).
3. **Your next move = Task #3 — Phase 2 generic compose-hint.** Spec is below. ~2 hr. Files all under `src/lib/chat/planner/`. After Phase 2 ships, re-smoke `"build me a habit tracker app"`. If anything goes sideways, the new delete button on `/apps` is the one-click reset for the iteration cycle.

---

## What shipped this session (11 commits)

```
bbdf8a54 docs(handoff): mark Task #2 cleanup complete
a158ff6b docs(handoff): delete-app feature shipped + UX-aligned across surfaces
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

All bisectable. Each commit independently revertable.

### Backend
- **`deleteAppCascade(appId, options?)`** — `src/lib/apps/registry.ts:217-261`. Async wrapper that composes the existing `deleteProjectCascade` (DB) and `deleteApp` (FS). Path-traversal guard reused from `deleteApp`. DB cascade runs **before** dir removal so a failed cascade leaves the manifest intact for retry. Returns `{filesRemoved, projectRemoved}` independently.
- **`DELETE /api/apps/[id]`** — `src/app/api/apps/[id]/route.ts:14-37`. Was previously a manifest-only `deleteApp` call; now wires through to the cascade. 200 with granular `{success, filesRemoved, projectRemoved}` if either half succeeded; 404 only when both halves report nothing; 500 on cascade exception. GET handler unchanged byte-identical.

### Frontend
- **`AppDetailActions`** — `src/components/apps/app-detail-actions.tsx`. Outlined destructive button in the page header (`<Trash2 /> Delete app`), matching `schedule-detail-view.tsx:159` + `profile-detail-view.tsx:288`. Originally used a kebab `DropdownMenu`; refactored after `/frontend-designer` flagged the inconsistency.
- **`AppCardDeleteButton`** — `src/components/apps/app-card-delete-button.tsx`. Ghost icon button (`h-7 w-7 text-destructive`) positioned absolute `top-1.5 right-1.5 z-10` as a sibling of the card's `<Link>` (NOT inside it — avoids button-inside-link a11y issue). Defensive `e.preventDefault() + e.stopPropagation()`. Calls `router.refresh()` only.
- **`apps/page.tsx`** — each card wrapped in `<div className="relative">`; card header gets `pr-8` clearance for the absolutely-positioned trash button.
- Both surfaces share the same `ConfirmDialog` + same cascade-summary builder. Pluralization correct: `1 table (and its rows…)` vs `2 tables (and their rows…)`.

### Tests
```
src/lib/apps/__tests__/registry.test.ts                 25/25  (5 new for deleteAppCascade)
src/lib/apps/__tests__/compose-integration.test.ts      14/14
src/lib/apps/__tests__/composition-detector.test.ts     20/20
src/app/api/apps/[id]/__tests__/route.test.ts            5/5   (NEW)
src/components/apps/__tests__/starter-template-card.test  5/5
                                                       ───────
                                                        71/71  in 865ms
npx tsc --noEmit                                        0 errors
```

### Smoke validation (real data)
- `/apps` UI smoke: kebab→button→dialog wiring verified non-destructively (Cancel before Confirm)
- `DELETE /api/apps/[id]` mass smoke: 7 curl deletes — 6 returned `{filesRemoved:true, projectRemoved:true}`, 1 returned `{filesRemoved:true, projectRemoved:false}` for `portfolio-manager`. The latter validated the orphan-dir test case from commit `6e0e05d6` end-to-end on real data.
- Browser screenshots: `/tmp/ainative-apps-list-with-delete.png`, `/tmp/ainative-app-detail-direct-button.png`, `/tmp/ainative-delete-app-dialog.png`, `/tmp/ainative-apps-empty-state.png`.

---

## Next session — Task #3: Phase 2 generic compose-hint for unmatched COMPOSE_TRIGGERS

**Why this matters:** Free-form prompts like `"build me a habit tracker"` currently match `COMPOSE_TRIGGERS` ("build me") but miss `PRIMITIVE_MAP` (no entry for "habit"). The classifier returns a `conversation` verdict, no compose hint is injected, and the LLM composes from scratch into raw primitives in a UUID-id project — no manifest, no `composedApp` metadata, no `ComposedAppCard`. Phase 1's appId validator (commit `0d08a870`) only catches `--`-bearing artifact ids when the LLM enters the appId path — which it doesn't in this case. **Phase 2 is the structural fix.**

### Files (all under `src/lib/chat/planner/`)
- `types.ts` — `ComposePlan.profileId` + `.blueprintId` optional; add `kind: "primitive_matched" | "generic"` discriminator
- `classifier.ts` — return generic plan when `findPrimitiveKey()` returns null but `COMPOSE_TRIGGERS` matches (currently returns `conversation` verdict in that branch)
- `composition-hint.ts` — generic-plan branch emits a compact hint (~150 chars) directing the LLM to:
  1. Pick a slug (lowercase kebab-case, e.g. "habit-tracker")
  2. Pass that slug as `appId` on every `create_table` / `create_schedule` call
  3. Avoid `--` in the appId (Phase 1 validator enforces; the hint just primes)

### Tests
- 3 cases in `classifier.test.ts`:
  - `COMPOSE_TRIGGERS` + no `PRIMITIVE_MAP` → generic plan
  - `PRIMITIVE_MAP` match still returns `primitive_matched`
  - Neither match still returns `conversation`
- 1 case in `composition-hint.test.ts`: generic plan emits compact hint with slug/appId/-- rules and stays under ~150 chars

### Verification (per CLAUDE.md "Smoke-test budget for runtime-registry-adjacent features")
This touches the prompt-construction path that feeds `claude-agent.ts`. **Unit tests are necessary but NOT sufficient.** Must end-to-end smoke `"build me a habit tracker app"` against `npm run dev` and confirm:
- Single `~/.ainative/apps/habit-tracker/` dir created (no split, no UUID project)
- `chat_messages.metadata.composedApp` populated
- `ComposedAppCard` renders in the chat UI

If the smoke creates leftover artifacts (it shouldn't, but Phase 2 is the bug we're fixing), use the new `/apps` trash icons to clean up before re-smoking.

### Plan reference
`docs/superpowers/plans/2026-05-01-delete-app-cascade.md` covered Tasks #1+#2. There is **no plan yet for Task #3**. Either write one with `superpowers:writing-plans` (recommended for the TDD discipline; ~10 min) or proceed directly if the spec above is enough — it's a small, well-bounded change.

### Estimated effort
~2 hr including the smoke run.

---

## Outstanding state

### Repo
- `main` is 11 commits ahead of `origin/main` until you push (this handoff session does the push as part of `commit and push`).
- Working tree is clean once this handoff lands.

### Database
- 13 projects, 11 user_tables, 12 schedules, 4 user_table_triggers remain.
- Among the 13 projects: 6 are UUID-id orphans from prior free-form-compose smokes (`GitHub Issue Sync`, `NVIDIA Learning Hub`, `Compliance & Audit Trail`, `Revenue Operations Command`, `Habit Loop` (UUID variant), `Daily Journal` (UUID variant)). The rest look like deliberate dogfood projects (`Client: MedReach Health`, `Customer Success Automation`, `Content Engine`, `Product Launch — AI Copilot v2`, etc.). Don't sweep these without a separate user pass — some are intentional.
- After Phase 2 ships, the UUID-id orphans should stop accumulating. A natural follow-up is to run `/projects` and use that page's existing Delete buttons (already cascade via the same `deleteProjectCascade`) to sweep the 6 orphans. Worth offering a `/schedule` for ~1 week out so the user has time to check which ones were intentional.

### Disk
- `~/.ainative/apps/` is empty — clean slate for the Phase 2 re-smoke.

---

## Follow-up nits (not blocking Phase 2)

1. **Test gap on presentation components.** `app-detail-actions.tsx` + `app-card-delete-button.tsx` lack RTL coverage of pluralization branches and toast paths. ~30 min for `vi.spyOn(global, "fetch")` test pairs.
2. **Server-side error sanitization.** `DELETE /api/apps/[id]` route returns raw `err.message` on 500 — fine for single-user local CLI, leaks home dir paths in multi-user contexts. Replace with generic message, keep `console.error` for diagnostic detail.
3. **Empty-id validation on the API route.** Today, an empty `id` falls through to `deleteAppCascade("")`, path-resolves to apps dir itself, fails the `startsWith` guard, returns 404 by accident. Add `if (!id) return 400` at the route boundary.
4. **Extract shared `useDeleteApp(args)` hook** when a third consumer joins. Today there are two; CLAUDE.md DRY-with-judgment says extract on third use.
5. **Sweep the 6 UUID-id orphan projects** (mentioned in "Outstanding state → Database") after Phase 2 stops creating new ones.

---

## Key patterns to remember

- **`/frontend-designer` consultation was the highest-leverage step in this session.** Code reviews approved the kebab pattern; only the cross-cutting design audit caught that two sibling detail pages (schedules, profiles) used direct destructive buttons. One refactor commit restored visual consistency across three detail pages. **For UX-touching features, schedule a designer pass — code review can't see across features.**
- **The portfolio-manager cleanup result was an unplanned end-to-end validation gift.** The orphan-dir case is hard to construct in a unit test (needs a manifest-on-disk-with-no-DB-project state); the real-data sweep produced exactly that fixture for free.
- **Reuse-first scope challenge cut the original plan in half.** Discovering `deleteProjectCascade` already existed (extracted earlier for `/api/projects/[id]`) collapsed Task 1 from "implement 17-table FK cascade" to "compose two existing helpers." **Always grep before scoping.**

---

*End of handoff. Working tree contains 1 changed file (this handoff). After commit + push, `main` and `origin/main` are in sync. Next session: Task #3.*
