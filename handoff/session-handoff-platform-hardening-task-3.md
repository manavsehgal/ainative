---
title: "Session Handoff: Platform Hardening task 3 (task-turn-observability)"
audience: future-claude-session
status: ready
created: 2026-04-11
source_session: Platform Hardening tasks 1-2 shipped (schedule-maxturns-api-control, task-create-profile-validation)
handoff_reason: Tasks 2 and 1 from the Platform Hardening batch shipped cleanly on main with 8 commits total. Task 3 (task-turn-observability) remains. It is the heaviest of the three — metric-definition gate, schema changes, runtime-registry-adjacent code touches, and a mandatory end-to-end smoke test per TDR-032. The current session paused to conserve context budget for a fresh start on Task 3.
---

# HANDOFF: Platform Hardening task 3 — task-turn-observability

**You are picking up the last task in the Platform Hardening batch.** Tasks 1 (`task-create-profile-validation`) and 2 (`schedule-maxturns-api-control`) shipped in the previous session; their specs are flipped to `completed` in `features/roadmap.md` and their changelog entries are in `features/changelog.md` under `## 2026-04-11`. This handoff is self-contained for a fresh session — do not re-read the parent handoff (`handoff/session-handoff-platform-hardening-tasks-1-3.md`) unless you need it for a specific cross-reference.

## Repo state at handoff

- Branch: `main`. 8 commits ahead of the pre-batch state, all pushed to `origin/main`.
- Working directory: `/Users/manavsehgal/Developer/ainative`
- Main dev server: **not running.** A parallel instance `ainative-wealth` runs on `:3000` — **never touch it.** When you need to run the ainative dev server for the smoke test, use `PORT=3010 npm run dev` and kill via `lsof -iTCP:3010 -sTCP:LISTEN -t | xargs -r kill` when done.
- Node process discipline: use `run_in_background: true`, read output via the tool's output file path, and always kill before ending the session.
- Test command: `npx vitest run <path> 2>&1 | tail -30`
- Type check: `npx tsc --noEmit 2>&1 | tail -5; echo exit=$?`

### Recent commit stack (tasks 1 and 2 from this batch — match this style)

```
457d95c docs(features): flip task-create-profile-validation to completed
fc37f81 feat(chat): validate agentProfile against profile registry
e591f1c docs(features): add spike addendum for task disappearance symptom
542d02f docs(plan): add implementation plan for task-create-profile-validation
84b8ef4 docs(features): flip schedule-maxturns-api-control to completed
484c2ea docs(plan): add implementation plan for schedule-maxturns-api-control
649db6d fix(chat): bump maxTurnsSetAt when maxTurns is edited via chat tools
ed783bb feat(chat): expose schedules.maxTurns on create/update MCP schemas
```

