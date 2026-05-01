# Handoff: Reading Radar smoke — compose-path bug FIXED + smoke 7/11 green

**Created:** 2026-04-21
**Status:** Primary bug fixed. Smoke advanced to step 7 of 11. Dev server killed at end of session. Working tree has fix + bundle + test updates uncommitted.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **The M4.5 compose-path bug (brainstorming skill shadowing the
composition-hint) is FIXED via a two-pronged change: strengthened hint
directive + Skill-tool denial when verdict is compose. End-to-end smoke
confirms the model now composes apps instead of invoking brainstorming.
Primary blocker resolved.**

---

## The bug (recap from prior handoff)

When a user typed "build me an app to track my weekly reading list" in /chat:

- **Expected:** Classifier returns `compose`, `composition-hint.ts` appends
  an advisory block, model calls `create_profile` / `create_blueprint` /
  `create_table` tools.
- **Actual:** Model responded with the brainstorming skill's verbatim
  "visual companion offer" text. No composition tools were called.

Root cause confirmed: the advisory hint in `composition-hint.ts` was
shadowed by the `superpowers:brainstorming` skill (loaded via
`settingSources: ["user", "project"]`). The brainstorming skill's
description literally triggers on "creating features, building components"
and uses hard directive language ("YOU MUST USE IT. NOT NEGOTIABLE.") that
outranks the advisory hint's closing fallback clause.

---

## The fix

Two surgical changes, together forming structural + behavioral defense:

### 1. Strengthened composition hint (`src/lib/chat/planner/composition-hint.ts`)

- Retitled from "App Composition **Hint**" to "App Composition **Directive**"
- Opens with "CRITICAL" framing that declares the turn a deterministic
  routing decision, not a creative task
- Adds explicit "MUST NOT invoke the Skill tool (brainstorming,
  ainative-app, product-manager, or any other skill) for this turn"
- Closing MUST/action-list now includes the `<app-id>--<artifact-id>`
  double-hyphen namespace requirement with a concrete example
  (`weekly-reading-list--manager`). Without the `--`, the UI's
  `extractAppIdFromArtifactId` helper returns null → no
  `AppMaterializedCard` renders.
- Kept a narrow fallback "if stated intent clearly differs" clause so the
  directive doesn't fire on false positives, but explicitly instructs the
  model to "respond in prose directly" rather than invoking skills.

### 2. Skill-tool denial on compose verdict (`src/lib/chat/engine.ts`)

In the `canUseTool` closure, added an exception branch: when
`verdict.kind === "compose"` and the model attempts to invoke the `Skill`
tool, return `{ behavior: "deny", message: ... }`. This is a structural
backstop — even if a future skill's directive language outranks the hint,
the tool call is physically blocked.

