---
title: Composed App Manifest — view: Field & Kit Inference
status: planned
priority: P1
milestone: post-mvp
source: ideas/composed-apps-domain-aware-view.md
dependencies: [composed-app-view-shell]
---

# Composed App Manifest — `view:` Field & Kit Inference

## Description

The composed-app view dispatcher needs to know which kit to render for a given app. This feature lands the manifest contract that drives that decision: an optional, **strict** `view:` field on `AppManifestSchema` (in `src/lib/apps/registry.ts`) plus a deterministic `pickKit(manifest, columnSchemas) → KitId` function that picks a kit when the field is omitted.

The `view:` field is the only place where layout intent enters the manifest. Every other manifest schema in the file is `.passthrough()`; this one is `.strict()` so it cannot drift into an HTML/styling escape hatch. KPI sources are an enumerated discriminated union, not formula strings — there are exactly N supported kinds; new kinds require a code change, not a manifest hack.

When `view:` is omitted (or `view.kit: auto`), the inference function runs a deterministic decision table top-to-bottom — first match wins, no scoring, no tie-breakers. Every existing starter app keeps working because inference produces a sensible kit.

## User Story

As an app author, I want to optionally declare which view kit my app uses (and which primitives bind to which slots) so that I can override the default domain-aware layout when needed; if I omit the field, I want the system to pick a sensible kit automatically based on the primitives I've already declared.

## Technical Approach

**Modified file: `src/lib/apps/registry.ts`** — add a new `ViewSchema` and attach it as `view: ViewSchema.optional()` on `AppManifestSchema`.

```ts
const KitId = z.enum([
  "auto", "tracker", "coach", "inbox", "research", "ledger", "workflow-hub",
]);

const BindingRef = z.union([
  z.object({ table: z.string() }),
  z.object({ blueprint: z.string() }),
  z.object({ schedule: z.string() }),
  z.object({ profile: z.string() }),
]);

const KpiSpec = z.object({
  id: z.string(),
  label: z.string(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("tableCount"),       table: z.string(), where: z.string().optional() }),
    z.object({ kind: z.literal("tableSum"),         table: z.string(), column: z.string() }),
    z.object({ kind: z.literal("tableLatest"),      table: z.string(), column: z.string() }),
    z.object({ kind: z.literal("blueprintRunCount"), blueprint: z.string(), window: z.enum(["7d","30d"]).default("7d") }),
    z.object({ kind: z.literal("scheduleNextFire"),  schedule: z.string() }),
  ]),
  format: z.enum(["int","currency","percent","duration","relative"]).default("int"),
});

const ViewSchema = z.object({
  kit: KitId.default("auto"),
  bindings: z.object({
    hero:      BindingRef.optional(),
    secondary: z.array(BindingRef).optional(),
    cadence:   BindingRef.optional(),
    runs:      BindingRef.optional(),
    kpis:      z.array(KpiSpec).optional(),
  }).default({}),
  hideManifestPane: z.boolean().default(false),
}).strict();
```

**New file: `src/lib/apps/view-kits/inference.ts`**

```ts
export function pickKit(
  manifest: AppManifest,
  columnSchemas: Map<string, UserTableColumn[]>,
): KitId {
  const declared = manifest.view?.kit;
  if (declared && declared !== "auto") return declared;

  // Decision table — first match wins. No scoring, no tie-breakers.
  if (rule1_ledger(manifest, columnSchemas))   return "ledger";
  if (rule2_tracker(manifest, columnSchemas))  return "tracker";
  if (rule3_research(manifest))                return "research";
  if (rule4_coach(manifest))                   return "coach";
  if (rule5_inbox(manifest, columnSchemas))    return "inbox";
  if (rule6_multiBlueprint(manifest))          return "workflow-hub";
  return "workflow-hub"; // fallback
}
```

Each `ruleN_*` is a small, named, **pure** predicate. The seven rules in order are:

| # | Condition | Kit |
|---|---|---|
| 1 | Hero table has `currency`-shaped column AND ≥1 blueprint | `ledger` |
| 2 | Hero table has `boolean`+`date` columns AND ≥1 schedule | `tracker` |
| 3 | Blueprint emits a document AND ≥1 schedule | `research` |
| 4 | Blueprint runs a `*-coach` profile AND ≥1 schedule | `coach` |
| 5 | Blueprint receives `notification`/`message` inputs | `inbox` |
| 6 | ≥2 blueprints, no clear hero table | `workflow-hub` |
| 7 | Fallback | `workflow-hub` |

