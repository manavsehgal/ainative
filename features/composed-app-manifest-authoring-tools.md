---
title: Composed App Manifest Authoring — Chat Tools for view: Field
status: planned
priority: P3
milestone: post-mvp
source: ideas/composed-apps-domain-aware-view.md
dependencies: [composed-app-manifest-view-field, composed-app-auto-inference-hardening, chat-app-builder]
---

# Composed App Manifest Authoring — Chat Tools for `view:` Field

## Description

The strategy doc closes Phase 5 with "Manifest authoring UX (the chat tools that emit/edit `view:` for end users)." Phases 1-4 made the `view:` field exist and made it drive the dispatcher. Phase 5's hardening made auto-inference production-ready. This feature adds the *chat-side authoring loop* so end users can compose apps with explicit view configuration without editing YAML by hand.

Today, when a user types *"build me a habit tracker"* in chat, the planner (`nl-to-composition-v1`) fires `AppMaterializedCard` and the resulting manifest has no `view:` field — auto-inference handles layout. That's correct for the default case. This feature handles the **override** case: a user who wants a Tracker layout for an app that auto-infers as Workflow Hub, or a user who wants to customize KPI tiles, or a user who wants to bind a specific table as the hero.

Three new chat tools land:

1. **`set_app_view_kit(appId, kit)`** — lock the kit selection (overrides auto-inference).
2. **`set_app_view_bindings(appId, bindings)`** — set hero/secondary/cadence/runs bindings.
3. **`set_app_view_kpis(appId, kpis)`** — declare 1-6 KPI tiles with discriminated-union sources.

Each tool is a thin wrapper that loads the manifest, mutates `view`, validates the result against `ViewSchema` (strict), and writes back atomically. The chat surface gets a small inline `<AppViewEditorCard/>` that the LLM can render to ask the user "Switch to Ledger layout?" with confirm/cancel.

This is **P3 / nice-to-have**: every starter and most user-authored apps work fine on auto-inference. This feature exists for the power user who wants explicit control.

## User Story

As a power user whose habit-tracker app auto-infers as `tracker` but who wants `workflow-hub` because they have multiple blueprints, I want to type *"switch to workflow hub layout"* in chat and have ainative update the manifest atomically without me touching YAML.

As a user customizing KPIs on my finance app, I want to add a "savings rate" tile via chat and have it appear at the top of the Ledger view immediately.

## Technical Approach

### Three new chat tools

**`src/lib/chat/tools/app-view-tools.ts`**

```ts
export const setAppViewKitTool = {
  name: "set_app_view_kit",
  description: "Set the explicit view kit for a composed app. Pass 'auto' to revert to inference.",
  inputSchema: z.object({
    appId: z.string(),
    kit: KitId,  // imported from src/lib/apps/registry.ts
  }),
  handler: async ({ appId, kit }, ctx) => {
    const app = await getApp(appId);
    if (!app) throw new ToolError("App not found", { code: "APP_NOT_FOUND" });
    const newManifest = {
      ...app.manifest,
      view: { ...(app.manifest.view ?? {}), kit },
    };
    const validated = AppManifestSchema.parse(newManifest);
    await writeAppManifest(appId, validated);
    return { ok: true, kit };
  },
};

export const setAppViewBindingsTool = {
  name: "set_app_view_bindings",
  inputSchema: z.object({
    appId: z.string(),
    bindings: ViewSchema.shape.bindings,  // reuse the existing Zod sub-schema
  }),
  handler: async ({ appId, bindings }, ctx) => { /* mutate, validate, write */ },
};

export const setAppViewKpisTool = {
  name: "set_app_view_kpis",
  inputSchema: z.object({
    appId: z.string(),
    kpis: z.array(KpiSpec),
  }),
  handler: async ({ appId, kpis }, ctx) => { /* mutate, validate, write */ },
};
```

All three tools:
- Load the current manifest, do a deep-clone, mutate `view`, validate via the existing strict Zod schemas, write back via atomic temp-file + rename.
- Fire the existing `ainative-apps-changed` event so `useApps()` and the dispatcher cache bust.
- Return the new effective kit (so the LLM can confirm to the user).

### Chat UI surface: `<AppViewEditorCard/>`

**`src/components/chat/app-view-editor-card.tsx`** — a card the LLM can render via existing tool-result-rendering pattern:

```tsx
type Props = {
  appId: string;
  currentKit: KitId;
  proposedKit?: KitId;
  proposedBindings?: ViewBindings;
  proposedKpis?: KpiSpec[];
  rationale?: string;  // why the LLM thinks this change helps
};
```

