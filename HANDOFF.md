# Handoff: `profile-runtime-default-resolution` shipped — pick the next feature

**Created:** 2026-05-02 (profile-runtime-default-resolution implementation session)
**Status:** Fully shipped. End-to-end browser smoke confirmed the synthesizer, registry wiring, and task execution completed without error. Working tree clean after this commit lands.
**Predecessor:** `.archive/handoff/2026-05-02-profile-runtime-default-resolution-pre-shipped-handoff.md` (the Phase 5 shipped handoff this one supersedes)

---

## TL;DR for the next agent (or interactive session)

1. **`profile-runtime-default-resolution` is shipped.** The `cs-coach` profile (and any other profile referenced inline in an app manifest without a corresponding `profile.yaml`) now synthesizes automatically via `loadAppManifestProfiles()`. The synthesized entry carries `supportedRuntimes: [all 5]`, so the execution-target resolver picks up the configured runtime without a `NoCompatibleRuntimeError`. Row-triggered tasks now reach `status=completed` end-to-end.

2. **Pick the next feature.** In priority order:
   - **`composed-app-auto-inference-hardening`** — tightens `pickKit`'s 7-rule decision table against ambiguous edge cases. Lower priority since current heuristic works for all 5 seeded apps.
   - **`document-output-generation`** — roadmap item: generate documents (PDF/DOCX) as outputs from workflow tasks. See `features/roadmap.md`.
   - **`multi-agent-swarm`** — roadmap item: concurrent agent execution with aggregation.

3. **Lessons worth carrying forward** — see "Patterns to remember" below.

---

## What landed this session

5 commits (4 feature + 1 fix):

```
90aa707b  feat(profiles): synthesize profiles from app-manifest inline refs (Task 1)
57fb3726  fix(profiles): spread SUPPORTED_AGENT_RUNTIMES into mutable array (Task 1 follow-up)
a476c857  test(profiles): edge cases for app-manifest synthesizer (Task 2)
31321eb8  feat(profiles): wire app-manifest synthesizer into profile registry (Task 3)
f7a66b75  feat(runtime): NoCompatibleRuntimeError names profile + runtime gap (Task 4)
```

Pre-feature planning commits (already on main before this session):
```
e9cc6d20  docs(specs): profile-runtime-default-resolution design
ca23f59c  docs(plans): profile-runtime-default-resolution implementation plan
```

---

## What shipped (code)

- **`src/lib/agents/profiles/app-manifest-source.ts`** — new module. `loadAppManifestProfiles(appsDir, profilesDir, builtinsDir)` scans `<appsDir>/*/manifest.yaml`, extracts `agentProfile` refs from `blueprints[].agentProfile`, checks that the id isn't already covered by an on-disk profile (profilesDir or builtinsDir), and synthesizes an in-memory `AgentProfile` with permissive defaults (`supportedRuntimes: SUPPORTED_AGENT_RUNTIMES`, `domain: "work"`, `tags: [appId]`, `origin: "import"`, `readOnly: true`, `skillMd: ""`, `systemPrompt: description`).
- **`src/lib/agents/profiles/index.ts`** — `scanProfiles()` now calls `loadAppManifestProfiles()` first and then overlays file-based profiles (Map last-write-wins), so on-disk profiles shadow synthesized ones at equal id. Cache signature extended: `getSkillsDirectorySignature()` fingerprints `<appsDir>/*/manifest.yaml` mtimes so app mutations auto-invalidate the profile cache.
- **`src/lib/agents/runtime/execution-target.ts`** — both throw sites for `NoCompatibleRuntimeError` now produce a message naming the profile id, its `supportedRuntimes`, and the configured runtimes list. Operators can diagnose the gap from logs alone without reading source code.
- **11 unit tests** in `src/lib/agents/profiles/__tests__/app-manifest-source.test.ts` covering: no apps dir, empty apps dir, manifest without blueprints, manifest without agentProfile field, profile already on disk (skipped), synthesis correctness, multiple apps, multiple blueprints, duplicate ids deduplicated, missing manifest.yaml in subdir.

---

## Verification run — 2026-05-02

Dev server `PORT=3010 npm run dev`, fresh restart after all 5 feature commits. Cold start: no `ReferenceError: Cannot access 'claudeRuntimeAdapter'` (TDR-032 module-load cycle absent).

