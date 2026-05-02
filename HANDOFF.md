# Handoff: Phase 2 + delete-route hardening shipped → orphan sweep is the only thing left

**Created:** 2026-05-01 (late afternoon)
**Status:** Phase 2 + 3 hardening nits shipped on `main` (3 commits ahead of `origin/main` until pushed). Smoke-verified end-to-end against `npm run dev`; 118/118 green across the touched suites; tsc clean. **No blocking item open.** Only outstanding follow-up is the optional orphan-project sweep (needs user judgment on which orphans are intentional).
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-phase2-shipped-pre-orphan-cleanup.md`

---

## TL;DR for the next agent

1. **Free-form composition prompts now work end-to-end.** `"build me a habit tracker app"` matches `COMPOSE_TRIGGERS` but misses `PRIMITIVE_MAP` → classifier returns a `compose` verdict with a generic plan (was `conversation` before) → `buildCompositionHint` emits a compact directive that (a) forbids Skill invocation, (b) mandates a kebab-case slug, (c) the `<slug>--<artifact>` id format on `create_profile`/`create_blueprint`, (d) `appId: '<slug>'` (no `--`) on `create_table`/`create_schedule`. Phase 1's appId validator catches the `--` mistake at the tool boundary; Phase 2 prevents the mistake from happening in the first place AND prevents the LLM from sliding off into the `ainative-app` Skill which asks 3 clarifying questions before composing.
2. **Smoke is clean.** `~/.ainative/apps/habit-tracker/manifest.yaml` has profile + blueprint + 2 tables + schedule all under `appId='habit-tracker'`. `chat_messages.metadata.composedApp` populated. ComposedAppCard renders in chat. `projects` row has `id='habit-tracker'` (slug, not UUID). One commit shipped: `9ecdda3f feat(planner): Phase 2 generic compose-hint for unmatched COMPOSE_TRIGGERS`.
3. **Next move = optional orphan sweep.** Six UUID-id orphan projects from the pre-Phase-2 era still sit in the DB (see prior handoff "Outstanding state → Database"). They no longer accumulate — Phase 2 stops the bleed — but they're noise on `/projects`. ~10 minutes via the existing `/projects` page Delete buttons (already cascade through `deleteProjectCascade`). Worth checking each one is intentional vs. orphaned before deleting.

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

## Outstanding state

### Repo
- `main` is 1 commit ahead of `origin/main` until you push.
- Working tree is clean once this handoff lands.

### Database
- 14 projects, 13 user_tables, 13 schedules, 5 user_table_triggers (post-smoke counts).
- The new `habit-tracker` project is intentional (the smoke artifact). The 6 pre-existing UUID-id orphans flagged in the prior handoff are still present:
  - `GitHub Issue Sync`
  - `NVIDIA Learning Hub`
  - `Compliance & Audit Trail`
  - `Revenue Operations Command`
  - `Habit Loop` (UUID variant — separate from the new `habit-tracker`)
  - `Daily Journal` (UUID variant)
- These should stop accumulating now that Phase 2 ships. Sweep optional; some may be intentional dogfood projects worth keeping.

### Disk
- `~/.ainative/apps/` contains a single `habit-tracker/` (the smoke artifact). Optional cleanup via `/apps` trash icon if you don't want to keep it.

---

## Next session — pick one

**Option A: orphan-project sweep (~15 min, low risk).** Visit `/projects`, check each of the 6 UUID-id orphans, delete the truly orphaned ones via the existing Delete buttons (cascade through `deleteProjectCascade`). Keep any that are intentional. Refer to "Outstanding state → Database" for the list.

**Option B: remaining follow-up nits.** Items 1-3 from the prior handoff shipped in `e8e7861e`. Two left:
1. ~~RTL coverage~~ — done
2. ~~Server-side error sanitization~~ — done
3. ~~Empty-id validation~~ — done
4. Extract shared `useDeleteApp(args)` hook — premature today (only 2 consumers; CLAUDE.md DRY-with-judgment says extract on third). Wait until a third surface needs delete.
5. Sweep the 6 UUID-id orphan projects — same as Option A.

**Option C: free-form compose hardening (~2-3 hr, deeper work).** Phase 2 covers the `COMPOSE_TRIGGERS`-but-no-`PRIMITIVE_MAP` branch. Some additional hardening worth considering:
- The generic hint doesn't include the `INTEGRATION_NOUNS` check, so `"build me a github habit tracker"` would still scaffold a GitHub plugin instead of composing. That's likely desirable, but worth verifying.
- The smoke showed the LLM narrated "I'll wire the app into the existing Habit Loop project" but actually created a fresh `habit-tracker` project. If a user asks `"add to my Habit Loop app"` the planner has no path for that — it falls through to compose-generic and creates a new app. Affordances for "extend an existing app" would close that gap.
- Consider a 30-day soak to see whether the generic hint's 440 chars is actually pulling its weight — if the LLM never tries to invoke Skill anyway, the guard line could be deleted.

---

## Key patterns to remember (carryover + new)

- **Smoke is the only ground truth for prompt-construction changes.** Unit tests pass with mocks; the LLM's actual response to the system prompt is unknowable until you run a real turn. The `vi.mock(...)` pattern fundamentally cannot exercise the LLM. CLAUDE.md "Smoke-test budget for runtime-registry-adjacent features" applies just as strongly to planner/system-prompt code paths.
- **Spec character budgets are guidance, not contracts.** "Compact hint (~150 chars)" was meant relative to the existing 2000-char hint. Aim for the spirit (concise, focused) and let the smoke validate the absolute size.
- **Discriminated unions beat optional chaining for compose plans.** Adding `kind` to `ComposePlan` made the `buildCompositionHint` branch obvious and lets future planners (e.g., `extend_app` mode) slot in without breaking primitive_matched assumptions.
- **The LLM narrates side effects from memory of partial reads.** When the smoke output says "wired into Habit Loop", check the actual files/DB rows — narration ≠ effect.

---

*End of handoff. Working tree clean after this file lands. Next session: optional orphan sweep, or one of the carry-over nits.*
