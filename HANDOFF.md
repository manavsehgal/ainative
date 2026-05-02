# Handoff: Phase 2 + delete-route hardening shipped → orphan sweep is the only thing left

**Created:** 2026-05-01 (late afternoon)
**Status:** Phase 2 + delete-route hardening + handoff updates shipped to `origin/main` (4 commits, all pushed). Smoke-verified end-to-end against `npm run dev`; 118/118 green across the touched suites; tsc clean. **No blocking item open.** The substantive next-session task is the **multi-primitive orphan sweep** documented below — it spans projects + apps + profiles + blueprints + tables + schedules and exposes one tooling gap worth fixing first.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-phase2-shipped-pre-orphan-cleanup.md`

---

## TL;DR for the next agent

1. **Free-form composition prompts now work end-to-end.** `"build me a habit tracker app"` matches `COMPOSE_TRIGGERS` but misses `PRIMITIVE_MAP` → classifier returns a `compose` verdict with a generic plan (was `conversation` before) → `buildCompositionHint` emits a compact directive that (a) forbids Skill invocation, (b) mandates a kebab-case slug, (c) the `<slug>--<artifact>` id format on `create_profile`/`create_blueprint`, (d) `appId: '<slug>'` (no `--`) on `create_table`/`create_schedule`. Phase 1's appId validator catches the `--` mistake at the tool boundary; Phase 2 prevents the mistake from happening in the first place AND prevents the LLM from sliding off into the `ainative-app` Skill which asks 3 clarifying questions before composing.
2. **Smoke is clean.** `~/.ainative/apps/habit-tracker/manifest.yaml` has profile + blueprint + 2 tables + schedule all under `appId='habit-tracker'`. `chat_messages.metadata.composedApp` populated. ComposedAppCard renders in chat. `projects` row has `id='habit-tracker'` (slug, not UUID). One commit shipped: `9ecdda3f feat(planner): Phase 2 generic compose-hint for unmatched COMPOSE_TRIGGERS`.
3. **Next move = multi-primitive orphan sweep.** Detailed plan in the new "Orphan sweep" section below. The picture is more nuanced than the prior handoff suggested: only **2 of the 6 flagged "orphan projects" are actually empty** (`Habit Loop`, `Daily Journal`); the other 4 (`NVIDIA Learning Hub`, `Compliance & Audit Trail`, `Revenue Operations Command`, `GitHub Issue Sync`) carry 5–8 tasks + workflows + tables and look like deliberate dogfood. Meanwhile **5 profile dirs and 4 blueprint files on disk** have no matching app — they're orphaned cleanly because `deleteAppCascade` doesn't reach `~/.ainative/profiles/` or `~/.ainative/blueprints/`. **Recommend fixing that gap before sweeping** so the next free-form-compose smoke doesn't regrow them.

---

## What shipped this session (3 commits)

```
e8e7861e chore(apps): harden DELETE /api/apps/[id] + RTL coverage for delete UI
a5edca1e docs(handoff): Phase 2 generic compose-hint shipped
9ecdda3f feat(planner): Phase 2 generic compose-hint for unmatched COMPOSE_TRIGGERS
```

Commit `e8e7861e` batched three follow-up nits from the prior handoff:
1. Empty-id 400 short-circuit on `DELETE /api/apps/[id]` (was returning 404 by accident via path-traversal guard)
2. 500 sanitization — generic "Failed to delete app" body, raw err.message goes to console.error only (no home-dir leak)
3. RTL coverage for `app-detail-actions` + `app-card-delete-button` — pluralization branches, success/error toast paths, sibling-of-link click isolation, URL-encoded appId

13 new tests; 118/118 across api+apps+planner+components.

### Code

- **`types.ts`** (`src/lib/chat/planner/types.ts:3-15`) — `ComposePlan` now has `kind: "primitive_matched" | "generic"` discriminator; `profileId` and `blueprintId` are optional (only present on `primitive_matched`).
- **`primitive-map.ts`** (`src/lib/chat/planner/primitive-map.ts:1-5`) — `PrimitiveMapEntry = Omit<ComposePlan, "kind">` so the 16 builtin entries stay schema-clean. Classifier wraps with `{ kind: "primitive_matched", ...PRIMITIVE_MAP[key] }`.
- **`classifier.ts`** (`src/lib/chat/planner/classifier.ts:127-138`) — when `findTriggerMatch(COMPOSE_TRIGGERS)` hits but `findPrimitiveKey()` returns null, returns `{ kind: "compose", plan: { kind: "generic", rationale } }`. Was `{ kind: "conversation" }` before.
- **`composition-hint.ts`** (`src/lib/chat/planner/composition-hint.ts:3-13`) — `buildCompositionHint` now branches on `plan.kind`. Generic branch emits ~440-char compact directive: forbids Skill invocation, slug rule, `--`-on-profile/blueprint rule, no-`--`-on-appId rule. Primitive-matched branch unchanged.

### Tests (31/31 green; 351/351 across chat+apps; tsc clean)

```
src/lib/chat/planner/__tests__/classifier.test.ts          13/13   (+2 new)
src/lib/chat/planner/__tests__/composition-hint.test.ts    11/11   (+1 new for generic)
src/lib/chat/planner/__tests__/primitive-map.test.ts        4/4
src/lib/chat/__tests__/engine-planner.test.ts               3/3
                                                          ──────
                                                            31/31  in 565ms