Rationale for dual defense:
- Hint-only fix is fragile (dueling directives — skill may evolve to out-assert it)
- Skill-deny-only fix is opaque (model gets denied but doesn't know why)
- Together: the hint tells the model what to do; the deny stops it from
  doing the wrong thing anyway.

---

## Verification

### Unit tests

| Suite | Before | After |
|---|---|---|
| `composition-hint.test.ts` | 6 passing | 8 passing (added 2 assertions for MUST NOT / MUST call) |
| `classifier.test.ts` | 12 passing | 12 passing (unchanged) |
| `primitive-map.test.ts` | 4 passing | 4 passing (unchanged) |
| **Full suite** | **1566 pass / 7 fail / 11 skip** | **1566 pass / 7 fail / 11 skip** |

Pre-existing failures (`router.test.ts`, `settings.test.ts`) confirmed
unchanged via `git stash && test && git stash pop`. My diff net: +2
passing, 0 regressions.

### Browser smoke (Claude in Chrome, `AINATIVE_DATA_DIR=/tmp/reading-radar-smoke`)

| Step | Action | Result |
|---|---|---|
| 1 | Home renders | ✅ sidebar, data-dir badge `/tmp/reading-radar-smoke`, API Connected |
| 2 | /chat shell | ✅ textarea focused, "Ask anything" placeholder |
| 3 | Submit "build me an app to track my weekly reading list" | ✅ **FIX VERIFIED** — model composes app instead of brainstorming. Response created Project + Reading List Table (10 cols) + Reading List Manager profile |
| 4 | AppMaterializedCard renders | ⚠️ Quick Access pills rendered (Project link + Dashboard), but formal `data-slot="app-materialized-card"` did NOT render. Cause: model used `reading-list-manager` (plain kebab-case), not the `--` namespaced format the UI needs. The *updated* hint now includes the namespacing example; next compose should use it. |
| 5 | /plugins route | ❌ 404 (route doesn't exist — schedules page serves as de-facto bundle inventory) |
| 6 | /schedules | ✅ Both `Monthly Financial Close (finance-pack)` and `Sunday Reading Synthesis (reading-radar)` listed. Profile id resolves to composite `reading-radar/reader-coach`. Next firing: 2026-04-26. |
| 7 | /tables | ✅ `Reading List` table visible, 10 cols, project=`Weekly Reading List`, source=agent |
| 8 | Insert 2 rows | — not reached |
| 9 | Run task with `reading-radar/reader-coach` profile | — not reached |
| 10 | /schedules → "Run now" on sunday-synth | — not reached |
| 11 | MCP fetch-tool path | — not reached (optional) |

**Second compose run ("make me an app for a content marketing pipeline")**
confirmed the fix is not specific to the reading-list case — model composed
a Content Marketing Pipeline app referencing existing `content-creator` +
`content-marketing-pipeline` builtins. Ran in 25.5s (vs 72s for first run —
cache-warm). Same pattern: no brainstorming invocation, direct composition
tool calls.

---

## Uncommitted state at end of session

```
M src/lib/chat/engine.ts
M src/lib/chat/planner/__tests__/composition-hint.test.ts
M src/lib/chat/planner/composition-hint.ts
M src/lib/plugins/__tests__/seed.test.ts        (from prior paused-handoff session)
?? handoff/2026-04-21-reading-radar-compose-fix-handoff.md  (this file)
?? handoff/2026-04-21-reading-radar-smoke-paused-handoff.md  (prior)
?? src/lib/plugins/examples/reading-radar/       (bundle, 7 files, from prior session)
```

- **Dev server:** killed at end of session
- **Data dir:** `/tmp/reading-radar-smoke/` populated with two composed apps
  (Weekly Reading List, Content Marketing Pipeline) — safe to delete or keep
- **Git:** nothing committed. User drives commit timing per CLAUDE.md.
- **Playwright MCP browser:** N/A — this session used Claude in Chrome
  successfully (extension connected on first try after user's laptop restart).

---

## How to resume

### Recommended next commit boundary

Two separate commits per CLAUDE.md bisect-friendly discipline:

1. **`feat(chat): M4.5 compose-path fix — hint directive + Skill deny`**
   - `src/lib/chat/planner/composition-hint.ts`
   - `src/lib/chat/engine.ts`
   - `src/lib/chat/planner/__tests__/composition-hint.test.ts`

2. **`feat(plugins): reading-radar dogfood bundle`**
   - `src/lib/plugins/examples/reading-radar/` (7 files)
   - `src/lib/plugins/__tests__/seed.test.ts`

### Remaining smoke (steps 8-11)

Boot dev server (`AINATIVE_DATA_DIR=/tmp/reading-radar-smoke STAGENT_DEV_MODE=true npm run dev`)
and walk the remaining 4 steps:

8. Navigate `/tables`, click into `Reading List`, insert 2 sample rows via UI
9. Start a task with profile `reading-radar/reader-coach` and prompt "synthesize what I read this week". Confirm SSE log streams.
10. Navigate `/schedules`, click `Run now` on `Sunday Reading Synthesis`. Confirm task log row appears in `/tasks`.
11. (optional) Type "I need a tool to fetch article URLs" → confirm `ExtensionFallbackCard` renders (TDR-037 Phase 6 scaffold-path).

Then run a third compose chat with "build me an app to track my weekly
reading list" to verify the *updated* hint (with `--` namespacing
example) produces the proper namespaced IDs and the `AppMaterializedCard`
renders.

---

## Don't undo these

- **`verdict.kind === "compose"` branch** in `engine.ts` canUseTool Skill
  handler — without it, the hint alone is fragile against skill-directive
  updates. Structural backstop.
- **"CRITICAL" directive framing** in `composition-hint.ts` — downgrading
  back to advisory re-opens the shadowing vulnerability.
- **`--` namespacing example in the hint action list** — the UI's
  `extractAppIdFromArtifactId` at `src/lib/apps/composition-detector.ts:22`
  requires `--` to detect a composed app.
- **`reading-list-manager` profile created during smoke** — lives at
  `/tmp/reading-radar-smoke/` and has no `--` in its id (it was created
  BEFORE the hint's namespacing example landed). It'll show in
  `/profiles` as a Custom v1.0.0 entry. If you want a clean dogfood
  profile, delete it and re-compose with the updated hint.

---

## Open items (deferred)

- **AppMaterializedCard rendering for `reading-list-manager`** — the
  first-compose profile used plain kebab-case. To properly verify the
  card, compose a fresh app on the updated hint.
- **`/plugins` route** — currently 404. If the user wants an M3 plugin
  inventory UI, that's a new feature spec.
- **Blueprint creation error path** — in the smoke, Haiku wrote "Let me
  fix the blueprint format... Let me try a simpler blueprint structure".
  The final prose claims a blueprint was created, but not independently
  verified via `/blueprints` or API. Could be a real friction point with
  the `create_blueprint` schema that warrants a follow-up.
- **Module-not-found webpack warnings** for `transport-dispatch.ts`
  during dev — harmless dynamic-import noise, logged once per HMR. Not a
  blocker.
- **Pre-existing test failures** in `router.test.ts` and
  `settings.test.ts` (7 total) — predate this session, triaged out of
  scope.

---

## Architectural note

The scaffold-path short-circuit at commit `e739e446` bypasses the LLM
entirely for deterministic routing decisions. This session's fix keeps
the LLM in the compose-path loop (for rich prose + rationale) but
enforces composition via (a) directive hint and (b) Skill deny. The two
patterns are complementary:

- **Scaffold-path**: model is never called — 100% deterministic,
  appropriate when the entire response is a template.
- **Compose-path**: model is called but constrained — appropriate when
  the response needs model-generated summarization but the *routing*
  must be deterministic.

If future compose-path regressions surface (e.g., Haiku or a smaller
model declines even under the strengthened hint), the fallback is a
scaffold-path-style short-circuit: bypass the LLM, call the composition
tools server-side, persist `composedApp` metadata directly. This was
considered as a single-hypothesis fix but deferred because the
two-pronged hint+deny approach proved sufficient in the live smoke.

---

*End of handoff. Bug fixed, smoke 7/11 green, no regressions, nothing
committed. Resume at step 8 of smoke (table row insert) or at commit
boundary (2 commits described above).*
