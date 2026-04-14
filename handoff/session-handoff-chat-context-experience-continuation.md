# Session Handoff — Chat Context Experience Continuation

**Handoff date:** 2026-04-13
**Previous session commits:** `fb130b1` → `2979350` (19 commits across two features + one cleanup)
**Status of feature bundle:** 2 of 10 Chat Context Experience features complete. All P0 critical-path work shipped. Ready to continue.

## What shipped in the previous session

1. **`runtime-capability-matrix` (P1)** — declared LLM-surface capability as first-class artifact. 7 commits `fb130b1` → `34350f5`. Plan: `.claude/plans/steady-capable-matrix.md`.
2. **`chat-claude-sdk-skills` (P0)** — flipped Stagent chat on the `claude-code` runtime from "isolation mode" to "SDK-native." Enables `settingSources`, `Skill` tool, filesystem tools (Read/Grep/Glob/Edit/Write/Bash/TodoWrite), and `list_profiles` fusion with SDK-discovered skills. 11 commits `78bdbaa` → `fc44233`. Plan: `.claude/plans/claude-sdk-skills-ignition.md`.
3. **`createStagentMcpServer` deprecation cleanup** — 1 commit `2979350`. Net −19 lines.

Both feature specs have their `status: complete` flipped, roadmap updated, changelog entries appended. TDR-032 live smoke tests verified via browser.

## Your mission

Work through **three sequential cleanups / continuations**, then continue with the remaining **7 Chat Context Experience features** in priority order. Do NOT skip steps or reorder — step 3 depends on step 2 (CLAUDE.md enriched before task-runtime-skill-parity ships so tasks benefit from the same content), and step 4+ depend on step 3 (task runtime needs SDK-native parity before sibling runtimes diverge).

---

## Step 1 — Stale-comment touch-up (cosmetic cleanup)

**Why:** The Community-Edition rollback (commits `0436803`, `3a0dc42`) removed ~8,600 lines of license/billing/Supabase/marketplace code. An audit during the previous session (handoff/session-handoff-chat-context-experience-continuation.md) confirmed all orphan files, API routes, components, tests, and package deps are gone. Two files retain stale comments referencing removed systems.

**Scope:** ~10 lines across 2 files. One commit.

**Files:**
- `src/lib/data/clear.ts` lines 58-60, 96-97 — comments describe preservation logic for a "license table" that was dropped in migration `0026_drop_license.sql`. Delete or update the comments to reflect that the table no longer exists.
- `src/lib/instance/fingerprint.ts` lines 5-7 — comment still describes the function's purpose as "cloud license metering." Update to describe the actual current purpose (machine fingerprinting for stagent instance identity; no longer billing-related).

**Verification:**
- `npm test` — all tests continue to pass
- `npx tsc --noEmit` — still exit 0

**Commit message:**
```
chore(cleanup): update stale comments referencing removed CE features

Migration 0026 dropped the license table; clear.ts's "preserve the license
table" rationale no longer applies. fingerprint.ts's "cloud license metering"
comment predates the Community-Edition rollback. Comments-only, no code change.
```

---

## Step 2 — CLAUDE.md enrichment

**Why:** The SDK now loads `CLAUDE.md` via `settingSources: ["project"]` (chat-claude-sdk-skills). The repo's current `CLAUDE.md` is a 34-line pointer that says "Read AGENTS.md for stable project instructions." The SDK CANNOT follow that pointer — `AGENTS.md` is a Codex convention, not a Claude setting source. Result: the LLM receives a near-empty CLAUDE.md and loses out on the project conventions captured in `AGENTS.md` / `MEMORY.md`.

**Scope:** Editorial — needs judgment about what to inline. Likely 2-3 commits.

**Before starting, ask the user these clarifying questions** (do not guess):

1. **What scope of content to inline?** Options:
   - (a) Full `AGENTS.md` — biggest reach, but duplicates the pointer's original purpose
   - (b) Top 3-5 most-load-bearing conventions from `AGENTS.md` (testing rules, migration gotchas, naming conventions, git workflow)
   - (c) Subset of `MEMORY.md` — things like "SheetContent body padding," "clear.ts sync discipline," the "no real name in content" privacy rule
   - (d) A fresh hand-authored summary in Claude-idiomatic style

2. **How to keep it in sync?** CLAUDE.md risks drifting from AGENTS.md/MEMORY.md. Options:
   - (a) Manual sync discipline (note in CLAUDE.md top)
   - (b) A generated CLAUDE.md built from an "authoritative" subset of AGENTS.md + MEMORY.md sections
   - (c) Accept drift — CLAUDE.md is the LLM-visible view; treat it like product copy

**Implementation approach:**
- Read current `AGENTS.md` and `MEMORY.md` (skim the top of each — MEMORY.md is the file at `/Users/manavsehgal/.claude/projects/-Users-manavsehgal-Developer-stagent/memory/MEMORY.md`, not a repo file; `AGENTS.md` is in the repo root)
- Draft the proposed CLAUDE.md content in a markdown code block
- Get user approval before writing
- After writing, verify via a smoke test: ask chat "What does CLAUDE.md tell you about X" where X is something you just added, confirm the response reflects actual content