npx tsc --noEmit                                            0 errors
```

Notable test change: the old `"build me a list of books" → conversation` assertion was replaced — that case is now compose-generic by design.

### Smoke validation (real data, npm run dev)

Conversation `73266415-07ff-41b2-95f3-d5c9fe6e910b`:
- LLM did NOT call Skill — composed directly via 5 primitive tool calls (with one self-correcting retry on the blueprint YAML format)
- `~/.ainative/apps/habit-tracker/manifest.yaml` — single dir, `id: habit-tracker`, profile `habit-tracker--habit-coach`, blueprint `habit-tracker--weekly-review`, 2 tables (Habits, Habit Log), 1 schedule (`0 20 * * *` Daily Habit Check-in)
- `chat_messages.metadata.composedApp` = `{appId:"habit-tracker", displayName:"Habit Tracker", hasProfile:true, hasBlueprint:true, tableCount:2, scheduleCount:1, primitives:["Profile","Blueprint","2 tables","Schedule"]}`
- ComposedAppCard rendered in chat with "Open app · Undo" buttons; sidebar shows new `Habit Tracker` link to `/apps/habit-tracker`
- `projects` row: `id='habit-tracker'`, `name='Habits'` — slug-id project, not UUID

Note: the LLM noticed an existing `Habit Loop` project (one of the 6 prior-era orphans) and remarked "I'll wire the app into it" — but in fact `ensureAppProject('habit-tracker', ...)` created a fresh `habit-tracker` project. The narration drifted; the actual side effects are clean.

---

## Iteration learning — why the first hint draft failed

The original generic-hint draft followed the spec literally — ~150 chars covering only items 1-3 (slug, appId rule, no `--`). It dropped the "MUST NOT invoke the Skill tool" guard the primitive-matched hint carries. Smoke #1 immediately failed: the LLM saw a free-form `"build me a habit tracker app"` and called the `ainative-app` Skill, which asks 3 clarifying questions before composing.

Fix was a one-line addition to the directive: explicit `MUST NOT invoke the Skill tool (no brainstorming, ainative-app, product-manager). Compose directly via primitive tools.` Hint now ~440 chars — still ~5x more compact than the primitive-matched hint (~2000 chars), but no longer underspecified. Test threshold relaxed from 400 → 700 chars.

**Pattern to remember:** "compact" relative to the existing hint isn't the same as "compact in absolute terms." Spec character budgets are guidance, not contracts — let the smoke decide.

---

## Outstanding state (audited 2026-05-01 17:50 PT)

### Repo
- `main` is in sync with `origin/main` after the 4-commit push. Working tree is clean once this handoff lands.

### Database
- 14 projects, 13 user_tables, 13 schedules, 4 user_table_triggers, 19 documents, 12 workflows, 59 tasks, 35 notifications.
- 0 FK orphans across `user_tables.project_id`, `schedules.project_id`, `user_table_triggers.table_id` (verified via the cross-table query in the sweep plan above). Cascade integrity is healthy.
- Project disposition table is in the sweep plan above. Net: 2 clean deletes (`Daily Journal`, `Habit Loop`) and 1 review (`GitHub Issue Sync`); the other 11 are intentional.

### Disk (`~/.ainative/`)
- `apps/` — just `habit-tracker/` (the smoke artifact)
- `profiles/` — 6 dirs; only `habit-tracker--habit-coach` matches a live app. The other 5 (`daily-journal--coach`, `habit-loop--coach`, `meal-planner--coach`, `portfolio-checkin--coach`, `weekly-reading-list--manager`) are orphans because `deleteAppCascade` doesn't reach this directory.
- `blueprints/` — 5 files; only `habit-tracker--weekly-review.yaml` matches a live app. The other 4 are orphans for the same reason.
- 2 chat messages have `composedApp` metadata: `habit-tracker` (live, fine) and `weekly-reading-list` (dangling but harmless — see "What's NOT in scope" in the sweep plan).

---

## Next session — multi-primitive orphan sweep

State audited at end of this session (2026-05-01 17:50 PT). Numbers are exact; names are real.

### Step 0 — fix the cascade gap before sweeping (~30 min)

`deleteAppCascade(appId)` (in `src/lib/apps/registry.ts:238`) only does two things: `deleteProjectCascade(appId)` (DB) and `fs.rmSync(appsDir/<appId>)` (manifest dir). It does NOT touch:

- `~/.ainative/profiles/<appId>--<artifact>/` — the profile dir(s) referenced from the manifest
- `~/.ainative/blueprints/<appId>--<artifact>.yaml` — the blueprint file(s) referenced from the manifest

Today's audit shows this gap empirically:
- 5 profile dirs on disk: `daily-journal--coach`, `habit-loop--coach`, `meal-planner--coach`, `portfolio-checkin--coach`, `weekly-reading-list--manager`
- 4 blueprint files on disk: `meal-planner--weekly-plan.yaml`, `portfolio-checkin--weekly-review.yaml`, `portfolio-manager--weekly-review.yaml`, `weekly-reading-list--synthesis.yaml`
- ZERO of these have a matching `~/.ainative/apps/<slug>/` dir or DB project

So either earlier sessions used a delete path that didn't cascade to profiles/blueprints, or the apps were never wired through `deleteAppCascade` at all. Either way: the gap exists today and will regrow on the next compose+delete cycle.

**Recommended fix (small):** extend `deleteAppCascade` to also remove app-namespaced profile dirs (`<appId>--*`) and blueprint files (`<appId>--*.yaml`). Add a `profilesRemoved: number` + `blueprintsRemoved: number` to `DeleteAppCascadeResult`. Update the route to surface them. ~25 LOC + 3 new tests in `src/lib/apps/__tests__/registry.test.ts` (cascade reaches profile dir, cascade reaches blueprint file, cascade is no-op when neither exists).

If you'd rather not touch the cascade, skip Step 0 and clean profiles/blueprints by hand in Step 4 — but the gap will reappear.

### Step 1 — Apps directory sweep (~2 min)

```bash
ls ~/.ainative/apps/
```

Today: only `habit-tracker/` (smoke artifact from this session). If you want a clean slate, delete via the `/apps` trash icon. Otherwise leave — it's a working composed app.

### Step 2 — Project sweep (~10 min, careful)

Audited disposition for the 14 rows in `projects`:

| id (truncated) | name | tables | schedules | tasks | workflows | disposition |
|---|---|---:|---:|---:|---:|---|
| `habit-tracker` | Habits | 2 | 1 | 0 | 0 | **KEEP** — slug-id, smoke artifact, has manifest |
| `12e5e99b…` | Portfolio Manager | 0 | 1 | 0 | 0 | **KEEP** — `working_directory` = this repo, dogfood |
| `07d7edff…` | Content Engine | 1 | 1 | 7 | 1 | **KEEP** — populated dogfood |
| `0d6a4aa9…` | Customer Success Automation | 1 | 1 | 6 | 1 | **KEEP** — populated dogfood |
| `0ddefdce…` | Client: MedReach Health | 0 | 1 | 6 | 1 | **KEEP** — populated dogfood |
| `1d452279…` | Compliance & Audit Trail | 0 | 1 | 6 | 1 | **KEEP** — populated dogfood (was flagged orphan but isn't) |
| `5637f769…` | Client: TechVenture Partners | 1 | 1 | 7 | 1 | **KEEP** — populated dogfood |
| `63a46710…` | Product Launch — AI Copilot v2 | 1 | 1 | 8 | 1 | **KEEP** — populated dogfood |
| `a07b9f32…` | NVIDIA Learning Hub | 3 | 0 | 5 | 3 | **KEEP** — populated dogfood (was flagged orphan but isn't) |
| `a4f66bb3…` | Revenue Operations Command | 2 | 1 | 6 | 1 | **KEEP** — populated dogfood (was flagged orphan but isn't) |
| `d2c4fa6b…` | Client: GreenLeaf Commerce | 1 | 1 | 6 | 1 | **KEEP** — populated dogfood |
| `a5a436b0…` | GitHub Issue Sync | 1 | 1 | 0 | 0 | **REVIEW** — table+schedule but no tasks/workflows; was flagged orphan |
| `5cfc9591…` | Daily Journal | 0 | 0 | 0 | 0 | **DELETE** — pure orphan |
| `6ae57515…` | Habit Loop | 0 | 0 | 0 | 1 | **DELETE** — near-orphan, only a stub workflow |

**Two clean deletes** (`Daily Journal`, `Habit Loop`) and **one judgment call** (`GitHub Issue Sync` — has 1 table + 1 schedule but zero tasks/workflows; check whether the table contains data before deleting).

**Recommended path:** open `/projects`, click each row's Delete button (already wired through `deleteProjectCascade`). Confirm the cascade summary matches the table above before clicking confirm.

**Alternate:** the chat tool `delete_project` (used by the LLM in chat) calls the same cascade; it's also fine but slower than the UI.

**Do NOT use raw SQL** — `deleteProjectCascade` is the only path that handles all 17 FK-related tables in the right order. See `src/lib/data/clear.ts` test for the full table list.

### Step 3 — Tables/schedules/triggers sweep (~3 min)

Each project has its own tables/schedules/triggers, all FK-dependent. Step 2's `deleteProjectCascade` cleans them up automatically — no extra work for kept-or-deleted projects.

The only standalone-orphan check worth doing: tables/schedules whose `project_id` references a project that no longer exists.

```bash
sqlite3 ~/.ainative/ainative.db "
  SELECT 'tables' as kind, t.id FROM user_tables t LEFT JOIN projects p ON p.id = t.project_id WHERE p.id IS NULL
  UNION ALL
  SELECT 'schedules', s.id FROM schedules s LEFT JOIN projects p ON p.id = s.project_id WHERE p.id IS NULL
  UNION ALL
  SELECT 'triggers', tr.id FROM user_table_triggers tr LEFT JOIN user_tables t ON t.id = tr.table_id WHERE t.id IS NULL;
