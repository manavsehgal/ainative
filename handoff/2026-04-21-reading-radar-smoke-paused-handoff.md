# Handoff: Reading Radar end-to-end journey — PAUSED mid-smoke

**Created:** 2026-04-21
**Status:** Paused. Dev server killed. Working tree has the bundle + test update uncommitted. User is restarting laptop and will resume.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **A second dogfood bundle (`reading-radar`) was designed and written
to disk. The seed test was extended. The dev server booted against isolated
`AINATIVE_DATA_DIR=/tmp/reading-radar-smoke` and the home + /chat pages
rendered clean. The first smoke step surfaced a real bug: the M4.5
compose-path's composition-hint is being SHADOWED by the brainstorming skill,
so the model offers to brainstorm instead of rendering the `AppMaterializedCard`.
Smoke paused at that bug. Next session resumes at the investigation.**

---

## Why this work exists

User asked to:
1. Plan a useful domain app a target persona could build using the
   Self-Extending Machine features (M1 + M2 + M3 + M4 + M4.5).
2. Walk the end-to-end plan → build → run journey.
3. Browser-smoke the journey, find + fix bugs.

Approved plan file: `/Users/manavsehgal/.claude/plans/parallel-fluttering-hinton.md`
— contains the full design + smoke script. Read that first if the context window
is fresh.

---

## What was designed — Reading Radar

Second committed dogfood bundle alongside `finance-pack`. Target persona:
Personal / Power User. The bundle exercises all four primitives + MCP tie-in.

```
src/lib/plugins/examples/reading-radar/     (NEW, 7 files, uncommitted)
  plugin.yaml                  — id: reading-radar, apiVersion: "0.14"
  profiles/reader-coach/
    profile.yaml               — anthropic-direct, Read-only tools, maxTurns: 20
    SKILL.md                   — "one takeaway per reading" philosophy
  blueprints/weekly-synthesis.yaml
                               — 3-step sequence: cluster → motifs → email digest
  tables/readings.yaml         — date, title, url, takeaway, tags, rating, week
                                 + 3 sample rows (Situational Awareness, Bitter
                                 Lesson, AI Native notes)
  schedules/sunday-synth.yaml  — cron "0 9 * * 0", wraps weekly-synthesis
  README.md                    — bundle overview
```

Every file mirrors the `finance-pack` shape exactly. Nothing novel in the
primitive shape — this is pure composition.

---

## What shipped to disk this session (uncommitted)

Working tree (from `git status --short`):

```
M src/lib/plugins/__tests__/seed.test.ts
?? src/lib/plugins/examples/reading-radar/
```

### Test extension

`src/lib/plugins/__tests__/seed.test.ts` lines 38–39, 47 now expect
`reading-radar` alongside `echo-server` + `finance-pack`. Both tests pass:

```
npx vitest run src/lib/plugins/__tests__/seed.test.ts \
                src/lib/plugins/__tests__/install-path-parity.test.ts
# → 5 pass, 0 fail
```

### Pre-audit on collateral

- `src/lib/plugins/seed.ts` uses `fs.cpSync(..., { recursive: true })` — so it
  already copies `schedules/` subdir (no M2 T14 gap found — the strategy
  handoff's worry was unfounded).
- `install-path-parity.test.ts` uses its own `demo` fixture, doesn't assert on
  `examples/` count. Safe.
- No other tests hard-code bundle counts (verified via grep).

---

## Smoke run — what happened

**Dev server boot:**
```
AINATIVE_DATA_DIR=/tmp/reading-radar-smoke STAGENT_DEV_MODE=true npm run dev
```
Booted clean. Home page rendered. Sidebar showed all 5 groups. Badge read
`/tmp/reading-radar-smoke` (isolation working).

**Browser tool fallback:** Claude in Chrome extension returned "No Chrome
extension connected" on both attempts. Fell back to Playwright MCP (per memory
`feedback-browser-tool-fallback`). User then asked to switch to visible
Playwright so they could follow along — Playwright MCP runs headless by default
for this user's install, and user paused the session before I could investigate
the headless flag.

**Smoke steps completed:**

| # | Step | Result |
|---|---|---|
| 1 | Navigate `localhost:3000` | ✅ Home renders, sidebar + API Connected + data-dir badge all correct |
| 2 | Navigate `/chat` | ✅ Chat shell renders, input focused, "No conversations yet" |
| 3 | Type *"build me an app to track my weekly reading list"* + submit | ❌ **BUG** — see below |
| 4–11 | — | Not reached |

