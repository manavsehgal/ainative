# Chat Skill Composition v1 Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ship Composition v1 of `chat-skill-composition` — extends `activate_skill` with `mode: "add"`/`force` params, gates by runtime capability flags, returns structured conflicts, and (for Claude/Codex/Direct runtimes) injects multiple SKILL.md bodies into the system prompt when explicitly composed.

**Architecture:** Additive schema (new `active_skill_ids` JSON column alongside existing `active_skill_id`), capability flags on `RuntimeFeatures`, pure conflict heuristic, and a context-builder that merges legacy + new state. UI modal + token-budget trim deferred to v2.

**Tech Stack:** Drizzle (better-sqlite3), Zod, Vitest, existing tool-registry / context-builder / catalog modules.

**Critical references from MEMORY.md:**
- `addColumnIfMissing` runs BEFORE the table CREATE — ALTER alone fails on fresh DBs. Update BOTH the bootstrap CREATE block AND the addColumnIfMissing call.
- Runtime-catalog adjacent — MUST end-to-end smoke under `npm run dev`, not just unit tests. Static `import` cycles into `claude-runtime-adapter` are silent unit-test killers; use dynamic `await import()` if any runtime module needs to call back into chat tooling.
- Cross-runtime system-prompt impact — consult `RuntimeFeatures` for whether to inject vs trust SDK.

---

## File Structure

**New files:**
- `src/lib/chat/skill-conflict.ts` — pure heuristic
- `src/lib/chat/__tests__/skill-conflict.test.ts` — heuristic unit tests

**Modified files:**
- `src/lib/agents/runtime/catalog.ts` — add `supportsSkillComposition` + `maxActiveSkills` to `RuntimeFeatures`; populate per-runtime
- `src/lib/db/schema.ts` — add `activeSkillIds` JSON column to `conversations`
- `src/lib/db/bootstrap.ts` — add column to CREATE TABLE block AND addColumnIfMissing call
- `src/lib/chat/tools/skill-tools.ts` — extend `activate_skill` with `mode`, `force`; new code path for composition
- `src/lib/chat/tools/__tests__/skill-tools.test.ts` — extend mock + new test cases
- `src/lib/chat/context-builder.ts` — merge legacy + new IDs, iterate, gate by capability
- `src/lib/chat/tool-catalog.ts` — update `activate_skill` description / paramHint
- `features/chat-skill-composition.md` — flip ACs, mark composition v1 shipped, note v2 deferred
- `features/roadmap.md` — status sync
- `features/changelog.md` — v2 ship entry

---

## Task 1: Runtime Catalog Capability Flags

**Files:**
- Modify: `src/lib/agents/runtime/catalog.ts:33-55` (RuntimeFeatures interface) + each runtime entry's `features:` block

- [ ] **Step 1.1: Extend `RuntimeFeatures` interface**

In `src/lib/agents/runtime/catalog.ts`, add to the `RuntimeFeatures` interface (after `stagentInjectsSkills`):

```typescript
  /**
   * Runtime supports composing multiple active skills in one conversation.
   * When false, only one skill may be active at a time (Ollama: context
   * budget too tight). When true, `activate_skill mode:"add"` is allowed
   * up to `maxActiveSkills`.
   */
  supportsSkillComposition: boolean;
  /**
   * Maximum number of skills that may be simultaneously active. Enforced
   * by the activate_skill tool. Ignored when supportsSkillComposition=false.
   */
  maxActiveSkills: number;
```

- [ ] **Step 1.2: Populate flags per runtime**

For each runtime entry in `RUNTIME_CATALOG`, add the two new fields inside `features: {...}`. Recommended values:

| Runtime | supportsSkillComposition | maxActiveSkills |
|---------|--------------------------|-----------------|
| `claude-code` | `true` | `3` |
| `openai-codex-app-server` | `true` | `3` |
| `anthropic-direct` | `true` | `3` |
| `openai-direct` | `true` | `3` |
| `ollama` | `false` | `1` |

- [ ] **Step 1.3: Verify runtime-capability-matrix smoke test still passes**

Run: `npx vitest run src/lib/agents/runtime/__tests__/`
Expected: existing matrix test pass; if it asserts feature shape, extend assertion to include new fields.

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/agents/runtime/catalog.ts src/lib/agents/runtime/__tests__/
git commit -m "$(cat <<'EOF'
feat(runtime): supportsSkillComposition + maxActiveSkills capability flags

