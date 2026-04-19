# Handoff: Self-Extending Machine — Milestone 1 SHIPPED → Next Steps

**Created:** 2026-04-18 (groomed M1 spec)
**Updated:** 2026-04-19 (M1 implementation shipped on `main`, 25 commits ahead of origin)
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

This handoff is the resume point for the next session. Read it top-to-bottom before doing anything else. The headline change since 2026-04-18: **Milestone 1 is fully shipped on `main` and unpushed.** The next session picks up from a clean working tree, ready to push, release 0.14.0, and groom Milestone 2.

---

## Read these first, in order

1. **This handoff** — you're here.
2. **`ideas/self-extending-machine-strategy.md`** — the living strategy doc, gitignored local-only. **Authoritative for decisions D1–D6**. Sections to know: §4 (composition ladder), §5 (plugin primitive spec), §9 (5-milestone roadmap), §10 (non-goals — the post-rollback discipline), §11 (risks + off-ramps).
3. **`features/primitive-bundle-plugin-kind-5.md`** — Milestone 1 feature spec. Status: `completed` (was `planned` 2026-04-18). Includes a "Verification run — 2026-04-19" section recording the real `npm run dev` smoke that confirmed zero TDR-032 cycle errors.
4. **`.claude/skills/architect/references/tdr-034-kind-5-plugin-loader.md`** — the architect TDR codifying the four load-bearing decisions from the M1 implementation: namespacing convention, composite-id table strategy, sync-loader/dynamic-import asymmetry, per-plugin error isolation.
5. **`features/architect-report.md`** — pre-implementation plan-vs-spec divergence audit. Useful for understanding why M1 deviated from the original spec in three places (apiVersion window, sync validateBlueprintRefs, composite-id tables).
6. **`features/roadmap.md`** → "Self-Extension Platform" section — `primitive-bundle-plugin-kind-5` row now `shipped`; M2–M5 still `planned`.
7. **`features/changelog.md`** top entry (2026-04-19, *Shipped — primitive-bundle-plugin-kind-5*) — concrete summary of what landed.
8. **`.superpowers/plans/2026-04-18-primitive-bundle-plugin-kind-5.md`** — the executed implementation plan (gitignored, local-only). 21 tasks, 137 tests passing. Includes the architect-revision delta documenting the changes applied between groom and ship.

---

## What shipped in the previous session — Milestone 1 in full

### 25 commits on `main`, unpushed (`ec2ab928` → `5cec5940`)

Headline: **a fully working Kind 5 plugin loader, end-to-end** — directory scan, manifest validation, per-bundle error isolation, profile/blueprint/table integration with namespacing, three new chat tools, two API routes, dogfood `finance-pack` bundle that auto-seeds on first boot, install-path parity, real-server smoke verified zero module-load cycles, and TDR-034 codifying the architectural decisions.

**The bisectable commit log (paste-friendly):**

```
5cec5940 docs(architect): TDR-034 — Kind 5 plugin loader architecture decisions
ce507393 docs: mark primitive-bundle-plugin-kind-5 shipped
20a3ee5d docs(plugins): record M1 verification smoke run
74feaf74 test(plugins): install-path parity (npx vs git-clone data dirs)
28db866b feat(api): POST /api/plugins/reload
e2b0e702 feat(api): GET /api/plugins
e1c90527 feat(chat): add reload_plugins, reload_plugin, list_plugins tools
89821c3a feat(plugins): wire plugin loader into Next.js boot sequence
a33dc9b1 feat(plugins): first-boot dogfood seeder (only when plugins/ is empty)
f0f84f54 feat(plugins): finance-pack dogfood bundle (profile + blueprint + table)
38afbd8f test(plugins): consolidated reload contract test
043130c2 feat(plugins): true single-plugin reload (preserves other plugins' cache entries)
719d3a37 feat(plugins): integrate tables — DB upsert with composite-id strategy
7c14d8f8 feat(plugins): integrate blueprints + cross-ref validator
4b979061 feat(plugins): integrate profiles — scan + namespace + merge (with refactored scanProfilesFromDir)
f9153148 feat(plugins): registry skeleton — manifest validation + apiVersion compat (with self-enforcing window test)
94f0d0ac feat(tables): installPluginTables + removePluginTables (composite-id strategy)
52abf161 refactor(blueprints): drop unnecessary cast in validateBlueprintRefs + namespacing comment
113360e5 feat(blueprints): mergePluginBlueprints + cross-ref validator
57e2633a feat(profiles): mergePluginProfiles/clearPluginProfiles for Kind 5 injection
f05d1f98 feat(plugins): manifest schema (Zod) + LoadedPlugin types
779d730a test(plugins): tighten getAinativePluginExamplesDir assertion + doc-comment intent
55c8364f feat(plugins): add getAinativePluginsDir + getAinativePluginExamplesDir
ae96bc5e docs(architect): Kind 5 plugin loader plan-vs-spec divergence audit
ec2ab928 docs(strategy): groom Milestone 1 spec + Self-Extension Platform roadmap
```

