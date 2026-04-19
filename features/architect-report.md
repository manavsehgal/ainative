---
generated: 2026-04-18
mode: review
target: .superpowers/plans/2026-04-18-primitive-bundle-plugin-kind-5.md
---

# Architect Report — Plan Review: Primitive Bundle Plugin (Kind 5)

**Verdict: APPROVE WITH REQUIRED CHANGES.** The plan is structurally sound and aligned with TDR-007 (profile-as-skill-directory), TDR-009 (idempotent bootstrap), TDR-011 (JSON-in-TEXT), and TDR-013 (text PKs). Two of the three flagged divergences are correct calls; one needs revision. There are also five additional gaps that block acceptance, and three forward-compat refinements that would substantially de-risk Milestones 2 and 3.

This review reads the plan against:
- TDR-007 (profile-as-skill-directory) — informs how profiles load
- TDR-009 (idempotent bootstrap) — informs how plugin loader fails-soft
- TDR-011 (JSON-in-TEXT) — informs how plugin tables persist
- TDR-013 (text-primary-keys) — directly enables the composite-id strategy
- TDR-032 (runtime ainative MCP injection / module-load cycle) — the reason CLAUDE.md flags chat-tools static imports
- The actual schema at `src/lib/db/schema.ts:971-995` (`userTableTemplates`)
- The actual seed wiring at `src/lib/db/index.ts:27-28` (`seedTableTemplates` runs at module-load)

---

## Verdict on the three flagged divergences

### Divergence 1 — Tables-as-DB-rows-with-composite-ids: **APPROVE WITH ONE BLOCKING FIX**

**Why I approve the strategy:**
- Honors strategy doc §10 ("no new DB columns via plugin") — non-negotiable post-rollback.
- Honors TDR-013 (text PKs) by piggybacking on the existing `id text primary key` column; composite ids are PK-prefix queryable, which means the `LIKE 'plugin:<id>:%'` cleanup uses the implicit PK BTREE index, not a table scan. Performance is fine at this scale.
- Honors TDR-011 (JSON-in-TEXT) — the plugin's `columnSchema` and `sampleData` ride the same TEXT-with-Zod-validation pattern as builtins.
- Alternative (a) "thin `pluginId` column" requires a new migration AND an ALTER on existing user DBs AND a bootstrap.ts entry per TDR-009. Much bigger blast radius for the same user-visible outcome.
- Alternative (b) "in-memory plugin-tables registry merged at API read time" splits the source of truth across DB rows and module memory. Worse: restart wipes plugin tables until the loader runs again, breaking idempotency. Reject.

**The blocking fix — name collision against the builtin seed:**

`src/lib/db/index.ts:27` triggers `seedTableTemplates()` at DB-module-load time. `src/instrumentation-node.ts` then runs `loadPlugins()`. So:

1. DB init runs `seedTableTemplates()` — inserts 12 builtin rows with random UUID ids and `scope: "system"`. Dedupe key: `name + scope === "system"`.
2. `loadPlugins()` runs → `installPluginTables("finance-pack", [{ id: "transactions", name: "Transactions", ... }])` — inserts a row with id `plugin:finance-pack:transactions`, name `"Transactions"`, scope `"system"`.

