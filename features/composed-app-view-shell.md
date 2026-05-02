---
title: Composed App View — Shell & Dispatcher
status: completed
priority: P1
milestone: post-mvp
source: ideas/composed-apps-domain-aware-view.md
dependencies: [app-shell, agent-profile-catalog, workflow-blueprints, scheduled-prompt-loops, tables-data-layer]
---

# Composed App View — Shell & Dispatcher

## Description

Today's per-app screen at `/apps/[id]` is a thin manifest viewer — four icon cards listing profiles/blueprints/tables/schedules plus a file list. Every composed app looks the same: a wealth tracker, a customer-support inbox, and a habit log are visually indistinguishable. The view feels like a settings page, not "an app."

This feature replaces that body with a **kit dispatcher**: a tiny route that resolves a composed app to one of N domain-aware "view kits" and renders it through a shared `<KitView/>` component. It introduces the type contracts (`KitDefinition`, `ViewModel`), the registry skeleton at `src/lib/apps/view-kits/`, and a "View manifest" sheet that preserves the current four-card composition view for power users.

This is the foundation for Phase 1 of the Composed Apps Domain-Aware View strategy. No kits ship in this feature — the dispatcher exists, but every app falls through to a single placeholder kit until later phases populate the registry. The point is to land the seam.

## User Story

As an app composer, I want every app I install to immediately fall through a shared dispatcher with a clean header, run-now affordance, and one-click access to the manifest, so that the per-app surface is consistent and ready to be specialized by domain in later phases.

## Technical Approach

**New module: `src/lib/apps/view-kits/`**

```
src/lib/apps/view-kits/
  index.ts          # registry: { [kitId]: KitDefinition }
  types.ts          # KitId, KitDefinition, ResolveInput, KitProjection,
                    #   RuntimeState, ViewModel, slot types
  resolve.ts        # resolveBindings(manifest) → resolved IDs
  data.ts           # server-only fetch(app) → RuntimeState (parallel queries)
  kits/
    placeholder.ts  # the only kit shipped in this feature; renders the
                    # current composition + files cards inside the new shell
```

**`KitDefinition` shape (frozen contract for future kits):**

```ts
export type KitDefinition = {
  id: KitId;
  resolve:    (input: ResolveInput) => KitProjection;
  buildModel: (proj: KitProjection, runtime: RuntimeState) => ViewModel;
};

export type ViewModel = {
  header:    HeaderSlot;
  kpis?:     KpiTile[];          // 0..6
  hero?:     HeroSlot;
  secondary?: SecondarySlot[];   // 0..3
  activity?: ActivityFeedSlot;
  footer?:   ManifestPaneSlot;
};
```

Kits are pure projection functions. They never own React state, never fetch data — `data.ts` builds `RuntimeState` once per request and passes it in. This contract is set in this feature and never relaxed.

**New shared component: `src/components/apps/kit-view/kit-view.tsx`**

A server component that takes `model: ViewModel` and maps each slot to existing primitives. Slot components live in `src/components/apps/kit-view/slots/`:

- `header.tsx` — wraps `PageHeader` + `StatusChip`; surfaces title, description, Run-now button, "View manifest" trigger
- `kpis.tsx` — placeholder; the real `KPIStrip` lands in Phase 2 feature
- `hero.tsx` / `secondary.tsx` / `activity.tsx` / `footer.tsx` — slot renderers

The `footer` slot is implemented as a `Sheet`-mounted "Manifest" pane — clicking the header's *View manifest ▾* button opens it. The pane shows the app's full manifest YAML in a code block plus the existing four-card composition view (profiles / blueprints / tables / schedules) and the file list. **The current view is preserved, not deleted.**

**Modified file: `src/app/apps/[id]/page.tsx`**

Replace the manifest-viewer body with the dispatcher:

```tsx
const app = await getApp(id);
if (!app) notFound();
const kit = pickKit(app.manifest, await loadColumnSchemas(app));
const projection = kit.resolve({ manifest: app.manifest, columns: app.columns });
const runtime = await loadRuntimeState(app, projection);
const model = kit.buildModel(projection, runtime);
return <KitView model={model} />;
```

In this feature, `pickKit` is a stub that always returns `placeholder`; the real decision table lands in `composed-app-manifest-view-field` and `composed-app-kit-tracker-and-hub`.

**Caching:** wrap `loadRuntimeState(app, projection)` with `unstable_cache(["app-runtime", id], …, { revalidate: 30 })`, busted on the existing `ainative-apps-changed` event used by `useApps()`.

**No DB migration. No new API routes. No breaking change to existing manifests.**

## Acceptance Criteria

- [ ] `src/lib/apps/view-kits/{index,types,resolve,data}.ts` exist with the frozen `KitDefinition` / `ViewModel` types exported
- [ ] `src/lib/apps/view-kits/kits/placeholder.ts` renders the existing composition + files content via the new slot system
- [ ] `src/components/apps/kit-view/kit-view.tsx` is a server component that maps `ViewModel` slots to primitives; six slot components live under `slots/`
- [ ] `src/app/apps/[id]/page.tsx` is reduced to ≤ 40 lines and dispatches through `pickKit → resolve → buildModel → <KitView/>`
- [ ] Clicking *View manifest ▾* in the header opens a `Sheet` showing the manifest YAML + the current composition + files content
- [ ] Visiting `/apps/<existing-app-id>` for every starter app (habit-tracker, weekly-portfolio-check-in, customer-follow-up-drafter, research-digest, finance-pack, reading-radar) renders without error
- [ ] Apps list at `/apps` is unchanged (no regression on the index)
- [ ] `loadRuntimeState` is wrapped in `unstable_cache` with a 30s revalidate; cache key includes the app id
- [ ] Unit tests for `resolve.ts` and `placeholder.ts` cover the empty-manifest and full-manifest cases
- [ ] Browser smoke: `npm run dev` → click *Apps > habit-tracker* in sidebar → page renders dispatcher path; *View manifest* sheet opens

## Scope Boundaries

**Included:**
- `KitDefinition` / `ViewModel` type contracts (frozen)
- View-kit registry skeleton + placeholder kit
- `<KitView/>` server component + six slot components
- Dispatcher route refactor at `src/app/apps/[id]/page.tsx`
- Manifest sheet preserving current composition + files content
- 30s server cache around runtime state

**Excluded:**
- The `view:` field on the app manifest (separate feature: `composed-app-manifest-view-field`)
- Real `pickKit` decision table (separate feature: `composed-app-manifest-view-field`)
- Tracker / Workflow Hub / Coach / Ledger / Inbox / Research kits (Phase 2-4 features)
- KPIStrip / LastRunCard / ScheduleCadenceChip / RunNowButton primitives (Phase 2 feature)
- Any DB migration, schema change, or API route addition
- Removing the manifest-viewer cards (they move into the sheet, not deleted)

## References

- Source: `ideas/composed-apps-domain-aware-view.md` — sections 5 (Runtime Architecture), 11 (Critical Files), 13 shard #1
- Related features: `composed-app-manifest-view-field` (lands the schema and replaces stub `pickKit`), `composed-app-kit-tracker-and-hub` (first real kits to consume this shell)
- Reference primitives: `src/components/shared/{page-header,status-chip,page-shell}.tsx`, `src/components/ui/sheet.tsx`
- TDR-worthy: "Kits are pure projection functions, not stateful components" (decided in this feature; documented in `/architect` TDR queue)
