# Handoff: M4.5 free-form compose Phase 1 — appId validator

**Created:** 2026-05-01 (afternoon)
**Status:** Phase 1 shipped (validator + tests). Phase 2 + browser smoke parked for pickup.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-browser-smoke-and-model-fallback-handoff.md` (M4.5/TDR-037/M5 browser smoke + model-fallback Plan D)

Headline: **Shipped Phase 1 of the free-form compose split-manifest fix from the prior handoff. Added a Zod `.refine()` rejecting `--` in `appId` on `create_table` and `create_schedule`, with sharper tool descriptions guiding the LLM to the app slug. Six new tests across two files (3 each tool); 414/414 across 44 chat/apps/runtime suites. Phase 2 (classifier widening + generic composition-hint) and the live `npm run dev` smoke remain open.**

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

## Pickup for next session

### Step 1 — Browser smoke Phase 1 alone (highest priority)

The HANDOFF.md acceptance criteria for the split-manifest fix include three live behaviors that unit tests cannot verify:

1. Smoke `"build me a habit tracker app"` → only `~/.ainative/apps/habit-tracker/` exists (no `habit-tracker--coach/` split).
2. Manifest.yaml has all 4 artifact references; projects row exists with id=`habit-tracker`; profile in `~/.ainative/profiles/habit-tracker--coach/`.
3. `composedApp` metadata present on the assistant message → `ComposedAppCard` renders live.

**Open question Phase 1 alone resolves:** does the LLM actually self-retry on the validator error? If yes, Phase 2 may be unnecessary polish. If no (the LLM gives up or returns a malformed retry), Phase 2 becomes load-bearing.

**Method:** `npm run dev` → Chrome DevTools MCP (Claude in Chrome → retry once → Chrome DevTools → Playwright per the project memory's browser-tool order). Submit the prompt in a fresh chat session, observe tool calls, then `ls ~/.ainative/apps/` and `ls ~/.ainative/profiles/` for ground truth.

**Cleanup before smoke:** `rm -rf ~/.ainative/apps/habit-tracker* ~/.ainative/apps/habit-loop* ~/.ainative/profiles/habit-tracker* ~/.ainative/profiles/habit-loop*` (only those — leave the seeded apps alone). Confirm no `habit-*` rows in `projects` first or the test starts dirty.

### Step 2 — Phase 2 (only if smoke shows LLM doesn't self-correct cleanly)

Per the prior handoff (`.archive/handoff/2026-05-01-browser-smoke-and-model-fallback-handoff.md`, §"Phase 2 — Generic compose-hint for unmatched COMPOSE_TRIGGERS"):

Files (all under `src/lib/chat/planner/`):
- `types.ts` — `ComposePlan.profileId` + `.blueprintId` optional; add `kind: "primitive_matched" | "generic"` discriminator
- `classifier.ts` — return generic plan when `findPrimitiveKey()` returns null but COMPOSE_TRIGGERS matches
- `composition-hint.ts` — generic-plan branch emits only `--` naming + appId rules (cap ~150 chars to limit token cost)

Plus 4 unit tests (3 in `classifier.test.ts`, 1 in `composition-hint.test.ts`).

**Estimated effort:** ~2 hours. Light architectural touch, all changes inside `src/lib/chat/planner/`.

### Step 3 — Re-smoke and confirm acceptance criteria

After Phase 2 (if needed), re-run the same `"build me a habit tracker app"` smoke. Single `~/.ainative/apps/habit-tracker/` dir + ComposedAppCard render = acceptance met.

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
| Tool descriptions guide LLM to slug discipline | Updated; verification deferred to live smoke |
| LLM self-retries on validator error | **Open** — assumption based on blueprint-YAML precedent; needs smoke |
| Single app dir on disk for free-form compose | **Open** — Phase 1 alone may suffice; smoke decides |
| `tsc --noEmit` clean | Yes (inline diagnostics panel was flaky as memory predicted) |
| Broader test suite green | 414/414 across 44 files |
| Diff is bisectable | Yes — single focused commit |

**Net:** confidence in the validator + tests is HIGH. Confidence in user-visible behavior change is MEDIUM until smoke confirms LLM self-retry. The smoke is the load-bearing next step.

---

*End of handoff. Working tree contains 4 changed files + this updated handoff. Single-commit ship recommended; smoke after merge.*
