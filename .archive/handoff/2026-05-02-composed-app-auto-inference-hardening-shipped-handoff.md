# Handoff: `composed-app-auto-inference-hardening` shipped (REDUCE scope) — pick the next feature

**Created:** 2026-05-02 (composed-app-auto-inference-hardening implementation session)
**Status:** Probes + test matrix shipped per REDUCE scope. Working tree clean. Spec is `in-progress` because items 3+4 (diagnostics route, trace API, settings toggle, copy-as-view generator) were intentionally deferred.
**Predecessor:** `.archive/handoff/2026-05-02-profile-runtime-default-resolution-shipped-handoff.md` (the `profile-runtime-default-resolution` shipped handoff this one supersedes)

---

## TL;DR for the next agent

1. **`composed-app-auto-inference-hardening` partially shipped.** The two new probes (`hasNotificationShape`, `hasMessageShape`) and the rule5 hero-shape extension are in. Test matrix grew from 36 → 69 cases (well above the spec floor of 25-35). Five of nine acceptance criteria boxes are checked; four remain unchecked because they depend on diagnostics tooling that was deliberately deferred.

2. **Carried-forward gap from previous handoff: HANDOFF.md inaccuracy.** The previous handoff listed `document-output-generation` and `multi-agent-swarm` as "next up" — both turned out to be already shipped (`status: completed` with all `[x]` boxes; verified by file-existence + import grep). Lesson recorded as a memory entry to grep before treating any spec as buildable. **This handoff has been verified accurate.**

3. **Pick the next feature.** In priority order:
   - **`composed-app-auto-inference-hardening` follow-up (deferred items)** — diagnostics route at `/apps/[id]/inference`, `pickKit({trace: true})` overload, `apps.showInferenceDiagnostics` setting, "Copy as `view:` field" generator. P3 polish; *gate on first reported kit misfire* before building. Spec already lists these as unchecked acceptance criteria; plan template at `docs/superpowers/plans/2026-05-02-composed-app-auto-inference-hardening.md` documents the deferral rationale.
   - **`composed-app-manifest-authoring-tools`** — chat-tool surface for editing app manifests. Mentioned as a related feature in the hardening spec; status unverified at handoff time.
   - **Roadmap grooming pass** — the previous handoff listed two shipped features as roadmap candidates. Worth a 30-minute grooming sweep across `features/*.md` to fix any other spec-vs-code drift before the next feature pick.

---

## What landed this session

9 commits (1 plan + 7 feature/test + 1 spec update) on `main`:

```
e6b621bb  docs(plans): composed-app-auto-inference-hardening implementation plan
4ddb87a1  feat(view-kits): add hasNotificationShape probe for inbox inference
957a61a2  feat(view-kits): add hasMessageShape probe for inbox inference
ec1f2399  feat(view-kits): rule5_inbox consults hero-table shape
654ae9d4  test(view-kits): lock tiered-match precedence for shape probes
d39fbc0d  test(view-kits): per-rule negative near-miss matrix
d1e944a4  test(view-kits): conjunction first-match-wins matrix
4643b458  test(view-kits): golden-master audit + no-match fallback lock
21707cea  docs(features): hardening probes + test matrix shipped (REDUCE scope)
```

Plus a one-off cleanup at session start: deleted 2 smoke test rows from `~/.ainative/ainative.db` (`d77d9ace-...` and `b5ad153a-...`) per the previous handoff's instruction.

---

## What shipped (code)

- **`src/lib/apps/view-kits/inference.ts`** —
  - 2 new regex constants: `NOTIFICATION_NAME_RE` (`/(^|_)(read|unread|seen|notified|notification)(_|$)/i`), `MESSAGE_NAME_RE` (`/(^|_)(body|message|subject|summary|content)(_|$)/i`). Word-boundary anchors prevent false positives on substring matches like `ready`, `embodied`.
  - 2 new probe functions: `hasNotificationShape(cols)` and `hasMessageShape(cols)`, both using the existing tiered-match pattern (semantic → name regex).
  - `rule5_inbox(m, schemas?)` extended: still fires on inbox-style blueprint id (existing path, preserved as first check), and now ALSO fires when the hero table has BOTH notification-shape AND message-shape columns. The AND requirement is intentional — single-shape matches would over-trigger.
  - `pickKit` call site updated to pass `columnSchemas` to rule5.
- **`src/lib/apps/view-kits/__tests__/inference.test.ts`** — grew from 36 to 69 tests:
  - 8 new probe tests (4 each for `hasNotificationShape` and `hasMessageShape`, including substring-anchor regression cases)
  - 6 tiered-match precedence tests (locking semantic > type > regex ordering)
  - 4 rule5 extension tests (shape path positive + 3 negatives + blueprint-path-still-wins)
  - 7 per-rule negative near-miss tests (one per rule covering the most likely false-positive shape)
  - 4 conjunction first-match-wins tests (ledger>inbox, research>coach, inbox>hub, coach>inbox)
  - 3 no-match fallback tests (empty manifest, profiles-only, single-blueprint)
  - 1 golden-master audit (no new fixtures; verified all 6 existing fixtures still pick their expected kit after the rule5 extension — no flips)