Notice:
- `feat(chat)` for new features touching chat-tool schemas and handlers
- `fix(chat)` for correctness fixes on top of a feature commit
- `docs(features)` for spec/roadmap/changelog
- `docs(plan)` for plan-file creation (lands BEFORE the feature commits, not after)
- Every commit body has a Co-Authored-By: `Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer
- Subject lines terse; bodies 2-3 short paragraphs explaining **why**, not what

## Skills you must invoke before responding

When you start, **before any code**, invoke these in order (Skill tool):
1. `superpowers:using-superpowers` — establishes skill discovery discipline (it may already be pre-loaded in your system prompt; if so, follow its content directly)
2. `product-manager` — ship-gate rules apply when flipping the spec to completed
3. `architect` — TDR-032 is load-bearing for this task; drift heuristics apply
4. `writing-plans` AND `superpowers:writing-plans` — **read both.** The project override requires a scope challenge step and specific required sections (NOT in scope, What already exists, Error & Rescue Registry). It also codifies the **smoke-test budget policy** that this task triggers.
5. `superpowers:subagent-driven-development` — the user prefers subagent-driven execution with two-stage review (spec reviewer → code quality reviewer) after each implementer dispatch

## The task

**Spec:** `features/task-turn-observability.md`

**Priority:** P2, post-mvp milestone. The remaining spec in the Platform Hardening batch.

### What it delivers

1. **A written definition of what `turnCount` actually measures.** Observed production values are 700–2,900+ (see the table in the spec), which is far higher than any plausible "reasoning round" count. The metric is almost certainly counting stream frames or agentLogs rows of all types, not reasoning rounds. Both users and AI assistants currently misread these numbers and reach wrong diagnoses (e.g., "hitting a 48-turn limit" when the task actually completed successfully with 2,227 of whatever-unit). The spec's AC #1 is that the metric definition is written BEFORE any columns are added.
2. **Schema columns.** `turnCount: integer("turn_count")` and `tokenCount: integer("token_count")` on the `tasks` table in `src/lib/db/schema.ts` (near the existing `maxTurns` at ~line 57) AND a matching idempotent `ALTER TABLE` in `src/lib/db/bootstrap.ts`. **Schema and bootstrap MUST stay in sync** per the recurring gotcha in `MEMORY.md → "DB bootstrap"` — deployed DBs without the bootstrap update will crash with "no such column" errors.
3. **Capture at task completion.** In `src/lib/agents/claude-agent.ts` near the result-frame handler (approximately lines 225 and 300-309 per the spec's hints — verify current line numbers), persist the final `turnCount` and the token total (from the SDK result frame's usage metadata) onto the task row at completion.
4. **Scheduler consistency.** `src/lib/schedules/scheduler.ts:191-236` currently computes turn count via `COUNT(*) FROM agentLogs WHERE taskId = ?`. The spec wants it to read from `tasks.turnCount` for completed tasks and fall back to the `COUNT(*)` path only for rows with `turnCount IS NULL` (pre-existing rows). This keeps schedule aggregates (`lastTurnCount`, `avgTurnsPerFiring`) consistent with the individual task metric.
5. **Surface on MCP tool responses.** Extend `get_task` and `list_tasks` output in `src/lib/chat/tools/task-tools.ts` (look around lines 215-236 per the spec; note the file has been recently modified by Task 1, so line numbers have shifted — the current content is what matters) to include `turnCount` and `tokenCount` for completed tasks. Add a short field comment referencing the written metric definition.
6. **Documentation mirror.** Write the metric definition into `AGENTS.md` or `MEMORY.md` so the project reference stays consistent with the spec's References section.

### Critical ordering constraint

The spec explicitly requires the metric-definition investigation to happen **first**, before any columns are added. Trace `turnCount++` at `src/lib/agents/claude-agent.ts:225` (approximate) and the scheduler's `COUNT(*) FROM agentLogs` at `src/lib/schedules/scheduler.ts:191-195`. Determine exactly what is being counted. Write one precise paragraph into the spec's References section defining the metric (e.g., "Number of stream frames where the agent produced an assistant message"). **If the definition reveals the current name is misleading, rename or split the field — do not persist a misnamed metric.** This gate exists so the codebase doesn't cement the current 700–2,900 misread into the schema.

### Smoke-test budget — REQUIRED

Task 3 touches `claude-agent.ts` AND `scheduler.ts` AND `task-tools.ts` — **three files in or adjacent to the runtime-registry import cycle** (TDR-032). You **must** budget an end-to-end smoke step in the plan, not just unit tests. Precedent: the feature that preceded this batch (`task-runtime-ainative-mcp-injection`) shipped with 34/34 passing unit tests and `tsc --noEmit` clean but still crashed at first task execution because a static import created a `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`. Unit tests mocking `@/lib/chat/ainative-tools` structurally cannot catch that class of bug. See `.claude/skills/architect/references/tdr-032-runtime-ainative-mcp-injection.md` for the full decision and the smoke-test policy in `.claude/skills/writing-plans/SKILL.md`.

**Smoke-test recipe (tested and known to work in Task 2 of this batch):**
1. `PORT=3010 npm run dev` in the background
2. Navigate to `http://localhost:3010/chat` via `mcp__claude-in-chrome__navigate` (retry once if the first call fails — Claude in Chrome → retry → Chrome DevTools → Playwright, per `MEMORY.md → feedback-browser-tool-fallback.md`)
3. Click into the chat input using `mcp__claude-in-chrome__computer` with `action: left_click` and a `ref` from `find`. **Do not use `form_input`** — it sets the DOM value directly and doesn't trigger React's onChange. Use `action: type` followed by `action: key, text: "Return"`.
4. Prompt the chat assistant to create + execute a real task that exercises the new capture path (e.g., a task whose completion will emit a turn/token count you can read back via `get_task`).
5. Watch the dev server log for any `ReferenceError` or 500 response.
6. Read back the completed task via `get_task` and confirm `turnCount` and `tokenCount` are populated.
7. Kill the dev server: `lsof -iTCP:3010 -sTCP:LISTEN -t | xargs -r kill`.
8. Clear the inbox (approve/reject/delete pending notifications, Mark all read, Delete read — per `MEMORY.md → feedback-no-skip-screengrabs` / inbox-cleanup rule from the parent handoff).
9. Record the verification run in the spec's References section with task ID, runtime used, and outcome.