### What you can now do as a user (verified live in T18 smoke)

```bash
# 1. Plugin auto-seeds on first boot when ~/.ainative/plugins/ is empty
ls ~/.ainative/plugins/finance-pack/
# → blueprints  plugin.yaml  profiles  README.md  tables

# 2. Three new chat tools: list_plugins, reload_plugins, reload_plugin

# 3. Two API surfaces:
curl :3000/api/plugins
# → { plugins: [{ id: "finance-pack", status: "loaded",
#                profiles: ["finance-pack/personal-cfo"],
#                blueprints: ["finance-pack/monthly-close"],
#                tables: ["plugin:finance-pack:transactions"] }] }
curl -X POST :3000/api/plugins/reload
# → { loaded: [...], disabled: [...] }

# 4. The plugin's primitives appear in the existing pickers:
#    /tables → "Transactions (finance-pack)" (with picker-collision suffix)
#    Profile picker → "finance-pack/personal-cfo"
#    Blueprint picker → "finance-pack/monthly-close"

# 5. Drop a directory in, run reload_plugins, primitives appear:
mkdir ~/.ainative/plugins/my-pack
echo "id: my-pack
version: 0.1.0
apiVersion: \"0.14\"
kind: primitives-bundle" > ~/.ainative/plugins/my-pack/plugin.yaml
# Then in chat: reload_plugins → my-pack appears in the loaded list
```

### Test coverage — 137 tests across 30 test files

```
$ npx vitest run src/lib/plugins/ src/lib/agents/profiles/ src/lib/workflows/blueprints/ \
                src/lib/data/seed-data/ src/lib/chat/tools/__tests__/plugin-tools.test.ts \
                src/app/api/plugins/ src/lib/utils/__tests__/
Test Files  30 passed (30)
     Tests  137 passed (137)
```

Plus a self-enforcing `api-version-window.test.ts` that reads `package.json` and asserts the supported MINOR set always includes the current and previous MINOR — drop a value or forget to widen on a release bump and CI catches it.

### Architectural artifacts shipped beyond code

- **`features/architect-report.md`** — pre-implementation review identifying three plan divergences (composite-id tables, sync validateBlueprintRefs, narrowed apiVersion window) plus five additional findings (profile loading shortcut, mislabeled reload_plugin, missing TDR-034, boot-order rationale, reload race). All addressed in the plan revision before code shipped.
- **`.claude/skills/architect/references/tdr-034-kind-5-plugin-loader.md`** — codifies four decisions: (1) namespacing convention `<plugin-id>/<primitive-id>`, (2) composite-id table strategy `plugin:<plugin-id>:<table-id>` (no DB schema change), (3) sync loader with dynamic-import asymmetry (only at chat-tools and instrumentation boundaries), (4) per-plugin error isolation (status: "disabled", boot continues). Adds a new drift heuristic for the `/architect` skill catching future static imports of runtime modules from plugin/chat-tool code.
- **Architect's drift heuristic addition** — appended to TDR-034's References section. Future `/architect drift detection` runs will flag any static `import` of `@/lib/agents/runtime/*` from files under `src/lib/plugins/` or `src/lib/chat/tools/`.

### Smoke verification highlights (from T18, recorded in spec)

- Real `npm run dev` boot at commit `74feaf74` on port 3010 with isolated smoke data dir.
- Boot sequence intact: bootstrap → migrations → `[plugins] 1 loaded, 0 disabled` → scheduler → channel-poller → auto-backup. Plugin loader runs **after** migrations and **before** scheduler, exactly as the architect's ordering invariants require.
- `[plugins] 1 loaded, 0 disabled` log line appears within 253ms of dev-server start.
- All four API surfaces return finance-pack contributions with namespaced ids.
- `Transactions (finance-pack)` visible in `/api/tables/templates` — the architect's picker-collision suffix from Divergence 1.
- Add test-pack → POST reload → 2 plugins; remove → POST reload → 1 plugin.
- **Zero `ReferenceError` / `Cannot access ... before initialization` / `claudeRuntimeAdapter` matches** in dev log. TDR-032 dynamic-import discipline held under live execution.

