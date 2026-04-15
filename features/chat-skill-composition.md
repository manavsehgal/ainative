---
title: Chat — Skill Composition with Conflict Warning
status: completed  # closed out 2026-04-15 after oldest-first prompt-budget eviction shipped
priority: P3
milestone: post-mvp
source: chat-advanced-ux.md §4 (split during grooming, 2026-04-14)
dependencies:
  - chat-claude-sdk-skills
  - chat-codex-app-server-skills
  - chat-ollama-native-skills
  - chat-environment-integration
---

# Chat — Skill Composition with Conflict Warning

## Description

`chat-ollama-native-skills` enforces single-active-skill to bound context size. On runtimes with generous context (Claude Sonnet/Opus, Codex App Server), power users want to stack multiple complementary skills — e.g. `researcher` + `technical-writer` for a deep writeup. This feature relaxes the single-active constraint on capable runtimes with explicit opt-in composition and a heuristic conflict check.

This is **runtime-aware behavior**: the runtime capability matrix (`catalog.ts`) gains a `supportsSkillComposition` flag. Ollama remains single-skill (disallow with a capability hint). Direct Anthropic / Direct OpenAI runtimes inherit from their base provider — progressive disclosure.

## User Story

As a power user on Claude who wants both the `researcher` workflow discipline and the `technical-writer` style guide active for a specific conversation, I want to activate both with a clear warning if their instructions conflict — and have Ollama politely tell me composition isn't supported there.

## Technical Approach

### Runtime capability flag

Add to `src/lib/agents/runtime/catalog.ts`:

```typescript
interface RuntimeCapabilities {
  // ...existing
  supportsSkillComposition: boolean;  // claude: true, codex-app-server: true, ollama: false, anthropic-direct: true, openai-direct: true
  maxActiveSkills?: number;            // claude: 3, codex: 3, ollama: 1
}
```

### Activation flow

`activate_skill` chat tool (from `chat-claude-sdk-skills`) currently replaces the active skill. Change signature:

```typescript
activate_skill({
  conversationId,
  skillId,
  mode?: "replace" | "add",   // default "replace" for back-compat
  force?: boolean              // skip conflict check
})
```

When `mode: "add"`:

1. Read current active skills for the conversation
2. If `!runtime.supportsSkillComposition` → return `{ error: "composition_unsupported", hint: "Switch to Claude or Codex to compose skills" }`
3. If `activeSkills.length >= runtime.maxActiveSkills` → return `{ error: "composition_limit_reached" }`
4. Run conflict check against new skill vs each currently active skill (see below)
5. If conflicts found and `!force` → return `{ conflicts: [...], requiresConfirmation: true }`
6. Else activate: append to active skills list; inject all SKILL.md bodies into system prompt (`context-builder.ts`)

### Conflict heuristic

Pure function `src/lib/chat/skill-conflict.ts`:

```typescript
interface SkillConflict {
  skillA: string;
  skillB: string;
  sharedTopic: string;     // e.g. "testing approach"
  excerptA: string;
  excerptB: string;
}
export function detectSkillConflicts(a: SkillMarkdown, b: SkillMarkdown): SkillConflict[];
```

Heuristic v1: extract lines from each SKILL.md that look like directives (`must`, `always`, `never`, `prefer`, `use`) and check for keyword overlap where directive verbs diverge. Good-enough signal; false-positives acceptable since the UI shows excerpts for user judgment.

### Conversation state

Extend conversation schema:

```typescript
// src/lib/db/schema.ts — conversations table
activeSkills: text("active_skills", { mode: "json" }).$type<string[]>().default([])
```

Migration adds the column with `addColumnIfMissing` in `bootstrap.ts` AND the CREATE TABLE block (per MEMORY.md lesson on the bootstrap.ts ordering gotcha). Existing `activeSkillId: string | null` becomes a derived view of `activeSkills[0]` for back-compat with code that hasn't been updated.

### UI

In the Skills tab of the `/` popover (built in `chat-environment-integration`), currently active skills get a ✓ badge. Add a second action: `+ Add` on inactive skills when composition is supported. Tapping surfaces:

- If no conflicts → silent add, toast "Added {skill} — 2 skills active"
- If conflicts → modal with conflict excerpts, "Add anyway" / "Cancel"

