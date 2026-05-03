# Handoff: `onboarding-runtime-provider-choice` shipped — last P2 closed; only 2 P3 specs remain

**Created:** 2026-05-03 (build session — `onboarding-runtime-provider-choice`)
**Status:** Working tree has uncommitted edits across spec, roadmap, changelog, helpers.ts, route.ts, layout.tsx, chat-settings-section.tsx, two new components under onboarding/, two new test files, and HANDOFF.md (12 files). Ready to commit. Roadmap status now: 209 completed / 27 deferred / 2 planned / 4 in-progress / 5 non-spec docs.
**Predecessor:** previous handoff was the `task-turn-observability` build session (committed in `3a971be9`).

---

## TL;DR for the next agent

1. **`onboarding-runtime-provider-choice` was a real build session.** Verification took ~10 minutes and confirmed real gaps — `modelPreference` did not exist anywhere in the codebase. The bidirectional-staleness pattern *did not* hit this time, but verifying first was still cheap. Sixth consecutive session benefiting from the verify-first playbook.

2. **No P1, no P2 left.** With this ship, the planned roster is **2 specs, both P3:**

   | Spec | Priority | Notes |
   |---|---|---|
   | `chat-conversation-branches` | P3 | Focused chat-runtime change. |
   | `composed-app-manifest-authoring-tools` | P3 | "Momentum" alternative across multiple handoffs. Has been deferred at least 3 times. |

   **Recommended order:** Start with `composed-app-manifest-authoring-tools` since it's been deferred multiple times and is the heavier piece. `chat-conversation-branches` is more focused and could be tackled as a quick chaser. Both are P3 — momentum and energy levels matter more than priority sequencing here.

   **Per the bidirectional-staleness pattern (5 of 6 recent sessions hit it):** grep for spec-referenced symbols, files, and DB columns BEFORE treating either spec as buildable. The pattern still applies even with no P1/P2 backlog — `composed-app-*` in particular has been brainstormed multiple times and may have partial machinery already shipped.

3. **Outstanding gap-closure work (not blocking, trackable):**
   - `direct-runtime-prompt-caching` (in-progress) — needs ledger persistence + cost-dashboard cache hit-rate UI + Batch API for meta-completions.
   - `direct-runtime-advanced-capabilities` (in-progress) — context compaction, `/v1/models` discovery, and Anthropic server-tool toggles.
   - `upgrade-session` (in-progress) — dedicated session-sheet UI, upgrade history list, abort confirmation, dev-server restart banner.
   - `composed-app-auto-inference-hardening` (in-progress) — 4 deferred ACs gated on first reported kit misfire.

4. **CLAUDE.md runtime-registry smoke gate not triggered this session** — the changes added new fields to existing route handlers, two new client components, and new typed helpers. Zero imports added/removed/reshaped under `src/lib/agents/runtime/` or `claude-agent.ts`. Pure UI + settings persistence. Same precedent as the prior task-turn-observability handoff.

5. **Latent bug fixed in passing.** The original `/api/settings/chat` PUT validator rejected anything not in `CHAT_MODELS`, which silently broke any user picking an Ollama model from the existing chat-settings-section dropdown (Ollama models live under the `ollama:*` namespace). Added `validOllamaModel = body.defaultModel.startsWith("ollama:")` allowance. Documented as DD-5 in the spec. Worth flagging in case the user wants to grep for similar latent-validator bugs in other settings routes.

---

## What landed this session

Uncommitted in working tree (12 files):

- `features/onboarding-runtime-provider-choice.md` — `status: planned` → `status: completed`, `shipped-date: 2026-05-03`. All 8 ACs checked with file:line evidence + Verification section + 5 Design Decisions added.
- `features/roadmap.md` — `onboarding-runtime-provider-choice` row flipped `planned` → `completed`.
- `features/changelog.md` — prepended top-level entry with implementation summary, file:line evidence, verification numbers, and DD summaries. Roadmap impact noted: P1=0, P2=0.
- `src/lib/settings/helpers.ts` — added `ModelPreference` type, `getModelPreference`, `setModelPreference`, `hasSeenModelPreferencePrompt`. Empty-string skip marker convention documented inline.
- `src/app/api/settings/chat/route.ts` — extended GET to return `{ defaultModel, defaultModelRecorded, modelPreference }`; PUT independently accepts each field. Added `ollama:*` model-id allowance.
- `src/components/onboarding/runtime-preference-modal.tsx` — new component. 4-option Dialog with capability notes, Skip path, Ollama discovery fallback, refuses outside-click close.
- `src/components/onboarding/runtime-preference-bootstrapper.tsx` — new component. Single GET on mount; opens modal only when `!defaultModelRecorded && modelPreference == null`.
- `src/app/layout.tsx` — mounted `RuntimePreferenceBootstrapper` inside the `ChatSessionProvider` tree, alongside `GlobalShortcuts`.
- `src/components/settings/chat-settings-section.tsx` — added "Model preference" Select alongside the existing "Default Model" Select with independent onChange handlers.
- `src/lib/settings/__tests__/model-preference.test.ts` — 10 new unit tests using a Map-backed `@/lib/db` mock.
- `src/components/onboarding/__tests__/runtime-preference-modal.test.tsx` — 7 new tests using `fetchOllamaModels` + `persistChoice` injection overrides.
- `HANDOFF.md` — this file.