**Verification:**
- Live smoke test via browser on running dev server (Opus model): ask Claude about a specific rule you just added. Confirm response reflects actual CLAUDE.md content, not generic Claude behavior.

**Commit message(s):**
```
docs(claude): inline [N] project conventions from AGENTS.md / MEMORY.md

CLAUDE.md was a 34-line pointer to AGENTS.md, but the Claude Agent SDK's
settingSources: ["project"] loads CLAUDE.md directly and cannot follow the
pointer. Inlines the [conventions / rules / gotchas] most likely to affect
LLM reasoning in chat so they actually reach the model.
```

---

## Step 3 — `task-runtime-skill-parity` (P1, full feature)

**Why:** The previous session's `chat-claude-sdk-skills` enabled SDK-native skills, filesystem tools, and CLAUDE.md auto-loading in **chat**. The **task execution runtime** (`src/lib/agents/claude-agent.ts`) did NOT receive the same treatment. An agent task and a chat turn on the same Claude model now have **different tool sets and different project context** — a real drift window. This feature mirrors Phase 1a into task execution.

**Feature spec:** `features/task-runtime-skill-parity.md` (already updated in previous session to reference `getFeaturesForModel` / `RuntimeFeatures` — stale names were corrected).

**Full pipeline required — do NOT shortcut:**
1. Invoke `superpowers:writing-plans` skill to produce a plan at `.claude/plans/<adjective-style-name>.md`
2. Perform the required scope challenge per project-level overrides (`.claude/skills/writing-plans/SKILL.md`)
3. Offer REDUCE / PROCEED / EXPAND paths to user and wait for pick
4. After plan is saved, offer execution options (subagent-driven recommended)
5. Execute via `superpowers:subagent-driven-development` with two-stage reviews per task
6. **MANDATORY:** smoke test on a running dev server per TDR-032. The test must create a real task via chat/MCP/UI that exercises the modified `claude-agent.ts` code path.

