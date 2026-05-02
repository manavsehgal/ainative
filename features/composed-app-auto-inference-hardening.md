---
title: Composed App Auto-Inference — Probes & Decision Table Hardening
status: planned
priority: P2
milestone: post-mvp
source: ideas/composed-apps-domain-aware-view.md
dependencies: [composed-app-kit-inbox-and-research]
---

# Composed App Auto-Inference — Probes & Decision Table Hardening

## Description

The first cut of `pickKit(manifest, columnSchemas)` (shipped in `composed-app-manifest-view-field`) uses approximate column-shape probes — `hasCurrency` matches by column name regex (`amount`, `price`, `cost`, `balance`) or by `column.config.format === "currency"`. This works for the starter apps but will misfire on real-world manifests with non-English column names, custom formats, or ambiguous shapes (e.g., a table with both currency and date columns might be a ledger or a budget tracker depending on context).

This feature hardens the inference layer with three changes:

1. **Tighten the column-shape probes** — use an explicit `column.config.semantic` field (added to `userTableColumns` schema) for unambiguous tagging, fall back to regex/format heuristics, and add a "no-match" path that always lands at `workflow-hub` rather than guessing.
2. **Expand the decision-table test suite** — add 20-30 synthetic-manifest test cases that cover every rule, every conjunction, and every "false positive" near-miss.
3. **Build an inference-trace developer tool** — a tiny diagnostic page at `/apps/[id]/inference` (dev-only or behind a setting) that shows which rule fired, which probes returned what values, and which alternate kits were considered. This is invaluable when an app picks the "wrong" kit.

This is the polishing pass that makes auto-inference production-ready for user-authored apps, not just hand-crafted starter manifests.

## User Story

As an app author whose composed app picks the wrong default kit, I want a visible explanation of why the kit was chosen and what would have selected a different one, so I can either fix my manifest or know which `view:` field to declare.

As a maintainer adding a new starter app, I want a comprehensive inference test suite so that adding a new manifest can't accidentally change the kit selection for an existing starter.

## Technical Approach

### 1. Tighten column-shape probes

Extend the existing `userTableColumns` config with an optional `semantic` discriminator. This is opt-in — old columns continue to work via regex/format fallbacks.

```ts
// Existing: column.config: { format?: string; ... }
// New optional: column.config.semantic
type ColumnSemantic =
  | "currency"          // monetary amount
  | "date"              // calendar date
  | "boolean-flag"      // active / completed / done
  | "url"
  | "email"
  | "notification"      // unread / read / status
  | "message-body";     // long-form text expected to be a message body
```

Probes become a tiered match:

```ts
function hasCurrency(cols: UserTableColumn[]): boolean {
  return cols.some(c =>
    c.config?.semantic === "currency"          // explicit (highest precedence)
    || c.config?.format === "currency"          // legacy format hint
    || /amount|price|cost|balance|net|total/i.test(c.name)  // last-resort regex
  );
}
```

Same pattern for `hasDate`, `hasBoolean`, `hasNotificationShape`, `hasMessageShape`.

**Migration path:** no DB migration. The `semantic` field is optional and stored inside the existing `column.config` JSON blob. Templates and starter tables can adopt it incrementally.

### 2. Expand the decision-table test suite

Create `src/lib/apps/view-kits/__tests__/inference.test.ts` with the matrix:

- **Per-rule positive cases** — one synthetic manifest per kit that triggers exactly that rule
- **Per-rule negative cases** — manifests that look close but don't match (e.g., a table with a currency column but no blueprint → falls through past rule 1 to rule 2)
- **Conjunction cases** — manifests that match multiple rules, asserting first-match-wins ordering (e.g., a manifest that hits both `currency` AND `boolean+date+schedule` should pick `ledger`, not `tracker`, because rule 1 fires first)
- **Edge cases** — empty manifests, manifests with only profiles, manifests with a `*-coach` profile but no schedule
- **Starter-app golden master** — every shipped starter app's manifest is tested for its expected kit (so adding a new starter or modifying an existing one fails the test if the kit selection changes unintentionally)

