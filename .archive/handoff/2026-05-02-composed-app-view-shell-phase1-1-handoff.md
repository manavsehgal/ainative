# Handoff: Phase 1.1 shipped (composed-app view-shell) — Phase 1.2 is next

**Created:** 2026-05-02 (early morning)
**Status:** Phase 1.1 (`composed-app-view-shell`) shipped on `main` as commit `a43aae7d`. Working tree is clean except for this handoff. `main` is **1 commit ahead of `origin/main`** (just today's Phase 1.1) — the predecessor's "2 commits ahead" was stale; that lead was pushed between sessions. Push not done.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-01-composed-apps-strategy-and-7-specs-handoff.md`

---

## TL;DR for the next agent

1. **Phase 1.1 is done and verified.** The per-app screen at `/apps/[id]` is now a thin kit dispatcher (143 → 42 lines). The four-card composition view + files list moved into a sliding "View manifest ▾" sheet from the page header. `pickKit` is a stub that always returns the placeholder kit. Browser-smoked via Playwright (Claude in Chrome was offline) — sheet opens, all four composition cards + files + YAML render with no console errors.

2. **Start Phase 1.2 next: `composed-app-manifest-view-field`.** This is the second P1 feature in Phase 1. It replaces the stub `pickKit` with the real 7-rule decision table and adds the strict Zod `view:` field on `AppManifestSchema` (plus a golden-master test ensuring every existing starter app still parses). Spec at `features/composed-app-manifest-view-field.md` (141 lines, self-contained).

3. **One open question is now resolved.** `userTableColumns.config.semantic` (Phase 5) lives in the existing JSON `column.config` blob — **Option A**, no DB migration in Phase 1. Documented in this handoff and in the `composed-app-view-shell` changelog entry. Phase 1.2 doesn't need to revisit this.

4. **Push is the user's call.** One local commit ahead of `origin/main` (`a43aae7d` — Phase 1.1). Predecessor handoff's "2 ahead" was stale; the lead was pushed between sessions. Run `git log --oneline origin/main..HEAD` to confirm before pushing.

---

## What landed this session

```
src/lib/apps/view-kits/
  types.ts            # KitId, KitDefinition, ResolveInput, KitProjection,
                      #   RuntimeState, ViewModel, slot types (frozen contract)
  resolve.ts          # resolveBindings(manifest) → resolved IDs + cron
  data.ts             # server-only loadRuntimeState(app, bindings) wrapped in
                      #   unstable_cache (30s revalidate, app-runtime:<id> tag)
  index.ts            # registry + pickKit stub (always returns placeholder)
  kits/placeholder.ts # the only kit shipped — produces ViewModel with
                      #   header (title/desc/status) + footer (manifest pane)
  __tests__/resolve.test.ts       # 2 tests: empty + full manifest
  __tests__/placeholder.test.ts   # 2 tests: empty + full manifest

src/components/apps/kit-view/
  kit-view.tsx              # server component dispatcher: maps ViewModel
                            #   slots to slot views in canonical order
  manifest-pane-body.tsx    # the previous composition + files cards, moved
                            #   out of the route into the sheet body
  slots/header.tsx          # title + description + status chip + actions +
                            #   "View manifest ▾" trigger
  slots/manifest-sheet.tsx  # client wrapper: trigger button + sliding sheet
  slots/kpis.tsx            # placeholder; renders nothing if no tiles
  slots/hero.tsx            # passthrough; placeholder kit doesn't supply one
  slots/secondary.tsx       # 0..3 cards; placeholder kit doesn't supply any
  slots/activity.tsx        # passthrough; Phase 2's RunHistoryTimeline goes here
  slots/footer.tsx          # currently a no-op (manifest sheet mounts in header)

src/app/apps/[id]/page.tsx  # 143 → 42 lines; pure dispatcher

features/composed-app-view-shell.md  # status: planned → completed
features/roadmap.md                  # status column updated
features/changelog.md                # new 2026-05-02 entry
```

**Frozen contract recap:** kits are pure projection functions. `resolve(input) → projection`, `buildModel(projection, runtime) → ViewModel`. Kits never own React state and never fetch data; `data.ts` builds `RuntimeState` once per request and passes it in. This is the "kits are pure projection functions, not stateful components" TDR landing in code — `/architect` should capture it formally when convenient.

---

## Phase 1.2 brief — `composed-app-manifest-view-field`

Spec is self-contained at `features/composed-app-manifest-view-field.md` (141 lines). High-level shape:

- **Add a strict Zod `view:` field** on `AppManifestSchema`. Use `.strict()` only on the inner `view` object — every other manifest schema stays `.passthrough()` (per the 5-TDR queue from the strategy doc).
- **Replace the `pickKit` stub** in `src/lib/apps/view-kits/index.ts` with a real 7-rule decision table that resolves `view.kit` if present, otherwise falls back to a deterministic auto-inference based on column shapes / cron presence / table count / blueprint presence.
- **Wire `loadColumnSchemas(app)`** so the route can pass real column data to `pickKit`. Currently the route passes `[]`. The schemas come from the `userTableColumns` table joined to the manifest's `tables[].id`.
- **Golden-master test**: parse every YAML manifest under `~/.ainative/apps/*/manifest.yaml` and `src/lib/apps/starters/*` and assert each one still validates after the new strict `view:` field is added (it must be optional — every existing app omits it).

**Phase 1.2 gate:** unit tests cover all 7 decision-table branches; the route passes real column schemas; every starter app parses; `pickKit` returns the right kit id (still maps to placeholder until Phase 2).

**Where Phase 1.2 will rub against Phase 1.1's contract:**
- The `ColumnSchemaRef` type in `src/lib/apps/view-kits/types.ts` already accepts `semantic?: string`. Phase 1.2 will populate it from the JSON `column.config.semantic` field (Option A — see resolved decision below).
- `pickKit` signature is already `(manifest, columns: ColumnSchemaRef[])` — no change needed at the call site.

---

## Resolved decision (was open in predecessor handoff)

**`userTableColumns.config.semantic` lives in the JSON `column.config` blob** (Option A, no DB migration in Phase 1).

Reasoning recorded in the `composed-app-view-shell` changelog entry and reproduced here:
- Phase 1.1 spec scope explicitly excludes migrations
- Strategy doc takes a "no schema changes" stance across all 7 phases
- `semantic` is read at most ~6 times per page render (all cached)
- Other column metadata (currency, format, units) already lives in `column.config`
- If query ergonomics ever bite, lifting to its own column is a one-migration follow-up — much smaller blast radius than baking the wrong shape into Phase 1

Phase 5 (`composed-app-auto-inference-hardening`) should not revisit this without new evidence.

---

## Verification gap: Claude in Chrome was offline

Phase 1.1 browser smoke ran via **Playwright** as the second-tier fallback. Claude in Chrome extension returned "not connected" twice, so per project memory (`feedback-browser-tool-fallback.md`) we fell through. Playwright captured the rendered dispatcher page, clicked the "View manifest" trigger, and snapshotted the open sheet — composition cards (Profiles 1, Blueprints 1, Tables 2, Schedules 1), files list, and full YAML all rendered correctly. Console error count: 0.

Screenshot saved at `output/phase1.1-manifest-sheet-open.png` (gitignored). Safe to delete.

If a quick re-smoke is wanted with Claude in Chrome when the extension is back: visit `/apps/habit-tracker`, click "View manifest", verify the sheet opens with the four composition cards + files list + YAML.

---

## Repo state (audited 2026-05-02 ~early morning)

### Git
- Working tree clean (this handoff is the only change after staging it).
- `main` is **1 commit ahead of `origin/main`** — `a43aae7d` (Phase 1.1). Push not done.
- Run `git log --oneline origin/main..HEAD` before any push to verify the lead.

### Database & disk
Unchanged from predecessor handoff. 11 projects. 13 user_tables, 13 schedules, 4 user_table_triggers. `~/.ainative/apps/` still has only `habit-tracker/` (so Phase 1.1's spec acceptance criterion #6 — "every starter app renders" — is currently testable only against `habit-tracker` until more starters are installed).

### Tests
- 91/91 apps tests pass (4 new, 87 preexisting).
- Full `npx tsc --noEmit` clean.
- Phase 1.1's own test files: `src/lib/apps/view-kits/__tests__/{resolve,placeholder}.test.ts`.

---

## Carryover from prior session (still valid)

### Free-form compose hardening (~2 hr)

1. **"Extend existing app" affordance (~1.5-2 hr).** Today the planner has no `extend_app` mode — every compose creates a new app. Independent of the Composed Apps Domain View work; could ship interleaved between Phase 1.2 and Phase 2 if a session prefers compose-hardening.

2. **30-day soak on the 440-char generic hint.** Passive. Telemetry-gated, not actionable today.

### LLM smoke for noun-aware hint (~5 min when extension is up)

Deterministic side of commit `8acc55fa` is fully covered by unit tests. The LLM-side observation — does the model actually compose without scaffolding when given the new hint? — was not run because Claude in Chrome was offline both sessions. Quick smoke when extension is back:

- Send `"build me a github habit tracker"` in chat (dev server up).
- Expected: compose card titled "Habit Tracker" + a prose mention of "you'll need to scaffold a separate plugin to access github."
- Negative signal: a scaffold card means routing didn't land OR the LLM ignored the hint.

### Apps consumers — extract `useDeleteApp(args)` hook

Premature today (only 2 consumers). Wait until a third surface needs delete. CLAUDE.md DRY-with-judgment.

---

## Key patterns to remember

### From this session

- **`unstable_cache` cache key naming.** Used `["app-runtime", app.id]` + tag `app-runtime:<id>`. Phase 1.2 should reuse the same tag namespace if it adds new cached loaders (e.g. `app-columns:<id>`). Per Next.js 16, `unstable_cache` is still supported but the long-term direction is the `'use cache'` directive — fine to revisit later, not a blocker.
- **Preserve, don't delete, when refactoring user-facing surfaces.** The previous composition cards moved into the manifest sheet with zero content loss. Acceptance criterion explicitly called this out — readers/reviewers always check.
- **Browser-smoke gap is bounded but worth noting in handoffs.** Deterministic side via unit tests + tsc + curl is enough to ship; the live click verification adds last-mile confidence. Note the gap when it exists; don't block the commit.
- **Frozen contract phrasing matters.** Calling kits "pure projection functions" and writing it into `types.ts` doc comments makes the boundary clear for the next 6 kits to come.

### Carried over and still relevant

- **`APP_INTENT_WORDS` is the cleavage line between scaffold and compose for noun-bearing prompts.**
- **HANDOFF interpretation is itself a skill.** When predecessor language is technically muddy, fall back to: what does the user actually want? Build to that.
- **Phase 2 is the gate that matters** for the 7-feature initiative. Phase 1.1 (today) and Phase 1.2 (next) are necessary plumbing; Phase 2 is when users see the first real domain-aware kit (Tracker + Workflow Hub fallback).

---

*End of handoff. Next move: read `features/composed-app-manifest-view-field.md`, decide whether to push the 5-commit lead first, then start Phase 1.2 with the strict Zod `view:` field + golden-master test.*