"
```

Today this returns **0 rows** — clean. Re-run after Step 2 deletes; should still be 0 if `deleteProjectCascade` worked.

### Step 4 — Profile + blueprint disk sweep (~5 min)

The 5 profiles + 4 blueprints listed in Step 0 are all orphans (no matching app/project). After Step 0 ships, they'll be auto-cleaned next time a parent app is deleted. For the existing orphans, two options:

**Option A (preferred): wait until the matching app is deleted.** None of the parent apps exist on disk today, so Option A reduces to "manual cleanup" anyway.

**Option B: manual cleanup.** Use the existing `/profiles` and `/blueprints` UI Delete buttons (each calls the per-primitive `deleteProfile` / `deleteBlueprint` route). Or:

```bash
# Profiles — keeps habit-tracker--habit-coach (matches the live app)
for p in daily-journal--coach habit-loop--coach meal-planner--coach portfolio-checkin--coach weekly-reading-list--manager; do
  curl -X DELETE "http://localhost:3000/api/profiles/$p"
done

# Blueprints — keeps habit-tracker--weekly-review.yaml
for b in meal-planner--weekly-plan portfolio-checkin--weekly-review portfolio-manager--weekly-review weekly-reading-list--synthesis; do
  curl -X DELETE "http://localhost:3000/api/blueprints/$b"
