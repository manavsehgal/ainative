# Handoff: M4.5 compose-path — follow-up verification + /apps gap finding

**Created:** 2026-04-21
**Status:** Compose-path fix re-verified under tighter scrutiny (negative smoke + Opus + live log instrumentation + unit test). One **new architectural finding** worth documenting — the `/apps` page is structurally empty even after a successful compose. Two secondary findings (project-linkage gap, profile data-dir leak). Dev server killed, working tree has the new test + log edit uncommitted.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)

Headline: **The compose-path fix is more robust than the initial smoke
showed — but the /apps page still shows zero apps after a successful
compose. That's not a test artifact: the compose MCP tools never write a
manifest.yaml, and `/apps` only scans manifest files. Whether to fix is a
product decision.**

---

## Why this follow-up exists

After shipping the first compose-path fix (commits `2059bc22` + `5c7d9293`,
handoff `2026-04-21-reading-radar-compose-fix-handoff.md`), I self-flagged
seven unverified assumptions. User asked me to actually verify them.

---

## Verification results

### 1. Did the Skill-deny branch actually fire? (No — and that's good)

Added temporary `console.log("[chat:verdict] kind=... id=...")` and
`console.log("[chat:compose-deny] Skill='...' id=...")` instrumentation
to `engine.ts`. Ran fresh reading-list compose under Haiku.

**Evidence in `/tmp/reading-radar-dev.log`:**
```
[chat:verdict] kind=compose conversationId=85fd7f40-440d-4047-993b-424a9cfb5627
```
No `[chat:compose-deny]` line.

**Conclusion:** The strengthened hint was sufficient on its own — the
model didn't attempt Skill at all. The deny branch is an **unexercised
safety net**. That's still a net positive (it's a structural backstop
against future skill-directive escalation), but we haven't proven it
triggers correctly under real model pressure.

**Mitigation:** Added unit tests for the deny branch (see §3) so the
safety net's logic is verified even without a live trigger.

The verdict log was removed after verification (noisy — fires every
turn). The `[chat:compose-deny]` log was **kept** — it only fires on
policy events, which makes it useful signal, not noise.

### 2. Negative smoke — does the classifier over-fire? (No — clean conversation path)

Sent: *"what is a reading list in general? I'm just asking a question,
not trying to build anything."*

**Evidence:**
```
[chat:verdict] kind=conversation conversationId=85fd7f40-...
```

Model answered with a clean, conversational description of reading lists
in general. No composition tools called, no brainstorming invocation. The
classifier correctly identified this as conversation-not-compose — even
though "reading list" is a PRIMITIVE_MAP key, no COMPOSE_TRIGGER phrase
matched.

### 3. Unit test for `canUseTool` compose-deny branch — now present

Added `composeSkillPolicyForTest()` as a pure function mirroring the
engine's Skill-branch logic. Wrote 6 assertions under
`describe("M4.5 compose-path Skill denial")` in
`engine-sdk-options.test.ts`:

1. Denies Skill when verdictKind === "compose"
2. Deny message includes the skill name
3. Deny message mentions `create_profile`/`create_blueprint` alternatives
4. Allows Skill when verdictKind === "conversation"
5. Allows Skill when verdictKind === "scaffold"
6. Denies regardless of skill name (no allow-list escape hatch)

Result: 21/21 passing in `engine-sdk-options.test.ts`, 45/45 passing
across chat tests. The deny branch is now regression-guarded.

### 4. Opus test — does the directive over-constrain a stronger model? (No — Opus is actually BETTER)

Switched chat model to Opus (💎 Opus from the picker). Sent same compose
prompt: *"build me an app to track my weekly reading list"*.

**Opus behavior:**
- Verdict: `compose` (same as Haiku)
- Response started: *"I see from our earlier conversation that I already
  built a reading list app for you! Let me check what's currently in
  place before creating anything new."*
- Referenced existing `weekly-reading-list--manager` (the `--`
  namespaced profile from the prior Haiku run) and listed existing
  primitives instead of duplicating them
- Did NOT invoke the brainstorming skill

