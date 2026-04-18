# Runtime Capability Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LLM-surface capability a first-class, declarative artifact on every runtime in the catalog, so downstream chat-UX and task-execution features can filter by capability instead of hard-coding `runtime === "claude-code"` conditionals.

**Architecture:** Add a separate `RuntimeFeatures` interface alongside the existing `RuntimeCapabilities` (operational) bag on `RuntimeCatalogEntry`. Declare feature values for all five runtimes in `src/lib/agents/runtime/catalog.ts`. Expose two lookup helpers: `getRuntimeFeatures(runtimeId)` next to the existing operational-bag helper, and `getFeaturesForModel(modelId)` colocated with `getRuntimeForModel` in `src/lib/chat/types.ts`. Guard drift with an exhaustiveness unit test that fails the build whenever a new feature key is added and any runtime forgets to declare it.

**Tech Stack:** TypeScript, Vitest, existing ainative runtime catalog (`src/lib/agents/runtime/`).

---

## What already exists

- `src/lib/agents/runtime/catalog.ts:13-22` — `RuntimeCapabilities` interface already in use, but it holds **operational** flags (`resume`, `cancel`, `approvals`, `mcpServers`, `profileTests`, `taskAssist`, `profileAssist`, `authHealthCheck`). This is a different concern from the LLM-surface capabilities the spec calls for. **Do not rename.** Add a sibling interface.
- `src/lib/agents/runtime/catalog.ts:31-39` — `RuntimeCatalogEntry` is the per-runtime descriptor. We add one new field (`features`) to it.
- `src/lib/agents/runtime/catalog.ts:41-142` — `RUNTIME_CATALOG` object with five runtimes: `claude-code`, `openai-codex-app-server`, `anthropic-direct`, `openai-direct`, `ollama`. All five must declare the new feature bag.
- `src/lib/agents/runtime/catalog.ts:154-158` — `getRuntimeCapabilities` helper. Our new helper `getRuntimeFeatures` follows the exact same shape.
- `src/lib/agents/runtime/__tests__/catalog.test.ts` — existing test file we extend with feature-bag assertions and the exhaustiveness check.
- `src/lib/agents/runtime/index.ts:3-8` — barrel that re-exports catalog helpers. New helper must be added here.
- `src/lib/chat/types.ts:98-108` — `getRuntimeForModel(modelId)` lives here (not in `runtime/types.ts` as the spec claims). New `getFeaturesForModel(modelId)` goes right next to it. The import from `agents/runtime/catalog.ts` is a one-way dependency (chat → agents), no cycle risk.
- **No existing consumer** hard-codes LLM-surface capability gates yet — this plan ships the type and the declaration only. Consumers (chat popover filtering, capability-hint banner) come in downstream specs.

## NOT in scope

- **Any consumer code that reads `features`.** Popover filtering, capability hint banner, engine/adapter dispatch using features — all deferred to `chat-command-namespace-refactor`, `chat-claude-sdk-skills`, `task-runtime-skill-parity`. This plan ships the matrix only.
- **Flipping SDK behavior.** Feature values reflect post-Phase-1 *capability* (what the SDK can do), not current *engagement* (what `engine.ts` currently activates). Wiring `settingSources` and the `Skill` tool through belongs to `chat-claude-sdk-skills`.
- **Direct-API skill injection policy.** `anthropic-direct` and `openai-direct` don't appear in the spec's capability table. We declare conservative defaults (all false, `stagentInjectsSkills: false`) and flag it as a follow-up for the direct-API owners.
- **`getRuntimeForModel` refactor.** We don't move it or change its signature. We add a sibling function.
- **Cross-runtime registry table in docs.** The table will be auto-generated from the snapshot test output if needed later; this plan does not ship docs.
- **Renaming existing `RuntimeCapabilities`.** Seven files depend on that name. Renaming is a separate, larger change that this plan does not justify.

## Error & Rescue Registry

