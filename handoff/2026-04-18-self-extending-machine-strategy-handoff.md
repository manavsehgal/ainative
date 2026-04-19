# Handoff: Self-Extending Machine — M1 SHIPPED, M2 IN PROGRESS (4 of 18 tasks complete)

**Created:** 2026-04-18 (M1 groom)
**Updated:** 2026-04-19 (M1 shipped, Path C race defense shipped, M2 groomed + T1–T4 implemented on main + pushed to origin)
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

This handoff is the resume point for the next session. Read it top to bottom. Headline: **M1 is shipped and on origin. M2 (schedules-as-yaml-registry) is mid-implementation — 4 of 18 tasks complete on `main`, pushed to origin. The next session picks up at Task 5 with a clean working tree.**

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`ideas/self-extending-machine-strategy.md`** — the living strategy doc, gitignored local-only. **Authoritative for decisions D1–D6**. Sections to know: §4 (composition ladder), §5 (plugin primitive spec), §9 (5-milestone roadmap), §10 (non-goals — the post-rollback discipline), §11 (risks + off-ramps).
3. **`features/schedules-as-yaml-registry.md`** — the M2 feature spec (397 lines, groomed 2026-04-19). Authoritative for what M2 ships. Especially §"DB Upsert with State Preservation" — that's the load-bearing section for T7.
4. **`features/primitive-bundle-plugin-kind-5.md`** — M1 feature spec. `status: completed`. Precedent for M2's shape; read if you want context on the M1 verification smoke run.
5. **`.claude/skills/architect/references/tdr-034-kind-5-plugin-loader.md`** — architect TDR codifying the four load-bearing M1 decisions (namespacing, composite-id tables, sync-loader / dynamic-import asymmetry, per-plugin error isolation). M2 inherits all four.
6. **`features/roadmap.md`** → "Self-Extension Platform" section — `primitive-bundle-plugin-kind-5` is `shipped`; `schedules-as-yaml-registry (Milestone 2)` is `planned` and linked.
7. **`features/changelog.md`** top entries — 2026-04-19 grooming + M1 shipped.
8. **`.superpowers/plans/2026-04-19-schedules-as-yaml-registry.md`** — the M2 implementation plan (923 lines, 18 tasks). **Gitignored, local-only.** If you're on the same machine, it's there. If not, regenerate via `superpowers:writing-plans` against `features/schedules-as-yaml-registry.md` — the 18-task shape is also summarized in §"M2 task status" below.

---

## What shipped in the prior sessions

### Session 2026-04-19 part 1 — M1 complete + pushed

25 commits on `main` + 1 handoff update. All now on `origin/main` at head `39242255`. Included:

- Kind 5 plugin loader end-to-end (scan → validate → merge/install per-section under `<plugin-id>/` namespace)
- Three chat tools: `list_plugins`, `reload_plugins`, `reload_plugin`
- Two API routes: `GET /api/plugins`, `POST /api/plugins/reload`
- `finance-pack` dogfood bundle (profile + blueprint + table), auto-seeds on first boot
- 137 tests passing, real `npm run dev` smoke verified zero module-load cycles
- TDR-034 + architect drift heuristic codified

### Session 2026-04-19 part 2 — Path C race defense

- Commit `39242255` — `refactor(plugins): single-statement upsert in installPluginTables` — replaces SELECT+branch with `onConflictDoUpdate`. Preserves `createdAt` on conflict; updates other config fields. New invariant test: "reconciles a row pre-inserted by a concurrent writer." 138 tests passing.
- **The pattern is the template for M2's T7.** T7's state-preservation story is the same `onConflictDoUpdate` idiom, scaled to 14 runtime-state columns instead of 1.

### Session 2026-04-19 part 3 — Path A push

`git push origin main` fast-forwarded `8485017a → 39242255`. 25 M1 commits + Path C now on origin.

**NOT done in Path A:** version bump to `0.14.0`, `SUPPORTED_API_VERSIONS` tightening, `npm publish`. All still pending, tracked under "Deferred Path A" below.

### Session 2026-04-19 part 4 — M2 groom