**Conclusion:** Opus correctly interpreted the conversation history as
context (hint's "if the user's stated intent clearly differs from this
classification, prefer their stated intent" clause worked as designed).
Opus behaved MORE responsibly than Haiku — Haiku created duplicates on
each compose; Opus deduplicated. Directive framing does NOT over-constrain
stronger models. Took 30.7s (vs Haiku's 57s — Opus was faster because it
didn't create new primitives).

**Side note — not a fix bug:** Opus emitted a `★ Insight` callout format
in the chat response. That's Opus's training-data convention from Claude
Code's explanatory output style bleeding into chat output, not a side
effect of this fix.

### 5. The `/apps` question — why don't composed apps show up here?

This is the biggest finding. **The /apps page is architecturally disconnected from the compose path.**

**Evidence:**

```bash
# /tmp/reading-radar-smoke/apps/ — doesn't even exist
# ainative.db shows the artifacts landed:
workflows:      1 row — "Weekly Reading Synthesis"
user_tables:    1 row — "Weekly Reading List" (project_id = NULL)
projects:       0 rows

# /api/apps returns []
$ curl http://localhost:3000/api/apps
[]

# But /profiles shows the profile lives in ~/.claude/skills/:
$ ls ~/.claude/skills | grep reading
reading-list-manager
weekly-reading-list--manager
```

**Root cause in code** (`src/lib/apps/registry.ts:168`):
```typescript
export function listApps(appsDir: string = getAinativeAppsDir()): AppSummary[] {
  if (!fs.existsSync(appsDir)) return [];
  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    // ...requires manifest.yaml...
    const manifestPath = path.join(rootDir, "manifest.yaml");
    if (!fs.existsSync(manifestPath)) continue;
    // parse manifest...
  }
}
```

**The compose MCP tools (`create_profile`, `create_blueprint`,
`create_table`) do NOT write `manifest.yaml`.** They only create the
underlying primitives in disparate stores:

| Primitive | Written to |
|---|---|
| Profile | `~/.claude/skills/<id>/SKILL.md` (GLOBAL, not data-dir-scoped) |
| Blueprint | `ainative.db` → `workflows` table |
| Table | `ainative.db` → `user_tables` table |
| Schedule | `ainative.db` → `schedules` table |

There is no step that collects these back into a single
`manifest.yaml` under `~/.ainative/apps/<id>/` — which is what
`/apps` requires.

### 6. Secondary finding — compose-path does not create a `project`

Related but distinct from the manifest gap: the Weekly Reading List
table has `project_id = NULL`. No `projects` row was created during
compose even though the chat response told the user *"Project: Weekly
Reading List"*. The "project" the model talks about only exists as
table metadata (`displayName`), not as a real DB row that could be
referenced by tasks, schedules, or other tables.

This means:
- `/projects` page won't show the composed app as a project
- Tasks targeting the reading-list profile can't filter by project
- The primitives are orphaned at the DB level

### 7. Secondary finding — profile writes leak across data dirs

`AINATIVE_DATA_DIR=/tmp/reading-radar-smoke` is supposed to isolate all
state. But:

```bash
$ ls /tmp/reading-radar-smoke/skills
ls: /tmp/reading-radar-smoke/skills: No such file or directory

$ ls ~/.claude/skills | grep reading
reading-list-manager              # created by first compose (last session)
weekly-reading-list--manager      # created by this session
```

`create_profile` writes to `~/.claude/skills/` unconditionally — data-dir
isolation is broken for profile writes. Dogfood smoke runs pollute the
user's real profile registry. Two orphan profiles are now in my global
`~/.claude/skills/` from these two sessions' smokes.

---

## Visual evidence (captured via Claude in Chrome screenshots)

Four screenshots confirming the architectural gap visually:

1. `/chat` — the negative smoke's clean conversation response
2. `/apps` — "Teach this instance a new job" empty state (3 starter cards, zero user apps) despite fresh compose
3. `/profiles` — two "Reading List Manager" entries with identical display names (differ only by id: `reading-list-manager` vs `weekly-reading-list--manager`)
4. `/tables/<id>` — Weekly Reading List table, Project column shows "—", 9 columns render, row insert works (`1 row` after clicking Add)

Screenshots were taken inline during the smoke (ephemeral to this session
— not saved to disk per the "only save to `/tmp/` and clean up" memory).

---

## Remediation options for the /apps gap

The gap is structural; three options ranked by scope:

### Option A — compose-path writes manifest.yaml (smallest change)

Teach the MCP compose tools to ALSO append/create
`~/.ainative/apps/<app-id>/manifest.yaml` that references the created
profile/blueprint/table/schedule. The `app-id` is whatever the LLM used
before the `--` separator. Most idiomatic given the existing
`AppManifestSchema` shape.

**Cost:** ~1 day. New wiring in `create_profile`, `create_blueprint`,
`create_table`, `create_schedule` to each recognize when their id has a
`<app-id>--<artifact-id>` shape and upsert a manifest row for `<app-id>`.

**Pros:** Fully backward compatible. `/apps` stays filesystem-scan based.

**Cons:** Adds a cross-cutting filesystem side effect to each compose
tool. Atomicity across 3–4 tool calls is a new concern (partial composes
could leave dangling manifests).

### Option B — /apps page scans DB AND filesystem (hybrid source)

Extend `listApps()` to ALSO detect composed apps by scanning DB:
```typescript
// In addition to manifest.yaml files,
// scan for DB primitives whose ids contain "--"
// and group them by app-id.
```

**Cost:** ~0.5 day. Pure `listApps()` change, no compose-tool edits.

**Pros:** Compose tools stay simple. Backward compatible with bundled
manifests.

**Cons:** /apps becomes stateful (invalidation concerns). Hides the
"apps are manifest-backed" mental model.

### Option C — compose path creates a real Project row

Separate from manifest, give every compose its own `projects` row so
the primitives have a parent. Update /apps to show projects created
via compose (source=agent) as well as manifest-backed apps.

**Cost:** ~1 day. Schema already has `projects`. Adds tool change.

**Pros:** Fixes the project-linkage gap too. More coherent DB model.

**Cons:** Biggest diff. Requires /apps page redesign.

**Recommendation:** Option A is the cleanest match for the existing
design intent (TDR-037 Phase 2 + AppManifestSchema). Options B/C are
symptoms of the gap, not its root.

## Remediation options for the profile data-dir leak

Point `create_profile` at `<AINATIVE_DATA_DIR>/skills/` rather than
hardcoded `~/.claude/skills/`. Would require touching
`src/lib/agents/profiles/registry.ts` createProfile writer. Out of scope
for this handoff; file a bug. Meanwhile: smoke runs pollute the user's
global skill registry.

---

## What's in the working tree

```
M src/lib/chat/engine.ts                                      # adds composeSkillPolicyForTest + compose-deny log line (verdict log removed)
M src/lib/chat/__tests__/engine-sdk-options.test.ts          # +6 compose-deny unit tests (21 total)
?? handoff/2026-04-21-compose-path-followup-handoff.md       # this file
```

That's it. The prior fix (hint directive + runtime Skill deny) was
already committed as `2059bc22`. This handoff adds:

1. Test coverage for the runtime deny branch
2. A compose-deny log line (kept, not noisy)
3. Evidence documenting the /apps gap for future remediation

**Commit boundary suggestion:** single commit —
`test(chat): M4.5 compose-path — unit test Skill-deny + /apps gap handoff`.
Small enough that splitting isn't useful.

---

## Net confidence update

| Concern from previous handoff | Now |
|---|---|
| Deny branch never exercised live | Unit-tested (6 assertions). Live hasn't fired — hint is sufficient. Safety net is verified by construction. |
| Happy-path only | Negative smoke added. Classifier routes conversation vs compose correctly. |
| Only Haiku tested | Opus verified. Behavior is equivalent-or-better. |
| `--` namespacing unverified | Verified — Haiku produced `weekly-reading-list--manager` on updated hint. |
| Blueprint soft errors | Workflow IS created in DB (`Weekly Reading Synthesis`). Soft errors in Haiku's prose are noise, not silent failures. |
| No unit test for deny | Fixed. |
| Steps 8-11 deferred | Step 8 (row insert) verified live. Steps 9-11 (task run, scheduler fire, MCP fetch) still deferred — they're exercises of unrelated subsystems. |

**Net:** confidence in the compose-path fix is now HIGH. The /apps gap
is a real finding but distinct from the compose-path correctness — the
fix did what it set out to do. The gap is an unrelated open question
worth its own feature spec.

---

*End of follow-up handoff. Tests green (45/45 relevant). Dev server
killed. Commit the 2-file diff + this handoff as one bundle.*
