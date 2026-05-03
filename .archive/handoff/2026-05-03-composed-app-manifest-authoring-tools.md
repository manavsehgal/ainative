# Handoff: `composed-app-manifest-authoring-tools` shipped — only 1 P3 spec remains

**Created:** 2026-05-03 (build session — `composed-app-manifest-authoring-tools`)
**Status:** Working tree has uncommitted edits across spec, roadmap, changelog, registry.ts, ainative-tools.ts, engine.ts, ainative-app SKILL.md, plus 4 new files (app-view-tools.ts + view-editing-hint.ts + app-view-editor-card.tsx + bootstrapper) and 4 new test files. 13 files total. Ready to commit.
**Predecessor:** previous handoff was the `onboarding-runtime-provider-choice` build session (committed in `996a727c`, pushed to `origin/main`).

---

## TL;DR for the next agent

1. **Real build session, ~9 of 10 ACs shipped.** AC #7 ("Apply via chat" affordance from the diagnostics page) deferred because the diagnostics page belongs to `composed-app-auto-inference-hardening` which is `status: in-progress` (one of the 4 deferred ACs on that spec). Cannot wire what doesn't exist. Documented as a follow-up; will be picked up when the diagnostics page lands.

2. **Net-new spec roster is at its smallest in months — only 1 P3 left:**

   | Spec | Priority | Notes |
   |---|---|---|
   | `chat-conversation-branches` | P3 | Focused chat-runtime change. The last fully-planned spec in the backlog. |

   **Recommended next:** Start with bidirectional-staleness grep (still 6 of 7 recent sessions hit it). If it turns out to be already shipped or partly built, close it out fast. If it's genuinely planned, it's a contained chat-data-layer change.

