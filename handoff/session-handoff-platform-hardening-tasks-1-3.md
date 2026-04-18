---
title: "Session Handoff: Platform Hardening tasks 1–3"
audience: future-claude-session
status: ready
created: 2026-04-11
source_session: task-runtime-ainative-mcp-injection shipped + follow-ups FU1/FU2/FU3
handoff_reason: The P0 in the Platform Hardening batch (task-runtime-ainative-mcp-injection) shipped + TDR-032 codified + smoke-test budget policy documented. Three more groomed specs are queued for execution. This handoff passes enough context so a fresh session can pick up without re-discovering session history, decisions, or gotchas.
---

# HANDOFF: Platform Hardening queue — tasks 1–3

**You are picking up mid-stream on the stagent Platform Hardening batch.** The P0 in this batch already shipped (`task-runtime-ainative-mcp-injection`, merged + pushed). Three more specs are ready to execute, groomed and waiting in `features/`. Your job is to ship them in priority order.

Read this briefing in full before touching anything. It captures session history, decisions you must honor, and gotchas you will otherwise rediscover the hard way.

## Repo state at handoff

- Branch: `main`. Clean tree. 10 commits ahead of the pre-session state, all pushed to `origin/main`.
- Working directory: `/Users/manavsehgal/Developer/stagent`
- Main dev server: **not running.** A parallel instance `stagent-wealth` runs on `:3000` — **never touch it.** When you need to run the stagent dev server, use `PORT=3010 npm run dev` and kill it via `lsof -iTCP:3010 -sTCP:LISTEN -t | xargs -r kill` when done.
- Node process discipline: if you start a dev server, use `run_in_background: true`, read output via the output file path the tool returns, and always kill it before ending the session.
- Test command: `npx vitest run src/lib/agents/__tests__/<file>.test.ts 2>&1 | tail -10`
- Type check: `npx tsc --noEmit 2>&1 | tail -3; echo exit=$?`

## Skills you must invoke before responding

When you start, **before any code**, invoke these in order (Skill tool):
1. `superpowers:using-superpowers` — establishes how to find and use skills.
2. `product-manager` — you will touch `features/` files; the ship-gate rules apply.
3. `architect` — TDR-032 is load-bearing for one of the tasks; drift heuristics apply.
4. `writing-plans` AND `superpowers:writing-plans` — the project override requires a scope challenge step and specific required sections. **Read both.**
5. `superpowers:subagent-driven-development` — the user prefers subagent-driven execution with two-stage review after each task (spec reviewer → code quality reviewer).

Do not skip any of these. The project has layered overrides that are not visible from a cold read of the base skills.

## The three tasks (in priority order)

Each has a full spec under `features/`. Read each spec in full before planning its task breakdown. The specs already contain Technical Approach, Acceptance Criteria, Scope Boundaries, and References sections — do not rewrite them, execute them.

### Task 1 (P1): `features/task-create-profile-validation.md`

**What it delivers:** Reject invalid `agentProfile` values at `create_task` (today, runtimes like `anthropic-direct` are accepted as if they were profiles). Also includes a **time-boxed investigation spike** for a reported symptom where tasks "disappeared" after creation.

**Critical correction already embedded in the spec:** The handoff doc that seeded this feature claimed "the task record was deleted." **That is wrong.** An Explore agent confirmed there is **zero task-deletion code anywhere in `src/`** — `claude-agent.ts:300-309, 363-371, 731-740` all persist `status: "failed"` with `failureReason` on every error path, and there is no GC/cleanup for tasks. The real cause is almost certainly a `STAGENT_DATA_DIR` or `projectId` scoping mismatch (see `MEMORY.md → shared-stagent-data-dir`). **The spec already says "investigation spike first, code second" — respect that ordering.** Do not write "stop deleting tasks" code; instead, reproduce the disappearance symptom, instrument it enough to determine the real cause, and document the finding in the spec's References section before any remediation lands.

**Files to modify:**
- `src/lib/chat/tools/task-tools.ts:91-96` — convert `agentProfile: z.string()` to `z.string().refine(id => getProfile(id) !== undefined, ...)` using `src/lib/agents/profiles/registry.ts`.
- `src/lib/chat/tools/__tests__/task-tools.test.ts` — add a test asserting `create_task` rejects `agentProfile: "anthropic-direct"`.