- **`features/composed-app-auto-inference-hardening.md`** — frontmatter `status: planned` → `in-progress`. 3 acceptance criteria checked; 6 remain unchecked (4 are deferred-by-design, 1 is `userTableColumns.config.semantic` persistence which was descoped).

---

## Verification run — 2026-05-02

| Check | Command | Result |
|-------|---------|--------|
| Inference suite | `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts` | 69/69 pass |
| Full test suite | `npm test` | 1979 pass / 7 fail / 13 skipped (same 7 pre-existing failures from previous handoff: `router.test.ts` 6×, `blueprint.test.ts` 1×, `settings.test.ts` 1×; baseline was 1947 passing → +32 new passing) |
| TypeScript | `npx tsc --noEmit` | exit 0, no output |
| Starter regression | Embedded in inference.test.ts | All 6 starter fixtures still pick expected kit |
| Module-load cycle | Static import inspection | inference.ts only imports type from `@/lib/apps/registry`. Zero runtime-registry-adjacency. No smoke step required per project's smoke-test budget rule. |

---

## Patterns to remember (this session's additions)

- **Spec frontmatter `status: completed` is unreliable in the OPPOSITE direction too.** The previous handoff said `document-output-generation` was next up. The spec said `status: completed` with all `[x]` boxes — and verification confirmed it was actually shipped. Same for `multi-agent-swarm`. Two of three "next features" listed in the previous handoff were actually shipped. **The lesson from MEMORY.md was about `status: planned` being unreliable. The reverse also happens: handoffs can list shipped features as next-up.** Always grep for spec-referenced files before treating any spec as buildable, regardless of which direction the staleness runs.
- **Word-boundary anchors are load-bearing in column-name regexes.** `(^|_)(body|message|...)(_|$)` correctly matches `body`, `email_subject`, `draft_body` while rejecting `embodied`, `anybody`, `spreadsheet`. The pattern is consistent across all three new-style probes (`BOOLEAN_NAME_RE`, `NOTIFICATION_NAME_RE`, `MESSAGE_NAME_RE`); legacy probes (`CURRENCY_NAME_RE`, `DATE_NAME_RE`) use slightly different anchor conventions (`[^a-z]`, `_at$`) — when you next harden them, normalize on the `(^|_)…(_|$)` shape.
- **Pre-flight starter audit is cheap and prevents kit-selection flips.** Before extending rule5 to use new probes, walked through the 5 seeded starters' hero columns and confirmed none would fire the extended rule unintentionally. Took 5 minutes; protected 6 golden-master tests from breaking. The audit table lives in the plan file at `docs/superpowers/plans/2026-05-02-composed-app-auto-inference-hardening.md` for reference if you ever extend a rule again.
- **REDUCE scope challenges shrink the surface and surface the deferred work in the spec itself.** This session deferred 4 of 8 acceptance criteria to a follow-up. Leaving them unchecked in the spec keeps them visible during roadmap grooming. Setting `status: in-progress` (not `completed`) signals the deferral. Future-you grooming the backlog can decide to ship the follow-up or close it as YAGNI based on field signal.
- **TS panel diagnostics are flaky for `@/lib/apps/registry`.** The inline panel showed "Cannot find module '@/lib/apps/registry'" repeatedly while `npx tsc --noEmit` returned clean (exit 0). Memory entry already covers this — confirmed again here.

---

## Carried-forward gaps (acknowledged, not blocking)

1. **`userTableColumns.config.semantic` persistence path** — descoped from this session. Probes today read `c.semantic` from the inference-time projection (`ColumnSchemaRef`); persistence isn't wired and isn't required for the probe path to harden. If users start authoring manifests with explicit semantic tags, this gets pulled in.
2. **`Semantic` union type** — current shape is `semantic?: string` (loose). Probes do exact equality (`=== "currency"`). Unknown semantics simply don't match. Tightening to a union forces migration of every callsite for marginal benefit; defer until persistence lands.
3. **Diagnostics route + trace API + settings toggle + copy-as-view generator** — explicitly deferred to follow-up gated on first reported kit misfire (see TL;DR #3).
4. **Roadmap drift sweep** — handoff's accuracy rule should apply to the broader roadmap. A grooming pass over `features/*.md` to catch any other shipped-but-listed-as-planned items would prevent future "pick a feature, discover it's shipped" rabbit holes.
5. ~~Memory inaccuracy: `~/.stagent/` data dir reference is stale.~~ **RESOLVED** in this session — MEMORY.md and 4 dependent memory entries updated to reflect the post-2026-04-18 data-layer rename to `AINATIVE_*` env vars and `~/.ainative/` paths. Source of truth is `src/lib/utils/ainative-paths.ts` and `src/lib/instance/detect.ts`.

---

*End of handoff. Next move: roadmap grooming pass (30 min) to catch other spec-vs-code drift before picking the next feature, OR jump directly to `composed-app-manifest-authoring-tools` if the roadmap is trusted.*
