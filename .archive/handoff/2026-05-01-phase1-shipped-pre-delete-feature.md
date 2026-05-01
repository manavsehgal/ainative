# Handoff: M4.5 free-form compose Phase 1 — appId validator

**Created:** 2026-05-01 (afternoon, updated post-smoke)
**Status:** Phase 1 shipped (validator + tests, commit `0d08a870`). Browser smoke ran — produced an unexpected finding that makes Phase 2 demonstrably load-bearing.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-browser-smoke-and-model-fallback-handoff.md` (M4.5/TDR-037/M5 browser smoke + model-fallback Plan D)

Headline: **Shipped Phase 1 of the free-form compose split-manifest fix. Added a Zod `.refine()` rejecting `--` in `appId` on `create_table` and `create_schedule` (414/414 unit tests green). Browser smoke of `"build me a habit tracker app"` revealed the LLM bypasses `appId` entirely without an explicit slug in the prompt — no manifest, no `composedApp` metadata, no `ComposedAppCard`. Phase 1's validator never fires for free-form compose because the LLM never enters the appId path. Phase 2 (generic composition-hint when COMPOSE_TRIGGERS matches but PRIMITIVE_MAP doesn't) is now the load-bearing structural fix.**

---

## What shipped

### Fix — appId discipline at the tool input boundary

The 2026-05-01 morning handoff observed that free-form compose prompts ("build me a habit tracker") which pass `COMPOSE_TRIGGERS` but miss `PRIMITIVE_MAP` get no composition hint. The LLM then composes from scratch and frequently passes the **profile id** (`habit-loop--coach`) as `appId` instead of the **app slug** (`habit-loop`), producing two app dirs in `~/.ainative/apps/`. The disk evidence from that smoke run was a `habit-loop/` (profile only) and a `habit-loop--coach/` (table + schedule) split.

**Phase 1 fix (this handoff):** add a Zod refinement at the tool-input boundary in **both** `create_table` (`src/lib/chat/tools/table-tools.ts`) and `create_schedule` (`src/lib/chat/tools/schedule-tools.ts`):

```ts
appId: z
  .string()
  .refine((v) => !v.includes("--"), {
    message:
      "appId must be the app slug only (e.g., 'habit-loop'), not an artifact id like 'habit-loop--coach'. Strip everything from '--' onward — the appId is the prefix before '--'.",
  })
  .optional()
  .describe(
    "App composition ID — the app's slug, e.g. 'wealth-tracker'. Must NOT contain '--'. If you have an artifact id like 'wealth-tracker--coach', the appId is everything before '--' (i.e. 'wealth-tracker'). When provided, the table/schedule is linked to the app's project and added to the app manifest."
  ),
```

The LLM gets the validator error in-context and self-retries — same proven pattern as the blueprint-YAML validator (which produced *"Let me fix the blueprint YAML format"* mid-stream during the prior session's Habit Loop run). No structural classifier change needed for Phase 1; this is defensive-only.

`update_schedule` does not currently accept `appId`, so no refinement is needed there.

### Why two callers but no shared schema

CLAUDE.md principle 6: "DRY with judgment — extract on third use, not first." Two callers is below threshold. Colocating the message with each tool's input shape also keeps the LLM-facing contract local and obvious — the message *is* the corrective signal the LLM reads.

---

## Tests

`npx vitest run src/lib/chat/ src/lib/apps/ src/lib/agents/runtime/ src/components/chat/`

**44 test files, 414/414 passing.** Net new: 6 cases across 2 files.

1. `src/lib/chat/tools/__tests__/table-tools-app-id.test.ts` (new file, 3 cases)
   - accepts a clean app slug appId
   - accepts omitted appId (non-app-composition table)
   - rejects an artifact id passed as appId (contains `--`) — asserts message contains `appId`, `--`, and `slug`
2. `src/lib/chat/tools/__tests__/schedule-tools.test.ts` (3 cases appended under "create_schedule appId discipline")
   - same three cases for `create_schedule`

TDD discipline observed: RED first (2 failures with `success === true` when `false` expected — confirming validation reaches the new refinement and the feature was indeed missing), then GREEN, then `npx tsc --noEmit` clean.

---

## Diff inventory

```
 src/lib/chat/tools/__tests__/schedule-tools.test.ts | 36 ++++++++++++++++++
 src/lib/chat/tools/__tests__/table-tools-app-id.test.ts | 81 +++++++++++++++++++++++++++++++++++++++
 src/lib/chat/tools/schedule-tools.ts                |  6 ++-
 src/lib/chat/tools/table-tools.ts                   |  6 ++-
 4 files changed, 127 insertions(+), 2 deletions(-)