### Three implementer-driven deviations (all improvements, all documented)

These came up during subagent-driven implementation and shipped as documented, principled choices — not silent shortcuts:

1. **T6's `scanPlugins`/`reloadPlugins` separation.** The original spec had `reloadPlugins()` repopulating the cache after invalidation, which broke the `reloadPlugins(); writeFiles(); loadPlugins()` pattern used by tests and future hot-reload flows. T6 implementer extracted a private `scanPlugins()`, made `reloadPlugins()` invalidate-and-return-fresh-scan-without-caching, and let the next `loadPlugins()` re-cache. Documented inline in `src/lib/plugins/registry.ts`.
2. **T9's `lastLoadedPluginIds` tracker.** The original spec's `removeAllPluginTablesForCachedPlugins()` would no-op when `pluginCache` was null — leaving stale plugin tables on the second of two consecutive reloads. T9 added a module-level `lastLoadedPluginIds: Set<string>` updated at end-of-scan, used as a fallback when the cache is null. Survives cache invalidation. Critical for the "remove plugin → reload → tables gone" assertion.
3. **T11's BlueprintSchema fixture corrections.** The original spec's example blueprint YAML used fields the schema rejects (`difficulty: "easy"` instead of `"beginner"`, `prompt` instead of `promptTemplate`, missing `version`, missing `requiresApproval`). T11 implementer read `BlueprintSchema` first and authored compliant YAML. The dogfood `finance-pack/monthly-close` blueprint now satisfies the validator cleanly.

---

## The post-rollback scar tissue (still applies)

**2026-04-12: 21 commits were rolled back** (Custom App Creation + Marketplace + Trust Ladder + Publish-to-Supabase + PII Sanitizer + App-Extended-Primitives-Tier2 + App-Forking-Remix + Seed-Data-Generation + Embeddable-Install-Widget). See `ideas/rollback-app-marketplace-features.md`.

M1 deliberately did not re-enter the rolled-back territory. When future scope-creep tries to add any of the following, `ideas/self-extending-machine-strategy.md` §10 is the "we decided against this" reference:

- publishing / marketplace rails
- trust tiers
- PII sanitization pipeline
- Kind 2/3/4 plugins (processors, pattern helpers, runtimes)
- new UI routes via plugin
- new DB columns via plugin (M1 honored this with the composite-id strategy)
- orphan writes to `launchCwd` on npx
- feature gating by install method

If future demand overrides any non-goal, update the strategy doc first, document the reversal with a date, then groom a spec.

---

## What the next session should do

Pick **one** of these paths. Do not interleave.

### Path A — Push M1 + release 0.14.0 (recommended FIRST)

The 25 commits on `main` need to reach origin and the package needs to be published before users can install.

1. **Push to origin**:
   ```bash
   git push origin main
   ```
   (Confirm with the user before pushing — `git push` to `main` is on the "ask before destructive/visible-to-others" list per CLAUDE.md.)

2. **Bump to 0.14.0** (minor bump — new primitive kind, new API surface):
   - Update `package.json` version `0.13.3` → `0.14.0`
   - **Tighten `SUPPORTED_API_VERSIONS` in `src/lib/plugins/registry.ts`** — currently the bridge value `["0.14", "0.13", "0.12"]`. After the 0.14.0 release ships, drop `"0.12"` to leave `["0.14", "0.13"]` (the standard 2-MINOR window). The self-enforcing test in `api-version-window.test.ts` will catch any mistake.
   - Update `features/changelog.md` 2026-04-19 entry to reference the actual published version.
   - Build the tarball: `npm pack`.
   - Commit as `chore(release): 0.14.0 …`.

3. **Publish** (user runs):
   ```bash
   npm publish ainative-business-0.14.0.tgz
   ```

4. **Verify the npx install path** — clean `~/.ainative-test-014/`, `npx ainative-business@0.14.0`, observe finance-pack auto-seed.

### Path B — Groom Milestone 2 (if Path A is blocked or already done)

Milestone 2 is **`schedules-as-yaml-registry`**. Today schedules are DB-only; Kind 5 bundles cannot carry schedules because there's no YAML loader. This milestone closes that gap.