### Commit style (plan this out)

Probably 5-6 commits on `main`, in this order:
1. `docs(plan): add implementation plan for task-turn-observability` (controller writes this before dispatching)
2. `docs(features): document turn-count metric definition in spec` (the metric-definition gate — docs-only commit, appended to References section, **before any code**)
3. `feat(db): add turn_count and token_count columns to tasks table` (schema.ts + bootstrap.ts in sync)
4. `feat(agents): capture turn and token counts on task completion` (claude-agent.ts persist)
5. `feat(chat): surface turnCount and tokenCount on get_task and list_tasks` (task-tools.ts response shapes) — may be bundled with #4
6. `refactor(schedules): read tasks.turnCount with fallback to agentLogs count` (scheduler.ts) — may be bundled with #4
7. `docs(memory): mirror turn-count metric definition from spec` (AGENTS.md or MEMORY.md)
8. `docs(features): flip task-turn-observability to completed` (spec frontmatter + roadmap + changelog)

Feel free to collapse 4+5+6 into a single commit if it keeps the diff bisectable and reviewable. The metric-definition commit (#2) **must** land as its own commit per the spec's ordering constraint — this is the equivalent of Task 1's spike addendum commit.

## Workflow rules you must honor (non-negotiable)

These came from explicit user feedback during the first two tasks in this batch. Deviating will waste the user's time.

1. **Plan-first for every task.** Before touching code, write the scope challenge (REDUCE / PROCEED / EXPAND) **inline in your response** and wait for user approval. Then write the full plan into `docs/superpowers/plans/2026-04-11-task-turn-observability.md` using the writing-plans skill's template (bite-sized steps with exact code, TDD-style). Include the project-override required sections: **"NOT in scope"**, **"What already exists"**, **"Error & Rescue Registry"**. Then present the plan for approval inline (you are not in plan mode in this session — do not call ExitPlanMode; just summarize the plan and ask for approval).

2. **Front-load research into the controller's context.** Read the relevant code paths yourself (`claude-agent.ts`, `scheduler.ts`, `task-tools.ts`) before writing the plan. The scope challenge should reflect actual findings, not spec-level speculation. This pattern worked well for Tasks 1 and 2 — the spike work in Task 1 compressed from a budgeted 2 hours to ~15 minutes because the controller pre-drafted the addendum.

3. **Execute via subagent-driven-development, not inline.** After plan approval, use `superpowers:subagent-driven-development`: dispatch an implementer subagent (general-purpose) per task with the full task text pasted inline (NEVER make the subagent read the plan file), then dispatch a spec reviewer (general-purpose), then a code quality reviewer (`superpowers:code-reviewer` subagent type). Re-dispatch reviewers after fix-up passes until both approve.

4. **The controller handles the flip-to-completed commit inline.** Do NOT delegate `features/roadmap.md`, `features/changelog.md`, or the spec frontmatter flip to a subagent. The implementer subagent's scope ends at the feature code + tests. The controller does the docs-sync afterward.

5. **Never amend commits.** User rule. If a commit has an issue, make a new commit on top of it. Use `git commit -m "$(cat <<'EOF' ... EOF)"` with the Co-Authored-By trailer on every commit.

6. **Never skip hooks or bypass signing.** No `--no-verify`, no `--no-gpg-sign`.

7. **Stay on `main`.** Project precedent — all recent commits land directly on main. No feature branches, no worktrees for this task.

8. **Grooming separate from implementation.** The metric-definition commit (#2 above) is grooming — it lands before any code. Similarly, if the plan file (#1) needs edits during execution, commit them separately from code.

9. **Commit + push after all tasks in this feature complete** — one feature = one small stack of commits = one push at the end. Do not batch across features, do not push mid-task unless something urgent needs the remote.

10. **Flip to completed at the end.** Update the spec frontmatter `status: planned` → `status: completed`, update the `features/roadmap.md` row, prepend a "Completed — task-turn-observability (P2)" entry to `features/changelog.md` under the existing `## 2026-04-11` section (the section already exists with two completed entries above it — task-create-profile-validation and schedule-maxturns-api-control). Commit this as a separate `docs(features): flip X to completed` commit.

11. **Ship verification before flipping.** Per the product-manager skill's ship gate: verify each Acceptance Criterion in the spec has a concrete implementation or test, verify the frontmatter is consistent with the roadmap, verify there's a changelog entry. Two-stage subagent review (spec + code quality) covers most of this; the controller walks the AC checklist in the plan's final task.

## Don't rediscover these gotchas

These are either from `MEMORY.md` or from lessons learned during Tasks 1 and 2 in this batch:

1. **`tsc --noEmit` is authoritative, not the IDE.** The IDE language server reports spurious "await has no effect on the type of this expression" errors on `db.select()...get()` calls in `schedule-tools.ts` and `task-tools.ts` (it types drizzle-better-sqlite3's sync `.get()` as non-Promise, but `tsc` handles it fine). It also reports spurious "declared but never read" errors on helper functions that ARE used a few lines below. **If `tsc --noEmit` exits 0, trust it over the IDE.** Do not waste time "fixing" these false positives. Both Task 1 and Task 2 hit this.

2. **`schema.ts` and `bootstrap.ts` MUST stay in sync when adding columns.** Per `MEMORY.md → "DB bootstrap"`: migrations may not be applied automatically on deployed DBs, so `bootstrap.ts`'s idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` logic is the self-healing net. If you add `turn_count` / `token_count` to `schema.ts` but forget `bootstrap.ts`, deployed DBs crash with "no such column" at runtime. Task 3 is the most vulnerable commit in this batch for this class of bug.

3. **New columns don't require `clear.ts` updates.** `src/lib/data/clear.ts` only needs entries for new FK-dependent tables, not new columns on existing tables. But the safety-net test at `src/lib/data/__tests__/clear.test.ts` must still be green after the change — run it as part of verification.

4. **Drizzle `sql` template treats column refs as bound params.** Don't write `sql\`...${tasks.turnCount}\`` — use Drizzle's typed query builder (`.where(isNull(tasks.turnCount))`, etc.). Tripped up schedule aggregation work in the past per `MEMORY.md → Lessons Learned`.

5. **Runtime-registry module cycle.** Any static import from `claude-agent.ts` or `scheduler.ts` into `@/lib/chat/ainative-tools` or transitively `@/lib/chat/tools/*` can trigger a `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`. Task 3 only adds DB writes / reads within those files, so the risk is low — but if you find yourself importing a chat-tool helper into claude-agent.ts, use a dynamic `await import()` inside the function body. See TDR-032.

6. **`task-tools.ts` was just modified by Task 1.** Line numbers shifted. Do not trust the spec's line-number hints blindly; read the current file. Task 1 added:
   - A static import of `@/lib/agents/profiles/registry` (top of file)
   - Two helper functions (`isValidAgentProfile`, `agentProfileErrorMessage`) above `taskTools()`
   - `.refine()` calls on `create_task.agentProfile` and `update_task.agentProfile`
   - Handler-body error surfaces in `create_task` and `update_task`
   - A synchronous stale-profile check in `execute_task`
   - An empty-result note on `list_tasks` (envelope shape change on the empty-with-filter branch only)
   
   The response-surfacing work for Task 3 (step 5 above) lands in the **same** `get_task` and `list_tasks` handlers — account for the line shift when planning edits.

7. **Claude in Chrome form_input footgun.** `form_input` sets DOM value directly and doesn't fire React's onChange — messages typed this way never actually send. Use `computer action: type` followed by `action: key, text: "Return"`. Task 2's smoke test verified this is the working path.

8. **Inbox cleanup after smoke tests.** After any smoke test, clear the inbox: reject/allow/delete any pending notifications, then `Mark all read` + `Delete read`. The user explicitly asked to clear stale notifications after the previous feature.

9. **SDK subprocess env must strip `ANTHROPIC_API_KEY` for OAuth mode.** See `memory/sdk-subprocess-env-isolation.md`. If Task 3 touches how the SDK is invoked in `claude-agent.ts`, double-check this — but we expect only to add a `db.update(tasks).set({turnCount, tokenCount})` call in the completion handler, not to change SDK invocation.

10. **Default auth method is OAuth.** Don't assume api_key in any test fixture.

11. **Pre-existing tsc errors that are NOT from your work.** `claude-agent.test.ts` lines 83, 408-410, 432, 669 (some may shift if you edit the file); `chat-session-provider.test.tsx` module-not-found. Ignore these unless your edits make them worse.

## Reference file paths (so you don't have to grep)

| Purpose | Path |
|---|---|
| This feature's spec | `features/task-turn-observability.md` |
| Schema | `src/lib/db/schema.ts` (tasks table around lines 55-75) |
| Bootstrap | `src/lib/db/bootstrap.ts` |
| Claude agent execution (capture point) | `src/lib/agents/claude-agent.ts` — grep for `turnCount++` and result-frame handler |
| Scheduler turn aggregation | `src/lib/schedules/scheduler.ts:191-236` (metrics path), `:235-236` (write `lastTurnCount` / `avgTurnsPerFiring`) |
| Task tools (get_task, list_tasks, execute_task) | `src/lib/chat/tools/task-tools.ts` — note the file was modified in Task 1 |
| Test file for task-tools | `src/lib/chat/tools/__tests__/task-tools.test.ts` — created in Task 1, 20 tests already present |
| Test file for claude-agent | `src/lib/agents/__tests__/claude-agent.test.ts` (has pre-existing tsc errors — ignore lines 83, 408-410, 432, 669) |
| Clear.ts safety-net test | `src/lib/data/__tests__/clear.test.ts` — run after schema change |
| TDR-032 | `.claude/skills/architect/references/tdr-032-runtime-ainative-mcp-injection.md` |
| Smoke-test policy | `.claude/skills/writing-plans/SKILL.md` → "Smoke-Test Budget for Runtime-Registry-Adjacent Features" |
| Plan directory | `docs/superpowers/plans/` — file naming: `2026-04-11-task-turn-observability.md` |
| Previous batch plans (reference) | `docs/superpowers/plans/2026-04-11-schedule-maxturns-api-control.md`, `docs/superpowers/plans/2026-04-11-task-create-profile-validation.md` — **match the structure of these** for consistency |
| AGENTS.md testing section | `AGENTS.md` → `## Testing and Verification` |
| Project memory | `/Users/manavsehgal/.claude/projects/-Users-manavsehgal-Developer-ainative/memory/MEMORY.md` |
| Recent commit stack | `git log --oneline -12` |

## What to do first when the session starts

1. **Announce:** "Picking up Platform Hardening task 3 (task-turn-observability). Invoking required skills first." Then invoke the 5 skills listed above.
2. **Status check:** Run `git status`, `git log --oneline -12`, `ls features/` to confirm the world is in the state this handoff describes. Specifically:
   - `git log --oneline -12` should show the 8 commits from Tasks 1 and 2 (`457d95c`, `fc37f81`, `e591f1c`, `542d02f`, `84b8ef4`, `484c2ea`, `649db6d`, `ed783bb`) plus the handoff commit for this document.
   - `git status` should be clean OR show only unrelated pre-existing modifications in `features/*.md` files that are NOT from this batch (if so, leave them alone).
   - `features/task-turn-observability.md` frontmatter should still say `status: planned`.
3. **Read `features/task-turn-observability.md` in full.** It is the ground truth. The line-number hints in the spec may be stale — verify against the current code.
4. **Do the metric-definition spike inline (in the controller's context) before writing the plan.** Read `claude-agent.ts` around the `turnCount++` increment, trace what it's counting, read `scheduler.ts:191-195` to see how the `COUNT(*) FROM agentLogs` aggregation counts rows. Write the one-paragraph metric definition as part of your scope challenge response. This is the Task-1 precedent of pre-drafting the spike addendum — it compresses the subagent's work and improves plan quality.
5. **Scope-challenge the task.** Present REDUCE / PROCEED / EXPAND paths inline with your recommendation. Wait for approval.
6. **Write the plan** to `docs/superpowers/plans/2026-04-11-task-turn-observability.md`. Use the same structure as `docs/superpowers/plans/2026-04-11-task-create-profile-validation.md` (which is on disk and was the precedent for this batch). **The plan MUST include an explicit smoke-test task**, not just a bullet. See the writing-plans project override in `.claude/skills/writing-plans/SKILL.md`.
7. **Present the plan for approval** inline (you are not in plan mode — do not call ExitPlanMode). Summarize the commit structure and ask "Approve?"
8. **Commit the plan file first** as `docs(plan): ...` — controller handles this, before dispatching any subagent.
9. **Dispatch the implementer subagent** with the metric-definition + schema + capture + surfacing + scheduler-refactor work inline. The metric-definition commit (#2 in the commit stack above) should be the subagent's first commit within its dispatch, before any code changes — mirror the Task 1 addendum pattern.
10. **Review (spec + code quality) in parallel.** Fix-up loops until both approve.
11. **Run the smoke test.** The controller drives this, not the subagent (the subagent is for code; smoke-testing is interactive with the dev server and chat). Record the run in the spec's References section.
12. **Flip to completed, commit, push.**

## Things explicitly NOT in scope (do not scope-creep)

- **Historical backfill of `turnCount` / `tokenCount`** on pre-existing task rows. Spec says new rows only. The scheduler keeps its `COUNT(*) FROM agentLogs` fallback for rows with `turnCount IS NULL`.
- **A full cost-and-usage dashboard view.** Already covered by `features/cost-and-usage-dashboard.md`.
- **Cross-runtime metric normalization.** Scoped to the `claude-code` runtime; other runtimes (`openai-direct`, `anthropic-direct`, `openai-codex`, `ollama`) are a follow-up.
- **Per-turn timing breakdowns.** Out of scope.
- **Changing how the scheduler's `failureStreak` or `turnBudgetBreachStreak` logic works.** Task 2 already touched `maxTurnsSetAt` semantics — don't bundle more scheduler changes.
- **Extending the empty-result note pattern from Task 1 to other tools.** That was a Task 1 scope overreach we deliberately defended; don't open the door again here.
- **A `get_stagent_info` health-check tool or startup log for `STAGENT_DATA_DIR`.** Deferred from Task 1 as a separate feature; not in this batch.

## Sanity checks before you report anything as "done"

- `npx vitest run src/lib/chat/tools/__tests__/task-tools.test.ts` → existing 20 tests + any new `turnCount`/`tokenCount` surfacing tests pass
- `npx vitest run src/lib/agents/__tests__/claude-agent.test.ts` → existing tests pass (ignore pre-existing errors at lines 83, 408-410, 432, 669 if they persist)
- `npx vitest run src/lib/schedules/__tests__/` → scheduler tests pass
- `npx vitest run src/lib/data/__tests__/clear.test.ts` → safety-net test green
- `npx tsc --noEmit` → exit 0 (or pre-existing-only errors)
- `git status` is clean before each commit
- Spec frontmatter `status:` field matches the roadmap row
- Changelog has an entry under `## 2026-04-11` with the commit SHAs
- **Smoke test was run, a real task completed, `get_task` returned a populated `turnCount` and `tokenCount`, and the dev server was killed**
- No notifications left in the inbox
- Metric definition is written in both `features/task-turn-observability.md` References AND in `AGENTS.md` / `MEMORY.md` (consistent wording)

## What changed in the previous session that you should know about

These are patterns and discoveries from Tasks 1 and 2 that may be useful for Task 3:

1. **The three-tier defense pattern** (Task 1): Zod `.refine()` → handler-body re-check with richer error → execute-time stale check. Each tier has a distinct trigger (tool-registry validation wrapper, direct handler calls, pre-existing data). If Task 3 needs validation anywhere (e.g., validating `turnCount >= 0` at some boundary), this pattern is already in `task-tools.ts` to crib from.

2. **Envelope-shape discipline** (Task 1): `list_tasks` now returns two response shapes — raw array on happy path, `{tasks: [], note}` on empty-with-filter. When Task 3 adds `turnCount`/`tokenCount` to the response, preserve the current shape duality — don't accidentally re-wrap the happy path. Also, **do not surface the new fields on empty-result responses** (there are no tasks to annotate).

3. **maxTurnsSetAt grace-window latent dead code** (Task 2, fix commit `649db6d`): the scheduler at `scheduler.ts:211` has been reading `maxTurnsSetAt` to drive a first-breach grace window, but until Task 2 no production code wrote that column — the grace logic was latent dead code. Task 3 should **not** assume existing scheduler fields are actively populated. If you see a column being read by the scheduler, grep for writers before assuming you understand the data flow.

4. **IDE spurious diagnostics** are a persistent distraction. The language server reports:
   - "await has no effect" on drizzle `.get()` awaits — pre-existing, ignore
   - "declared but never read" on helper functions that ARE referenced — also a false positive, ignore
   `tsc --noEmit` is the authority.

5. **Plan file precedent:** Tasks 1 and 2 each used the same plan-file structure: header → What already exists → NOT in scope → Error & Rescue Registry → File Structure → Tasks (numbered, bite-sized) → Verification → Self-review notes. Both plan files are on disk in `docs/superpowers/plans/`. Structural consistency makes reviews faster.

6. **Controller-vs-subagent split:** The controller handles (a) scope challenge + plan writing, (b) the plan file commit, (c) inline spike research, (d) the flip-to-completed commit + push. The subagent handles (e) all code + tests + feature commits within a single dispatch. Two-stage review sits between subagent work and controller-handled flip.

---

**End of handoff.** When you're ready, announce, invoke the skills, do the status check, then read `features/task-turn-observability.md`. Do not write any code, plans, or long-form responses until after those three steps.