| Failure mode | How it manifests | Recovery strategy |
|---|---|---|
| New feature key added but a runtime forgets to declare it | TypeScript compile error (if typed correctly) OR exhaustiveness unit test fails | Exhaustiveness test in Task 3 fails loudly with the missing runtime/key pair. Fix is mechanical: add the field to the offending runtime block in `RUNTIME_CATALOG`. |
| Module-load cycle via chat-tools import (per project smoke-test override) | `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` at first request in `npm run dev` | Dynamic `await import()` at call site in any consumer that imports from `@/lib/chat/ainative-tools`. This plan doesn't add such a consumer — Task 5 verifies dev server boots and a real chat turn executes without the error. Reference: TDR-032, commits `092f925` → `2b5ae42`. |
| Someone confuses `RuntimeCapabilities` (ops) with `RuntimeFeatures` (LLM surface) | Feature accessed via `entry.capabilities.hasNativeSkills` returns `undefined` | TypeScript catches it at compile time. Code review enforces the convention: `capabilities` = adapter plumbing, `features` = LLM/UX surface. |
| Direct-API conservative defaults get treated as ground truth | Downstream popover hides Claude direct-API skills that could actually be ainative-injected | This plan explicitly flags the direct-API row as "conservative — revisit when direct-API skill injection is designed." Owners of `chat-claude-sdk-skills` must revisit before their plan ships. |

---

## Task 1: Add `RuntimeFeatures` interface + per-runtime declarations

**Files:**
- Modify: `src/lib/agents/runtime/catalog.ts:13-142`

Writing the type, the catalog-entry field, and the values for all five runtimes as one unit because they are logically inseparable — the type without the values won't compile, and the values without the type are meaningless.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/agents/runtime/__tests__/catalog.test.ts` inside the existing `describe("runtime catalog", ...)` block:

```typescript
  it("exposes LLM-surface features via getRuntimeFeatures", () => {
    const features = getRuntimeFeatures("claude-code");
    expect(features.hasNativeSkills).toBe(true);
    expect(features.hasProgressiveDisclosure).toBe(true);
    expect(features.autoLoadsInstructions).toBe("CLAUDE.md");
    expect(features.stagentInjectsSkills).toBe(false);
  });

  it("marks Ollama as requiring ainative-injected skills", () => {
    const features = getRuntimeFeatures("ollama");
    expect(features.hasNativeSkills).toBe(false);
    expect(features.stagentInjectsSkills).toBe(true);
    expect(features.autoLoadsInstructions).toBeNull();
  });

  it("declares Codex auto-loads AGENTS.md", () => {
    expect(getRuntimeFeatures("openai-codex-app-server").autoLoadsInstructions).toBe("AGENTS.md");
  });
```

Also update the import block at the top of the file:

```typescript
import {
  DEFAULT_AGENT_RUNTIME,
  getRuntimeCapabilities,
  getRuntimeCatalogEntry,
  getRuntimeFeatures,
  listRuntimeCatalog,
  resolveAgentRuntime,
} from "@/lib/agents/runtime/catalog";
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npx vitest run src/lib/agents/runtime/__tests__/catalog.test.ts`
Expected: three new tests fail with `getRuntimeFeatures is not a function` (or TypeScript error `has no exported member 'getRuntimeFeatures'`).

- [ ] **Step 3: Add the `RuntimeFeatures` interface**

In `src/lib/agents/runtime/catalog.ts`, immediately **after** the existing `RuntimeCapabilities` interface (line 22, before `RuntimeModelConfig` on line 24), insert:

```typescript
/**
 * LLM-surface features that affect what the model sees and which tools/skills
 * ainative exposes to it. Distinct from RuntimeCapabilities above, which is
 * adapter-plumbing concerns (can the adapter resume/cancel/etc.).
 *
 * Values reflect post-Phase-1 capability (what the runtime SDK *can* do),
 * not current engagement (what `engine.ts` currently activates). Downstream
 * features read this bag to decide rendering, filtering, and dispatch.
 */
export interface RuntimeFeatures {
  /** SDK provides a native skill-invocation tool (e.g. Claude SDK `Skill` tool). */
  hasNativeSkills: boolean;
  /** SDK loads skill metadata first, full SKILL.md on demand. */
  hasProgressiveDisclosure: boolean;
  /** Read/Grep/Glob/Edit/Write available as LLM tools. */
  hasFilesystemTools: boolean;
  /** Bash tool available (ainative gates via permission bridge). */
  hasBash: boolean;
  /** TodoWrite tool available. */
  hasTodoWrite: boolean;
  /** Runtime supports delegating to sub-agents (e.g. Task tool). */
  hasSubagentDelegation: boolean;
  /** Runtime loads filesystem hooks (pre/post tool-use shell scripts). */
  hasHooks: boolean;
  /** Which project-level instructions file the runtime auto-loads, if any. */
  autoLoadsInstructions: "CLAUDE.md" | "AGENTS.md" | null;
  /**
   * Runtime has no native skill support — ainative must inject SKILL.md content
   * into the system prompt to expose skills to the LLM.
   */
  stagentInjectsSkills: boolean;
}
```

- [ ] **Step 4: Add `features` field to `RuntimeCatalogEntry`**

In the same file, extend the `RuntimeCatalogEntry` interface (currently lines 31-39). Add `features: RuntimeFeatures;` after `capabilities: RuntimeCapabilities;`:

```typescript
export interface RuntimeCatalogEntry {
  id: AgentRuntimeId;
  label: string;
  description: string;
  providerId: "anthropic" | "openai" | "ollama";
  capabilities: RuntimeCapabilities;
  features: RuntimeFeatures;
  /** Model catalog — default and supported model IDs for this runtime */
  models: RuntimeModelConfig;
}
```

- [ ] **Step 5: Populate `features` for `claude-code`**

In `RUNTIME_CATALOG["claude-code"]` (starts at line 42), add `features` immediately after the `capabilities` block (after line 56, before `models` on line 57):

```typescript
    features: {
      hasNativeSkills: true,
      hasProgressiveDisclosure: true,
      hasFilesystemTools: true,
      hasBash: true,
      hasTodoWrite: true,
      hasSubagentDelegation: false, // ainative task primitives replace SDK Task tool
      hasHooks: false, // excluded per Q2
      autoLoadsInstructions: "CLAUDE.md",
      stagentInjectsSkills: false,
    },
```

- [ ] **Step 6: Populate `features` for `openai-codex-app-server`**

After the `capabilities` block of `openai-codex-app-server` (around line 76), before its `models`:

```typescript
    features: {
      hasNativeSkills: true,
      hasProgressiveDisclosure: true,
      hasFilesystemTools: true,
      hasBash: true,
      hasTodoWrite: true,
      hasSubagentDelegation: false,
      hasHooks: false,
      autoLoadsInstructions: "AGENTS.md",
      stagentInjectsSkills: false,
    },
```

- [ ] **Step 7: Populate `features` for `anthropic-direct` (conservative defaults)**

After the `capabilities` block of `anthropic-direct` (around line 96), before its `models`:

```typescript
    features: {
      // Direct Messages API — no SDK-native skill machinery.
      // Revisit when chat-claude-sdk-skills designs direct-API skill injection.
      hasNativeSkills: false,
      hasProgressiveDisclosure: false,
      hasFilesystemTools: false,
      hasBash: false,
      hasTodoWrite: false,
      hasSubagentDelegation: false,
      hasHooks: false,
      autoLoadsInstructions: null,
      stagentInjectsSkills: false,
    },
```

- [ ] **Step 8: Populate `features` for `openai-direct` (conservative defaults)**

After the `capabilities` block of `openai-direct` (around line 116), before its `models`:

```typescript
    features: {
      // Direct Responses API — no SDK-native skill machinery.
      // Revisit when chat-claude-sdk-skills designs direct-API skill injection.
      hasNativeSkills: false,
      hasProgressiveDisclosure: false,
      hasFilesystemTools: false,
      hasBash: false,
      hasTodoWrite: false,
      hasSubagentDelegation: false,
      hasHooks: false,
      autoLoadsInstructions: null,
      stagentInjectsSkills: false,
    },
```

- [ ] **Step 9: Populate `features` for `ollama`**

After the `capabilities` block of `ollama` (around line 136), before its `models`:

```typescript
    features: {
      hasNativeSkills: false,
      hasProgressiveDisclosure: false,
      hasFilesystemTools: false,
      hasBash: false,
      hasTodoWrite: false, // ainative MCP exposes todo tools separately
      hasSubagentDelegation: false,
      hasHooks: false,
      autoLoadsInstructions: null,
      stagentInjectsSkills: true,
    },
```

- [ ] **Step 10: Add `getRuntimeFeatures` helper**

After `getRuntimeCapabilities` (currently ends at line 158), before `resolveAgentRuntime` (line 160), add:

```typescript
export function getRuntimeFeatures(
  runtimeId: AgentRuntimeId = DEFAULT_AGENT_RUNTIME
): RuntimeFeatures {
  return getRuntimeCatalogEntry(runtimeId).features;
}
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npx vitest run src/lib/agents/runtime/__tests__/catalog.test.ts`
Expected: all tests (existing + three new) PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/agents/runtime/catalog.ts src/lib/agents/runtime/__tests__/catalog.test.ts
git commit -m "$(cat <<'EOF'
feat(runtime): declare LLM-surface features per runtime

Adds RuntimeFeatures interface alongside the existing RuntimeCapabilities
(operational) bag. Declares feature values for all five runtimes and
exposes them via getRuntimeFeatures(runtimeId). Unblocks capability-aware
chat UX and task-execution parity work.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add exhaustiveness guard

**Files:**
- Modify: `src/lib/agents/runtime/__tests__/catalog.test.ts`

A single declarative test that fails loudly if someone adds a new feature key and forgets to declare it on one of the five runtimes. This is the drift-prevention mechanism the spec's exhaustiveness criterion requires.

- [ ] **Step 1: Write the failing test**

Append inside the `describe("runtime catalog", ...)` block:

```typescript
  it("every runtime declares every feature key (exhaustiveness guard)", () => {
    const runtimes = listRuntimeCatalog();
    const expectedKeys: Array<keyof ReturnType<typeof getRuntimeFeatures>> = [
      "hasNativeSkills",
      "hasProgressiveDisclosure",
      "hasFilesystemTools",
      "hasBash",
      "hasTodoWrite",
      "hasSubagentDelegation",
      "hasHooks",
      "autoLoadsInstructions",
      "stagentInjectsSkills",
    ];

    for (const runtime of runtimes) {
      for (const key of expectedKeys) {
        expect(
          runtime.features,
          `${runtime.id} missing feature "${key}"`
        ).toHaveProperty(key);
      }
    }
  });

  it("feature matrix snapshot matches declared values", () => {
    // Guard against silent regressions: the declared feature matrix must match
    // this snapshot exactly. Update intentionally when flipping a capability flag
    // (and reference the spec change in the commit message).
    const snapshot = listRuntimeCatalog().reduce<Record<string, unknown>>((acc, r) => {
      acc[r.id] = r.features;
      return acc;
    }, {});

    expect(snapshot).toMatchInlineSnapshot(`
      {
        "anthropic-direct": {
          "autoLoadsInstructions": null,
          "hasBash": false,
          "hasFilesystemTools": false,
          "hasHooks": false,
          "hasNativeSkills": false,
          "hasProgressiveDisclosure": false,
          "hasSubagentDelegation": false,
          "hasTodoWrite": false,
          "stagentInjectsSkills": false,
        },
        "claude-code": {
          "autoLoadsInstructions": "CLAUDE.md",
          "hasBash": true,
          "hasFilesystemTools": true,
          "hasHooks": false,
          "hasNativeSkills": true,
          "hasProgressiveDisclosure": true,
          "hasSubagentDelegation": false,
          "hasTodoWrite": true,
          "stagentInjectsSkills": false,
        },
        "ollama": {
          "autoLoadsInstructions": null,
          "hasBash": false,
          "hasFilesystemTools": false,
          "hasHooks": false,
          "hasNativeSkills": false,
          "hasProgressiveDisclosure": false,
          "hasSubagentDelegation": false,
          "hasTodoWrite": false,
          "stagentInjectsSkills": true,
        },
        "openai-codex-app-server": {
          "autoLoadsInstructions": "AGENTS.md",
          "hasBash": true,
          "hasFilesystemTools": true,
          "hasHooks": false,
          "hasNativeSkills": true,
          "hasProgressiveDisclosure": true,
          "hasSubagentDelegation": false,
          "hasTodoWrite": true,
          "stagentInjectsSkills": false,
        },
        "openai-direct": {
          "autoLoadsInstructions": null,
          "hasBash": false,
          "hasFilesystemTools": false,
          "hasHooks": false,
          "hasNativeSkills": false,
          "hasProgressiveDisclosure": false,
          "hasSubagentDelegation": false,
          "hasTodoWrite": false,
          "stagentInjectsSkills": false,
        },
      }
    `);
  });
```