Adds per-runtime composition declaration to RuntimeFeatures. Claude,
Codex, and direct providers default to 3 simultaneously active skills.
Ollama stays single-skill — context budget makes composition impractical.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Conflict Heuristic

**Files:**
- Create: `src/lib/chat/skill-conflict.ts`
- Create: `src/lib/chat/__tests__/skill-conflict.test.ts`

- [ ] **Step 2.1: Write failing tests first**

```typescript
// src/lib/chat/__tests__/skill-conflict.test.ts
import { describe, it, expect } from "vitest";
import { detectSkillConflicts } from "../skill-conflict";

describe("detectSkillConflicts", () => {
  it("returns no conflicts for two unrelated skills", () => {
    const a = { id: "a", name: "code-reviewer", content: "Always run ESLint before reviewing code." };
    const b = { id: "b", name: "haiku-poet", content: "Use 5-7-5 syllable structure." };
    expect(detectSkillConflicts(a, b)).toEqual([]);
  });

  it("flags directive divergence on a shared topic", () => {
    const a = { id: "a", name: "tdd", content: "Always write the test first. Never write production code without a failing test." };
    const b = { id: "b", name: "spike", content: "Never write tests during a spike. Prefer exploratory code." };
    const conflicts = detectSkillConflicts(a, b);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toMatchObject({
      skillA: "tdd",
      skillB: "spike",
    });
    expect(conflicts[0].excerptA).toMatch(/test/i);
    expect(conflicts[0].excerptB).toMatch(/test/i);
  });

  it("returns no conflicts when both skills agree on a topic", () => {
    const a = { id: "a", name: "tdd", content: "Always write tests first." };
    const b = { id: "b", name: "qa-strict", content: "Always write tests first and add coverage gates." };
    expect(detectSkillConflicts(a, b)).toEqual([]);
  });

  it("ignores non-directive lines", () => {
    const a = { id: "a", name: "x", content: "This skill is for documentation tasks." };
    const b = { id: "b", name: "y", content: "Documentation is important context." };
    expect(detectSkillConflicts(a, b)).toEqual([]);
  });
});
```

- [ ] **Step 2.2: Run to confirm failure**

`npx vitest run src/lib/chat/__tests__/skill-conflict.test.ts` — expect "module not found"

- [ ] **Step 2.3: Implement heuristic**

```typescript
// src/lib/chat/skill-conflict.ts
/**
 * Lightweight heuristic that flags when two SKILL.md bodies issue
 * divergent directives on the same topic. Pure function — no I/O.
 *
 * Approach (v1):
 *   1. For each skill, extract "directive lines" containing one of:
 *      always | never | must | prefer | use | avoid | don't | do not
 *   2. Tokenize each directive into content words (lowercase, drop
 *      stopwords + the directive verb itself).
 *   3. For each pair of directives across the two skills with significant
 *      keyword overlap (≥2 shared content words ≥4 chars), check if their
 *      directive verbs disagree (always vs never, prefer vs avoid, etc.).
 *   4. Surface the disagreeing pair as a SkillConflict.
 *
 * False positives are acceptable — the consumer presents excerpts to the
 * user, not a binary block. False negatives (semantic conflict without
 * keyword overlap) await the embedding-based v2.
 */

export interface SkillMarkdown {
  id: string;
  name: string;
  content: string;
}

export interface SkillConflict {
  skillA: string;       // skill name
  skillB: string;       // skill name
  sharedTopic: string;  // joined keywords that overlapped
  excerptA: string;     // the directive line from A
  excerptB: string;     // the directive line from B
}

const POSITIVE_DIRECTIVES = new Set(["always", "must", "prefer", "use", "do"]);
const NEGATIVE_DIRECTIVES = new Set(["never", "avoid", "don't", "dont", "skip"]);
const ALL_DIRECTIVES = new Set([...POSITIVE_DIRECTIVES, ...NEGATIVE_DIRECTIVES]);

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "without",
  "to", "of", "in", "on", "at", "by", "from", "as", "is", "are",
  "be", "this", "that", "these", "those", "it", "its", "before",
  "after", "during", "into", "out",
]);

interface DirectiveLine {
  raw: string;
  polarity: "positive" | "negative";
  keywords: Set<string>;
}

function extractDirectives(content: string): DirectiveLine[] {
  const lines = content.split(/\r?\n/);
  const out: DirectiveLine[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("```")) continue;
    const lower = line.toLowerCase();
    let polarity: "positive" | "negative" | null = null;
    for (const tok of lower.split(/\s+/)) {
      const cleaned = tok.replace(/[^a-z']/g, "");
      if (POSITIVE_DIRECTIVES.has(cleaned)) { polarity = "positive"; break; }
      if (NEGATIVE_DIRECTIVES.has(cleaned)) { polarity = "negative"; break; }
    }
    if (!polarity) continue;
    const keywords = new Set<string>();
    for (const tok of lower.split(/[^a-z0-9]+/)) {
      if (tok.length < 4) continue;
      if (STOPWORDS.has(tok) || ALL_DIRECTIVES.has(tok)) continue;
      keywords.add(tok);
    }
    if (keywords.size === 0) continue;
    out.push({ raw: line, polarity, keywords });
  }
  return out;
}

