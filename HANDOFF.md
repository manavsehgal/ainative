# Handoff: M4.5 / TDR-037 / M5 browser smoke + model-fallback Plan D

**Created:** 2026-05-01
**Status:** All shipped fixes verified in browser; one known limitation remains, with an actionable plan for next session.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **Browser-smoked the recently-launched M4.5 / TDR-037 / M5 features end-to-end. Found and fixed 4 bugs (compose-card not rendering, scaffold-card not rendering live, demo conversations stuck on retired model, streaming pipe missing modelId). One known limitation parked with a concrete plan: free-form compose prompts can split into two app dirs because the LLM mis-uses `appId`.**

---

## What was smoked

End-to-end Chrome DevTools MCP smoke against `npm run dev` covering recently-launched features per `features/changelog.md`:

| Surface | Smoke result |
|---|---|
| `/apps` page (TDR-037 Phase 2+3) | Renders 3 starter templates + dynamic sidebar entries for composed apps |
| Compose-followup commit `1948b864` (manifest write, projects row, profile data-dir) | All three fixes verified on disk via `~/.ainative/apps/<id>/manifest.yaml`, `projects` table rows, `~/.ainative/profiles/<id>/` |
| M4.5 conversation classifier (negative case) | "what is a reading list in general?" correctly routes to conversation |
| M4.5 scaffold path | "I need a plugin that connects to Linear..." → `ExtensionFallbackCard` renders with **Try this** + **Scaffold + open** + `~/.ainative/plugins/linear-mine/` |
| M4.5 compose path | "Build me a weekly reading list app..." → `AppMaterializedCard` renders with **Running** badge + primitives summary + Open/Undo buttons |

---

## Bugs found and fixed

### Fix 1 — Compose detector ignored `result.appId`

`src/lib/apps/composition-detector.ts`'s `appIdFromResult` only parsed the `--`-namespaced `id` field. For `create_table`/`create_schedule` (which use UUID primary keys for row identity), the appId comes through as a separate `appId` field per commit `1948b864`. The detector was blind to that field, so `composedApp` metadata was always `null` for happy-path composes — meaning the in-chat `ComposedAppCard` (the headline M4.5 demo affordance) silently never rendered.

**Fix:** detector reads `result.appId` first, falls back to slug parsing.

### Fix 2 — `create_table` never called `onToolResult`

Dead-end discovery: `create_table` returned the right shape to the LLM but never invoked `ctx.onToolResult?.()`, so `toolResults` (the array passed to `detectComposedApp`) literally never contained `create_table` entries. This compounded with Fix 1 — even after teaching the detector to read `appId`, it still saw zero table calls.

`src/lib/chat/tools/schedule-tools.ts` had the same shape problem: `onToolResult` was called with the bare DB row, not the tool's full result envelope including `appId`.

**Fix:** both tools now emit `onToolResult` with the full `{ id, name, ..., appId }` shape.

### Fix 3 — Streaming `done` event dropped chip-rendering metadata

`engine.ts` writes `composedApp` / `extensionFallback` / `fallbackReason` / model usage to `chat_messages.metadata` AT THE END of the stream, then yields a `done` SSE event that only carries `messageId` and `quickAccess`. The client's `chat-session-provider.tsx` `done` handler merged only `quickAccess` into the in-memory message metadata — so live-rendered messages lacked the metadata fields that `chat-message.tsx` reads to decide whether to render `AppMaterializedCard`, `ExtensionFallbackCard`, the model-label muted line, and the amber fallback chip.

Symptom: cards and chips appeared only after a hard page reload (which re-fetches metadata from DB).

**Fix:** extended `ChatStreamEvent.done` with optional `composedApp`, `extensionFallback`, `fallbackReason`, `modelId`. Engine emits all four (where applicable). Client merges all four into local message metadata.

### Fix 4 — `modelLabel` gates the fallback-chip parent block