Smoke flow:
1. `GET /api/profiles` — returned `cs-coach` with `origin: "import"`, `tags: ["customer-follow-up-drafter"]`, `supportedRuntimes: [all 5]`. Synthesizer registered ✅
2. `POST /api/tables/customer-touchpoints/rows` with `{customer: "Smoke Test Co", summary: "Smoke verification of profile-runtime-default-resolution", sentiment: "neutral", channel: "email"}`. Returned row id `d77d9ace-5fa2-41ae-b5e8-020be8c3d3a5` ✅
3. Workflow `4991db0c-77e2-479e-8815-9628bdc3417c` (active) created with `_contextRowId = d77d9ace-...` ✅
4. Task `ac895f80-4bbd-4180-bf86-3b693c0691cf` created with `agent_profile=cs-coach`, `effective_runtime_id=claude-code` ✅
5. Task settled to `status=completed`, `failure_reason=(none)` ✅ — first time the full row-trigger chain completes without error.
6. Dev log scan for `ReferenceError|TypeError|cannot|Cannot access|claudeRuntimeAdapter|NoCompatibleRuntime` → 0 matches ✅

**Critical CLAUDE.md rule check** (profiles/index.ts touches the registry, which is runtime-registry-adjacent): NO `ReferenceError` in cold start. The dynamic-import pattern for engine.ts from the dispatcher (shipped in Phase 5) was already in place; this feature only touches the profile registry, not the agent or engine modules. Zero new module-load cycle risk.

Screenshots: Not captured — DB-level verification was the authoritative signal. No `output/*.png` artifacts.

---

## Unit test suite results — 2026-05-02

- **1947 passed, 7 failed, 13 skipped** across 254 test files.
- All 7 failures are pre-existing, unrelated to this feature:
  - `src/__tests__/e2e/blueprint.test.ts` — e2e test requiring live network, pre-existing
  - `src/lib/agents/__tests__/router.test.ts` — 6 failures, pre-existing (mock shape mismatch)
  - `src/lib/validators/__tests__/settings.test.ts` — 1 failure, pre-existing (default value assertion)
- Zero regressions from Tasks 1–4.

---

## Type-check — 2026-05-02

`npx tsc --noEmit` produced no output (exit 0). Clean.

---

## Patterns to remember (this session's additions)

- **Synthesizer module pattern for bridging registries.** When a registry's consumers reference an id that only exists in a sibling registry (here: agent profiles referenced in app manifests), the cleanest fix is a synthesizer module that reads the sibling registry and emits synthetic entries at lowest precedence — not a fallback inside the consumer, not a join query. The synthesizer is independently testable, the precedence is explicit via Map ordering, and the consumer (execution-target.ts) remains unmodified.
- **`SUPPORTED_AGENT_RUNTIMES` is a `readonly` tuple.** Assigning it directly to `supportedRuntimes: [...]` (which Drizzle / Zod expects as a mutable array) causes a TypeScript error. Fix: `[...SUPPORTED_AGENT_RUNTIMES]` spread. Caught immediately by tsc; pattern applies to any const-asserted array used as a mutable field.
- **Named error messages at throw sites pay off fast.** Adding the profile id, `supportedRuntimes`, and configured runtimes to `NoCompatibleRuntimeError` took 3 lines of code. During smoke, the operator (here: the plan agent) could confirm from the log message alone that `cs-coach` was missing from the registry — no source-code dive needed. Name your errors with context, not just a generic label.
- **Cache invalidation must include all inputs.** The profile cache was keyed on profiles-dir and builtins-dir mtimes but not app-manifest mtimes. Without fingerprinting `<appsDir>/*/manifest.yaml`, adding a new app manifest wouldn't evict the synthesized-profiles cache. Extended `getSkillsDirectorySignature()` to include manifest glob mtimes. Lesson: when a function's output depends on N input sources, the cache key must cover all N.

---

## Carried-forward gaps (acknowledged, not blocking)

1. **`composed-app-auto-inference-hardening`** — `pickKit`'s 7-rule decision table is untested against ambiguous edge cases. Lower priority since current heuristic works for all 5 seeded apps.
2. **Tables UI `user_tables.column_schema` JSON** — Phase 4's smoke fixture left this denormalized column empty. Manually populated for Phase 5 smoke. Future smoke-fixture refactor: keep both `user_table_columns` rows and the JSON in sync via a shared seed helper.
3. **Multi-step Inbox loader** — pre-existing from Phase 4. Current `LIMIT 1 + JOIN documents` works fine for single-step blueprints. If multi-step row-triggered blueprints become common, the loader needs `ORDER BY` tightening.
4. **Smoke row cleanup** — `d77d9ace-5fa2-41ae-b5e8-020be8c3d3a5` (this session's smoke row) and `b5ad153a-9e3a-4eb8-9415-721865daec68` (Phase 5's Delta Industries row) remain in the DB. Optional cleanup:
   ```bash
   sqlite3 ~/.ainative/ainative.db "DELETE FROM user_table_rows WHERE id IN ('d77d9ace-5fa2-41ae-b5e8-020be8c3d3a5', 'b5ad153a-9e3a-4eb8-9415-721865daec68');"
   ```

---

*End of handoff. Next move: pick `composed-app-auto-inference-hardening` for a polish pass, or advance to `document-output-generation` / `multi-agent-swarm` from the roadmap.*