```

Single coherent commit — the validator and its tests must ship together (RED→GREEN was test-first, so they form a natural unit).

---

## Smoke result — 2026-05-01 afternoon

Submitted `"build me a habit tracker app"` in a fresh chat session against `npm run dev`. Captured via Chrome DevTools MCP (Claude in Chrome unavailable on first try and after retry; fell through per the documented order).

**What the LLM did:**

| Artifact | Result |
|---|---|
| Project | Created `7d65288c-5cc4-4f47-849c-e0f6156e1497` "Habit Tracker" — **UUID id, not slug** |
| `Habits` table | Linked to project UUID via `project_id` (no `appId`) |
| `Daily Log` table | Linked to project UUID (no `appId`) |
| `Streak Alert` trigger | Bound to Daily Log table |
| `Weekly Habit Review` schedule | `project_id = '7d65288c-...'` (no `appId`) |
| `chat_messages.metadata.composedApp` | **absent** — confirmed via direct DB query |
| `~/.ainative/apps/habit-tracker*` | **0 dirs** |
| `ComposedAppCard` in chat | **did not render** |

**Why this happened:** the prompt `"build me a habit tracker app"` matches `COMPOSE_TRIGGERS` ("build me") but no `PRIMITIVE_MAP` keyword (no entry for "habit"). Per current `classifier.ts` policy, no PRIMITIVE_MAP match → returns `conversation` verdict → no composition hint injected. The LLM then composes from scratch using only tool descriptions and chooses to create raw primitives in a fresh project rather than going through the `appId`-based app-composition flow.

**Phase 1 verdict:** validator code is correct (proved by 6 unit tests); it never fired in this smoke because the LLM never tried to pass `appId`. The "split-manifest" bug from the prior session required the explicit slug `"called 'habit-loop'"` to push the LLM into the appId path. Without it, the LLM bypasses app composition entirely — a different failure mode.

**Phase 2 verdict: now demonstrably load-bearing.** Until the classifier always returns `compose` when COMPOSE_TRIGGERS matches (with a generic hint for unmatched primitives), free-form compose prompts will silently produce raw primitives instead of registered apps. The user-visible symptom is "I built you an app" in chat but no `/apps/<slug>` entry, no manifest, no ComposedAppCard.

---

## Pickup for next session

### Step 1 — Phase 2: generic compose-hint for unmatched COMPOSE_TRIGGERS

Per the prior handoff (`.archive/handoff/2026-05-01-browser-smoke-and-model-fallback-handoff.md`, §"Phase 2 — Generic compose-hint for unmatched COMPOSE_TRIGGERS"):

Files (all under `src/lib/chat/planner/`):
- `types.ts` — `ComposePlan.profileId` + `.blueprintId` optional; add `kind: "primitive_matched" | "generic"` discriminator
- `classifier.ts` — return generic plan when `findPrimitiveKey()` returns null but COMPOSE_TRIGGERS matches
- `composition-hint.ts` — generic-plan branch emits only `--` naming + appId rules (cap ~150 chars to limit token cost). The hint MUST direct the LLM to:
  1. Pick a slug (lowercase kebab-case, e.g. "habit-tracker")
  2. Pass that slug as `appId` on every `create_table` / `create_schedule` call
  3. Avoid `--` in the appId (the Phase 1 validator now enforces this; the hint just primes the LLM)
- Plus 4 unit tests (3 in `classifier.test.ts`, 1 in `composition-hint.test.ts`).

**Estimated effort:** ~2 hours. Light architectural touch, all changes inside `src/lib/chat/planner/`.

**Phase 1's validator becomes the safety net here**: the hint tells the LLM to use a clean appId; if the LLM still mistakenly passes a `--`-bearing artifact id, the validator catches it and the LLM retries. Two layers of defense.

### Step 2 — Re-smoke and confirm acceptance criteria

After Phase 2, re-run the same `"build me a habit tracker app"` smoke. Acceptance: single `~/.ainative/apps/habit-tracker/` dir + ComposedAppCard render + `composedApp` metadata in `chat_messages`.

### Step 3 — Smoke artifact cleanup (this session left these behind)

The afternoon smoke created uncomposed primitives in the user's workspace:
- Project `7d65288c-5cc4-4f47-849c-e0f6156e1497` "Habit Tracker"
- Tables `f98445ea-...` (Habits) and `900fcae1-...` (Daily Log)
- Trigger `70310b11-...` (Streak Alert — Habit Completed)
- Schedule `1aa46a79-...` (Weekly Habit Review)

These are workspace clutter, not bug evidence. The Phase 2 author can either delete them via `/projects/7d65288c-.../`, `/tables/`, and `/schedules/` UIs before re-smoking, or run a single SQL cleanup:
```sql
DELETE FROM schedules WHERE id = '1aa46a79-a032-4127-b7dc-362d0bcb4319';
DELETE FROM user_table_triggers WHERE id = '70310b11-7343-4030-9b79-2d022f691fc3';
DELETE FROM user_tables WHERE id IN ('f98445ea-773a-4c35-a9a0-18ba9af1f49d', '900fcae1-ac6e-4110-8807-2fb27e35d174');
DELETE FROM projects WHERE id = '7d65288c-5cc4-4f47-849c-e0f6156e1497';
```

### Anti-patterns (do NOT do these)

(unchanged from prior handoff §"What NOT to do" — repeated here so this file is self-contained)

- Don't try to "fix" `ensureAppProject` to extract slug from `--`-prefixed ids. That hides the LLM error instead of correcting it.
- Don't add an LLM-side post-process that rewrites manifests to merge split dirs. Non-deterministic, conflicts with `upsertAppManifest`'s atomic rename.
- Don't expand `PRIMITIVE_MAP` to cover every novel app idea. Long tail belongs to Phase 2's generic compose path.

---

## Repo housekeeping (this session, prior commit `deecfc76`)

Separate from Phase 1 work, this session also:

- Moved `handoff/` → `.archive/handoff/` via `git mv` (31 files, history preserved).
- Promoted the 2026-05-01 morning handoff to the new root `HANDOFF.md` convention (single living file).
- Updated 32 markdown cross-references in `features/` and `docs/superpowers/`.
- Documented the convention in project-root `MEMORY.md` (visible to Codex too) + auto-memory `feedback-handoff-md-workflow.md`.

**Convention:** read `HANDOFF.md` at session start; overwrite when (1) committing substantial changes, (2) finishing a large feature, or (3) session >30% filled. Archive prior content under `.archive/handoff/YYYY-MM-DD-<slug>.md` if it carries audit value.

---

## Net confidence

| Concern | State |
|---|---|
| `appId` Zod validator rejects `--` artifact ids | Verified via 6 unit tests, 2 callers |
| Tool descriptions guide LLM to slug discipline | Updated; **didn't influence smoke** because LLM never entered the appId path |
| LLM self-retries on validator error | **Untested in live smoke** (validator never fired); precedent from blueprint-YAML retries says yes |
| Single app dir on disk for free-form compose | **Phase 2 required** — current state: zero app dir, just raw primitives in UUID-id project |
| `composedApp` metadata + ComposedAppCard render | **Phase 2 required** — confirmed absent in this smoke's `chat_messages.metadata` |
| `tsc --noEmit` clean | Yes (inline diagnostics panel was flaky as memory predicted) |
| Broader test suite green | 414/414 across 44 files |
| Diff is bisectable | Yes — single focused commit `0d08a870` |

**Net:** Phase 1 is solid defensive infrastructure but doesn't move the user-visible needle on its own. **Phase 2 is now the load-bearing next step** — without it, free-form compose prompts produce raw primitives instead of registered apps. With Phase 2, Phase 1 becomes the safety net that catches `--` mistakes the LLM might still make.

---

*End of handoff. Working tree contains 1 changed file (this handoff update). Phase 1 already on origin at `0d08a870`. Smoke artifacts left in DB for the next session to decide on.*