**Smoke-test budget (TDR-032 / AGENTS.md → Testing and Verification):** `task-tools.ts` lives under `src/lib/chat/tools/` which is transitively imported by `@/lib/chat/stagent-tools`, which is now loaded by `claude-agent.ts` via dynamic import. The changes are schema-only (Zod refinements), so they should not introduce a cycle — but if you refactor or add a new static import at the top of `task-tools.ts`, run a quick smoke-test to confirm the dev server boots. The full smoke-test recipe is in task 3's section; same pattern.

**Spike subtask constraints:**
- Time-box: ~2 hours max.
- Output: 1–2 paragraphs with file:line citations appended to the spec's References section, named "Spike addendum — <date>".
- If the cause turns out to be `STAGENT_DATA_DIR` or `projectId` scoping, the fix is improved error messaging (not isolation changes — the domain-clone isolation model is explicitly out of scope per the spec's Excluded list).

**Commit style:** Two commits minimum. First commit: spike findings documented in the spec. Second commit: the validation code + test. If the spike surfaces additional remediation (e.g. preserving a failed-state path that was missed), a third commit is fine.

---

### Task 2 (P2): `features/schedule-maxturns-api-control.md`

**What it delivers:** Expose the existing `schedules.maxTurns` column on `create_schedule` and `update_schedule` MCP input schemas. The column, the DB migration, the scheduler plumbing, and the schedule→task handoff at firing time already exist. Only the two Zod schemas are missing.

**This is the smallest of the three tasks** — probably 1–2 files, under 30 minutes of actual work plus tests. Do not over-scope it.

**Files to modify:**
- `src/lib/chat/tools/schedule-tools.ts:46-72` — add `maxTurns: z.number().int().min(10).max(500).optional()` to `create_schedule` input schema.
- `src/lib/chat/tools/schedule-tools.ts:202-219` — add the same field to `update_schedule` input schema. Must support explicit `null` to clear an override back to "inherit global default."
- `src/lib/chat/tools/__tests__/schedule-tools.test.ts` — add unit tests for create-with-value, update-to-new-value, clear-to-null, and range validation (reject below 10 or above 500).
- If `get_schedule` response serialization doesn't already echo the field (check first), add it.

**Don't touch:**
- `src/lib/db/schema.ts:237-239` — column already exists
- `src/lib/schedules/scheduler.ts:284, 535` — already correctly threads `maxTurns` from schedule to task
- Any UI — chat-tool access only for now, per the spec's Scope Boundaries

**Smoke-test budget:** Not required — `schedule-tools.ts` is pure Zod schema additions, no imports change, no runtime-registry adjacency.

**Commit style:** Single commit covering both schema additions + tests.

---

### Task 3 (P2): `features/task-turn-observability.md`

**What it delivers:** Add `turnCount` and `tokenCount` columns to the `tasks` table, capture them at task completion in `claude-agent.ts`, and surface them on `get_task` / `list_tasks` responses. **Also** commits to a **written definition** of what the existing turn-count metric actually measures, because observed values (700–2,900) far exceed any plausible "reasoning round" interpretation and currently mislead users and AI assistants into wrong diagnoses.

**Critical ordering constraint from the spec:** The metric definition investigation **must happen first**, before any columns are added. Trace `turnCount++` at `src/lib/agents/claude-agent.ts:225` (approximate, line may have shifted) and the scheduler's `COUNT(*) FROM agentLogs` at `src/lib/schedules/scheduler.ts:191-195`. Determine exactly what is being counted. Write one precise paragraph into the spec's References section defining the metric. **If the definition reveals the current name is misleading, rename or split the field — do not persist a misnamed metric.** This gate exists so the codebase doesn't cement the current 700–2,900 misread into the schema.

**Files to modify (after metric definition is written):**
- `src/lib/db/schema.ts` — add `turnCount: integer("turn_count")` and `tokenCount: integer("token_count")` to the `tasks` table, near the existing `maxTurns` column at line ~57.
- `src/lib/db/bootstrap.ts` — add matching idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` updates. Per `MEMORY.md → "DB bootstrap"`: **schema.ts and bootstrap.ts must stay in sync** or deployed DBs will crash with "no such column" errors. This is a repeat gotcha — do not skip.
- `src/lib/db/migrations/` — if the project's migration convention applies (check existing migration files for the current naming pattern), add a new migration file.
- `src/lib/agents/claude-agent.ts` — in the result-frame handler (around lines 225 + 300-309), persist `turnCount` and the SDK usage frame's token total onto the task row at completion.
- `src/lib/schedules/scheduler.ts:191-236` — the existing `COUNT(*) FROM agentLogs` path should read from `tasks.turnCount` for completed tasks and fall back to the count-query only for rows with `turnCount IS NULL` (pre-existing rows).
- `src/lib/chat/tools/task-tools.ts:215-236` — extend `get_task` and `list_tasks` response shapes to include the new fields.
- `AGENTS.md` or `MEMORY.md` — mirror the written metric definition so the project reference is consistent with the feature spec.
- `src/lib/data/__tests__/clear.test.ts` — verify still green per `MEMORY.md → Recurring Issues → clear.ts`. New columns don't require `clear.ts` updates (that's only for new FK-dependent tables), but the safety-net test must stay green.

**Smoke-test budget: REQUIRED.** Task 3 touches `claude-agent.ts` AND `schedule.ts` AND `task-tools.ts` — three files that sit in or near the runtime-registry import cycle (TDR-032). You **must** budget an end-to-end smoke step in the plan, not just unit tests. Precedent from the previous feature in this batch: 34/34 unit tests passed and `tsc --noEmit` was clean, but the feature still crashed at first task execution because a static import created a `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`. Unit tests mocking `@/lib/chat/stagent-tools` structurally cannot catch that class of bug. See `.claude/skills/architect/references/tdr-032-runtime-ainative-mcp-injection.md` for the full decision and the smoke-test policy in `.claude/skills/writing-plans/SKILL.md`.

**Smoke-test recipe (tested and known to work):**
1. `PORT=3010 npm run dev` in the background
2. Navigate to `http://localhost:3010/chat` via `mcp__claude-in-chrome__navigate` (retry once if the first call fails — see `MEMORY.md → feedback-browser-tool-fallback.md`; Claude in Chrome first, retry, then Chrome DevTools, then Playwright)
3. Click into the chat input using `mcp__claude-in-chrome__computer` with `action: left_click` and a `ref` from `find`. **Do not use `form_input`** — it sets the DOM value directly and doesn't trigger React's onChange, so the message never actually sends. Use `action: type` followed by `action: key, text: "Return"`.
4. Prompt the chat assistant to create + execute a real task that exercises the modified code path (e.g., a task whose completion will emit a turn/token count you can read back via `get_task`).
5. Watch the dev server log for any `ReferenceError` or 500 response.
6. Kill the dev server: `lsof -iTCP:3010 -sTCP:LISTEN -t | xargs -r kill`.
7. Record the verification run in the spec's References section with task ID, runtime used, and outcome.

**Commit style:** Probably 3 commits — (a) metric definition investigation + written definition in the spec, (b) schema + capture + surfacing, (c) verification note after smoke-test.

---

## Workflow rules you must honor (non-negotiable)

These came from explicit user feedback during the previous feature in this batch. Deviating will waste the user's time.

1. **Plan-first for every task.** Before touching code, write the scope challenge (REDUCE / PROCEED / EXPAND) **inline in your response** and wait for user approval. Then write the full plan into `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` using the writing-plans skill's template (bite-sized steps with exact code, TDD-style red→green→commit). Include the project-override required sections: "NOT in scope", "What already exists", "Error & Rescue Registry". Then call `ExitPlanMode` for approval.

2. **Execute via subagent-driven-development, not inline.** After plan approval, use `superpowers:subagent-driven-development`: dispatch an implementer subagent (general-purpose) per task with the full task text pasted inline, then dispatch a spec reviewer (general-purpose), then a code quality reviewer (`superpowers:code-reviewer` subagent type). The user explicitly chose this workflow in the previous feature. Do not skip reviews.

3. **Never amend commits.** User rule. If a commit has an issue, make a new commit on top of it. Use `git commit -m "$(cat <<'EOF' ... EOF)"` with Co-Authored-By: `Claude Opus 4.6 (1M context) <noreply@anthropic.com>` trailer on every commit.

4. **Never skip hooks or bypass signing.** No `--no-verify`, no `--no-gpg-sign`.

5. **Stay on `main`.** Project precedent — recent commits all land directly on main (see `dfd447e`, `56e2839`, `a2973b8`). The user explicitly confirmed this in the previous feature. No feature branches, no worktrees for this batch (the three tasks are small enough).

6. **Grooming separate from implementation.** If any spec needs editing (e.g. to correct a frontmatter or add a clarification), commit the grooming change as its own commit before starting the implementation commits. Do not mix them.

7. **Commit + push after each task**, not at the end. User pattern: one feature = one small stack of commits = one push. Do not batch multiple features into a single push.

8. **Flip to completed at the end of each task** — update the spec frontmatter `status:`, update the `features/roadmap.md` row, prepend a "Completed — <feature-name>" entry to `features/changelog.md` under the current date (check if a date section already exists). Commit this as a separate "docs(features): flip X to completed" commit.

9. **Run ship verification before flipping.** Per the product-manager skill's ship gate: verify each Acceptance Criterion in the spec has a concrete implementation, verify the frontmatter is consistent with the roadmap, verify there's a changelog entry. The previous feature went through two-stage review (spec + code quality) which effectively covered this, so repeat that pattern.

## Don't rediscover these gotchas

1. **SheetContent has no padding.** If any of these tasks ends up adding a UI sheet (unlikely but possible), always add `px-6 pb-6` to the body div inside SheetContent. This has been reported 3 times in `MEMORY.md`.

2. **Drizzle `sql` template treats column refs as bound params.** Don't write `` sql`...${tasks.id}` `` — use Drizzle's typed query builder.

3. **Tailwind v4 cascade layers.** Custom border-color CSS may need doubled attribute selectors `[data-slot="x"][data-slot="x"]` to beat utility specificity. Unlikely to matter for these three tasks.

4. **SDK subprocess env must strip `ANTHROPIC_API_KEY` for OAuth mode.** See `memory/sdk-subprocess-env-isolation.md`. If task 3 touches how the SDK is invoked, double-check this.

5. **Default auth method is OAuth, not api_key.** Don't assume api_key in any test fixture.

6. **Never set `turbopack.root` in next.config.mjs** — breaks npx CSS resolution.

7. **Migration renumbering.** Migrations in `src/lib/db/migrations/` follow a `NNNN_description.sql` pattern. During dev, use a temporary prefix; renumber at PR time if the project has pending migration drift. Check recent git log for the latest migration number.

8. **`clear.ts` safety-net test.** New tables with FK relationships must be added to `src/lib/data/clear.ts` in FK-safe order (children before parents). A test in `src/lib/data/__tests__/clear.test.ts` enforces this. Task 3 only adds columns, not a table — so `clear.ts` shouldn't need updates, but run the safety-net test to confirm.

9. **Chat input react state vs DOM.** When driving the browser via Claude in Chrome, `form_input` sets the `value` attribute but doesn't fire React's `onChange`, so the typed text never reaches the app's state. Use `computer action: type` instead. This wasted ~5 minutes in the previous feature — don't repeat it.

10. **Inbox cleanup after smoke tests.** After any smoke test, clear the inbox: reject/allow/delete any pending notifications, then `Mark all read` + `Delete read` to get back to zero. The user noticed stale notifications and explicitly asked to clear them. Don't leave the inbox dirty.

## Reference file paths (so you don't have to grep)

| Purpose | Path |
|---|---|
| TDR-032 invariant | `.claude/skills/architect/references/tdr-032-runtime-ainative-mcp-injection.md` |
| Canonical stagent injection helpers | `src/lib/agents/claude-agent.ts:45-88` |
| Helper call sites | `src/lib/agents/claude-agent.ts:547-578` (execute), `:677-708` (resume) |
| Stagent tool factory | `src/lib/chat/stagent-tools.ts:70-113` |
| Task tools (create_task, get_task, list_tasks, execute_task) | `src/lib/chat/tools/task-tools.ts` |
| Schedule tools (create_schedule, update_schedule, get_schedule) | `src/lib/chat/tools/schedule-tools.ts` |
| Profile registry | `src/lib/agents/profiles/registry.ts` |
| DB schema | `src/lib/db/schema.ts` — `tasks` around line 57, `schedules` around line 237 |
| DB bootstrap (keep in sync with schema) | `src/lib/db/bootstrap.ts` |
| Scheduler firing logic | `src/lib/schedules/scheduler.ts:191-236` (metrics), `:284, 535` (maxTurns handoff) |
| Claude agent test file | `src/lib/agents/__tests__/claude-agent.test.ts` |
| Feature specs (queue) | `features/task-create-profile-validation.md`, `features/schedule-maxturns-api-control.md`, `features/task-turn-observability.md` |
| Roadmap (Platform Hardening section) | `features/roadmap.md` (search for `### Platform Hardening`) |
| Changelog (most recent: 2026-04-11) | `features/changelog.md` |
| Plan directory | `docs/superpowers/plans/` — follow the naming pattern `YYYY-MM-DD-<feature-name>.md` |
| AGENTS.md — testing and verification rules | `AGENTS.md` → `## Testing and Verification` |
| Writing-plans project override | `.claude/skills/writing-plans/SKILL.md` |
| Project memory | `/Users/manavsehgal/.claude/projects/-Users-manavsehgal-Developer-stagent/memory/MEMORY.md` |

## The recent commit stack (context for what "done" looks like)

```
63782e1 docs: smoke-test budget policy for runtime-registry-adjacent features
8f7604e docs(architect): add TDR-032 for runtime stagent MCP injection invariant
3b269f3 refactor(agents): dedupe withStagentAllowedTools at both spread sites
48088a7 docs(features): flip task-runtime-ainative-mcp-injection to completed
2b5ae42 fix(agents): break stagent-tools import cycle via dynamic import
4906fcb fix(agents): extract stagent helpers + inject into resumeClaudeTask
969e096 docs(plan): rewrite Task 2 to extract shared stagent helpers first
ddd58fd fix(agents): use non-deprecated createToolServer in stagent injection
092f925 fix(agents): inject stagent MCP into executeClaudeTask
221f2db docs(features): groom handoff batch into Platform Hardening specs
```

Match this commit message style for the three new tasks. Notice:
- `fix(agents): ...` for bug-fix commits touching `src/lib/agents/`
- `refactor(agents): ...` for code cleanup in the same area
- `docs(features): ...` for spec/roadmap/changelog
- `docs(architect): ...` for TDRs
- `docs(plan): ...` for plan-file edits
- Every commit body has a Co-Authored-By trailer
- Subject lines are terse; bodies are 2–3 short paragraphs explaining **why**, not what

## What to do first when the session starts

1. **Announce:** "Picking up Platform Hardening tasks 1–3. Invoking required skills first." Then invoke the 5 skills listed above.
2. **Read the three feature specs in full.** Do not start with task 1 until you've read all three — task 3's smoke-test constraint affects how you'll scope the session, and task 2's simplicity may influence whether you batch things.
3. **Status check:** Run `git status`, `git log --oneline -5`, `ls features/` to confirm the world is in the state this handoff describes. If not, stop and tell the user what's different.
4. **Propose a sequencing.** Tell the user whether you want to do tasks 1 → 2 → 3 strictly (safer, matches priority), or whether you think 2 → 1 → 3 makes more sense (task 2 is a quick warm-up that confirms tooling works). Ask the user to pick.
5. **Scope-challenge task 1 first.** Present REDUCE / PROCEED / EXPAND paths. Wait for approval. Write the plan. Call ExitPlanMode. Execute via subagent-driven-development with spec + code quality reviews.
6. **Flip to completed, commit, push.** Then repeat for the next task.

## Things I explicitly did NOT include in these three tasks (do not scope-creep)

- Backfilling `turnCount` / `tokenCount` on pre-existing task rows — the spec says new rows only.
- A full cost-and-usage dashboard view — already covered by `features/cost-and-usage-dashboard.md`.
- Wildcard support in `canUseToolPolicy.autoApprove` — explicitly deferred per TDR-032. Not this batch.
- Cross-runtime metric normalization — task 3 is scoped to the claude-code runtime; other runtimes are a follow-up.
- A general task cleanup/GC retention policy for task 1 — no such policy exists today; do not build one speculatively just because the original handoff mentioned it.
- `STAGENT_DATA_DIR` isolation model changes — out of scope even if the task 1 spike reveals it's the cause.
- Helper type tightening from `Record<string, unknown>` to named `McpServerMap` alias — cosmetic follow-up flagged in the previous feature's code review, file separately if anyone wants it.
- A dedup-branch test (A-stagent-4 / R-stagent-3) for `withStagentAllowedTools` — low priority, file separately.

## Sanity checks before you report anything as "done"

- Unit tests all pass (use specific file paths, not the whole suite, unless you suspect regression).
- `npx tsc --noEmit` exits 0 (or fails only on the pre-existing errors at test-file lines 83/407-410/431/668/669 — those predate this work).
- `git status` is clean before each commit.
- Spec frontmatter `status:` field matches the roadmap row.
- Changelog has an entry under today's date with the commit refs.
- For task 3 specifically: the smoke test was run, the verification run is recorded in the spec, and the dev server was killed.
- No notifications left in the inbox if you ran the dev server.

---

**End of handoff.** When you're ready, start by invoking the skills and doing the status check. Do not write any code, plans, or even long-form responses until after those two steps.