- `706bd76e` — `docs(strategy): groom Milestone 2 spec — schedules-as-yaml-registry`. 411 lines across new spec (397 lines), roadmap link, changelog entry.

### Session 2026-04-19 part 5 — M2 plan

- `.superpowers/plans/2026-04-19-schedules-as-yaml-registry.md` — 923-line architect-revisable implementation plan. **Gitignored, local-only.**
- 18 tasks, TDD bite-sized, mandatory `npm run dev` smoke at T18
- Architect Refinement 2 (generic `scanBundleSection<T>`) bundled as T2 before the fourth scanner is added
- Architect Refinement 1 (`z.discriminatedUnion`) landed at T3 — de-risks M3 manifest schema
- All project `writing-plans` override sections present: NOT in scope, What already exists, Error & Rescue Registry, smoke-test budget dedicated task

### Session 2026-04-19 part 6 — M2 T1–T4 implementation

Executed via `superpowers:subagent-driven-development` with per-task implementer + spec reviewer + code quality reviewer. All on `main`, all pushed.

| Task | Commit(s) | What it does |
|---|---|---|
| T1 | `714026d9` | `feat(schedules): add getAinativeSchedulesDir path helper` |
| T2 | `1d0ed6a9` + `4b5855f1` | `refactor(plugins): extract generic scanBundleSection<T> helper (architect Refinement 2)` + style fix |
| T3 | `2c023176` + `9e556697` | `feat(schedules): ScheduleSpec discriminated-union Zod schema` + refine-lift refactor |
| T4 | `a627a63c` + `6fdfb78d` + `073240c7` | `feat(schedules): registry skeleton — scan, validate, cache, user CRUD` + style fix + builtin-ids cache perf fix |

All three code-review-driven fix commits addressed real issues: implicit-any on test callbacks, Zod v4 `discriminatedUnion` + `.refine()` fragility, and `isBuiltinSchedule` disk re-scan. Pattern is working; the 2-stage review is earning its keep.

---

## M2 task status — resume at T5

### ✓ Completed (4 of 18)