Subtle follow-up surfaced *during* Fix 3 verification: even after wiring `fallbackReason` through the `done` event, the chip still didn't render for new turns. Root cause: `chat-message.tsx` line ~250 wraps both the model label and the chip in:
```tsx
{!isUser && !isStreaming && modelLabel && (<div>...</div>)}
```
If `modelLabel` is null (because `meta.modelId` isn't in client state yet), the whole block is skipped and `fallbackReason` never gets a chance to render — even though it's been correctly merged into metadata.

**Fix:** `done` event also carries `modelId`. Client merges it into metadata; `resolveModelLabel(meta.modelId)` returns truthy; the gate opens; the chip renders.

### Fix 5 — Demo conversations stuck on retired Sonnet 4.5 model (Plan D: A + C)

5 of 6 seeded demo conversations (`Launch copy strategy`, `SEO content plan for Q2`, `Churn risk for Enterprise accounts`, `TechVenture due diligence scope`, `Deal review: Meridian Corp stall`) had hardcoded `modelId: "claude-sonnet-4-5-20250514"`. That model is no longer accessible. Opening any of them and submitting a message threw "model may not exist or you may not have access" — directly visible in the UI as a degraded chat-error message.

**Plan D = A + C combined:**
- **A (seed update):** `src/lib/data/seed-data/conversations.ts` (×5) and `src/lib/data/seed-data/usage-ledger.ts` (×1) replaced raw model IDs with the `"sonnet"` alias. Fresh installs after `npm publish` get a working demo from minute one.
- **C (runtime fallback):** added `isRecognizedChatModelId()` check at the top of `resolveChatExecutionTarget`. Unknown raw IDs (CHAT_MODELS doesn't have them, no `ollama:` prefix) get substituted with `DEFAULT_CHAT_MODEL` and a synthetic unavailability reason that flows into the existing `fallbackReason` chip pipeline. Existing local DBs get the chip + a working response, no manual reseed needed.

Chip text: *"claude-sonnet-4-5-20250514 is not a recognized model. Using haiku on Claude Code for this turn."*

---

## Live verifications

All claims below verified by Chrome DevTools MCP against `npm run dev` (not unit tests):

- **Weekly Reading List compose** (PRIMITIVE_MAP-matched, `compose` verdict): `AppMaterializedCard` rendered live with `Running` badge, `Profile · Blueprint · 1 table · Schedule` primitives summary, **Open Weekly Reading List** link to `/apps/weekly-reading-list`, **Undo Weekly Reading List** button. Matching disk artifacts: `~/.ainative/apps/weekly-reading-list/manifest.yaml` with all 4 primitives, projects row created, profile in data-dir.
- **Linear scaffold** (SCAFFOLD_TRIGGER + integration noun): `ExtensionFallbackCard` rendered live with **Try this** + **Scaffold + open** buttons and `~/.ainative/plugins/linear-mine/` path. No LLM turn burned.
- **Reading-list conversation** (no trigger match): clean prose response, no compose tools fired, no card rendered.
- **Meridian Corp demo** (stale Sonnet 4.5 model): 3 sequential turns submitted (Portfolio Manager scaffold via skill, Pinnacle qualification table, deprioritize one-liner). Each rendered both:
  - Model label: `claude-haiku-4-5-20251001`
  - Amber chip: `claude-sonnet-4-5-20250514 is not a recognized model. Using haiku on Claude Code for this turn.`
  
  All 5 originally-broken demo conversations confirmed loading 200 OK from `/api/chat/conversations/<id>`.

---

## Tests

`npx vitest run src/lib/agents/runtime/__tests__/ src/lib/chat/__tests__/ src/lib/apps/__tests__/ src/components/chat/__tests__/`

29 test files, **235/235 passing**, including 4 new regressions:

1. `composition-detector.test.ts` — UUID + appId path detection
2. `execution-target.test.ts` — `substitutes DEFAULT_CHAT_MODEL when the requested model is an unrecognized raw ID`
3. `execution-target.test.ts` — `does not substitute when the requested model is a known alias`
4. (Plus existing chat suites still green.)

---

## Diff inventory

```
 src/components/chat/chat-session-provider.tsx       | 19 +++++++++++
 src/lib/agents/runtime/__tests__/execution-target.test.ts | 34 +++++++++++++++++++
 src/lib/agents/runtime/execution-target.ts          | 38 +++++++++++++++++++---
 src/lib/apps/__tests__/composition-detector.test.ts | 17 ++++++++++
 src/lib/apps/composition-detector.ts                |  7 ++++
 src/lib/chat/engine.ts                              | 23 ++++++++++---
 src/lib/chat/tools/schedule-tools.ts                |  5 ++-
 src/lib/chat/tools/table-tools.ts                   |  5 +++
 src/lib/chat/types.ts                               | 10 +++++-
 src/lib/data/seed-data/conversations.ts             | 10 +++---
 src/lib/data/seed-data/usage-ledger.ts              |  2 +-
 11 files changed, 152 insertions(+), 18 deletions(-)
```

Single working tree, no untracked files beyond this handoff. Commit boundary suggestion: split into 3 commits to keep bisectable history:

1. `fix(chat): wire composedApp + extensionFallback + fallbackReason + modelId through done SSE event` — Fixes 1–4 (composition-detector + tools + engine + provider + types + tests). The 4 bugs share a root cause (the `done` event metadata pipe), so they make one coherent unit.
2. `fix(chat): seed conversations with sonnet alias instead of retired raw model id` — Fix 5A (seed-data only).
3. `feat(runtime): substitute unknown chat model ids with DEFAULT_CHAT_MODEL + surface fallback reason` — Fix 5C (execution-target.ts + tests).

---

## Pickup for next session: free-form compose split-manifest issue

### Problem

When the M4.5 classifier returns `compose` (PRIMITIVE_MAP key matched), the composition hint instructs the LLM explicitly: *"call create_table and pass `appId: '<app-id>'` (same slug as step 1)"* — the LLM gets it right.

When the classifier returns `conversation` because the user's prompt didn't match a `PRIMITIVE_MAP` keyword (e.g. *"build me a habit tracker"* — "build me" matches `COMPOSE_TRIGGERS` but "habit" isn't in the map), no hint is injected. The LLM then composes from scratch using only the tool descriptions. It frequently passes the **profile id** (e.g. `habit-loop--coach`) as `appId` instead of the **app slug** (`habit-loop`). Because `ensureAppProject(args.appId, ...)` blindly creates a project with id=`<whatever you passed>`, the result is two app dirs in `~/.ainative/apps/`:

- `habit-loop/manifest.yaml` — profile only (written by `create_profile`)
- `habit-loop--coach/manifest.yaml` — table + schedule (written by `create_table`/`create_schedule` because the LLM passed the wrong appId)

Real artifact from this session's smoke run, `ls ~/.ainative/apps/`:
```
daily-journal
habit-loop
habit-loop--coach    ← split manifest
meal-planner
portfolio-checkin
weekly-reading-list
```

### Plan: Phase 1 (D) + Phase 2 (E)

#### Phase 1 — Tool-side appId validator (small, surgical)

Add `appId` shape validation at the tool-input boundary. If `appId` contains `--`, return `err()` with a corrective message. The LLM will see the error and retry — same pattern that already works for blueprint YAML validation (the Habit Loop run produced *"Let me fix the blueprint YAML format"* mid-stream when blueprint validation rejected the first attempt).

**Files:**
- `src/lib/chat/tools/table-tools.ts` — add Zod refinement on `appId`:
  ```ts
  appId: z.string().refine(
    (v) => !v.includes("--"),
    { message: "appId must be the app slug only (e.g., 'habit-loop'), not an artifact id like 'habit-loop--coach'. Strip the '--' suffix." }
  ).optional()
  ```
- `src/lib/chat/tools/schedule-tools.ts` — same refinement.
- Update tool descriptions to be unambiguous: *"appId: the app's slug, e.g. 'wealth-tracker'. Must NOT contain `--`. If you have an artifact id like 'wealth-tracker--coach', the appId is everything before `--`."*
- Tests: `src/lib/chat/tools/__tests__/table-tools.test.ts` + `schedule-tools.test.ts` — add 2 cases each:
  - Valid appId `'habit-loop'` → tool succeeds
  - Invalid appId `'habit-loop--coach'` → tool returns `err()` with the corrective message

**Risk:** none. The LLM either retries (good) or fails the tool call (also good — beats silent split-manifest). Defensive-only fix.

#### Phase 2 — Generic compose-hint for unmatched COMPOSE_TRIGGERS (E)

Currently `classifier.ts` returns `conversation` when COMPOSE_TRIGGERS matches but `findPrimitiveKey()` returns null. Change the policy: when a compose trigger matches, ALWAYS return `compose` — but with a "generic" plan that omits profileId/blueprintId suggestions and just emits the appId-discipline part of the hint.

**Files:**
- `src/lib/chat/planner/types.ts` — make `ComposePlan.profileId` and `.blueprintId` optional. Add a `kind: "primitive_matched" | "generic"` discriminator.
- `src/lib/chat/planner/classifier.ts` — `inferComposePlan` returns a generic plan when no PRIMITIVE_MAP key matches. Plan shape: `{ kind: "generic", rationale: "Compose-shaped prompt without a registry match" }`.
- `src/lib/chat/planner/composition-hint.ts` — when plan is generic, emit only the `--` naming convention + appId-passing rules, skip the "Profile: X / Blueprint: Y" pre-population.
- Tests: 3 new cases in `classifier.test.ts`:
  - `"build me a habit tracker"` (compose trigger + no primitive match) → `compose` verdict, generic plan
  - `"build me a reading list app"` (compose trigger + primitive match) → `compose` verdict, primitive_matched plan (existing behavior)
  - `"what is a habit tracker"` (no compose trigger) → `conversation` verdict (existing behavior — don't over-fire)
- Tests: 1 new case in `composition-hint.test.ts`:
  - Generic plan emits the appId-discipline directives without the Profile/Blueprint pre-pop

**Risk:** medium. Adding a `compose` verdict to more prompts means more prompts get the system-prompt augmentation (~400 chars per turn). Small token cost, no latency cost. Mitigation: limit generic-hint to ~150 chars, focused only on the appId rule.

#### Acceptance criteria for closing this issue

After Phase 1 + Phase 2 are shipped:

1. Smoke `"build me a habit tracker app"` → only `~/.ainative/apps/habit-tracker/` exists (no `habit-tracker--coach/` split).
2. Same disk-state assertion as the Weekly Reading List smoke: manifest.yaml has all 4 artifact references, projects row exists with id=`habit-tracker`, profile in `~/.ainative/profiles/habit-tracker--coach/`.
3. `composedApp` metadata present on the assistant message → `ComposedAppCard` renders live in chat.
4. Tool-input validator unit tests + classifier unit tests green.

#### Estimated effort

- Phase 1: ~1 hour (2 tool edits + 4 unit tests + tool description copy edit). No restart needed beyond Turbopack hot reload.
- Phase 2: ~2 hours (planner type widening + classifier branch + hint variant + 4 unit tests). Light architectural touch, all changes inside `src/lib/chat/planner/` and trivially reviewable.

#### What NOT to do

- Don't try to "fix" `ensureAppProject` to extract slug from `--`-prefixed ids. That hides the LLM error instead of correcting it; the projects table would still get a project with the wrong id (or a duplicate one), creating new edge cases downstream.
- Don't add an LLM-side post-process that rewrites manifests to merge split dirs. That introduces non-determinism in disk state and conflicts with `upsertAppManifest`'s atomic rename.
- Don't expand `PRIMITIVE_MAP` to cover every novel app idea. The map is curated for known patterns; the long tail belongs to the generic compose path (Phase 2).

---

## Net confidence

| Concern | State |
|---|---|
| ComposedAppCard renders for happy-path composes | Verified live, no reload (Weekly Reading List run) |
| ExtensionFallbackCard renders for happy-path scaffolds | Verified live, no reload (Linear plugin scaffold) |
| Demo conversations no longer error on stale model | Verified live (Meridian + 4 others HTTP 200) |
| Fallback chip surfaces correctly | Verified live (3 chips on 3 sequential Meridian turns) |
| Free-form compose ("habit tracker") produces single app dir | **Open** — Phase 1 + Phase 2 plan above |
| Unit tests green | 235/235 across 29 files |
| Diff is bisectable | Yes, 3-commit split documented above |

**Net:** confidence in the smoke + fallback work is HIGH. The remaining limitation has a concrete actionable plan with bounded scope and clear acceptance criteria. Pick it up next session.

---

*End of handoff. Working tree contains 11 changed files + this doc. No untracked beyond the handoff. Commit when ready per the 3-split suggestion above.*