Target: 25-35 tests. Each test names the rule and the assertion in plain English.

### 3. Inference-trace developer tool

**New route: `src/app/apps/[id]/inference/page.tsx`** — gated behind a setting `apps.showInferenceDiagnostics: false` (default off). When enabled, the page shows:

- The chosen kit
- The rule that fired (rule number + plain-English condition)
- All probe values (`hasCurrency`, `hasDate`, etc.) with their evidence (which column / which fallback path)
- The next 2-3 candidate kits and why each was rejected
- A "Copy as `view:` field" button that emits the equivalent explicit declaration

**Modified file: `src/lib/apps/view-kits/inference.ts`** — refactor `pickKit` to optionally return a trace alongside the kit id. The dispatcher ignores the trace; the diagnostics page consumes it.

```ts
export function pickKit(
  manifest: AppManifest,
  columnSchemas: Map<string, UserTableColumn[]>,
  options?: { trace?: true },
): KitId | { kit: KitId; trace: InferenceTrace };
```

Settings entry added to existing settings page (`src/app/settings/page.tsx`); persists in `settings` table via existing API.

### Out of scope on purpose

- **No scoring or fuzzy ranking.** The decision table stays first-match-wins. Hardening tightens probes; it does not relax determinism.
- **No telemetry feedback loops.** Probes don't change behavior based on user click-throughs. (Listed as anti-pattern in the strategy doc.)
- **No new kit ids.** This feature is purely about the probes feeding the existing 6 kits.

## Acceptance Criteria

- [ ] `userTableColumns.config.semantic` is documented and accepted; existing rows without it continue to work
- [ ] `hasCurrency`, `hasDate`, `hasBoolean`, `hasNotificationShape`, `hasMessageShape` probes use tiered match (semantic → format → regex), with tests for each tier
- [ ] Inference test suite has ≥25 cases; positive + negative + conjunction + edge + golden-master coverage
- [ ] All existing starter apps still resolve to their expected kit (no regression)
- [ ] `pickKit(...).options.trace` returns an `InferenceTrace` object listing rule hits, probe values, and rejected candidate kits
- [ ] `/apps/[id]/inference` route renders the trace when `apps.showInferenceDiagnostics` is enabled, returns 404 otherwise
- [ ] "Copy as `view:` field" button on the diagnostics page produces a valid YAML snippet that, when added to the manifest, produces the same kit selection
- [ ] Settings page has an `apps.showInferenceDiagnostics` toggle (default off)
- [ ] Unit tests for the trace serialization (so the diagnostics page contract is locked)

## Scope Boundaries

**Included:**
- Tiered column-shape probes (semantic → format → regex)
- `userTableColumns.config.semantic` optional field
- Expanded inference test suite (25-35 cases)
- `/apps/[id]/inference` diagnostics route (gated by setting)
- "Copy as `view:` field" generator on the diagnostics page

**Excluded:**
- Adding new kit ids or rules (the strategy explicitly caps at 6 kits)
- Telemetry-driven kit selection (anti-pattern per strategy)
- Auto-migration of existing column configs to add `semantic` (opt-in only)
- Manifest authoring UX in chat (separate feature: `composed-app-manifest-authoring-tools`)
- LLM-based "explain why this kit" — the trace is mechanical, not generative

## References

- Source: `ideas/composed-apps-domain-aware-view.md` — sections 4 (Auto-Inference Rules), 8 (Phase 5 — Polish), 13 shard #6
- Related features: `composed-app-manifest-view-field` (provides initial `pickKit`), `composed-app-manifest-authoring-tools` (consumes the trace generator)
- Reference: `src/lib/tables/types.ts` (existing column-config shape), `src/app/settings/page.tsx` (settings UX pattern)
- Anti-pattern reminders: no scoring, no telemetry inputs, no fuzzy matching