3. **After `chat-conversation-branches` ships, the roster shifts to in-progress closeouts.** Per the prior handoff, 4 in-progress features have outstanding gap-closure work:
   - `direct-runtime-prompt-caching` — needs ledger persistence + cost-dashboard cache hit-rate UI + Batch API for meta-completions.
   - `direct-runtime-advanced-capabilities` — context compaction, `/v1/models` discovery, and Anthropic server-tool toggles.
   - `upgrade-session` — dedicated session-sheet UI, upgrade history list, abort confirmation, dev-server restart banner.
   - `composed-app-auto-inference-hardening` — 4 deferred ACs gated on first reported kit misfire (the diagnostics page that AC #7 of THIS session was waiting on lives here).

   Plus a small one I noticed mid-session:
   - **Roadmap drift on `composed-app-auto-inference-hardening`**: spec frontmatter says `status: in-progress` but the roadmap row says `planned`. Worth flipping next session for consistency. Not done this session because the focus was on the new spec; the drift doesn't affect functionality.

4. **CLAUDE.md runtime-registry smoke gate not triggered this session** — chat tools register through the existing `defineTool` pattern via `ainative-tools.ts:71` (one-line addition to `collectAllTools`). No imports added/removed under `src/lib/agents/runtime/` or `claude-agent.ts`. Same precedent as the previous two sessions.

5. **Two follow-ups worth tracking** (both deferred from this session, both honest):
   - **AppViewEditorCard chat-message.tsx auto-render** — the card is built and tested standalone, but engine.ts doesn't yet detect a successful `set_app_view_*` tool call and populate chat metadata to auto-mount the card. The existing `composedApp` and `extensionFallback` metadata paths are precedents — adding `viewEditor` is a small engine.ts change. Per DD-1, the LLM can already call the tools directly without the card; the card is reusable for any future surface.
   - **Latent stale baselines in older specs** — this session's spec said "chat-tool count goes from 92 → 95" but the actual baseline before my work was 97. The +3 still applies. Worth a project-wide grep on other planned specs that hard-code counts; 3 of the 4 in-progress features above might also have stale numbers.

---

## What landed this session

Uncommitted in working tree (13 files):

- `features/composed-app-manifest-authoring-tools.md` — `status: planned` → `status: completed`, `shipped-date: 2026-05-03`. 9 of 10 ACs checked with file:line evidence; AC #7 marked deferred with rationale + 6 Design Decisions appended.
- `features/roadmap.md` — `composed-app-manifest-authoring-tools` row flipped `planned` → `completed`.
- `features/changelog.md` — prepended top-level entry with implementation summary, file:line evidence, verification numbers, DD summaries, and a Deferral section. Roadmap impact noted: P1=0, P2=0, P3=1.
- `src/lib/apps/registry.ts` — added `writeAppManifest(id, manifest, appsDir?)` between `getApp` and `deleteApp`. Atomic via temp-file + renameSync; cleans up `.tmp` on rename failure; calls `invalidateAppsCache` on success; validates via strict `AppManifestSchema.parse` before any disk write.
- `src/lib/chat/tools/app-view-tools.ts` — new file, 3 `defineTool` calls. Reuses `KitIdSchema` / `ViewSchema.shape.bindings` / `KpiSpecSchema` directly so future schema rotations propagate. Mutation tools replace-not-merge; preserves unrelated view fields.
- `src/lib/chat/ainative-tools.ts` — added `import { appViewTools }` and `...appViewTools(ctx)` in `collectAllTools`. Total chat tools now 100 (97 → 100).
- `src/lib/chat/planner/view-editing-hint.ts` — new file. `detectViewEditingIntent` (regex classifier with most-specific-wins precedence) + `buildViewEditingHint` (short prose nudge). Tolerant of false positives by design.
- `src/lib/chat/engine.ts` — wired `detectViewEditingIntent` + `buildViewEditingHint` parallel to the existing `buildCompositionHint` injection.
- `src/components/chat/app-view-editor-card.tsx` — new file. 5 visual states (idle/pending/applied/cancelled/failed), double-click guard during pending, inline error on confirm-throw.
- `src/lib/apps/__tests__/write-app-manifest.test.ts` — 5 tests pinning the atomic-write contract.
- `src/lib/chat/tools/__tests__/app-view-tools.test.ts` — 6 tests on the 3 chat tools (happy path + missing app + bindings-preservation + kit-preservation + kpis-merge + kpis-bound).
- `src/lib/chat/planner/__tests__/view-editing-hint.test.ts` — 13 tests on the classifier (5 detect cases, 6 hint-shape cases, plus the AC #8 worked-example pinning).
- `src/components/chat/__tests__/app-view-editor-card.test.tsx` — 7 tests on the card (3 render shapes, confirm/cancel, error-on-throw, double-click guard).
- `.claude/skills/ainative-app/SKILL.md` — appended a "View-Editing (override auto-inferred layout)" section.
- `HANDOFF.md` — this file.

### Net effect on roadmap

| Status | Before | After |
|---|---|---|
| completed | 209 | 210 |
| planned | 2 | 1 |

(in-progress, deferred, non-spec all unchanged. P1 planned: 0. P2 planned: 0. P3 planned: 1.)

### Test surface verified

- `npx vitest run src/lib/apps src/lib/chat src/components/chat` — **656/657 pass across 70 files** (1 pre-existing skip; 31 new tests across 4 new test files).
- `npx tsc --noEmit` — **clean project-wide** (zero errors). Pre-existing `.passthrough()` deprecation warnings on registry.ts not introduced by this session.

---

## Patterns reinforced this session

- **Atomic write helper as a registry concern, not a tool concern.** `writeAppManifest` lives next to `getApp` so any caller — chat tool, CLI, settings UI, plugin — gets the same atomic guarantees without re-implementing temp-file + rename. The 3 chat tools are thin wrappers over it. If a future tool/route needs to mutate manifests, it gets atomicity for free.

- **Zod sub-schema reuse via `Schema.shape.field`.** `ViewSchema.shape.bindings` passed directly to `defineTool` keeps the chat-tool input shape in lock-step with the strict view schema. If the schema rotates (e.g., a new BindingRefSchema variant), the tool inherits the change with zero edit. Pattern is reusable for any chat tool that mutates a known-strict object slice.

- **Most-specific-wins classification for layered intents.** When a single message can match multiple intent categories (kit / bindings / kpis), the classifier returns the most-specific category that matched. Documented as DD-4 + pinned by a test. Pattern transfers to any future intent classifier with overlapping vocabularies.

- **Replace-not-merge for whole-object mutation.** The bindings and kpis tools replace the entire object/array, not patch fields. The hint reminds the LLM to "pass the COMPLETE object". Avoids partial-mutation surprises for the user. Pattern is appropriate for any tool whose schema is small enough that the LLM can reliably reproduce the full state. Big nested schemas would warrant a deep-merge instead.

- **Build the standalone, defer the integration when honest.** The AppViewEditorCard is fully built and tested but the chat-message.tsx auto-render integration is deferred. Documented as DD-1 with the rationale. The card is reusable for any future surface (settings UI, app detail page); the auto-render is sugar that costs engine.ts metadata-path work. Per project principle #7 ("Permission to scrap"), it's appropriate to ship the standalone now and wire the integration when there's a stronger user case for it.

- **Stale baselines in older specs.** This spec said "92 → 95" — the actual baseline was 97 (now 100). Worth a project-wide audit before the next planned spec gets started; 3 of the 4 in-progress features may also have hard-coded counts that have drifted.

---

## How to commit this session's work

```
git add features/composed-app-manifest-authoring-tools.md \
        features/roadmap.md \
        features/changelog.md \
        src/lib/apps/registry.ts \
        src/lib/chat/tools/app-view-tools.ts \
        src/lib/chat/ainative-tools.ts \
        src/lib/chat/planner/view-editing-hint.ts \
        src/lib/chat/engine.ts \
        src/components/chat/app-view-editor-card.tsx \
        src/lib/apps/__tests__/write-app-manifest.test.ts \
        src/lib/chat/tools/__tests__/app-view-tools.test.ts \
        src/lib/chat/planner/__tests__/view-editing-hint.test.ts \
        src/components/chat/__tests__/app-view-editor-card.test.tsx \
        .claude/skills/ainative-app/SKILL.md \
        HANDOFF.md \
        .archive/handoff/2026-05-03-onboarding-runtime-provider-choice.md
git commit -m "feat(apps): ship composed-app-manifest-authoring-tools (P3 close)"
```

Single commit captures the full close-out — registry helper + 3 chat tools + planner hint + card + skill doc + 4 test files + spec/roadmap/changelog/handoff. Per CLAUDE.md commit style: `feat(apps)` is correct because the user-visible change is 3 new chat tools that mutate composed-app manifests.

---

*End of handoff. Next move: bidirectional-staleness grep on `chat-conversation-branches` (the last planned P3). If it's already partly shipped, close out fast; otherwise build the chat-data-layer change.*
