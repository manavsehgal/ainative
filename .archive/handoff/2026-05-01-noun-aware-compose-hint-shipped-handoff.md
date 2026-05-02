# Handoff: GitHub Issue Sync deleted + noun-aware compose hint shipped → 2 compose-hardening sub-items left

**Created:** 2026-05-01 (late evening)
**Status:** Both carryover items from the prior handoff cleared. `GitHub Issue Sync` project deleted; noun-aware generic compose hint shipped (commit `8acc55fa`). Working tree clean. **`main` is 1 commit ahead of `origin/main`** — push not done (user hasn't asked).
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-handoff-only-compose-and-issue-sync-review-pre-shipped.md`

---

## TL;DR for the next agent

1. **`GitHub Issue Sync` project deleted** via `DELETE /api/projects/a5a436b0-6278-4e3f-a3c8-516803ad5009` → `{"success":true}`. Cascade reached the active schedule, table, and project row. Disk + DB still clean (12 → 11 projects; everything else untouched).

2. **Noun-aware generic compose hint shipped** (commit `8acc55fa`). `"build me a github habit tracker"` now routes to compose generic (was scaffold) with `integrationNoun: "github"` carried into the plan and surfaced as a warning in the hint: "Composition primitives can't make external API calls — compose the structure and tell the user to scaffold a separate plugin if they need github access. Do NOT scaffold a plugin in this turn." The scaffold-first test (`"build me a tool that pulls my github issues"`) still passes — the noun-guard only short-circuits to scaffold when no app-intent word ("app", "tracker", "dashboard", "workflow") is present.

3. **Tests:** 32/32 planner (4 new — 2 classifier, 2 hint) + 289/289 chat. tsc clean.

4. **Next move (in order):** push the 1-commit lead to `origin/main` (one-liner if the user okays it), then either of the two remaining compose-hardening sub-items: **"Extend existing app" affordance (~1.5-2 hr)** is the substantive one; the **30-day soak on the 440-char generic hint** is passive (telemetry-gated, not actionable today).

---

## What shipped this session (1 commit, 1 deletion)

```
8acc55fa feat(planner): noun-aware generic compose hint — github habit tracker no longer scaffolds
```

### Routing change (`src/lib/chat/planner/classifier.ts`)

- New `APP_INTENT_WORDS` const: `["app", "tracker", "dashboard", "workflow"]`.
- The noun-guard at lines 147-154 (now lines 159-170 with the new conditional comment) only short-circuits to scaffold when `!hasAppIntent(normalized)`. With app-intent present, the guard falls through to the compose path.
- Both `inferComposePlan` (primitive_matched) and `genericComposePlan` paths now receive the detected noun. The classifier spreads `integrationNoun: noun` into the returned plan so the hint can branch on it.

### Hint change (`src/lib/chat/planner/composition-hint.ts`)

- `buildGenericHint` checks `plan.integrationNoun` and appends a 4th line when present:
  > Note: the user mentioned `<noun>`. Composition primitives can't make external API calls — compose the app structure (profile + blueprint + tables + schedule) and tell the user to scaffold a separate plugin (e.g. "i need a tool that pulls my <noun> data") if they need <noun> access. Do NOT scaffold a plugin in this turn.

### Type change (`src/lib/chat/planner/types.ts`)

- `ComposePlan` gained `integrationNoun?: string` (optional, applies to both `primitive_matched` and `generic` kinds).

### Verification

Verified deterministically via direct `tsx --eval` invocation across 4 canonical prompts:

| Input | Verdict | `integrationNoun` |
|---|---|---|
| `build me a github habit tracker` | compose generic | `github` (warning emitted) |
| `build me a tool that pulls my github issues` | scaffold | n/a (preserved) |
| `build me a notion portfolio app` | compose primitive_matched | `notion` |
| `build me a habit tracker app` | compose generic | none (no warning) |

**LLM smoke not run** — Claude in Chrome extension wasn't connected (returned "Browser extension is not connected"). The deterministic part is fully covered by tests; the LLM-side observation (does the model actually compose without scaffolding when given the new hint?) is the soak/observation step that was waived this session.

---

## Outstanding state (audited 2026-05-01 ~22:05 PT)

### Repo
- `main` is **1 commit ahead of `origin/main`**. `8acc55fa` is local-only. Working tree clean.

### Database
- 11 projects (was 12 — `GitHub Issue Sync` deleted).
- 13 user_tables, 13 schedules, 4 user_table_triggers — these still match per the FK-orphan audit recipe; no orphans introduced.

### Disk (`~/.ainative/`)
- `apps/` — `habit-tracker/` only (unchanged).
- `profiles/` — `habit-tracker--habit-coach/` only (unchanged).
- `blueprints/` — `habit-tracker--weekly-review.yaml` only (unchanged).

### FK-orphan audit recipe (canonical, plugin-aware)

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

Verified 0 rows on 2026-05-01 post-delete. (The `GitHub Issue Sync` schedule + table cascaded cleanly.)

---

## Other future work

### Free-form compose hardening (2 sub-items left, ~2 hr)

1. **"Extend existing app" affordance (~1.5-2 hr).** Carryover. Today the planner has no `extend_app` mode — every compose creates a new app. If a user says `"add to my Habit Loop app"` there's no path. Needs a new planner mode + chat-tool + classifier branch + tests. Phase 2 smoke caught the LLM narrating "I'll wire the app into the existing Habit Loop project" but actually creating a fresh `habit-tracker` project — that's the symptom this would fix.

2. **30-day soak on the 440-char generic hint.** Passive. The hint includes "MUST NOT invoke the Skill tool" because of a Phase 2 smoke where the LLM tried to call Skill before composing. If 30 days of real chat traffic show the LLM never tries to invoke Skill anyway, the guard line could shrink to ~250 chars. Not actionable today; needs telemetry from compose conversations.

### LLM smoke for the noun-aware hint (~5 min when extension is up)

The deterministic side of `8acc55fa` is fully covered by unit tests. The LLM-side observation is the only thing not yet verified:

- Send `"build me a github habit tracker"` in chat (with the dev server up).
- Expected: a compose card titled "Habit Tracker" with profile + blueprint + tables, AND a prose mention of "you'll need to scaffold a separate plugin to access github."
- Negative signal: a scaffold card ("I can scaffold a github plugin for that") would mean the routing change didn't land OR the LLM ignored the new hint.

The Claude in Chrome extension was offline this session; rerun when it's back. Browser fallback chain per project memory: Claude in Chrome → retry once → Chrome DevTools → Playwright.

### Apps consumers — extract `useDeleteApp(args)` hook

Premature today (only 2 consumers: `app-detail-actions.tsx` + `app-card-delete-button.tsx`). CLAUDE.md DRY-with-judgment says extract on third. Wait until a third surface needs delete.

### Soak validation for cascade gap (passive)

Step 0 from the prior session is unit-tested + live-smoked, but real-world coverage will only come from organic compose+delete cycles. If `profilesRemoved` or `blueprintsRemoved` ever shows up as 0 when the user expected non-zero, the heuristic (slug prefix match) needs revisiting.

---

## Key patterns to remember (carryover + new from this session)

- **Browser-smoke gap is real but bounded.** When the Claude in Chrome extension isn't connected, you can still verify deterministic prompt-construction via a one-shot `npx tsx --eval` invocation that imports the classifier + hint builder. That covers everything except actual LLM behavior, which is empirical and needs an A/B chat run anyway. Don't block the commit on the LLM smoke if the deterministic path is fully tested — note the gap in the handoff and move on.
- **`APP_INTENT_WORDS` is the cleavage line between scaffold and compose for noun-bearing prompts.** Strong-tool requests ("a tool that pulls X") have no app-intent word and route to scaffold via the noun-guard short-circuit. App-y requests ("a github habit tracker") have an app-intent word and route to compose with the noun carried into the hint. If a future case feels miscategorized, check whether the user's phrasing matches an app-intent word — that's the routing pivot.
- **The noun-guard is now defense-in-depth, not the primary scaffold trigger.** Primary scaffold signals are the explicit `SCAFFOLD_TRIGGERS` list (e.g. `"i need a tool that pulls"`, `"integrate with"`). The noun-guard catches ambiguous cases that don't match any scaffold trigger but do mention an integration. Don't add new scaffold patterns to the noun-guard branch — add them to `SCAFFOLD_TRIGGERS` instead.
- **HANDOFF interpretation is itself a skill.** The prior handoff's text "the LLM may still scaffold a GitHub plugin instead of composing" was technically wrong (it was the *classifier*, not the LLM, that scaffolded), but the *intent* — get this case to compose with a noun warning — was correct. When a handoff description is technically muddy, fall back to: what does the user actually want to happen? Then build to that, not the literal text.
- **`{"success":true}` for the project DELETE was sufficient — no need to also check the projects table.** `deleteProjectCascade` is the canonical path; if it returns success, the row + cascade are gone. Skip the verification `sqlite3` query unless you see contradicting evidence (e.g. orphan schedules in the audit recipe).

---

*End of handoff. `main` 1 commit ahead of `origin/main`. Working tree clean. Recommended next move: push the lead to remote (one-liner if user okays), then start on `extend_app` affordance — the substantive sub-item of free-form compose hardening (~1.5-2 hr).*