The card shows:
- Current kit name + a one-line description
- Proposed change (highlighted)
- Rationale from the LLM (1-2 sentences)
- Confirm / Cancel buttons; Confirm calls the appropriate tool

Renders inside the chat message stream like the existing `AppMaterializedCard` and `ExtensionFallbackCard`.

### LLM tool-emission patterns

These tools are exposed to the chat planner. The planner gets nudged toward them when:

- The user message mentions "switch layout", "change view", "add KPI", "show me as", "use [kit name] layout"
- The user message references an app + a view-shaped intent ("on my habit tracker, show me a finance dashboard instead")

Add a `buildViewEditingHint(plan, appContext)` to the existing planner (`src/lib/chat/planner/`), parallel to the existing `buildCompositionHint`. When the classifier detects view-editing intent, the system prompt is augmented with the available tools and current app context.

### Inference trace integration (UX shortcut)

The diagnostics page from `composed-app-auto-inference-hardening` includes a "Copy as `view:` field" button. Wire that button to *also* offer "Apply via chat" — opens the chat with a pre-filled message that calls `set_app_view_kit` + `set_app_view_bindings` for the user.

### Permissions and safety

- These tools mutate user-authored manifests. They're allowed by default (analogous to the existing app-mutation tools); no new permission preset needed.
- Strict Zod validation catches schema violations before write (e.g., LLM-hallucinated KPI source kinds fail loudly).
- Atomic temp-file + rename prevents partial writes from corrupting the manifest.
- A "View manifest" sheet in the app's header (already shipped in `composed-app-view-shell`) shows the post-write state immediately.

## Acceptance Criteria

- [ ] Three chat tools land: `set_app_view_kit`, `set_app_view_bindings`, `set_app_view_kpis` — registered in the chat tools registry, chat-tool count goes from 92 → 95
- [ ] All three tools validate inputs against the strict `ViewSchema`; invalid inputs return a `ToolError` with `code` and clear message
- [ ] Each tool fires `ainative-apps-changed` after a successful write; the apps sidebar and dispatcher refresh
- [ ] `<AppViewEditorCard/>` renders in the chat message stream with current kit, proposed kit, rationale, confirm/cancel
- [ ] Confirm button on the card calls the right tool with the right args; cancel discards
- [ ] Planner detects view-editing intent and augments system prompt with `buildViewEditingHint`; classifier tests cover ≥4 view-editing user messages
- [ ] Diagnostics page (from `composed-app-auto-inference-hardening`) gets an "Apply via chat" affordance that pre-fills a view-editing message
- [ ] Worked-example test: typing *"switch my habit tracker to workflow hub layout"* in chat results in `set_app_view_kit("habit-tracker", "workflow-hub")` being called and the dispatcher renders Workflow Hub on next visit
- [ ] Atomic write: a tool failure mid-write does not corrupt the manifest file (verified via test that pre-injects a write failure)
- [ ] Documentation in `ainative-app` skill updated with examples of view-editing prompts

## Scope Boundaries

**Included:**
- 3 new chat tools for view editing
- `<AppViewEditorCard/>` chat surface
- Planner hint for view-editing intents
- "Apply via chat" wiring from the diagnostics page
- Updated `ainative-app` skill docs

**Excluded:**
- LLM-generated KPI suggestions ("here are 4 useful KPIs for your app") — pure rule-based suggestions only in this feature
- A full visual layout editor (drag-drop bento) — out of scope; chat is the authoring surface
- New kit ids or new KPI source kinds (those require code changes per strategy)
- Multi-user collaboration on view editing (single-user only)
- Undo/redo of view changes (the manifest sheet shows current state; users can re-edit if needed)

## References

- Source: `ideas/composed-apps-domain-aware-view.md` — section 8 (Phase 5 — Polish, "Manifest authoring UX"), section 13 shard #7
- Related features: `composed-app-manifest-view-field` (defines the schema this writes to), `composed-app-auto-inference-hardening` (provides the diagnostics integration), `chat-app-builder` (existing chat-driven app authoring), `nl-to-composition-v1` (existing planner pattern)
- Reference: existing tool registration in `src/lib/chat/tools/`, `AppMaterializedCard` and `ExtensionFallbackCard` for chat surface patterns
- Anti-pattern reminders: tools never bypass `ViewSchema` validation; manifest writes are atomic; no escape hatches that allow arbitrary YAML