**Key reconnaissance targets before writing the plan:**
- `src/lib/agents/claude-agent.ts:66-67` — current `createToolServer(projectId).asMcpServer()` call. Does NOT currently pass `settingSources`, does NOT include filesystem tools in `allowedTools`.
- `src/lib/agents/claude-agent.ts:479-489` — cwd resolver (duplicate of engine.ts:188-207 pattern; the plan may consider DRYing these into a shared helper, but that's optional)
- `src/lib/agents/claude-agent.ts` `query()` call (around lines 500-600) — the options object that needs the same treatment as engine.ts got in Task 1 of the prior plan
- `src/lib/agents/__tests__/claude-agent.test.ts` — existing mock patterns; plan's TDD tests extend these

**Plan size estimate:** 6-8 tasks, ~12-15 commits. Comparable to `chat-claude-sdk-skills` but slightly smaller (no `list_profiles` equivalent since tasks don't have a user-facing popover).

**What the plan MUST address:**
- SDK options parity: `settingSources`, filesystem tool set, auto-allow for Read/Grep/Glob (mirror the chat canUseTool policy — consider extracting `CLAUDE_SDK_*` constants from engine.ts into a shared module if both files now need them)
- `canUseTool` in claude-agent.ts: decide whether to reuse chat's side-channel flow or task-level's existing `handleToolPermission` pattern. Previous session's reconnaissance report noted these are separate today. Plan must pick one and justify.
- Hooks-excluded regression test (Q2 scope exclusion, mirror of chat side)
- TDR-032 smoke test on real task execution (NOT just chat)
- Feature closeout (status flip, roadmap, changelog)

---

## Step 4 — Remaining Chat Context Experience features

After steps 1-3 complete, **ask the user which feature to pick up next.** Do not auto-select.

Priority-ordered backlog (all planned, none started):

| Priority | Feature | Spec path | Sibling / blocker notes |
|---|---|---|---|
| P1 | `chat-codex-app-server-skills` | `features/chat-codex-app-server-skills.md` | Mirrors chat-claude-sdk-skills into the `openai-codex-app-server` runtime. Uses `turn/start` skill params. Depends on Phase 1a UX contract now established. |
| P1 | `chat-file-mentions` | `features/chat-file-mentions.md` | `@file:path` typeahead with tiered expansion (Q6). Independent of runtime work. |
| P1 | `chat-command-namespace-refactor` | `features/chat-command-namespace-refactor.md` | `/` = verbs, `@` = nouns, tabbed popover, ⌘K palette, capability hint banner (Q9a). **Breaking UX change accepted per Q7.** Flagged for `/frontend-designer` sign-off before implementation. |
| P2 | `chat-ollama-native-skills` | `features/chat-ollama-native-skills.md` | Stagent-native `activate_skill` MCP tools + context injection for Ollama (no SDK support). |
| P2 | `chat-environment-integration` | `features/chat-environment-integration.md` | Environment metadata badges in skills popover (DD-CE-004). |
| P2 | `onboarding-runtime-provider-choice` | `features/onboarding-runtime-provider-choice.md` | First-launch model/provider preference modal (Q10). Parallel track to runtime work. |
| P3 | `chat-advanced-ux` | `features/chat-advanced-ux.md` | `#`-filters, templates, composition, branches. |

**Recommended order after step 3:** `chat-codex-app-server-skills` → `chat-file-mentions` → `chat-command-namespace-refactor` → then P2 tier. Rationale: finishing the runtime-native Phase 1 trio (Claude done, Codex next, Ollama last because it's Stagent-native injection rather than SDK-native) keeps a coherent feature story.

Each feature follows the same pipeline: `writing-plans` → scope challenge → `subagent-driven-development` → live smoke test → closeout.

---

## Known gotchas (read before starting)

1. **LSP diagnostics LIE about the pre-existing "Community Edition rollback debris."** Throughout the previous session, Claude Code's LSP reported dozens of `Cannot find module '@/components/ui/button'` / `@/lib/db` / `@/lib/license/manager` errors. **These files do not exist on disk.** The LSP was serving stale diagnostics from a snapshot captured before the rollback commits. Real-project `npx tsc --noEmit` returns exit 0 on the current codebase. If the next session sees similar phantom diagnostics, run `ls <flagged-file>` before attempting to fix anything.

2. **Next.js 16 refuses to start a parallel dev server in the same project root.** The user runs their own dev server on `:3000`. Do NOT `pkill` it — per project memory, only restart your own. For smoke tests, use the user's running `:3000` server rather than trying to launch your own on `:3010`. Next.js 16's dedup will fail with "Another next dev server is already running."

3. **TDR-032 module-load cycle.** Any change to `src/lib/chat/engine.ts`, `src/lib/agents/claude-agent.ts`, `src/lib/agents/runtime/catalog.ts`, `src/lib/agents/runtime/index.ts`, `src/lib/agents/runtime/claude.ts`, or any file that statically imports `@/lib/chat/stagent-tools` REQUIRES a live smoke test per project writing-plans override. Unit tests cannot catch module-load cycles because `vi.mock` replaces the cycle. See `.claude/skills/architect/references/tdr-032-runtime-stagent-mcp-injection.md`.

4. **Keep `clear.ts` in sync when adding DB tables.** Any new table with FKs must get a `db.delete()` call in `src/lib/data/clear.ts` in FK-safe order (children before parents). Safety-net test at `src/lib/data/__tests__/clear.test.ts`. Settings table is intentionally excluded.

5. **Privacy rule: never write `manavsehgal` in user-facing content** — it's the macOS username and leaks via absolute paths. Use `manavsehgal`. Grep shipped content before marking content tasks complete.

6. **SheetContent body padding** — shadcn Sheet has NO horizontal padding on `SheetContent`. Always add `px-6 pb-6` to the body content div.

7. **Working directory** — user gave explicit consent to commit on `main` for this workstream. Do not create worktrees unless user requests. Confirm consent still stands at session start.

8. **Skills framework** — this project uses `superpowers:*` skills for the dev lifecycle. The critical ones for this handoff: `writing-plans` (before touching code), `subagent-driven-development` (executing plans), `verification-before-completion` (before claiming work done). Project-level overrides are in `.claude/skills/writing-plans/SKILL.md` — read first.

9. **Commit style** — each commit must include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`. Use HEREDOC for commit messages to preserve formatting. Never use `--amend`, `--no-verify`, or force-push on `main`.

10. **Pre-existing diagnostic warnings** (unused imports like `DEFAULT_CHAT_MODEL`, `getLaunchCwd` in engine.ts, implicit-any `p` parameters in test callbacks) are `★`-severity info, not errors. Ignore unless new ones appear tied to your changes.

---

## Starting sequence

On session start:

1. Read this handoff doc top-to-bottom.
2. Read `AGENTS.md`, `MEMORY.md` at `/Users/manavsehgal/.claude/projects/-Users-manavsehgal-Developer-stagent/memory/MEMORY.md`, and `FLOW.md`.
3. Confirm current state: `git log --oneline -15` — HEAD should be at `2979350` or later.
4. Confirm working tree clean: `git status`.
5. Confirm tests pass: `npm test 2>&1 | tail -5` — expect 775+ passing.
6. Begin Step 1 (stale-comment touch-up).

Do NOT start a plan at `writing-plans` before confirming all of the above. Do NOT skip directly to Step 3 or Step 4 — they depend on Steps 1 and 2 being complete.

If any precondition fails (git state diverged, tests failing, unfamiliar commits present), STOP and ask the user what to do. Never attempt to "fix" unexpected state without authorization.