function intersect(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const tok of a) if (b.has(tok)) out.push(tok);
  return out;
}

export function detectSkillConflicts(
  a: SkillMarkdown,
  b: SkillMarkdown
): SkillConflict[] {
  const directivesA = extractDirectives(a.content);
  const directivesB = extractDirectives(b.content);
  const conflicts: SkillConflict[] = [];
  for (const da of directivesA) {
    for (const db of directivesB) {
      if (da.polarity === db.polarity) continue;
      const shared = intersect(da.keywords, db.keywords);
      if (shared.length < 2) continue;
      conflicts.push({
        skillA: a.name,
        skillB: b.name,
        sharedTopic: shared.slice(0, 3).join(", "),
        excerptA: da.raw,
        excerptB: db.raw,
      });
    }
  }
  return conflicts;
}
```

- [ ] **Step 2.4: Run tests**

`npx vitest run src/lib/chat/__tests__/skill-conflict.test.ts` — expect 4/4 pass

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/chat/skill-conflict.ts src/lib/chat/__tests__/skill-conflict.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): keyword-based skill conflict heuristic

Pure function that extracts directive lines (always/never/prefer/avoid)
from two SKILL.md bodies and surfaces pairs whose polarities diverge on
shared keywords. Acceptably noisy — consumer renders excerpts for human
judgment, not as a binary block.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Schema — Additive `activeSkillIds` Column

**Files:**
- Modify: `src/lib/db/schema.ts:554` (conversations table)
- Modify: `src/lib/db/bootstrap.ts` — add to BOTH the CREATE TABLE block AND the addColumnIfMissing list

- [ ] **Step 3.1: Schema column**

In `src/lib/db/schema.ts`, just below the existing `activeSkillId: text("active_skill_id"),` line in the conversations table, add:

```typescript
  // Composition v1 — array of additionally-activated skill IDs (beyond
  // the legacy single activeSkillId). Default empty. Read paths merge
  // legacy + new and dedupe.
  activeSkillIds: text("active_skill_ids", { mode: "json" })
    .$type<string[]>()
    .default([] as unknown as string[]),