### The bug — compose-path shadowed by brainstorming skill

**Session URL:** `localhost:3000/chat?c=6af27442-932e-44a5-874b-51db84243d6f`
(stored in the isolated DB at `/tmp/reading-radar-smoke/stagent.db`)

**Expected per M4.5 shipped handoff:** Classifier returns `ClassifierVerdict:
"compose"`. `composition-hint.ts` appends the advisory system-prompt block.
Model is steered to render the `AppMaterializedCard` with
`researcher + documentation-generation + readings` table.

**Actual model response (Haiku, default model):**

> I'll help you build a reading list tracking app. Let me start by using
> the brainstorming skill to explore the best approach for your needs.
>
> I'm following the brainstorming skill to design your reading list app
> properly. Let me start by exploring the project context and understanding
> your needs.
>
> **Project Context:** The ainative workspace already has powerful
> infrastructure for this — tables, workflows, profiles, and automation. A
> reading list tracker could be built as a composition of these primitives
> rather than a standalone app.
>
> Before we dive into design, let me offer something that might help us
> think through this visually:
>
> Some of what we're working on might be easier to explain if I can show it
> to you in a web browser. I can put together mockups, diagrams,
> comparisons, and other visuals as we go. This feature is still new and
> can be token-intensive. Want to try it? (Requires opening a local URL)

This is the **brainstorming skill's "visual companion offer"** verbatim —
from `.claude/skills/brainstorming/visual-companion.md`. The model loaded
the brainstorming skill instead of rendering the materialization card.

**Two possible root causes to investigate:**

1. **Advisory-only hint is too weak.** Per the M4.5 planner spec,
   `composition-hint.ts` only *appends* to the system prompt — it doesn't
   short-circuit tool choice. If a dominant skill (like brainstorming) is
   also in the system prompt and instructs "invoke Skill tool BEFORE any
   response", the model follows the skill's rule over the advisory hint.
2. **Classifier may not have matched.** "build me an app to track my weekly
   reading list" matches `COMPOSE_TRIGGERS[0]` ("build me"), and "reading
   list" matches `PRIMITIVE_MAP["reading list"]`. Both lookups should hit.
   But if the classifier's pattern matching is stricter than expected, it
   could return `"chat"` verdict, bypassing the hint injection entirely.

**Investigation entry points (next session):**

1. Add temporary `console.log` in `src/lib/chat/engine.ts` around the
   `classifier.classify()` call — log the verdict + hint text actually
   appended to the system prompt. Re-run smoke.
2. If verdict is `"compose"` and hint is appended: the bug is that the
   brainstorming skill's `using-superpowers` rules outrank the hint. Options:
   (a) promote the hint to a harder directive in `composition-hint.ts`,
   (b) short-circuit the compose-path similar to how scaffold-path
   short-circuits in `engine.sendMessage` (commit `e739e446`),
   (c) demote/disable the `using-superpowers` behavior in chat context.
3. If verdict is `"chat"` (not compose): the bug is in `classifier.ts` —
   trigger-phrase matching likely too strict.

**Triage:** This is a real M4.5 regression or known limitation surfacing
under the brainstorming-skill context. The M4.5 shipped handoff at
`handoff/2026-04-21-m4.5-shipped-handoff.md` noted no end-to-end browser smoke
was done at ship time — so this session is the first time the compose-path
was exercised live with a real LLM + real skills loaded. Exactly the kind of
bug E2E smoke is meant to catch.

---

## Also caught during prep (non-blocker)

- `install-path-parity.test.ts` run emitted stderr `[bootstrap] ALTER TABLE
  failed: no such table: conversations` — the memory-documented "addColumnIfMissing
  runs BEFORE the table CREATE" pattern. Test passes (the ALTER swallows
  silently). Not related to Reading Radar but worth noting.

---

## State at pause

- **Branch:** `main`. Working tree: 1 M, 1 untracked (see above).
- **Dev server:** killed (`lsof -ti:3000 | xargs kill`).
- **Data dir:** `/tmp/reading-radar-smoke/` still populated — contains the
  test DB with session `6af27442-932e-44a5-874b-51db84243d6f` and the
  seeded example plugins. Can be deleted any time (`rm -rf
  /tmp/reading-radar-smoke`) or kept for re-running the smoke.
- **Tests:** 5/5 pass on the updated seed + install-parity suite. Full
  suite not re-run this session.
- **Git:** nothing committed. No push. User drives commit timing per
  CLAUDE.md.