- [ ] **Step 2: Run tests and verify they pass**

Run: `npx vitest run src/lib/agents/runtime/__tests__/catalog.test.ts`
Expected: both new tests PASS. If the `toMatchInlineSnapshot` fails with a diff, the test runner auto-writes the snapshot on first run — re-run once and it should pass.

- [ ] **Step 3: Verify the guard actually catches drift (one-minute sanity check)**

Temporarily break `ollama.features` by deleting the `hasNativeSkills: false,` line in `catalog.ts`. Re-run the test.
Expected: exhaustiveness test fails with `ollama missing feature "hasNativeSkills"`.
**Restore the line** before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agents/runtime/__tests__/catalog.test.ts
git commit -m "$(cat <<'EOF'
test(runtime): guard feature-matrix drift with exhaustiveness + snapshot

Adds two runtime-catalog tests: one asserts every runtime declares every
feature key (fails loudly when someone adds a key and forgets a runtime),
one snapshots the full feature matrix to catch silent value regressions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `getFeaturesForModel` helper

**Files:**
- Modify: `src/lib/chat/types.ts:98-108`
- Test: `src/lib/chat/__tests__/types.test.ts` (create if missing)

Colocates with `getRuntimeForModel` so chat callers have one place to look.

- [ ] **Step 1: Check whether the test file exists**

Run: `ls src/lib/chat/__tests__/types.test.ts 2>/dev/null || echo MISSING`

If MISSING, the test file must be created from scratch in the following step. If it exists, append to the existing `describe` block.

- [ ] **Step 2: Write the failing test**

If the file does not exist, create `src/lib/chat/__tests__/types.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";
import { getFeaturesForModel, getRuntimeForModel } from "@/lib/chat/types";

describe("getFeaturesForModel", () => {
  it("returns Claude features for a Claude model id", () => {
    const features = getFeaturesForModel("sonnet");
    expect(features.hasNativeSkills).toBe(true);
    expect(features.autoLoadsInstructions).toBe("CLAUDE.md");
  });

  it("returns Ollama features for an ollama-prefixed model id", () => {
    const features = getFeaturesForModel("ollama:llama3");
    expect(features.stagentInjectsSkills).toBe(true);
    expect(features.hasNativeSkills).toBe(false);
  });

  it("returns Codex features for a GPT model id", () => {
    const features = getFeaturesForModel("gpt-5.4");
    expect(features.autoLoadsInstructions).toBe("AGENTS.md");
  });

  it("falls back to claude-code features for an unknown model id", () => {
    // getRuntimeForModel's fallback chain lands on claude-code for unknown ids.
    const features = getFeaturesForModel("totally-made-up-model");
    expect(features.hasNativeSkills).toBe(true);
    expect(getRuntimeForModel("totally-made-up-model")).toBe("claude-code");
  });
});
```