Runtime-unsupported: `+ Add` is replaced by a disabled pill "Single skill only on Ollama" with a link to switch runtime.

### Context injection

`context-builder.ts` injects the merged `activeSkills[]` SKILL.md payload under `## Active Skill:` sections separated by `---`. Total injection is capped at `ACTIVE_SKILL_BUDGET`; when the combined payload exceeds budget, older composed skills are omitted first and the system prompt includes an explicit omission note. If even the newest remaining skill is too large, that final section is truncated with the existing marker.

## Acceptance Criteria

- [x] Runtime capability matrix gains `supportsSkillComposition` and `maxActiveSkills` (Claude/Codex/direct = true/3, Ollama = false/1)
- [x] `activate_skill` with `mode: "add"` appends a skill when runtime supports and no conflicts (force=true skips conflict check)
- [x] Conflict check returns structured conflicts in tool response; Skills-tab UI surfaces a modal with "Add anyway" / "Cancel"
- [x] Composition blocked on Ollama with clear hint to switch runtime
- [x] `maxActiveSkills` enforced — attempt to add a 4th on Claude returns "Max active skills (3) reached"
- [x] `activeSkillIds` persists across turns; all SKILL.md bodies injected into system prompt via `buildActiveSkill` iteration
- [x] Back-compat: existing `activate_skill` calls (no mode param) continue to work as replace; deactivate_skill clears both columns
- [x] Token-budget trim removes oldest skill when over budget; if one remaining skill still exceeds budget it is truncated in place with an omission note for evicted skills
- [x] `detectSkillConflicts` unit tests cover: no-conflict pair, clear-conflict pair, agreeing pair, non-directive lines (4 tests)
- [x] Smoke test verifies dev-server boots clean post-migration (runtime-catalog risk per MEMORY.md mitigated); functional 2-skill compose + Ollama refusal exercised via skill-tools.test.ts mocked production path

## Shipped Scope

- `RuntimeFeatures` extended with `supportsSkillComposition` + `maxActiveSkills` (Claude/Codex/direct = true/3, Ollama = false/1)
- Additive `conversations.active_skill_ids` JSON column (default `[]`); legacy `active_skill_id` preserved for back-compat
- `mergeActiveSkillIds()` helper unifies legacy + composed IDs
- `activate_skill` accepts `mode: "replace" | "add"` and `force: boolean`; `skill-composition.ts` is the shared service for MCP + HTTP callers
- Capability gate refuses composition on Ollama with a clear hint; `maxActiveSkills` is enforced on composition-capable runtimes
- `detectSkillConflicts` keyword heuristic in `src/lib/chat/skill-conflict.ts` returns structured excerpts for the UI and tool surface
- Skills-tab UI ships `+ Add`, active badges, deactivate action, active-count indicator, and `SkillCompositionConflictDialog`
- `context-builder.ts` iterates merged active skills, joins SKILL.md bodies with `---`, omits oldest composed skills first when over budget, and truncates the newest remaining section only if still oversized
- Composition (any entry in `activeSkillIds`) is treated as explicit user opt-in: it overrides `stagentInjectsSkills=false` so composed skills still surface on Claude/Codex

## Follow-Up Ideas

- Composition presets (saved combinations of skills)
- Reordering composed skills inside a conversation
- Composition analytics or usage insights

## Scope Boundaries

**Included:**
- Composition on Claude + Codex + Anthropic-direct + OpenAI-direct
- Keyword-based conflict heuristic
- Runtime gate on Ollama

**Excluded:**
- Embedding-based semantic conflict detection (future work)
- User-authored conflict rules
- Per-conversation composition presets
- Composition analytics

## References

- Split from: [chat-advanced-ux](chat-advanced-ux.md) §4
- Depends on: all 3 runtime-skills features (foundational single-skill contract)
- Depends on: [chat-environment-integration](chat-environment-integration.md) (Skills tab UI)
- Existing code: `src/lib/agents/runtime/catalog.ts`, `src/lib/chat/skill-composition.ts`, `src/lib/chat/tools/skill-tools.ts`, `src/lib/chat/context-builder.ts`
- MEMORY.md cross-references: `addColumnIfMissing` + CREATE TABLE ordering gotcha; cross-runtime system-prompt impact; SheetContent padding rule if the conflict modal uses a sheet