1. Invoke `/product-manager` with: *"Write the feature spec for Milestone 2 — schedules-as-yaml-registry. Source: ideas/self-extending-machine-strategy.md §9 Milestone 2, plus existing schedule infrastructure at src/lib/schedules/ and src/lib/db/schema.ts (schedules table). Must follow the shape of workflow-blueprints.md (YAML + Zod + registry + loader) adapted to schedules. Target: features/schedules-as-yaml-registry.md."*

2. Update roadmap + changelog per PM skill conventions.

3. After grooming, invoke `superpowers:writing-plans` to produce an implementation plan grounded in the spec. The plan should follow the same structure as the M1 plan (architect-revisable, TDD bite-sized tasks, real smoke step at the end).

4. Execute via `superpowers:subagent-driven-development`.

The architect's "**Refinement 2 — generic `scanBundleSection<T>` helper**" deferral applies here. M2 adds `scanBundleSchedules` — that's the third near-identical scanner. M2 plan should extract a generic helper from `scanBundleProfiles`/`scanBundleBlueprints`/`scanBundleTables` rather than duplicating the pattern a fourth time.

### Path C — Address deferred concerns from M1

These were flagged during M1 review but deferred to a separate session (per-task scope discipline):

- **Race condition on concurrent `installPluginTables`** (T5 reviewer flag). Two simultaneous `reload_plugins` from different chat sessions could both see `existing == null` then both attempt INSERT → `SqliteError: UNIQUE constraint failed`. Bounded scenario but real. Fix: wrap in `db.transaction(...)` or use Drizzle's `.onConflictDoUpdate()`. ~5 lines of code.
- **Single-character plugin id allowed** (T2 reviewer flag, confidence 82). Regex `/^[a-z][a-z0-9-]*$/` accepts `id: "a"`. Defensible but ugly. Tighten to `{2,}` minimum length if it becomes a usability complaint.
- **Category enum duplicated 5 times across the codebase** (T2 reviewer flag). Pre-existing tech debt that M1 added a fifth instance to. Right time to extract is when the DB enum is next modified — not as a standalone refactor.
- **Refinement 1 — `z.discriminatedUnion` for `kind`** (architect, deferred to M3). When M3 (chat-tools-plugin-kind-1) needs `kind: "primitives-bundle" | "chat-tools"` with different valid fields per kind, the schema becomes:
  ```ts
  z.discriminatedUnion("kind", [Kind5ManifestSchema, Kind1ManifestSchema])
  ```
  Plan to land this refactor at the start of M3, before the Kind 1 schema is added.

### Path D — Refresh content pipeline (cosmetic but useful)

The book/docs/screengrabs may reference outdated counts now that M1 shipped:
- 81 chat tools → 84 (added `list_plugins`, `reload_plugins`, `reload_plugin`)
- 12 builtin table templates + N user templates → also includes `plugin:*` rows
- New endpoint count: `/api/plugins` and `/api/plugins/reload` not in any docs

Run `/refresh-content-pipeline` if you want code-derived content (README counts, book chapters, user guide) to reflect the new state.

---

## Environment state at handoff time

- **Branch**: `main`, clean working tree, **25 commits ahead of origin**.
- **HEAD**: `5cec5940` (TDR-034).
- **Test suite (last regression run)**: 137/137 green across 30 test files.
- **package.json version**: still `0.13.3`. M1 ships at 0.14.0 (Path A).
- **Smoke data dir**: `~/.ainative-smoke-plugins-m1` left in place from T18 — safe to inspect or delete.
- **Dev server**: not running. Confirmed clean stop after T18.

### First action for the next session

Read this handoff + the four numbered references at top, then choose Path A / B / C / D.

If Path A: **ask the user before pushing to origin/main.** That's the project's git-safety rule.

If Path B: spawn the product-manager agent with the prompt in §"Path B — Groom Milestone 2".

---

## Don't undo these (regression guards from M1)

A short list of state that is easy to accidentally regress. Each has a test or invariant protecting it:

### From this milestone (M1, 2026-04-19)

