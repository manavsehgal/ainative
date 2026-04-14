---
title: Chat — Claude SDK-Native Skills & Filesystem Context
status: complete
priority: P0
milestone: post-mvp
source: ideas/chat-context-experience.md §4.1, §4.2, §8 Phase 1a
dependencies: [chat-engine, runtime-capability-matrix, skill-portfolio, environment-scanner]
---

# Chat — Claude SDK-Native Skills & Filesystem Context

## Description

Stagent's chat dispatcher routes `claude-code` runtime conversations through `@anthropic-ai/claude-agent-sdk`'s `query()` function at `src/lib/chat/engine.ts:300-315`. Today, that call omits two SDK options that would give chat users filesystem parity with the Claude Code CLI: `settingSources: ["user", "project"]` (which loads CLAUDE.md, `.claude/rules/*.md`, project skills, and user skills from disk) and `"Skill"` in `allowedTools` (which enables the SDK's built-in progressive-disclosure skill tool). As a result, the 25+ project skills in `.claude/skills/`, every user skill in `~/.claude/skills/`, and every CLAUDE.md are invisible to chat regardless of how rich the filesystem is.

This feature is the **critical path** of Phase 1 of the Chat Context Experience initiative. It flips Stagent's Claude runtime from "isolation mode" to "SDK-native" — one small options change in `engine.ts` plus a deliberate partition of the system prompt (Decision DD-CE-002) so CLAUDE.md doesn't double-prompt against Stagent's Tier 0. It also adds the filesystem tools Claude Code CLI users depend on (`Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`) under the existing Stagent permission bridge, and updates the `list_profiles` chat tool to return SDK-discovered skills alongside registry profiles.

Unlocks Phase 1b (Codex), Phase 1c (Ollama), and every downstream phase (file mentions, namespace refactor, environment integration) by establishing the `list_profiles` contract and the skill-UX pattern that sibling runtimes must match.

## User Story

As a developer who already uses Claude Code CLI with custom skills and a CLAUDE.md, when I open Stagent chat on a Claude model (Haiku/Sonnet/Opus), I want my filesystem skills, project rules, and CLAUDE.md to reach the LLM automatically — and I want `Read`/`Grep`/`Edit` tools available through Stagent's permission bridge — so Stagent chat feels like a richer surface over the same agent I already use, not a stripped-down alternative.

## Technical Approach

### 1. Enable SDK-native loading in `engine.ts`

At `src/lib/chat/engine.ts:300-315`, extend the `query()` options:

```typescript
query({
  prompt,
  options: {
    model, maxTurns, cwd, env,
    mcpServers: { stagent: stagentServer, ...browserServers, ...externalServers },
    allowedTools: [
      "mcp__stagent__*",
      ...browserPatterns,
      ...externalPatterns,
      "Skill",
      "Read", "Grep", "Glob",
      "Edit", "Write",
      "Bash",       // gated via Stagent permission bridge (Q3)
      "TodoWrite",
    ],
    settingSources: ["user", "project"],
  },
});
```

- `cwd` resolution (per Q4): use active project's `workingDirectory` when present, else fall back to launch cwd. Reuse the existing resolver from `claude-agent.ts`.
- Hooks are **explicitly excluded** from scope (Q2) — they fire per tool call, which has unexpected chat implications. Document as a future consideration.

### 2. Partition Tier 0 vs CLAUDE.md (DD-CE-002)

`src/lib/chat/context-builder.ts` currently renders `STAGENT_SYSTEM_PROMPT` into Tier 0. Audit that prompt and any concatenated workspace/project prose for content that a well-structured CLAUDE.md would provide (project conventions, testing rules, privacy rules). Move project-specific prose out of Tier 0 and leave only "Stagent identity + tools + primitives."

Target partition:

- **Stagent Tier 0**: Stagent role/personality, tool catalog hints, entity primitives, permission bridge semantics
- **SDK-loaded CLAUDE.md**: project conventions, repo-specific rules, coding standards

### 3. Update `list_profiles` chat tool

`list_profiles` currently returns only registered `AgentProfile` rows. Update it to call `listAllProfiles(projectDir)` which fuses registry profiles with SDK-discovered filesystem skills (deduped by id). This keeps the `/` popover and LLM-exposed tool both honest about what's really available.

### 4. Wire Bash through permission bridge (Q3)

`Bash` must route through the existing Stagent permission system (`src/lib/agents/permission-*`). No YOLO mode in chat — every `Bash` invocation raises a standard permission request, visible in the ambient approval toast and logged in the audit trail.

### 5. Verification — real smoke test

Per TDR-032, run `npm run dev`, create `.claude/skills/test-skill/SKILL.md`, then:

- Ask in chat "what skills do you have?" → skill must appear in the answer
- Ask "read CLAUDE.md and summarize" → response must reflect actual file content
- Trigger a `Grep` call → completes without an `allowedTools` error

Unit tests alone do not count.

## Acceptance Criteria

- [ ] User selects Claude model, types `/skill-name` — skill invokes with full SKILL.md content reaching the LLM
- [ ] `CLAUDE.md` and `.claude/rules/*.md` content is reflected in chat responses on the Claude runtime
- [ ] `Read`, `Grep`, `Glob` work in chat without per-call allow-listing
- [ ] `Edit`, `Write`, `Bash` are gated by the Stagent permission bridge and produce audit entries on use
- [ ] `list_profiles` returns SDK-discovered skills alongside registry profiles, deduped
- [ ] Existing Stagent tools (`mcp__stagent__*`) continue to work alongside SDK skills and filesystem tools
- [ ] Double-prompt resolved — no duplicate instructions between Tier 0 and CLAUDE.md (verified by sampling a Claude response for repeated directives)
- [ ] Filesystem hooks are **not** loaded (Q2 scope exclusion); confirmed by inspecting the SDK options and adding a regression test
- [ ] `cwd` resolves to the active project's `workingDirectory` when set, else launch cwd (Q4)
- [ ] Smoke test passes in `npm run dev` (not just unit tests — TDR-032 requirement)

## Scope Boundaries

**Included:**
- `settingSources: ["user", "project"]` + `"Skill"` in `allowedTools` for `claude-code` runtime only
- Filesystem tools (`Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`, `TodoWrite`) under permission bridge
- Tier 0 / CLAUDE.md partition (DD-CE-002)
- `list_profiles` augmentation with SDK-discovered skills
- Real-environment smoke tests

**Excluded:**
- Codex runtime skill integration — covered by `chat-codex-app-server-skills`
- Ollama runtime skill injection — covered by `chat-ollama-native-skills`
- Filesystem hook loading — deferred per Q2
- Task execution runtime parity — covered by `task-runtime-skill-parity`
- Popover UX refactor — covered by `chat-command-namespace-refactor`
- `Task` subagent delegation tool — replaced by Stagent task primitives per §3.3

## References

- Source: `ideas/chat-context-experience.md` §2.2, §3.1, §4.1, §4.2, §4.3 (partition), §8 (Phase 1a ACs)
- Related features: `runtime-capability-matrix` (prerequisite), `task-runtime-skill-parity` (sibling), `chat-codex-app-server-skills` (depends on this), `chat-ollama-native-skills` (depends on this)
- Reference docs: `.claude/reference/platform-claude-com-agent-sdk/skills.md`, `claude-code-features.md`, `modifying-system-prompts.md`
- Existing code: `src/lib/chat/engine.ts:300-315`, `src/lib/chat/context-builder.ts`, `src/lib/chat/tool-catalog.ts`, `src/lib/agents/permission-bridge.ts`, `src/lib/agents/claude-agent.ts` (cwd resolver)
- TDR: TDR-032 (Stagent MCP injection consistency — smoke-test requirement)

## Tier 0 vs CLAUDE.md partition audit (DD-CE-002)

Audit performed 2026-04-13 during implementation of this feature.

**Rubric:**
- KEEP in Tier 0 (`src/lib/chat/system-prompt.ts`): Stagent identity, tool catalog, tool routing, Stagent domain semantics, LLM interaction style.
- MOVE to CLAUDE.md: project conventions, repo-specific rules, testing/git workflow guidance.

**Result for the stagent repo:** zero content migration. Tier 0 blocks all pass the KEEP rubric:

| Block (lines in `system-prompt.ts`) | Decision |
|---|---|
| Identity (6) | Keep |
| Tool catalog (8-79) | Keep |
| When to Use Which Tools (81-90) | Keep |
| Approach (92-98) | Keep |
| Guidelines (101-109) | Keep |
| Worktree note (110) | Keep (borderline) |
| Document Pool Awareness (112-117) | Keep |

The current `CLAUDE.md` at the repo root is a 34-line pointer file referencing `AGENTS.md`. The SDK cannot follow that pointer (AGENTS.md is a Codex convention, not a Claude setting source), so users who expect rich project-convention content to reach the LLM should either:
1. Inline the relevant content into `CLAUDE.md` directly, or
2. Track this in a follow-up editorial pass, separate from this feature.

**Regression guard:** the rubric is documented as a doc comment on `STAGENT_SYSTEM_PROMPT`. Any future contributor adding project-specific rules to `system-prompt.ts` should be caught in code review against this rubric.

## Smoke test outcomes (2026-04-13)

Per TDR-032, the following live-environment checks all passed against the running dev server on `:3000` (browser-driven via claude-in-chrome MCP on Opus model / `claude-code` runtime):

- **Skill invocation reaches the LLM.** Created ephemeral `.claude/skills/smoke-test-skill/SKILL.md` with marker phrase `SMOKE_TEST_SKILL_REACHED_LLM`. Asked chat to "Invoke the smoke-test-skill skill and report exactly what it tells you to say." Response: exactly `SMOKE_TEST_SKILL_REACHED_LLM`. Confirms `settingSources: ["user", "project"]` loaded the skill and `"Skill"` in `allowedTools` wired.
- **CLAUDE.md auto-loaded via `settingSources`.** Asked "Read the repository's CLAUDE.md and summarize what it says about cross-tool sync." Response cited specific content: `~/.codex/config.toml`, 23 Codex skills, shared `.claude/skills/` + `~/.codex/skills/` directories, `.claude/reference/developers-openai-com-codex-sdk/`, and `src/lib/agents/runtime/codex-app-server-client.ts`. Response began with "Based on the CLAUDE.md I already have loaded in context" — direct evidence the SDK auto-loaded the file without requiring an explicit `Read` call.
- **Grep without permission prompt.** Asked "Grep the codebase for 'getRuntimeFeatures' and tell me which files contain it." Response returned 7 accurate file matches (including `catalog.ts`, `runtime/index.ts`, `chat/types.ts`, tests, changelog, plan docs). No permission-approval UI surfaced during the call — the read-only auto-allow branch for `Read`/`Grep`/`Glob` is wired correctly.
- **No module-load cycle.** All three turns returned normal streaming responses. No 500s, no `ReferenceError`, no missing-tools errors observed during the session.

Test skill removed after verification.