### Net effect on roadmap

| Status | Before | After |
|---|---|---|
| completed | 208 | 209 |
| planned | 3 | 2 |

(in-progress, deferred, non-spec all unchanged. P1 planned: 0. P2 planned: 0. P3 planned: 2.)

### Test surface verified

- `npx vitest run src/lib/settings src/components/onboarding src/components/settings/__tests__` — **60/60 pass across 10 files** (10 new + 7 new + 43 existing).
- `npx vitest run src/components/chat/__tests__/chat-session-provider.test.tsx` — **6/6 pass** (no regression from new GET shape — provider only reads `data.defaultModel`).
- `npx vitest run src/lib/instance/__tests__/settings.test.ts src/lib/chat/tools/__tests__/settings-tools.test.ts` — **36/36 pass**.
- `npx tsc --noEmit` — **clean project-wide** (zero errors).

---

## Patterns reinforced this session

- **Empty-string skip marker** — the existence of a row in the settings k/v table can encode "user has been asked at least once," even when the coerced value is null. Lets the bootstrapper distinguish "never asked" from "asked and skipped" without a separate boolean column. Documented in `helpers.ts` JSDoc + DD-3 in spec. Reusable pattern for any future "has user been prompted?" feature.

- **Injection overrides for testability** — the modal accepts `fetchOllamaModels` and `persistChoice` as optional props with production defaults. Tests inject mocks; production omits and gets the real fetches. Cleaner than mocking `global.fetch` for component tests, especially when the component already has internal state machinery to test.

- **Map-backed `@/lib/db` mock for typed-helper tests** — at `src/lib/settings/__tests__/model-preference.test.ts`. Lighter than the heavily-mocked-chains pattern in `auth.test.ts`. Works because the typed helpers (`getModelPreference`/`setModelPreference`) are thin coerce-and-call wrappers over `getSetting`/`setSetting` — testing with a real-ish in-memory store gives end-to-end coverage of the wrapper logic. Pattern is reusable for other future typed-setting helpers.

- **Verification first, even when handoff says "build"** — the previous handoff explicitly framed this as a "real build session" rather than Ship Verification, but I still ran a 10-minute verification round (`rg modelPreference`, `rg DEFAULT_CHAT_MODEL`, `ls src/components/onboarding/`) before designing. Cost: 10 min. Benefit: confirmed scope was greenfield and no half-shipped machinery existed; saved scope creep. Sixth consecutive session benefiting from verify-first.

- **Spec-faithful design decisions even when ambiguous** — DD-1 (privacy fallback persists `preference: "privacy"` despite operating model being sonnet) is one of those "neither answer is wrong" calls. I documented the rejected alternative in the design decision so future agents can see the reasoning if a user reports the mismatch as a bug. Worth doing for any non-obvious choice.

---

## How to commit this session's work

```
git add features/onboarding-runtime-provider-choice.md \
        features/roadmap.md \
        features/changelog.md \
        src/lib/settings/helpers.ts \
        src/app/api/settings/chat/route.ts \
        src/components/onboarding/runtime-preference-modal.tsx \
        src/components/onboarding/runtime-preference-bootstrapper.tsx \
        src/app/layout.tsx \
        src/components/settings/chat-settings-section.tsx \
        src/lib/settings/__tests__/model-preference.test.ts \
        src/components/onboarding/__tests__/runtime-preference-modal.test.tsx \
        HANDOFF.md
git commit -m "feat(onboarding): ship onboarding-runtime-provider-choice (P2 close)"
```

Single commit captures the full close-out — typed helpers + route extension + modal + bootstrapper + layout wiring + settings UI + tests + spec/roadmap/changelog/handoff docs. Per CLAUDE.md commit style: `feat(onboarding)` is correct because the user-visible change is a new first-launch onboarding step.

---

*End of handoff. Next move: pick one of the two remaining P3 specs (recommend `composed-app-manifest-authoring-tools` for momentum). Bidirectional-staleness grep first.*