- **T1** — path helper `getAinativeSchedulesDir()`
- **T2** — generic `scanBundleSection<T>` helper + adapted `scanBundleBlueprints` + `scanBundleTables` (scanner for profiles intentionally left as-is per plan permission; `scanProfilesIntoMap` is directory-scoped not file-scoped)
- **T3** — `ScheduleSpec` Zod `discriminatedUnion` schema + TS types (`scheduled` + `heartbeat` subtypes). `.refine(intervalOrCron)` lifted to union level (Zod v4 fast-path safety). `.strict()` on each member gives free rejection of heartbeat-only-on-scheduled
- **T4** — registry skeleton at `src/lib/schedules/registry.ts`: `getSchedule`, `listSchedules`, `reloadSchedules`, `isBuiltinSchedule`, `createScheduleFromYaml`, `deleteSchedule`, `getUserSchedulesDir`. Parallel `builtinIdsCache: Set<string>` avoids disk re-scan. No DB writes in T4 (T7 owns that). `src/lib/schedules/builtins/` created on disk but empty (git won't track)

### ⏳ Remaining (14 of 18) — pick up here

- **T5** — plugin-injection surface on the registry: `mergePluginSchedules`, `clearPluginSchedules`, `clearAllPluginSchedules`, `listPluginScheduleIds`. Mirror `src/lib/workflows/blueprints/registry.ts` lines 148–177 exactly.
- **T6** — `validateScheduleRefs(spec, { pluginId, siblingProfileIds })` cross-ref validator. **Important:** Uses **dynamic** `await import("@/lib/agents/profiles/registry")` (not static like blueprints). This makes the function `async` and cascades through `loadSinglePlugin` in T10 (which becomes async). The plan explicitly documents an escape hatch to a static import if the async ripple causes trouble — but default is dynamic for TDR-032 defense.
- **T7** — `installSchedulesFromSpecs` state-preserving upsert in new `src/lib/schedules/installer.ts`. **LOAD-BEARING.** Every column explicitly categorized (18+ tests, one per preserved column). Mirrors Path C's `installPluginTables` pattern scaled to 14 state columns.
- **T8** — self-enforcing column-coverage invariant test. Enumerates every column in the Drizzle `schedules` table; fails if a column is in neither CONFIG nor STATE set. Future migration adding a column can't land without an explicit decision. Pattern mirrors `api-version-window.test.ts`.
- **T9** — plugin schedule helpers. Composite id `plugin:<plugin-id>:<schedule-id>`, `(<plugin-id>)` display-name suffix. `installPluginSchedules`, `removePluginSchedules`, `listInstalledPluginScheduleIds`.
- **T10** — wire `scanBundleSchedules` into `loadSinglePlugin`. Uses the T2 generic helper. `LoadedPlugin` gets `schedules: string[]`. `loadSinglePlugin` becomes `async` per T6 cascade.
- **T11** — three chat tools at `src/lib/chat/tools/schedule-spec-tools.ts`: `list_schedule_specs`, `install_schedule_from_yaml`, `reload_schedules`. **Dynamic `await import()` MANDATORY** for the registry import per TDR-032 discipline. Chat-tool count: 84 → 87.
- **T12** — `GET /api/plugins` payload includes `schedules: string[]`. Likely no handler change (the route serializes `listPlugins()` directly); confirm and skip commit if no change.
- **T13** — extend `src/lib/plugins/__tests__/install-path-parity.test.ts` fixture to include `schedules/*.yaml`. Assert parity between npx + git-clone install paths.
- **T14** — finance-pack dogfood `schedules/monthly-close.yaml` referencing `finance-pack/personal-cfo`. Also: confirm the plugin seeder at `src/lib/plugins/seed.ts` copies the `schedules/` subdirectory (it may hard-code `profiles`/`blueprints`/`tables` — extend if so).
- **T15** — boot-order sanity check in `src/instrumentation-node.ts`. Update the ordering invariants comment to explicitly name schedules. Plugin loader MUST run before `startScheduler()`.
- **T16** — full regression suite (extended vitest command). Target ≥170 tests passing, zero skipped.
- **T17** — install-path parity re-verification after T13.
- **T18** — **MANDATORY real `npm run dev` smoke.** Isolated `~/.ainative-smoke-m2` data dir, boot on port 3010, verify finance-pack auto-seed, verify state preservation via SQL round-trip (pause a schedule, set firingCount=17, reload, assert preserved). Record verification run in the feature spec.

### First action for the next session

1. Read this handoff + `features/schedules-as-yaml-registry.md` + (if available) `.superpowers/plans/2026-04-19-schedules-as-yaml-registry.md`.
2. Run `git status && git log --oneline origin/main..HEAD` to confirm state. Expected: clean tree, 0 ahead of origin after this handoff's push.
3. Invoke `superpowers:subagent-driven-development`. Start at T5.

---

## Review learnings from T1–T4 (avoid re-discovery)

These patterns surfaced repeatedly across the 4 tasks' reviews. Bake them in:

1. **`noImplicitAny` fires on every test closure.** `.map(s => ...)`, `parseFile: (f) => ...` etc. all need explicit parameter annotations (`: string`, `: { id: string }`, etc.). Fix is trivial but recurring — consider the convention in the implementer prompt.
2. **Zod v4 `discriminatedUnion` — lift `.refine()` to union level, never to members.** Member-level refine produces `ZodEffects<ZodObject>` which breaks the discriminator fast-path in some Zod v4 minor versions. See commit `9e556697` for the fix.
3. **The TS diagnostic panel is aggressively stale after `Write` on new TS files.** "Cannot find module" appears for seconds to minutes even when the module is on disk and `tsc --noEmit` is clean. **Trust `npx tsc --noEmit` only.** Project memory already notes this but it bites on every new file.
4. **`isBuiltinSchedule`-style functions should cache source-of-entry once at load.** Don't re-scan the disk on every check. Pattern: parallel `Set<string>` populated in `loadAll`, cleared in `reloadX`. See commit `073240c7`. Worth pushing the same fix into `isBuiltinBlueprint` as a follow-up (not M2-blocking).
5. **The plan's regression-test floor counts need to match the vitest-path scope.** T2's "≥137 tests" was for T16's broader 10-path scope, not T2's narrower 4-path scope. Implementer correctly got 106→110 with zero regressions. Don't conflate floor counts across scopes.

---

## The post-rollback scar tissue (still applies, unchanged from prior handoff)

**2026-04-12: 21 commits were rolled back** (Custom App Creation + Marketplace + Trust Ladder + Publish-to-Supabase + PII Sanitizer + App-Extended-Primitives-Tier2 + App-Forking-Remix + Seed-Data-Generation + Embeddable-Install-Widget). See `ideas/rollback-app-marketplace-features.md`.

M1 deliberately did not re-enter rolled-back territory. M2 continues that discipline. When scope creep tries to add any of the following, `ideas/self-extending-machine-strategy.md` §10 is the "we decided against this" reference:

- publishing / marketplace rails
- trust tiers
- PII sanitization pipeline
- Kind 2/3/4 plugins
- new UI routes via plugin
- new DB columns via plugin (M1 + M2 both honor this — M2 rides existing `schedules` table with composite ids)
- orphan writes to `launchCwd` on npx
- feature gating by install method

---

## Deferred Path A — version bump + npm publish

M1 + Path C are on origin but not released. When the user cuts `0.14.0`:

1. `package.json` version `0.13.3` → `0.14.0`
2. Tighten `SUPPORTED_API_VERSIONS` in `src/lib/plugins/registry.ts` — drop `"0.12"`, leaving `["0.14", "0.13"]`. The self-enforcing `api-version-window.test.ts` will catch mistakes.
3. Update the 2026-04-19 `Shipped — primitive-bundle-plugin-kind-5` changelog entry to reference the actual published version.
4. `npm pack` → user runs `npm publish ainative-business-0.14.0.tgz`.
5. Verify `npx ainative-business@0.14.0` in a clean `~/.ainative-test-014/` — observe finance-pack auto-seed.

**When to cut this:** after T18 ships, bump straight to `0.15.0` (new primitive loader surface = minor). Or cut `0.14.0` now and `0.15.0` after M2. User preference.

---

## Don't undo these (regression guards, M1 + M2-in-progress)

A short list of state that is easy to accidentally regress. Each has a test or invariant protecting it.

### From M1 (2026-04-19, all on origin)

- **Dynamic `await import("@/lib/plugins/registry")`** inside `src/lib/chat/tools/plugin-tools.ts` (all three handlers) and inside `src/instrumentation-node.ts`. A static import here triggers TDR-032's module-load cycle. Doc comment at the top of `plugin-tools.ts` explicitly warns. T18 smoke is the only catcher.
- **`(<plugin-id>)` name suffix in `installPluginTables`** — plugin rows carry the suffix to disambiguate from builtin-name collisions. M2's `installPluginSchedules` (T9) inherits the same rule.
- **`lastLoadedPluginIds` tracker** in `src/lib/plugins/registry.ts`. Without it, reloads leak stale rows across the cache-null gap.
- **Boot-order ordering invariants comment** in `src/instrumentation-node.ts`. Plugin loader AFTER migrations, BEFORE `startScheduler()` / `startChannelPoller()`. M2 T15 tightens this comment to name schedules explicitly — if it goes missing, a future change could silently break plugin-shipped schedules.
- **The 6-line comment above `import { getProfile }`** in `src/lib/workflows/blueprints/registry.ts` — flags why the static import is safe. Without it, `/architect drift detection` will flag it as a TDR-032 violation.
- **Self-enforcing `api-version-window.test.ts`** — reads `package.json` and asserts current + previous MINOR are in `SUPPORTED_API_VERSIONS`.

### From Path C (2026-04-19)

- **Single-statement `onConflictDoUpdate` in `installPluginTables`** — race-safe under multi-process WAL. `.set()` clause omits `createdAt` to preserve it. Regression test: `plugin-tables.test.ts` → "reconciles a row pre-inserted by a concurrent writer."

### From M2 in-progress (T1–T4, 2026-04-19)

- **`scanBundleSection<T>` helper** in `src/lib/plugins/registry.ts`. Three M1 scanners (blueprints, tables + soon schedules in T10) delegate to it. If someone un-refactors, the M2 plan's T10 adapter would have to duplicate file-walk logic. Comment in registry.ts explains why `scanBundleProfiles` is the one exception (directory-scoped, not file-scoped).
- **`.refine(intervalOrCron)` at the union level in `schedule-spec.ts`** — NOT on union members. If someone "refactors" it back to member-level, Zod v4 fast-path dispatch degrades and may throw at parse time in some minor versions. Comment in the file explains.
- **`.strict()` on both `scheduled` and `heartbeat` schema members** — load-bearing for the test case "heartbeat-only field on scheduled → rejected." Without `.strict()`, the rejection is structurally impossible.
- **`builtinIdsCache: Set<string>`** in `src/lib/schedules/registry.ts`. Without it, `isBuiltinSchedule` re-scans disk on every invocation. Empty-dir no-op in v1, but silently becomes O(n-disk-reads) once M3+ adds builtins.

### From earlier sessions (preserved through M1 + M2)

- The npx `.env.local` precedence inversion (0.13.2 — `bin/cli.ts` lines 36–76). Covered by `src/lib/__tests__/cli-env-local.test.ts`.
- The first-run auto-writer in `bin/cli.ts` (0.13.2, same region).
- The `skippedReason: "no_git"` branch in `src/app/api/instance/config/route.ts` (0.13.3).

If any of those tests disappear, flag it immediately.

---

## Open decisions deferred to future sessions

From M1 + M2 grooms:

- **TypeScript authoring for Kind 1 plugins** (M3 concern).
- **Plugin dependency deduplication** (revisit when `~/.ainative/plugins/` aggregate size is a complaint).
- **Plugin discovery in chat command palette** (sixth "Plugins" category vs. interleave into Create + Automate).
- **`--safe-mode` runtime toggle** — M3 CLI flag vs. Settings toggle.
- **PE-portfolio persona** (Phase 2).
- **Table-name collision dedup in `seedTableTemplates()`** — tighten to `id NOT LIKE 'plugin:%'` defensively.
- **True targeted reload performance** — cache `bundleId → rootDir` in `reloadPlugin(id)`.
- **`isBuiltinBlueprint` mirror optimization** — blueprints re-resolve via cached `isBuiltin` boolean already; schedules now uses a parallel Set. Different patterns; consider unifying.
- **Plan-file distribution** — `.superpowers/plans/*` is gitignored, so the M2 plan doesn't travel in the repo. For long-lived plans, consider check-in under `features/plans/` or equivalent.

None block M2 or M3.

---

## Environment state at handoff time

- **Branch:** `main`, clean working tree.
- **HEAD:** `073240c7` before this handoff; **after this commit:** will be 1-ahead, pushed to origin immediately.
- **Tests (last run):** 110/110 in the T1–T4 scope; 138/138 in the broader M1 + Path C scope. `npx tsc --noEmit` clean.
- **`package.json` version:** still `0.13.3`. Deferred Path A.
- **`SUPPORTED_API_VERSIONS`:** `["0.14", "0.13", "0.12"]` — bridge value still, tighten at 0.14.0 release.
- **Smoke data dirs:** `~/.ainative-smoke-plugins-m1` from M1 T18 still in place. `~/.ainative-smoke-m2` will be created at M2 T18.
- **Dev server:** not running.

---

## Who to talk to if stuck

- **For architecture** on plugin primitives or future kinds: re-invoke `/architect`. `ideas/self-extending-machine-strategy.md` §5 + TDR-034 are the canonical refs.
- **For UX** on `/apps`, schedule pickers, install-path surfacing: re-invoke `/frontend-designer`.
- **For scope / priority / sequencing**: re-invoke `/product-manager` with explicit reference to strategy doc §9 (roadmap) and §10 (non-goals). Use Ship Verification mode to audit M2 before marking `completed`.
- **For security** on Kind 1 (M3): Claude Code + Codex CLI's MCP server trust model is the reference pattern. We do not sandbox; we document + gate on user click-accept.

---

*End of handoff. M1 is shipped + on origin. Path C race defense is shipped + on origin. M2 is 4 of 18 tasks in + all pushed. Resume at Task 5: plugin-injection surface on `src/lib/schedules/registry.ts`. The strategy is intact; the rollback discipline holds.*