If the file already exists, append only the `describe("getFeaturesForModel", ...)` block above and reconcile imports.

- [ ] **Step 3: Run and verify it fails**

Run: `npx vitest run src/lib/chat/__tests__/types.test.ts`
Expected: fails with `getFeaturesForModel` is not exported.

- [ ] **Step 4: Add the helper to `src/lib/chat/types.ts`**

At the top of `src/lib/chat/types.ts`, add the import (reconcile with existing imports if any):

```typescript
import {
  getRuntimeFeatures,
  resolveAgentRuntime,
  type AgentRuntimeId,
  type RuntimeFeatures,
} from "@/lib/agents/runtime/catalog";
```

Then, immediately after `getRuntimeForModel` (currently ends at line 108), add:

```typescript
/**
 * Model → LLM-surface features. Thin wrapper around getRuntimeForModel +
 * getRuntimeFeatures so chat callers don't need to know runtime IDs.
 */
export function getFeaturesForModel(modelId: string): RuntimeFeatures {
  const runtimeId = resolveAgentRuntime(getRuntimeForModel(modelId));
  return getRuntimeFeatures(runtimeId as AgentRuntimeId);
}
```

**Why `resolveAgentRuntime`?** `getRuntimeForModel` returns a raw `string` — a historical choice predating strict runtime typing. Passing it through `resolveAgentRuntime` coerces it to `AgentRuntimeId` (falling back to default with a warning on unknowns), matching how other callers normalize it.

- [ ] **Step 5: Run tests and verify pass**

Run: `npx vitest run src/lib/chat/__tests__/types.test.ts`
Expected: all four new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chat/types.ts src/lib/chat/__tests__/types.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): add getFeaturesForModel helper

Colocates model→features lookup with the existing getRuntimeForModel
so chat-layer callers resolve LLM-surface capability without reaching
into agents/runtime internals.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Re-export from runtime barrel

**Files:**
- Modify: `src/lib/agents/runtime/index.ts:1-8`

Makes `getRuntimeFeatures` and `RuntimeFeatures` importable via `@/lib/agents/runtime`, matching how the operational bag is already surfaced.

- [ ] **Step 1: Update the barrel import**

In `src/lib/agents/runtime/index.ts`, change lines 1-8 from:

```typescript
import {
  DEFAULT_AGENT_RUNTIME,
  getRuntimeCapabilities,
  getRuntimeCatalogEntry,
  listRuntimeCatalog,
  resolveAgentRuntime,
  type AgentRuntimeId,
} from "./catalog";
```

to:

```typescript
import {
  DEFAULT_AGENT_RUNTIME,
  getRuntimeCapabilities,
  getRuntimeCatalogEntry,
  getRuntimeFeatures,
  listRuntimeCatalog,
  resolveAgentRuntime,
  type AgentRuntimeId,
} from "./catalog";
```

- [ ] **Step 2: Add re-exports at the bottom of the file**

At the end of `src/lib/agents/runtime/index.ts`, append:

```typescript
export { getRuntimeFeatures };
export type { RuntimeFeatures } from "./catalog";
```

- [ ] **Step 3: Run the type checker on the whole app**

Run: `npx tsc --noEmit`
Expected: exits 0 (no new TS errors). Pre-existing diagnostics in `context-builder.ts`, `engine.ts`, `codex-engine.ts`, `chat-command-popover.tsx`, and `marketplace-browser.tsx` are not introduced by this plan — if they appear, they predate it (verified at plan start).

