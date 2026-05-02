# Handoff: Phase 4 (`composed-app-kit-inbox-and-research`) shipped — pick the next feature

**Created:** 2026-05-02 (Phase 4 verification + ship session)
**Status:** Phase 4 fully shipped. Browser smoke complete across all 5 seeded kits (Inbox, Research, Tracker, Coach, Ledger), one runtime bug found + fixed during smoke (`"use client"` on a non-stateful SVG module), all unit tests still green. Working tree clean after this commit lands.
**Predecessor:** `.archive/handoff/2026-05-02-composed-app-kit-phase4-handoff.md` (the code-complete-but-smoke-deferred handoff this one supersedes)

---

## TL;DR for the next agent (or interactive session)

1. **Phase 4 is shipped.** The composed-app-kit feature surface now covers 6 kits (Tracker, Workflow Hub, Coach, Ledger, Inbox, Research) and 5 of them have a seeded smoke app at `~/.ainative/apps/{habit-tracker,weekly-portfolio-check-in,finance-pack,customer-follow-up-drafter,research-digest}/`. Workflow Hub has integration-test coverage but no seeded smoke app.

2. **Pick the next feature.** Two locked follow-ups deferred from Phase 4's design decisions:
   - **`row-trigger-blueprint-execution`** — wires the `trigger.kind: row-insert` manifest field through the workflow engine so blueprints actually fire when rows arrive at a user_table. The Phase 4 wave-1 column `tasks.context_row_id` is already in place to receive the engine's writes; the engine just needs a row-insert listener and a dispatcher that finds matching blueprints. Low-medium scope; gated on small surface area in `src/lib/workflows/engine.ts` + a row-insert hook in `src/lib/data/user-tables.ts`.
   - **`composed-app-auto-inference-hardening`** — tightens `pickKit`'s 7-rule decision table against ambiguous edge cases. Lower priority since current heuristic works for all 5 seeded apps.

   Either one is a solid next pickup. Use the brainstorming skill for either feature before plan-writing.

3. **Verification artifacts** are at `output/phase-4-{inbox-empty,inbox-draft,research,regression-tracker,regression-coach,regression-ledger}.png`. They are gitignored (per `output/` policy) — keep on disk for reference but don't try to commit them.

4. **Lesson worth carrying forward** — see "Patterns to remember" below. Phase 4's smoke caught a Next.js Server/Client boundary bug that all 11 KitView integration tests passed. This is a *second* class of wiring bug (after the runtime-registry class from earlier features) where unit tests structurally cannot catch the boundary. Future kit/component work that crosses Server↔Client should either factor non-component helpers out of `"use client"` modules or budget a real-browser smoke. The `composed-app-kit-inbox-and-research.md` feature spec has the full root-cause writeup in its "Verification run" section.

---

## What landed this session

Two commits on top of the Phase 4 series (1f0e + this handoff commit):

```
W7-fix  <pending>  fix(apps): drop unnecessary "use client" from throughput-strip + Phase 4 verification addendum
        <pending>  docs(handoff): Phase 4 shipped — pick row-trigger-blueprint-execution next
```

The fix is one line: removed `"use client";` from `src/components/apps/throughput-strip.tsx`. The component was always purely declarative SVG — no state, no effects, no handlers — and the directive was preventing the co-located `hasSentimentColumn` helper from being importable into `src/lib/apps/view-kits/kits/inbox.ts` (server context).

---

## Verification this session

- **Browser smoke (chrome-devtools-mcp), `PORT=3010 npm run dev`:**
  - `/apps/customer-follow-up-drafter` — trigger chip "Triggered by row insert in customer-touchpoints", no Run Now, 3 queue rows; click cft-r1 row → URL `?row=cft-r1` + draft pane shows Acme Corp reply markdown
  - `/apps/research-digest` — cadence chip "Friday 5pm", Run Now button, KPIs Sources=3 / Last synth "just now", 3 source rows, synthesis markdown + RunHistoryTimeline
  - Regression smokes: `/apps/habit-tracker`, `/apps/weekly-portfolio-check-in`, `/apps/finance-pack` all render console-clean
  - Workflow Hub has no seeded smoke app; integration test at `src/lib/apps/view-kits/__tests__/integration/workflow-hub-kit-view.test.tsx` covers DOM wiring
- **Console clean** on every page (only HMR connection messages, no warnings/errors)
- **Unit tests after fix:** `throughput-strip.test.tsx` 6/6, `inbox.test.ts` 7/7 — both green, confirming the `"use client"` removal is non-breaking

---

## Patterns to remember (this session's addition)

- **The `"use client"` directive should be the result of a real client-only React feature, not a default.** Pure SVG/declarative components (no `useState`, `useEffect`, event handlers, `useRef`, `useContext`, browser APIs) work as Server Components and benefit from being importable on either side. Adding `"use client"` to such a file is a footgun: it converts non-component named exports into server-side reference shims that throw on call, but the `*.tsx` extension makes it look benign. **Rule of thumb:** only add `"use client"` when something in the file genuinely needs the client runtime; if you co-locate a pure helper in a `"use client"` module, expect server consumers to break.
- **Server/Client boundary errors are a separate wiring-bug class from runtime-registry boundary errors** (the existing CLAUDE.md smoke-test budget rule). They share the property that Vitest + RTL pass them because both layers run in the same single client runtime. The pragmatic implication: any kit/component feature that adds a slot rendered server-side (kit `resolve()` is server-side) and imports from a `"use client"` module needs a real-browser smoke before ship. Integration tests are necessary but not sufficient.
- **chrome-devtools-mcp is the right tool when you need explicit screenshot file paths.** claude-in-chrome's `save_to_disk: true` doesn't surface the saved path in the tool result, so it's awkward when artifacts go to a specific folder. chrome-devtools-mcp's `take_screenshot` accepts an absolute `filePath` and returns it in the result — straightforward for verification artifacts that need to live next to the spec.

---

## Carried-forward gaps (acknowledged, not blocking)

1. **RunNowSheet variable end-to-end coverage gap (carried from prior handoff).** Integration tests assert the `Run Now` button renders, but don't click through to assert the sheet opens with the correct `variables` prop. Add a click-through test if RunNow regresses.
2. **Citation linkage ships empty.** `loadRuntimeStateUncached`'s research branch sets `researchCitations: []` per locked design decision. The actual citation linkage (mapping synthesis tasks back to source rows) needs follow-up data work — likely a separate feature.
3. **`loadLatestSynthesis` `instanceof Date` defensive code is dead** — Drizzle's `integer({ mode: "timestamp" })` always returns a Date. Cosmetic.
4. **`data.ts` is now ~798 lines.** Approaching unwieldy. Split per-kit if a future feature adds more loaders.
5. **Workflow Hub has no seeded smoke app.** Coverage exists only at the integration-test layer. Low risk because Workflow Hub is the most-tested kit (it shipped in Phase 1), but a smoke seed would close the gap.

---

*End of handoff. Next move: pick `row-trigger-blueprint-execution` or `composed-app-auto-inference-hardening`, brainstorm, plan, build.*