- **Dynamic `await import("@/lib/plugins/registry")` inside `src/lib/chat/tools/plugin-tools.ts`** (all three handlers) and inside `src/instrumentation-node.ts`. A static import here triggers TDR-032's module-load cycle. The doc comment at the top of `plugin-tools.ts` explicitly warns about this. T18's smoke is the only catcher — unit tests structurally cannot detect the cycle.
- **The `(<plugin-id>)` name suffix in `installPluginTables`** (`src/lib/data/seed-data/table-templates.ts`). Without it, plugin tables silently collide with same-named builtins in the picker UI. Architect's required Divergence 1 fix.
- **The `lastLoadedPluginIds` tracker** in `src/lib/plugins/registry.ts`. Without it, `removeAllPluginTablesForCachedPlugins()` no-ops when the cache is null, leaving stale plugin tables across the gap between two consecutive `reloadPlugins()` calls. T9's deviation from spec.
- **The boot-order ordering invariants comment in `src/instrumentation-node.ts`**. Plugin loader MUST run after `runPendingMigrations()` (writes to `userTableTemplates`) and BEFORE `startScheduler()` / `startChannelPoller()` (which can fire tasks bound to plugin profiles). Moving the block without re-checking will silently break scheduled task execution.
- **The 6-line code comment above `import { getProfile } from "@/lib/agents/profiles/registry"`** in `src/lib/workflows/blueprints/registry.ts`. Without this comment, the next pass of `/architect drift detection` will flag the static import as a TDR-032 violation, and a future contributor will paste the dynamic-import workaround unnecessarily, defeating sync simplicity.
- **The self-enforcing `api-version-window.test.ts`**. Reads `package.json` and asserts the current and previous MINOR are in `SUPPORTED_API_VERSIONS`. Drop a value or forget to widen on bump → test fails. Critical for the apiVersion contract not silently breaking.

### From earlier sessions (preserved through M1)

- The npx `.env.local` precedence inversion (0.13.2 — `bin/cli.ts` lines 36–76). Covered by `src/lib/__tests__/cli-env-local.test.ts` (6 subprocess tests).
- The first-run auto-writer in `bin/cli.ts` (0.13.2, same region).
- The `skippedReason: "no_git"` branch in `src/app/api/instance/config/route.ts` (0.13.3). Covered by `src/components/instance/__tests__/instance-section.test.tsx`.

If any of those test files disappear or those tests are removed, flag it immediately.

---

## Open decisions deferred to future sessions

From M1 review and strategy doc §13:

- **TypeScript authoring for Kind 1 plugins** — revisit only if user complaints surface about unreadable emitted JS. (Strategy doc §13)
- **Plugin dependency deduplication** — revisit when `~/.ainative/plugins/` aggregate size becomes a complaint. (Strategy doc §13)
- **Plugin discovery in chat command palette** — interleave into Create + Automate categories vs. a sixth "Plugins" category. (Strategy doc §13)
- **`--safe-mode` runtime toggle** — currently planned as a CLI flag for M3; consider a Settings toggle for audit-in-place. (Strategy doc §13, M3 concern)
- **PE-portfolio persona (Phase 2)** — fleet management, portfolio-wide deployment. Out of Phase 1 scope. (Strategy doc §13)
- **Table-name collision dedup in `seedTableTemplates()`** — current implementation dedupes by `name + scope === "system"`. After M1, plugin rows AND builtin rows both have `scope: "system"`. The `(<plugin-id>)` suffix means names won't actually collide, but if a future contributor changes the suffix scheme or removes it, the silent dedupe-by-name behavior could re-emerge. Worth tightening `seedTableTemplates`'s dedupe predicate to `id NOT LIKE 'plugin:%'` defensively.
- **True targeted reload performance** — `reloadPlugin(id)` currently re-scans the entire plugins directory to locate the bundle, even though only one plugin needs reloading. Optimization: maintain a cached `bundleId → rootDir` map populated at scan time. Defer until plugin counts are large enough to make the difference noticeable.

None of these block any of the 5 milestones.

---

## Who to talk to if stuck

- **For architecture questions** on plugin primitives or future plugin kinds: re-invoke `/architect`. The synthesis in `ideas/self-extending-machine-strategy.md` §5 captures Kind 5 conclusions; TDR-034 captures the implementation outcomes.
- **For UX questions** on `/apps`, ExtensionFallbackCard, or install-path surfacing: re-invoke `/frontend-designer`. Reference strategy doc §6.
- **For scope / priority / sequencing questions**: re-invoke `/product-manager` with explicit reference to strategy doc §9 (5-milestone roadmap) and §10 (non-goals). Use Ship Verification mode to audit Milestone 2 before marking it `completed`.
- **For security questions** on Kind 1 (Milestone 3): Claude Code and Codex CLI's MCP server trust model is the reference pattern. We do not sandbox; we document and gate on user click-accept.

---

*End of handoff. The next session should begin by choosing Path A, B, C, or D above. Path A (push + release 0.14.0) is the default unless the user has another priority. M1 is shipped; the strategy is intact; the rollback discipline holds.*