If a plugin ships a table whose `name` collides with a builtin (e.g., a hypothetical plugin's "Customer List"), **two rows both with `name="Customer List"` and `scope="system"` will coexist** — the picker UI at `/api/tables/templates` will list "Customer List" twice. On next boot, `seedTableTemplates`'s dedupe-by-name finds an existing row and skips the builtin re-insert (harmless), but the duplicate listing remains.

**Required minimum change to accept:** Either
- (i) Have `installPluginTables` write `name: \`${t.name} (${pluginId})\`` so plugin rows are visually distinct in the picker, OR
- (ii) Add a guard in `installPluginTables` that refuses to insert a plugin row if a builtin row with the same `name` and `scope: "system"` already exists (with `id NOT LIKE 'plugin:%'` predicate). Log + skip + report in `LoadedPlugin.error`.

I prefer (i) because it's purely cosmetic, fully reversible, and doesn't require the plugin loader to know which builtin names exist. (ii) is more defensive but adds coupling.

**Plan task affected:** Task 5, Step 3 — `installPluginTables` body. One line change.

### Divergence 2 — Sync `validateBlueprintRefs` with static profile import: **APPROVE — but codify why this is safe**

The plan's worry that this might violate TDR-032 is unfounded. TDR-032 is specifically about the cycle `runtime/catalog → runtime/index → claudeRuntimeAdapter → chat/ainative-tools → back to runtime/catalog`. Its prohibition is on **static imports of `@/lib/chat/ainative-tools` (and transitively `@/lib/chat/tools/*`)** from any file under `src/lib/agents/runtime/` or `src/lib/agents/claude-agent.ts` or `src/lib/workflows/engine.ts`.

I verified by grep:
- `src/lib/agents/profiles/registry.ts` does NOT statically import any chat-tools module.
- `src/lib/workflows/blueprints/registry.ts` does NOT either.

So the new static import chain (`workflows/blueprints/registry → agents/profiles/registry`) introduces:
- **No new runtime cycle risk** — neither leaf is a chat-tools module.
- **One new cross-package dependency direction** — `workflows/` now statically depends on `agents/profiles/`. This direction *already exists implicitly* via `workflows/engine.ts` invoking profile-bound agents, so we're formalizing what was already true.
- **One new test-time side effect** — calling `validateBlueprintRefs` will trigger `ensureLoaded()` on the profile registry, which calls `ensureBuiltins()` (mkdir + copyFile to `~/.claude/skills/`). Plan's tests in Task 4 don't call `validateBlueprintRefs` directly, so no new test-isolation problem. Future tests touching `validateBlueprintRefs` need to set `HOME` to a tmpdir or accept the side effect.

**Required minimum change to accept:** Add a one-line code comment above the new `import { getProfile }` statement in `blueprints/registry.ts`:

```ts
// Static import is intentional and safe: TDR-032's no-static-chat-tools-import
// rule applies to the chat-tools cycle, not the workflows→profiles direction.
// Profile registry has no chat-tools dependency. See plan §"Divergence 2".
```

Without that comment, the next pass of `/architect drift detection` will likely flag the new edge as "potential cycle" — and a future reader will paste the same dynamic-import workaround that TDR-032 prescribes for chat-tools, defeating the sync simplicity.

**Plan task affected:** Task 8, Step 3 — add comment to the import statement.

### Divergence 3 — `apiVersion` window narrowed to a single value: **REJECT AS-WRITTEN**

This is the one I push back on hardest. `SUPPORTED_API_VERSIONS = new Set(["0.14"])` makes every plugin authored on 0.14 instantly disabled the moment ainative-business ships 0.15.0. That's not a compatibility contract, that's a tripwire.

The spec says "0.14 accepted for ainative 0.14.x–0.15.x" — i.e., a 1-MINOR-forward window. The plan should implement that or be explicit about why it's narrower.

Three viable approaches, ranked:

1. **Recommended: lazy-derived from package.json.** Read `version` from `package.json`, compute current MINOR, accept current MINOR and current MINOR-1.

```ts
import pkg from "../../../../package.json";
const [major, minor] = pkg.version.split(".").map(Number);
const currentMinor = `${major}.${minor}`;
const previousMinor = minor > 0 ? `${major}.${minor - 1}` : null;
const SUPPORTED_API_VERSIONS = new Set(
  [currentMinor, previousMinor].filter((v): v is string => v !== null)
);
```

   Pros: zero maintenance burden, contract is "one MINOR back is always supported." Cons: silent expansion as the project ages — eventually the plan needs an explicit deprecation sweep.

2. **Acceptable: explicit constant with bump-checklist.** Keep `SUPPORTED_API_VERSIONS = new Set(["0.14"])` for now BUT add an inline comment AND add it to the release checklist:

```ts
// Bump checklist (every chore(release) commit):
//   1. If ainative-business minor changes: add the new MINOR here.
//   2. Drop a MINOR only when ainative-business is 2 MINORs ahead of it.
//   3. NEVER drop a MINOR in the same release that adds the next one.
const SUPPORTED_API_VERSIONS = new Set(["0.14"]);
```

   Pros: explicit and reviewable. Cons: easy to forget, especially in a hotfix release.

3. **Reject: leave as-is.** Single-value set guarantees a UX cliff at every minor bump. We'd need to re-publish every plugin in lockstep with each ainative release. That's the marketplace-coupling problem we explicitly opted out of in strategy doc §10.

**Required minimum change to accept:** Choose approach 1 OR 2 — not 3. Plan task affected: Task 6, Step 3.

---

## Five additional findings that block acceptance

### Finding A — Plugin profile loading drops profile-richness features

The plan's `scanBundleProfiles` (Task 7, Step 3) constructs an `AgentProfile` object by hand-mapping fields:

```ts
{
  ...config,
  id: namespacedId,
  description: config.name,           // <-- loses SKILL.md frontmatter description extraction
  systemPrompt: skillMd,
  skillMd,
  mcpServers: (config.mcpServers ?? {}) as Record<string, unknown>,
  supportedRuntimes: ["claude"],      // <-- loses getSupportedRuntimes(config) inference
  origin: "manual" as const,          // <-- loses origin inference (import / environment / ai-assist / manual)
}
```

But `src/lib/agents/profiles/registry.ts:scanProfilesFromDir` (lines 173–250) does much more sophisticated work:
- Extracts description from SKILL.md frontmatter (`/^---\s*\n[\s\S]*?description:\s*(.+?)\s*\n[\s\S]*?---/`)
- Calls `getSupportedRuntimes(config)` to infer multi-runtime compat
- Infers `origin` from `config.author` and `importMeta`
- Carries `tests`, `runtimeOverrides`, `capabilityOverrides`

A plugin profile that uses any of those features (multi-runtime support, runtime overrides, tests) will silently lose those fields when loaded via the plugin path. **This violates the spec's promise that "profiles in `<plugin>/profiles/` use the same schema as builtins."**

**Required minimum change to accept:** Refactor `scanProfilesFromDir` (registry.ts:173) to accept an optional `namespace` parameter. Plugin loader calls `scanProfilesFromDir(pluginDir + "/profiles", namespace: pluginId)` and the helper handles ALL existing field extraction, just rewriting `config.id → \`${namespace}/${config.id}\`` at the end. This is the DRY-with-judgment principle from AGENTS.md ("when you do extract, the abstraction must earn its weight" — here the second use already justifies it because the duplication is structural, not coincidental, and the duplicated path silently strips features).

**Plan task affected:** Task 7, Step 3 — replace `scanBundleProfiles` body with a call to a refactored, namespace-aware `scanProfilesFromDir`.

### Finding B — `reloadPlugin(id)` chat tool is misleading

The plan's Task 6 implementation:

```ts
export function reloadPlugin(id: string): LoadedPlugin | null {
  reloadPlugins();   // <-- full reload, not single-plugin
  return getPlugin(id);
}
```

…calls full `reloadPlugins()`. But the chat tool's description (Task 14, `defineTool("reload_plugin", "Reload a single plugin bundle by id...", ...)`) tells the LLM it's a targeted operation. The agent will reasonably believe single-plugin reload is cheap and call it repeatedly per plugin during a multi-plugin edit session. Each call clears all plugin profiles + blueprints + tables and re-scans the entire plugins directory.

This isn't a correctness bug, but it's an "agent gaslights itself" performance bug — the agent's mental model of cost diverges from reality.

**Required minimum change to accept:** Either
- (i) Implement true single-plugin reload (clear just one plugin's namespaced entries via `clearPluginProfiles(id)` + `clearPluginBlueprints(id)` + `removePluginTables(id)`, then re-scan only that one bundle directory), OR
- (ii) Update the chat tool description to say "Currently identical to reload_plugins; reserved for future targeted reload semantics in Milestone 3."

Option (i) is ~20 lines of code and matches the API surface contract. Recommended.

**Plan task affected:** Task 6 (registry impl) + Task 14 (chat tool description).

### Finding C — No TDR is proposed despite a new architectural surface

This feature introduces a brand-new system layer — a plugin loader with namespacing, manifest validation, apiVersion compatibility, per-bundle error isolation, and three new merge/clear surfaces on existing registries. Per architect skill guidance, "when a decision is made during implementation, create a TDR immediately."

The decisions worth codifying:
1. **Namespacing convention** — `<plugin-id>/<primitive-id>` is now used in three registries. Without a TDR, the next plugin kind (Kind 1, Kind 2 if ever revived) could pick a different convention.
2. **Composite-id table strategy** — `plugin:<plugin-id>:<table-id>` in `userTableTemplates`. Without a TDR, a future feature might add a `pluginId` column anyway, contradicting strategy doc §10.
3. **Sync loader / dynamic imports only at chat-tool boundaries** — the asymmetry the plan establishes is exactly the kind of thing that drifts in 6 months.
4. **Per-plugin error isolation** — disabled-but-listed failure mode is a new pattern in this codebase. Worth codifying as the model for future loaders (Kind 1 will need it more, with capability check failures, plugins.lock mismatches, etc.).

**Required minimum change to accept:** Add a final task to the plan that creates `tdr-034-kind-5-plugin-loader.md` with the four decisions above. Don't write the TDR body in the plan — just reserve the slot and outline the categories. The TDR can be authored alongside the implementation, picked up automatically by the next architect drift run.

### Finding D — Boot sequence rationale not articulated

The plan inserts plugin loading "between `runPendingMigrations()` and `startUpgradePoller()`." That's correct — but the plan doesn't say why the order matters. The real constraint is:

- **Must come AFTER** `runPendingMigrations()` because `installPluginTables` writes to `userTableTemplates` (which the migrations create/upgrade).
- **Must come BEFORE** `startScheduler()` because a scheduled task may reference a plugin profile (`finance-pack/personal-cfo`); if the scheduler fires before the plugin loads, the lookup fails and the task crashes with "profile not found."
- **Must come BEFORE** `startChannelPoller()` for the same reason — channels can spawn tasks bound to plugin profiles.
- **Order vs `startUpgradePoller`** is irrelevant (upgrade poller is async background, doesn't read profiles synchronously).

**Required minimum change to accept:** Add a plan-level note in Task 13 articulating the ordering invariant. This protects against a future refactor that rearranges `instrumentation-node.ts` and inadvertently moves the plugin loader after the scheduler.

### Finding E — No reload concurrency model

The plan treats reload as instantaneous. Realistic scenario: user edits a plugin's profile YAML → calls `reload_plugins` from chat → at the same instant, a scheduled task fires that uses that profile. Race conditions:

1. **Scheduler reads the profile** mid-reload → finds the namespaced id absent (cleared by `clearAllPluginProfiles`) → task fails with "profile not found."
2. **Scheduler reads the profile** after reload completes → fine.
3. **Scheduler holds the profile object** from before reload → uses the stale version → task succeeds with stale system prompt.

Case 1 is a real silent failure (user's scheduled task fails because of an unrelated chat action). Case 3 is the JS module-cache situation — fine in practice because profiles are values, not references.

**Required minimum change to accept:** Add to the plan's Error & Rescue Registry a row:

| Failure mode | Where | Recovery |
|---|---|---|
| Scheduled task fires mid-reload, profile lookup returns undefined | Task execution path | Caller must handle "profile not found" by retrying once after a 100ms delay (reload completes within ~10ms in practice). Document this in the next Milestone-3 spec — for M1, accept the race and mention it in the changelog. |

This is honest about the limitation rather than pretending reloads are atomic.

---

## Three forward-compat refinements that de-risk Milestones 2 and 3

These are not blocking — but skipping them creates rework when M2 and M3 land.

### Refinement 1 — Use `z.discriminatedUnion` for `kind` from day one

Plan Task 2's schema:

```ts
const PluginManifestSchema = z.object({
  kind: z.literal("primitives-bundle"),
  // ...
}).strict();
```

This works for Milestone 1 but Milestone 3 will need `kind: "primitives-bundle" | "chat-tools"`, with different valid fields per kind (chat-tools requires `entry`, optionally `capabilities`). Refactoring at that point means touching the schema, the type, and every downstream consumer.

**Better now:**

```ts
const PrimitivesBundleManifest = z.object({
  id: z.string()...,
  version: z.string()...,
  apiVersion: z.string()...,
  kind: z.literal("primitives-bundle"),
  name: z.string().optional(),
  // ...
}).strict();

export const PluginManifestSchema = z.discriminatedUnion("kind", [
  PrimitivesBundleManifest,
  // ChatToolsManifest added in Milestone 3
]);
```

Same behavior today, single-line addition in M3.

### Refinement 2 — Generic `scanBundleSection<T>` helper

Plan Tasks 7, 8, 9 each define `scanBundleProfiles`, `scanBundleBlueprints`, `scanBundleTables` — three near-identical functions differing only in (a) subdirectory name, (b) Zod schema, (c) namespacing convention. Milestone 2 (`schedules-as-yaml-registry`) adds `scanBundleSchedules` — that's the third use, the AGENTS.md threshold for extraction.

A generic `scanBundleSection<T>(opts: { rootDir, sectionName, parser, namespacer })` extracted now means M2 is 5 lines of "register the schedules section" instead of another 30 lines of duplicated scanner logic.

This is a soft recommendation — the plan as-written works. But the duplication will get harder to remove once it's spread across 4 sections.

### Refinement 3 — Spec update: explicitly document the composite-id strategy

The current spec at `features/primitive-bundle-plugin-kind-5.md` (line 128) still describes `table-templates.ts` as if it's a runtime registry that can be refactored to a mutable map. Future readers — especially future automated audits — will read that and expect a registry shape that doesn't exist.

**Required for plan-acceptance hygiene (not a code change):** Plan Task 19 (status update) should also patch the spec's Technical Approach section to read:

> Plugin tables are persisted as `userTableTemplates` rows with composite ids `plugin:<plugin-id>:<table-id>` and `scope: "system"`. Reload removes by `LIKE 'plugin:<plugin-id>:%'` predicate. No DB schema change. The pre-existing `seedTableTemplates()` system seed remains untouched and runs at DB-module-load time, before the plugin loader.

This locks in the composite-id strategy as the canonical pattern, so the architect's drift detection won't flag it as a deviation in 3 months.

---

## Pattern Compliance Matrix

| Category | TDRs Touched | Plan Compliance | Notes |
|---|---|---|---|
| data-layer | TDR-011, TDR-013 | ✅ Compliant | Composite-id strategy is the right use of TDR-013 text PKs and TDR-011 JSON-in-TEXT |
| agent-system | TDR-007, TDR-032 | ⚠ Partial — Finding A | Profile loading shortcut bypasses TDR-007's "same schema as builtins" promise |
| api-design | (none specific) | ✅ Compliant | Two thin route handlers, both following the existing `src/app/api/blueprints/route.ts` pattern |
| frontend-architecture | (n/a) | n/a | No UI in M1 |
| runtime | TDR-032 | ✅ Compliant | Static import is in the workflows→profiles direction, NOT in the chat-tools cycle. Plan correctly uses dynamic imports in `chat/tools/plugin-tools.ts`. Finding C asks for an explicit comment to lock this in. |
| workflow | (none specific) | ✅ Compliant | Blueprint registry extension follows the existing flat-cache pattern |
| infrastructure | TDR-009 | ✅ Compliant | Per-plugin error isolation (failed plugins → `disabled` status, boot continues) is exactly TDR-009's "self-heals missing tables" philosophy applied to plugins |

**Drift detected:** none. The plan introduces a new pattern (composite-id plugin storage) that should become a new TDR (Finding C), not a drift instance.

**Patterns to codify (Finding C):** Kind 5 plugin loader as a new TDR-034.

---

## Summary — minimum changes to acceptance

In order of importance:

1. **Divergence 3 — apiVersion compat window:** widen to current MINOR + previous MINOR (recommended approach 1) OR keep `["0.14"]` with explicit bump-checklist comment AND release-checklist note (approach 2). Reject "leave as-is."

2. **Finding A — profile loading shortcut:** refactor `scanProfilesFromDir` to take an optional `namespace`, then call it from the plugin loader. Replace `scanBundleProfiles` with a thin wrapper. DRY-with-judgment call where extraction is justified.

3. **Divergence 1 — table name collision:** prepend plugin-id to the `name` field in `installPluginTables` (e.g., `"Transactions (finance-pack)"`). One-line fix.

4. **Finding B — `reloadPlugin(id)` mislabel:** either implement true single-plugin reload OR update the chat-tool description to say it's currently identical to full reload.

5. **Finding C — TDR-034:** add a plan task that reserves a TDR slot for the four codifiable decisions (namespacing, composite-id, sync loader, per-plugin error isolation). The TDR can be authored alongside the code.

6. **Divergence 2 — sync `validateBlueprintRefs`:** add the one-line code comment explaining why the static import is safe (Finding C's TDR-034 will absorb this rationale long-term).

7. **Finding D — boot order rationale:** add a code comment in `instrumentation-node.ts` articulating the ordering invariant.

8. **Finding E — reload race condition:** add an entry to the plan's Error & Rescue Registry acknowledging the in-flight-task race.

9. **Refinement 3 — spec update:** Task 19 should also patch `features/primitive-bundle-plugin-kind-5.md` to describe the composite-id strategy.

Refinements 1 and 2 (discriminated union, generic scanner) are nice-to-have and can land in M2/M3 cleanup if they're skipped now.

**With these changes, the plan ships safely.** Without them, the most likely failure modes are:
- 0.15.0 release breaks every plugin (Divergence 3)
- Plugin profiles silently lose runtime-compat metadata (Finding A)
- Picker UI shows duplicate table templates (Divergence 1)
- Future architect drift run flags the new static import as a TDR-032 violation, leading to an unnecessary refactor (Divergence 2)

---

*Generated by `/architect` — review mode, focused on plan-vs-spec divergence audit*