If new errors appear that reference `RuntimeFeatures`, `getRuntimeFeatures`, or `features`: fix before proceeding (likely a missing import somewhere touched by auto-imports).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass (including the existing 5 tests in `catalog.test.ts` and the 5 new ones we added, plus the 4 new ones in `types.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/runtime/index.ts
git commit -m "$(cat <<'EOF'
chore(runtime): export RuntimeFeatures from runtime barrel

Makes the feature bag reachable via @/lib/agents/runtime for downstream
chat and task-execution consumers.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Smoke test (project-override requirement)

**Why this task exists:** project override in `.claude/skills/writing-plans/SKILL.md` mandates an end-to-end smoke test for any plan that modifies `src/lib/agents/runtime/catalog.ts` or `src/lib/agents/runtime/index.ts`. This plan modifies both. Unit tests cannot detect module-load cycles introduced by seemingly innocuous additions to the runtime layer (see TDR-032, commits `092f925` → `2b5ae42` where a similar feature shipped 34/34 green and crashed at first request).

**Files:** none. Dev-server execution only.

- [ ] **Step 1: Start the dev server on a non-colliding port**

Run: `PORT=3010 npm run dev`
Expected: starts cleanly, no `ReferenceError` on startup, `Ready in Xs` appears in console.

If you see `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` — a cycle was introduced. Abort the smoke test, trace the import graph from any file that imports from `@/lib/chat/ainative-tools`, and introduce a dynamic `await import()` at the call site.

- [ ] **Step 2: Trigger a real chat turn on the Claude runtime**

In a separate terminal (or browser), open `http://localhost:3010`, select a Claude model (e.g. `sonnet`), and send the prompt: `list all agent profiles`.

Expected: the chat turn completes, the assistant response appears, and the ainative `list_profiles` MCP tool fires (visible in the activity/tool-result UI). No `ReferenceError` in the dev-server console during the turn.

- [ ] **Step 3: Trigger a real chat turn on an Ollama model (if Ollama is available locally)**

Skip if Ollama is not installed locally. Otherwise, select an `ollama:*` model and send: `hello`.
Expected: turn completes without runtime errors.

- [ ] **Step 4: Stop the dev server**

Ctrl-C the `npm run dev` process. If any `next-server` child processes remain (`ps aux | grep next-server`), kill them before proceeding.

- [ ] **Step 5: Record the smoke-test outcome in the feature spec**

Append to the References section of `features/runtime-capability-matrix.md`:

```markdown
- Smoke test (YYYY-MM-DD): started dev server on `:3010`, exercised `list_profiles` on Claude runtime and a chat turn on Ollama runtime. No `ReferenceError` observed. Runtime catalog loads cleanly with new `features` field.
```

(Replace `YYYY-MM-DD` with today's date. Omit the Ollama line if step 3 was skipped.)

- [ ] **Step 6: Commit the verification note**

```bash
git add features/runtime-capability-matrix.md
git commit -m "$(cat <<'EOF'
docs(features): record runtime-capability-matrix smoke-test outcome

Verifies TDR-032 module-load cycle check passed after adding the
RuntimeFeatures bag to the runtime catalog.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification checklist (run before declaring the plan complete)

- [ ] `npx tsc --noEmit` exits 0 (no new TypeScript errors attributable to this plan)
- [ ] `npm test` passes fully
- [ ] `npx vitest run src/lib/agents/runtime/__tests__/catalog.test.ts` — 10 tests pass (5 existing + 3 feature-bag + 2 guards)
- [ ] `npx vitest run src/lib/chat/__tests__/types.test.ts` — 4 new tests pass
- [ ] Five commits landed (one per task 1-4 + verification note in task 5)
- [ ] Dev server started on `:3010`, real chat turn completed, no `ReferenceError` (task 5)
- [ ] Verification note appended to `features/runtime-capability-matrix.md` References section
- [ ] Feature spec's acceptance criteria re-read: all nine criteria that are in-scope for this plan are green (the two consumer-facing criteria — "popover consumes the matrix" and "hint banner consumes the matrix" — are explicitly downstream and intentionally deferred)