Column-shape probes (`hasCurrency`, `hasDate`, `hasBoolean`) live in the same file as small helpers. Initial implementations can be approximate (e.g., `hasCurrency` checks `column.config.format === "currency"` OR `column.name.match(/amount|price|cost|balance/i)`) — `composed-app-auto-inference-hardening` (Phase 5) tightens these.

**Replaces stub from `composed-app-view-shell`:** the dispatcher's `pickKit` import switches from the placeholder always-`workflow-hub` stub to this real implementation. Until later phases register real kits in the registry, `pickKit` returns the kit id but the registry resolves any unknown id to `placeholder` (graceful degradation).

**Backward compatibility (golden-master test):** every existing starter app's manifest must continue to parse cleanly through the updated `AppManifestSchema`. A snapshot test loads each starter manifest and asserts `parseAppManifest(yaml).success === true`.

**No new chat tools, no new API routes, no DB migration.**

## Acceptance Criteria

- [ ] `AppManifestSchema` accepts an optional `view` field; `view` validates against the strict schema above
- [ ] `view.kit` defaults to `"auto"` when absent; unknown kit ids fail Zod validation with a clear error
- [ ] `view` schema rejects unknown top-level fields (`.strict()` enforced; covered by a unit test)
- [ ] `KpiSpec.source` is a discriminated union; passing `{ kind: "formula", expr: "..." }` fails validation
- [ ] `pickKit(manifest, columnSchemas)` is a pure function in `src/lib/apps/view-kits/inference.ts` returning a `KitId`
- [ ] Decision table has 7 named, individually unit-tested rules; first match wins
- [ ] Golden-master test: every starter manifest under `.claude/apps/starters/` and `src/lib/plugins/examples/*/plugin.yaml` parses with no errors after the schema change
- [ ] Inference picks the expected kit for each starter: habit-tracker → `tracker`, weekly-portfolio-check-in → `coach`, customer-follow-up-drafter → `inbox`, research-digest → `research`, finance-pack → `ledger`, reading-radar → `tracker`
- [ ] Worked manifest example from the strategy doc (habit-tracker with explicit `view:`) parses successfully and round-trips
- [ ] Documentation comment on `ViewSchema` explicitly states "no formula strings, no HTML, no component refs — kit-specific binding shapes go in the kit's resolver, not here"

## Scope Boundaries

**Included:**
- `ViewSchema`, `BindingRef`, `KpiSpec`, `KitId` Zod schemas in `registry.ts`
- `pickKit` + 7 rule predicates + column-shape probes in `inference.ts`
- Wire `pickKit` into the dispatcher (replaces the `composed-app-view-shell` stub)
- Golden-master test for backward-compat across all starter manifests
- Unit tests per rule predicate

**Excluded:**
- Implementing real kits beyond `placeholder` (Phase 2-4 features)
- Authoring the chat tools that emit/edit `view:` (separate feature: `composed-app-manifest-authoring-tools`)
- Tightening column-shape probes against edge cases (separate feature: `composed-app-auto-inference-hardening`)
- Evaluating KPI specs against the DB (handled in `composed-app-kit-tracker-and-hub` via `evaluateKpi`)
- Any UI surface for editing the `view:` field

## References

- Source: `ideas/composed-apps-domain-aware-view.md` — sections 3 (Manifest Contract), 4 (Auto-Inference Rules), 13 shard #2
- Related features: `composed-app-view-shell` (consumes `pickKit`), `composed-app-kit-tracker-and-hub` (first kits triggered by inference), `composed-app-auto-inference-hardening` (tightens probes)
- TDR-worthy: "Kit selection is manifest-declared with deterministic auto-inference fallback"; "KPI sources are an enumerated discriminated union, not expressions"; "`view` schema is `.strict()`, every other manifest schema is `.passthrough()`"
- Existing schema: `src/lib/apps/registry.ts:11-51` (current `AppManifestSchema`)