done
```

Verify via UI counts on `/profiles` and `/blueprints` afterward.

### Step 5 — Verify final state

```bash
sqlite3 ~/.ainative/ainative.db "SELECT COUNT(*) FROM projects"   # expect 11–12 (was 14)
sqlite3 ~/.ainative/ainative.db "SELECT COUNT(*) FROM user_tables" # expect ≤ 13
sqlite3 ~/.ainative/ainative.db "SELECT COUNT(*) FROM schedules"   # expect ≤ 13
ls ~/.ainative/apps/                                                # expect just habit-tracker/
ls ~/.ainative/profiles/                                            # expect just habit-tracker--habit-coach/
ls ~/.ainative/blueprints/                                          # expect just habit-tracker--weekly-review.yaml
```

### Estimated effort
- Step 0 (cascade-gap fix): ~30 min including 3 new unit tests
- Steps 1–5 (sweep): ~20 min if you do Step 0 first; ~25 min without

### What's NOT in scope here
- The 11 chat conversations referencing the kept dogfood projects — fine, they'll keep working.
- The 2 chat conversations with `composedApp` metadata (`weekly-reading-list`, `habit-tracker`) — `habit-tracker` matches the live app; `weekly-reading-list` is dangling but harmless (the chat just shows an "Open app" button that 404s if clicked, which the existing 404 handling covers).
- `agent_logs` (1126 rows), `usage_ledger` (76 rows), `notifications` (35 rows) — these reference projects/tasks but degrade gracefully when the parent is gone. No FK constraint failures observed in `clear.ts` precedent.

---

## Other future work (separate from the sweep)

**Free-form compose hardening (~2-3 hr).** Phase 2 covers the `COMPOSE_TRIGGERS`-but-no-`PRIMITIVE_MAP` branch. Some hardening worth considering later:
- The generic hint doesn't include the `INTEGRATION_NOUNS` check, so `"build me a github habit tracker"` would still scaffold a GitHub plugin instead of composing. Likely desirable, but worth verifying.
- The smoke showed the LLM narrated "I'll wire the app into the existing Habit Loop project" but actually created a fresh `habit-tracker` project. If a user asks `"add to my Habit Loop app"` the planner has no path for that. Affordances for "extend an existing app" would close that gap.
- Consider a 30-day soak to see whether the generic hint's 440 chars is pulling its weight — if the LLM never tries to invoke Skill anyway, the guard line could shrink.

**Extract shared `useDeleteApp(args)` hook.** Premature today (only 2 consumers; CLAUDE.md DRY-with-judgment says extract on third). Wait until a third surface needs delete.

**Apps card UI: relocate trash + status (~10 min).** On `/apps` (`src/app/apps/page.tsx:33-54`), the card today has the title + Package icon on the left of the top row, the `Running` StatusChip on the right of the top row, and the trash icon absolutely positioned on top of the StatusChip (`top-1.5 right-1.5 z-10`). Replace with:
- **Top row:** `<Package /> <name>` on the left, trash icon on the right (drop the absolute positioning; render `AppCardDeleteButton` as the right-side flex child where StatusChip is today, and remove the `pr-8` clearance + the outer `<div className="absolute top-1.5 right-1.5 z-10">` wrapper)
- **Bottom row:** `<StatusChip status="running" size="sm" />` on its own line below the primitives summary

The existing `e.preventDefault() + e.stopPropagation()` guards on `AppCardDeleteButton` already keep clicks from bubbling to the surrounding `<Link>`, so moving it inside the flex row is safe. The RTL "stopPropagation" test in `app-card-delete-button.test.tsx:67` covers it.

---

## Key patterns to remember (carryover + new)

- **Smoke is the only ground truth for prompt-construction changes.** Unit tests pass with mocks; the LLM's actual response to the system prompt is unknowable until you run a real turn. The `vi.mock(...)` pattern fundamentally cannot exercise the LLM. CLAUDE.md "Smoke-test budget for runtime-registry-adjacent features" applies just as strongly to planner/system-prompt code paths.
- **Spec character budgets are guidance, not contracts.** "Compact hint (~150 chars)" was meant relative to the existing 2000-char hint. Aim for the spirit (concise, focused) and let the smoke validate the absolute size.
- **Discriminated unions beat optional chaining for compose plans.** Adding `kind` to `ComposePlan` made the `buildCompositionHint` branch obvious and lets future planners (e.g., `extend_app` mode) slot in without breaking primitive_matched assumptions.
- **The LLM narrates side effects from memory of partial reads.** When the smoke output says "wired into Habit Loop", check the actual files/DB rows — narration ≠ effect.

---

*End of handoff. Working tree clean after this file lands. Next session: orphan sweep — start at Step 0 (cascade gap fix), then Steps 1–5.*