```

(Drizzle's TS types for `default([])` on JSON columns can be finicky — the cast above is the established pattern in this file. If a different cast is used elsewhere for JSON-array columns, follow that pattern instead.)

- [ ] **Step 3.2: bootstrap.ts updates**

Open `src/lib/db/bootstrap.ts`. Find the conversations CREATE TABLE block. Add `active_skill_ids TEXT DEFAULT '[]'` as a new column line. Then find the `addColumnIfMissing(...)` calls for the conversations table and add a new call:

```typescript
addColumnIfMissing("conversations", "active_skill_ids", "TEXT DEFAULT '[]'");
```

Order: bootstrap.ts always runs the addColumnIfMissing block BEFORE the CREATE TABLE for safety on existing DBs (per MEMORY.md). Just match the pattern of nearby calls.

- [ ] **Step 3.3: Verify schema sync**

Run: `npx vitest run src/lib/db/` — expect green. If `clear.test.ts` exists and snapshots schema, it should still pass since we added an additive column with a default.

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/bootstrap.ts
git commit -m "$(cat <<'EOF'
feat(db): conversations.active_skill_ids JSON column for skill composition

Additive — leaves legacy activeSkillId column intact. New composition
code paths read both and merge. Bootstrap updates BOTH the CREATE TABLE
block and the addColumnIfMissing call per the MEMORY.md ordering gotcha.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extend `activate_skill` Tool

**Files:**
- Modify: `src/lib/chat/tools/skill-tools.ts` (the `activate_skill` defineTool block)
- Modify: `src/lib/chat/tools/__tests__/skill-tools.test.ts`
- Modify: `src/lib/chat/tool-catalog.ts:159-160` (description / paramHint)

- [ ] **Step 4.1: Extend tool params + handler**

In `src/lib/chat/tools/skill-tools.ts`, replace the `activate_skill` `defineTool(...)` block with:

```typescript
defineTool(
  "activate_skill",
  "Activate a skill on a conversation. While active, the skill's SKILL.md is injected into the system prompt on every subsequent turn. Default mode 'replace' clears any prior active skills and binds just this one. Pass mode='add' to compose multiple skills (gated by runtime — Ollama refuses; Claude/Codex/direct allow up to 3). Pass force=true to skip conflict warnings on add.",
  {
    conversationId: z.string().describe("ID of the conversation to bind the skill to."),
    skillId: z.string().describe("Opaque skill ID from list_skills (typically the relative path)."),
    mode: z
      .enum(["replace", "add"])
      .optional()
      .default("replace")
      .describe("'replace' (default) clears prior active skills; 'add' appends — runtime must support composition."),
    force: z
      .boolean()
      .optional()
      .default(false)
      .describe("When mode='add', skip the conflict heuristic check and add anyway."),
  },
  async (args) => {
    try {
      const { getSkill } = await import("@/lib/environment/list-skills");
      const skill = getSkill(args.skillId);
      if (!skill) return err(`Skill not found: ${args.skillId}`);

      const existing = await db
        .select({
          id: conversations.id,
          activeSkillId: conversations.activeSkillId,
          activeSkillIds: conversations.activeSkillIds,
          runtimeId: conversations.runtimeId,
        })
        .from(conversations)
        .where(eq(conversations.id, args.conversationId))
        .get();
      if (!existing) return err(`Conversation not found: ${args.conversationId}`);

      if (args.mode === "add") {
        // Capability gate
        const { getRuntimeFeatures } = await import("@/lib/agents/runtime/catalog");
        let features;
        try {
          features = getRuntimeFeatures(
            existing.runtimeId as Parameters<typeof getRuntimeFeatures>[0]
          );
        } catch {
          return err(`Unknown runtime '${existing.runtimeId ?? "(none)"}' — cannot determine composition support`);
        }
        if (!features.supportsSkillComposition) {
          return err(`Runtime '${existing.runtimeId}' does not support skill composition — switch to a Claude/Codex/direct runtime to compose skills`);
        }
        const currentIds = mergeActiveSkillIds(existing.activeSkillId, existing.activeSkillIds);
        if (currentIds.includes(args.skillId)) {
          return ok({
            conversationId: args.conversationId,
            activeSkillIds: currentIds,
            note: "skill already active",
          });
        }
        if (currentIds.length >= features.maxActiveSkills) {
          return err(`Max active skills (${features.maxActiveSkills}) reached on '${existing.runtimeId}' — deactivate one first`);
        }
        // Conflict check unless forced
        if (!args.force && currentIds.length > 0) {
          const { detectSkillConflicts } = await import("@/lib/chat/skill-conflict");
          const allConflicts = [];
          for (const otherId of currentIds) {
            const other = getSkill(otherId);
            if (!other) continue;
            const conflicts = detectSkillConflicts(
              { id: skill.id, name: skill.name, content: skill.content },
              { id: other.id, name: other.name, content: other.content }
            );
            allConflicts.push(...conflicts);
          }
          if (allConflicts.length > 0) {
            return ok({
              conversationId: args.conversationId,
              requiresConfirmation: true,
              conflicts: allConflicts,
              hint: "Re-call activate_skill with force=true to add anyway",
            });
          }
        }
        const nextIds = [...currentIds, args.skillId];
        await db
          .update(conversations)
          .set({ activeSkillIds: nextIds, updatedAt: new Date() })
          .where(eq(conversations.id, args.conversationId));
        return ok({
          conversationId: args.conversationId,
          activatedSkillId: args.skillId,
          activeSkillIds: nextIds,
          skillName: skill.name,
        });
      }

      // mode === "replace" (legacy / default)
      await db
        .update(conversations)
        .set({
          activeSkillId: args.skillId,
          activeSkillIds: [],
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, args.conversationId));

      return ok({
        conversationId: args.conversationId,
        activatedSkillId: args.skillId,
        skillName: skill.name,
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : "activate_skill failed");
    }
  }
),
```

Add a small helper at module scope (above `skillTools`):

```typescript
/**
 * Merge legacy `active_skill_id` (single) with the new `active_skill_ids`
 * JSON array, dedupe, and return the canonical "currently active skills"
 * list. Order: legacy first (preserves prior behavior for read paths),
 * then composed adds in insertion order.
 */
export function mergeActiveSkillIds(
  legacyId: string | null | undefined,
  composed: string[] | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (legacyId) { out.push(legacyId); seen.add(legacyId); }
  if (composed) {
    for (const id of composed) {
      if (id && !seen.has(id)) { out.push(id); seen.add(id); }
    }
  }
  return out;
}
```

Also update `deactivate_skill` to clear BOTH columns:

```typescript
await db
  .update(conversations)
  .set({
    activeSkillId: null,
    activeSkillIds: [],
    updatedAt: new Date(),
  })
  .where(eq(conversations.id, args.conversationId));
```

- [ ] **Step 4.2: Update tool catalog metadata**

In `src/lib/chat/tool-catalog.ts:159`:

```typescript
{ name: "activate_skill", description: "Bind a skill to a conversation — SKILL.md is injected into every turn's system prompt. Pass mode='add' to compose (runtime-gated).", group: "Skills", paramHint: "conversationId, skillId, mode?" },
```

- [ ] **Step 4.3: Extend tests**

Update `src/lib/chat/tools/__tests__/skill-tools.test.ts`:

1. Extend the conversations mock to track `activeSkillIds: string[]` alongside `activeSkillId`. Also extend the runtimeId field so capability lookups work — set conversations to `runtimeId: "claude-code"` by default and `runtimeId: "ollama"` for the negative-capability test.
2. Add the following test cases inside `describe("activate_skill")`:

```typescript
it("mode:add appends a second skill on a composition-capable runtime", async () => {
  mockState.conversations.set("conv-1", {
    id: "conv-1",
    activeSkillId: "first-skill",
    activeSkillIds: [],
    runtimeId: "claude-code",
  });
  const { data } = await call("activate_skill", {
    conversationId: "conv-1",
    skillId: "second-skill",
    mode: "add",
    force: true, // bypass conflict check for this test
  });
  expect(data.activeSkillIds).toEqual(["first-skill", "second-skill"]);
});

it("mode:add returns conflicts when skills disagree (without force)", async () => {
  // requires the test mock for getSkill to return SKILL.md content;
  // either extend the existing mock with `content` or vi.mock "@/lib/chat/skill-conflict"
  // to return [{ skillA, skillB, sharedTopic, excerptA, excerptB }] deterministically.
  // Pick whichever existing test pattern is present in the file.
});

it("mode:add fails on Ollama with capability hint", async () => {
  mockState.conversations.set("conv-1", {
    id: "conv-1",
    activeSkillId: null,
    activeSkillIds: [],
    runtimeId: "ollama",
  });
  const { error } = await call("activate_skill", {
    conversationId: "conv-1",
    skillId: "any",
    mode: "add",
  });
  expect(error).toMatch(/composition/i);
});

it("mode:add enforces maxActiveSkills", async () => {
  mockState.conversations.set("conv-1", {
    id: "conv-1",
    activeSkillId: "a",
    activeSkillIds: ["b", "c"],
    runtimeId: "claude-code",
  });
  const { error } = await call("activate_skill", {
    conversationId: "conv-1",
    skillId: "d",
    mode: "add",
    force: true,
  });
  expect(error).toMatch(/max active skills/i);
});

it("default mode:replace clears prior composed skills (back-compat)", async () => {
  mockState.conversations.set("conv-1", {
    id: "conv-1",
    activeSkillId: "old",
    activeSkillIds: ["other"],
    runtimeId: "claude-code",
  });
  await call("activate_skill", { conversationId: "conv-1", skillId: "new" });
  expect(mockState.conversations.get("conv-1")?.activeSkillId).toBe("new");
  expect(mockState.conversations.get("conv-1")?.activeSkillIds).toEqual([]);
});
```

For the conflict-returning test, prefer `vi.mock("@/lib/chat/skill-conflict")` to return a deterministic array — the conflict heuristic itself is already covered by Task 2 tests.

- [ ] **Step 4.4: Run tests**

`npx vitest run src/lib/chat/tools/__tests__/skill-tools.test.ts` — expect all pass (existing 4-5 tests + new ones)

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/chat/tools/skill-tools.ts src/lib/chat/tools/__tests__/skill-tools.test.ts src/lib/chat/tool-catalog.ts
git commit -m "$(cat <<'EOF'
feat(chat): activate_skill mode:add with capability gate + conflict heuristic

Adds composition path to the existing single-skill activate flow. mode='add'
gates by runtime (Ollama refuses; Claude/Codex/direct accept up to 3),
runs the conflict heuristic, and returns structured warnings unless
force=true. Default mode='replace' preserves prior behavior. deactivate_skill
also clears the new composition column.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Context Builder — Iterate Over Composed Skills

**Files:**
- Modify: `src/lib/chat/context-builder.ts:78-` (the `buildActiveSkill` function)

- [ ] **Step 5.1: Update buildActiveSkill**

Replace the body of `buildActiveSkill` to:
1. Read both `activeSkillId` and `activeSkillIds`
2. Merge via `mergeActiveSkillIds` (export from skill-tools or duplicate the helper here — prefer importing from a shared module if you can; otherwise duplicate is fine for v1)
3. If the merged list is empty → return ""
4. Capability gate logic stays the same — but with one tweak: when `activeSkillIds.length > 0` (i.e. user explicitly composed), inject regardless of `stagentInjectsSkills`. Composition is the user's explicit opt-in to override the SDK-native default.
5. Iterate over each id, fetch SKILL.md, accumulate into a single string with `---` separators and a per-skill header.
6. Apply the same `ACTIVE_SKILL_BUDGET` cap to the COMBINED body (oldest-first trim).

```typescript
async function buildActiveSkill(conversationId: string): Promise<string> {
  const row = await db
    .select({
      activeSkillId: conversations.activeSkillId,
      activeSkillIds: conversations.activeSkillIds,
      runtimeId: conversations.runtimeId,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  const merged = mergeActiveSkillIds(row?.activeSkillId, row?.activeSkillIds);
  if (merged.length === 0) return "";

  // Composition (length > 1 OR composed array non-empty) is an explicit
  // user opt-in — inject regardless of stagentInjectsSkills, otherwise
  // the user's choice silently no-ops on Claude/Codex.
  const isComposed = (row?.activeSkillIds?.length ?? 0) > 0;

  if (!isComposed && row?.runtimeId) {
    try {
      const { getRuntimeFeatures } = await import("@/lib/agents/runtime/catalog");
      const features = getRuntimeFeatures(
        row.runtimeId as Parameters<typeof getRuntimeFeatures>[0]
      );
      if (!features.stagentInjectsSkills) return "";
    } catch {
      // unknown runtime → fall through and inject
    }
  }

  const { getSkill } = await import("@/lib/environment/list-skills");
  const sections: string[] = [];
  for (const id of merged) {
    const skill = getSkill(id);
    if (!skill) continue;
    sections.push(`## Active Skill: ${skill.name}\n\n${skill.content}`);
  }
  if (sections.length === 0) return "";
  const combined = sections.join("\n\n---\n\n");
  return truncateToTokenBudget(combined, ACTIVE_SKILL_BUDGET);
}
```

Add the import for `mergeActiveSkillIds`:

```typescript
import { mergeActiveSkillIds } from "@/lib/chat/tools/skill-tools";
```

If importing from `skill-tools` creates a circular import via the tool registry, instead duplicate the 8-line helper inline at the top of `context-builder.ts` and add a comment pointing to the original.

- [ ] **Step 5.2: Verify**

`npx tsc --noEmit 2>&1 | grep context-builder` — expect empty
`npx vitest run src/lib/chat/__tests__/` — expect green (any existing context-builder tests should still pass since merged=[activeSkillId] when activeSkillIds is empty)

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/chat/context-builder.ts
git commit -m "$(cat <<'EOF'
feat(chat): context builder injects composed SKILL.md bodies

When activeSkillIds is non-empty, treats composition as user opt-in and
injects all SKILL.md bodies (separated by ---) regardless of the runtime's
stagentInjectsSkills default. Token budget applies to the combined string.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Dev-Server Smoke Verification

This task is REQUIRED — runtime-catalog adjacent per MEMORY.md.

- [ ] **Step 6.1: Start dev server**

`npm run dev` (background) — wait for ready

- [ ] **Step 6.2: Smoke via Node-side script (in browser console or curl)**

Pick any conversation ID from `/api/conversations`. Then:

```bash
# Activate first skill (replace mode, default)
curl -X POST http://localhost:3000/api/chat/tool/activate_skill \
  -H 'Content-Type: application/json' \
  -d '{"conversationId":"<ID>","skillId":"<SKILL_A>"}'

# Add second skill (composition; should succeed on Claude conv)
curl -X POST http://localhost:3000/api/chat/tool/activate_skill \
  -H 'Content-Type: application/json' \
  -d '{"conversationId":"<ID>","skillId":"<SKILL_B>","mode":"add","force":true}'

# Verify state
curl http://localhost:3000/api/conversations/<ID> | jq '.activeSkillId, .activeSkillIds'
```

If the chat-tool MCP route doesn't expose a direct HTTP endpoint, use the in-browser console with the MCP client. Whichever is convenient.

- [ ] **Step 6.3: Negative path — Ollama refusal**

Repeat with a conversation whose `runtimeId` is `ollama`. Expect the second `activate_skill` (mode:add) to return an error matching `/composition/`.

- [ ] **Step 6.4: Tear down dev server, no commit needed**

(Smoke is verification, not code.)

---

## Task 7: Spec + Roadmap + Changelog Sync

**Files:**
- Modify: `features/chat-skill-composition.md` — flip ACs, add v1 Shipped section, defer UI to v2
- Modify: `features/roadmap.md` — flip status
- Modify: `features/changelog.md` — v1 ship entry

- [ ] **Step 7.1: Spec frontmatter**

`features/chat-skill-composition.md` line 3:
```
status: in-progress  # composition v1 (tool API) shipped; UI modal + token-budget trim deferred to v2
```

(Or `completed` if you prefer to close it like Phase 1 did. The deferred items are non-trivial — `in-progress` is more honest. Pick `in-progress`.)

- [ ] **Step 7.2: AC checkboxes**

Flip `[ ]` → `[x]` for the 7 covered ACs (catalog flags, mode:add append, conflict check structured response, Ollama gate, maxActiveSkills, persists + injected, back-compat, conflict unit tests, smoke). Leave UI modal AC and token-budget trim AC unchecked with `(deferred — v2)` notes.

- [ ] **Step 7.3: Add v1 Shipped Scope + v2 Deferred Scope sections** (mirror the Phase 1 closeout pattern in chat-filter-namespace.md)

- [ ] **Step 7.4: Roadmap row**

`features/roadmap.md` — flip `chat-skill-composition` row's status column from `planned` to `in-progress`.

- [ ] **Step 7.5: Changelog entry**

Prepend a 2026-04-14 entry under the existing date heading describing what shipped, the design decisions (additive schema, opt-in composition override, keyword heuristic), and what's deferred.

- [ ] **Step 7.6: Commit**

```bash
git add features/
git commit -m "$(cat <<'EOF'
docs(features): chat-skill-composition v1 — tool API shipped, UI deferred

Composition v1 lands the catalog flags, additive schema, conflict
heuristic, and tool-API path with capability gates. UI modal +
token-budget trim deferred to v2.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] `npm test` — full suite pass (existing 971 + new tests)
- [ ] `npx tsc --noEmit` — clean
- [ ] Dev-server smoke from Task 6 confirmed Claude composition + Ollama refusal

---

## Self-Review Notes

**Spec coverage:** 7 of 10 ACs satisfied in v1 (catalog, mode:add, conflict structured response, Ollama gate, max enforcement, persist + inject, back-compat, conflict unit tests, smoke). Deferred to v2 (with explicit notes): UI modal with "Add anyway"/"Cancel" buttons, token-budget oldest-first trim with logging, and the `+ Add` action on the Skills tab. The chat-tool API is the substrate the v2 UI will sit on.

**MEMORY.md callouts honored:**
- `addColumnIfMissing` + CREATE TABLE both updated (Task 3)
- Runtime-catalog smoke explicitly required (Task 6)
- Cross-runtime impact: composition opt-in overrides `stagentInjectsSkills` (Task 5) — documented in code comment

**Type consistency:** `mergeActiveSkillIds(legacyId, composed)` signature is identical wherever used (Task 4 helper, Task 5 import). `ACTIVE_SKILL_BUDGET` is the existing constant (no new budget constant introduced).