- **Playwright MCP browser:** closed.
- **Claude in Chrome:** extension was not connected during this session;
  user's next session should verify the extension is active before
  attempting again.

### Artifacts on disk

- `src/lib/plugins/examples/reading-radar/` (7 files)
- `src/lib/plugins/__tests__/seed.test.ts` (modified, 2 lines added)
- `.playwright-mcp/snapshot-chat-after-compose.yml` (captured chat state
  showing the bug — gitignored area)
- `/tmp/reading-radar-dev.log` (dev server output — may or may not still
  exist after restart)
- `/tmp/reading-radar-smoke/` (isolated data dir)
- `/Users/manavsehgal/.claude/plans/parallel-fluttering-hinton.md`
  (approved plan)

---

## How to resume

### First action next session

1. Read this handoff.
2. Read `/Users/manavsehgal/.claude/plans/parallel-fluttering-hinton.md`
   (the approved plan — has the full smoke script + 11 steps).
3. Confirm working tree state:
   ```
   git status --short
   # expect: M src/lib/plugins/__tests__/seed.test.ts
   # expect: ?? src/lib/plugins/examples/reading-radar/
   ```
4. Decide browser mode — Claude in Chrome retry (visible, user preferred
   but extension wasn't connecting) vs. visible Playwright (research the
   headless flag for `@playwright/mcp`) vs. keep headless.

### Resume smoke flow

1. Re-boot dev server:
   ```
   rm -rf /tmp/reading-radar-smoke  # optional — fresh DB is highest-confidence
   mkdir -p /tmp/reading-radar-smoke
   AINATIVE_DATA_DIR=/tmp/reading-radar-smoke STAGENT_DEV_MODE=true \
     npm run dev > /tmp/reading-radar-dev.log 2>&1 &
   ```
2. Investigate the compose-path bug — entry points listed above. Likely
   fix is one of:
   - Make the composition hint a harder directive in
     `src/lib/chat/planner/composition-hint.ts`
   - Add a compose-path short-circuit in `src/lib/chat/engine.ts` (mirror
     the scaffold-path at commit `e739e446`)
   - Suppress superpowers skills in chat context (risky — may have wider
     fallout)
3. Re-run smoke step 3, confirm materialization card renders.
4. Continue through steps 4–11 per plan file.

### When the smoke passes end-to-end

1. Full test suite (`npm test`) to confirm no regressions.
2. Write a ship handoff
   (`handoff/2026-04-21-reading-radar-shipped-handoff.md`) mirroring the M5
   structure.
3. Commit the 7 bundle files + seed test update + any compose-path fix as
   ONE or TWO commits (bundle + fix, separately).
4. User drives push + any npm publish timing.

---

## Don't undo these

- **`src/lib/plugins/examples/reading-radar/` directory structure** — follows
  `finance-pack` convention exactly. Any simplification (flat YAML,
  different subfolder names) breaks the M1 loader's `scanBundleSection<T>`
  expectations.
- **`apiVersion: "0.14"`** in `plugin.yaml` — MUST match the current
  `SUPPORTED_API_VERSIONS` window in `src/lib/plugins/registry.ts`. Bumping
  to `"0.15"` or dropping this line rejects the bundle at load time.
- **Seed test assertions** at `seed.test.ts:47` — the sort list must match
  the actual `examples/` directory contents, case-sensitive. Adding more
  bundles requires extending this list; removing one requires shrinking it.
- **`agentProfile: reading-radar/reader-coach`** in `sunday-synth.yaml` —
  uses composite-id format. Any schedule or blueprint reference to a plugin
  profile MUST use `<plugin-id>/<profile-id>`. Bare `reader-coach` won't
  resolve.
- **`profileId: reading-radar/reader-coach`** in `weekly-synthesis.yaml`
  steps — same composite-id rule.

---

## Open questions still deferred

From the plan file:

- **Schedule firing in-session** — cron `"0 9 * * 0"` won't fire during the
  smoke; "Run now" manual trigger is the path. If you want to observe a
  live fire, temporarily set `"* * * * *"` and revert.
- **MCP fetch tool** — user confirmed they want M3 exercised in-journey.
  Still deferred; not yet wired.
- **Commit timing** — bundle + test update still uncommitted per CLAUDE.md
  risky-action discipline.

---

*End of handoff. Smoke paused at step 3 (compose-path bug). Bundle is on
disk + tests green. Dev server killed. User restarting laptop; resume at
"First action next session" above.*
