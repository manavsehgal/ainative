# TDR-037 Phase 6 Design — `create_plugin_spec` + `ainative-app` fall-through + `ExtensionFallbackCard`

**Date:** 2026-04-20
**Status:** approved (user)
**Supersedes scope of:** `~/.claude/plans/time-to-consult-the-clever-rose.md` §Phase 6 (tightens v1 language/transport choice and defers planner-wiring to 6.5)
**Builds on:** TDR-037 `accepted` (commit `a6618e25`), Phase 4 live smokes

---

## Goal

Make user-authored plugin code as zero-ceremony to scaffold as composition. Today there is no chat tool that emits a Kind 1 MCP plugin — the Phase 6 strawman's `ExtensionFallbackCard` hand-waves the actual authoring. Close that gap with three independent pieces that all land on the TDR-037 self-extension path (zero capability accept, zero lockfile, zero confinement ceremony).

## Non-goals

- Plan planner integration for `ExtensionFallbackCard` — Phase 6.5.
- Scaffold Node/inprocess template bodies — v1 ships a TODO stub only; Phase 6.5 fills in.
- Build any `/plugins` page surface — Phase 5, explicitly deferred until first third-party plugin exists.
- Auto-reload / auto-register the scaffolded plugin — user reloads ainative (matches echo-server onboarding).
- Write real seatbelt/apparmor policy corpus — M3.5 commitment.
- Touch any M3 plugin-trust machinery (capability-check, confinement, tool-permissions) — Phase 6 is additive-only on top of Phase 4.

---

## Architecture

Three independent pieces, one thematic goal. All three rely on TDR-037 classification: every plugin this phase scaffolds writes `author: "ainative"` **AND** `origin: "ainative-internal"` so the classifier returns `"self"` deterministically via signal #1 AND signal #2 (belt-and-suspenders; either alone suffices).

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. create_plugin_spec chat tool                                  │
│    src/lib/chat/tools/create-plugin-spec-tool.ts                 │
│    ─ scaffolds ~/.ainative/plugins/<id>/ with 4 files            │
│    ─ returns summary to chat                                     │
│    ─ registered in src/lib/chat/ainative-tools.ts                │
├──────────────────────────────────────────────────────────────────┤
│ 2. ainative-app skill SKILL.md edit                              │
│    .claude/skills/ainative-app/SKILL.md                          │
│    ─ Phase 2/4 fall-through: call create_plugin_spec when        │
│      composition can't express user's ask                        │
│    ─ dual-target: plugin dir + optional apps manifest            │
├──────────────────────────────────────────────────────────────────┤
│ 3. ExtensionFallbackCard chat component (renderable only in v1)  │
│    src/components/chat/extension-fallback-card.tsx               │
│    ─ two paths: "Try this" compose-alt | "Scaffold a plugin"     │
│    ─ Calm Ops opaque surface                                     │
│    ─ wired to planner in Phase 6.5                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Piece 1 — `create_plugin_spec` chat tool

### Input schema (Zod)

```ts
{
  id: string,                        // slug, kebab-case only, e.g. "github-mine"
  name: string,                      // human label
  description: string,               // one-sentence purpose
  capabilities: string[],            // declared capability strings (may be [])
  transport: "stdio" | "inprocess",  // v1: only "stdio" scaffolds real code
  language: "python" | "node",       // v1: only "python" scaffolds real code
  tools: Array<{
    name: string,
    description: string,
    inputSchema?: unknown            // passed through to server stub
  }>
}
```

### Write target

`~/.ainative/plugins/<id>/` — resolved via `getAinativePluginsDir()` from `src/lib/utils/ainative-paths.ts` (pattern matches `getAinativeAppsDir()`). Refuses to overwrite an existing directory.

### Files written

**`plugin.yaml`:**
```yaml
id: <id>
version: 0.1.0
apiVersion: "0.14"
kind: chat-tools
name: <name>
description: <description>
author: ainative
origin: ainative-internal
capabilities: [<capabilities...>]
tools:
  - name: <tool.name>
    description: <tool.description>
```

**`.mcp.json`:**
```json
{
  "mcpServers": {
    "<id>": {
      "command": "python3",
      "args": ["${PLUGIN_DIR}/server.py"],
      "transport": "stdio"
    }
  }
}
```
(v1 always writes stdio+python; `transport: "inprocess"` or `language: "node"` writes a stub `.mcp.json` with a TODO marker.)

**`server.py`:**
Clone of echo-server's handler pattern (lines 1–128 of `src/lib/plugins/examples/echo-server/server.py`). Each declared tool becomes a handler stub that returns `{ "stub_for": "<tool.name>", "args": <args-json> }` so the plugin is immediately runnable end-to-end. User subsequent edits fill in business logic.

**`README.md`:**
Brief onboarding — how to reload ainative to register, how to edit `server.py`, a pointer to `src/lib/plugins/examples/echo-server/` for reference, note that `origin: ainative-internal` is sticky (do not change).

### Return shape

```ts
{
  ok: true,
  id: string,
  pluginDir: string,        // absolute path
  files: { pluginYaml, mcpJson, serverPy, readme },  // relative paths
  tools: string[],          // tool names scaffolded
  message: string           // "Scaffolded <id>. Reload ainative to register."
}
```

### Error handling

Every error has a name (CLAUDE.md principle #2):

- `PluginSpecAlreadyExistsError` — dir exists; includes path. User must delete manually.
- `PluginSpecInvalidIdError` — id fails `/^[a-z][a-z0-9-]*[a-z0-9]$/` or is reserved (e.g. "echo-server"). Includes acceptable pattern.
- `PluginSpecWriteError` — fs failure during write; includes offending path and cause.

### Atomicity

Write all 4 files to a sibling temp dir (`<id>.tmp-<timestamp>`), then `fs.renameSync` to `<id>`. On any write failure, remove the temp dir and surface `PluginSpecWriteError`. No partial state.

### Tool registration

Registered in `src/lib/chat/ainative-tools.ts` as the fifth `create_*` primitive alongside `create_profile`, `create_blueprint`, `create_table`, `create_schedule`. Brings chat tool count from 91 → 92.

---

## Piece 2 — `ainative-app` skill fall-through

### Scope

Extend `.claude/skills/ainative-app/SKILL.md` Phase 2 (match-or-author primitives) and Phase 4 (emit artifacts) to describe a fall-through: when composition cannot express the user's ask, call `create_plugin_spec` inline instead of declaring the app incomplete.

### Behavior

When Phase 2 determines a required primitive doesn't fit composition (e.g., the user needs a tool that reads an external HTTP API), the skill:

1. Explains the gap to the user in one sentence.
2. Invokes `create_plugin_spec` with inferred inputs (id derived from app slug, tools from the user's description).
3. **Dual-target writes:**
   - `~/.ainative/plugins/<slug>/` — executable plugin (four files from Piece 1).
   - `~/.ainative/apps/<app-id>/manifest.yaml` — thin composition manifest that *references* the plugin (so `/apps` surfaces the composed app, not just the bare plugin).
4. Reports both targets to the user with next-step edit instructions.

### Contract preservation

The skill's existing manifest-location fix from Phase 4 (write apps to `~/.ainative/apps/<app-id>/`, NOT `.claude/apps/*`) is preserved. Phase 6 layers plugin-scaffold onto that — same `~/.ainative/` root, different subdirectory (`plugins/` vs `apps/`).

The `origin: ainative-internal` sticky contract is called out explicitly — user edits after scaffold must not strip this field, or the classifier flips the plugin to third-party.

---

## Piece 3 — `ExtensionFallbackCard`

### File

`src/components/chat/extension-fallback-card.tsx` — follows `src/components/chat/app-materialized-card.tsx` structural conventions (same file size target, same imports, same Calm Ops surface patterns).

### Props

```ts
type ExtensionFallbackCardProps = {
  explanation: string;              // one-sentence why composition can't do it
  composeAltPrompt: string;         // rephrased request that could be composed
  pluginSlug: string;               // proposed scaffold id
  pluginInputs: CreatePluginSpecInput;  // pre-inferred scaffold inputs
  onTryAlt: (prompt: string) => void;
  onScaffold: (inputs: CreatePluginSpecInput) => Promise<ScaffoldResult>;
  initialState?: "prompt" | "scaffolded" | "failed";
};
```

### Visual

```
┌───────────────────────────────────────────────────────────────┐
│ [!] I can't build this with composition alone                 │
│     "<one-sentence explanation from planner>"                 │
│                                                                │
│     Closest compose-only version:                              │
│     → <alt phrasing>                            [Try this]    │
│                                                                │
│     Scaffold a plugin for it:                                  │
│     → Writes ~/.ainative/plugins/<slug>/ [Scaffold + open]    │
└───────────────────────────────────────────────────────────────┘
```

- Calm Ops: opaque `surface-2` background, `border`, `rounded-lg`. No glass, no backdrop-filter.
- Status icon left (lucide `AlertCircle`), copy center, buttons right-aligned within each action row.
- Two paths only, not three (frontend-designer §3 authority).

### States

| State | UI |
|---|---|
| `prompt` (default) | Full card, both action buttons enabled |
| `scaffolded` | Collapsed: "Scaffolded `<slug>`. Edit `<pluginDir>/server.py` to fill in logic." + [Open folder] button |
| `failed` | Collapsed: error name + message, [Retry] button |

### Scope limit for v1

The chat planner integration that *triggers* this card is OUT of scope for Phase 6. We ship the card as a renderable component plus a fixture-backed test suite. Wiring to the planner lands in Phase 6.5 — mirrors how `app-materialized-card.tsx` shipped renderable-first.

---

## Data flow — end-to-end

```
user: "I need a tool that pulls my GitHub issues assigned to me"
  ↓  (chat planner: composition can't express, emits fallback_card event)
  ↓
[ExtensionFallbackCard rendered in chat transcript]
  ↓  user clicks "Scaffold a plugin"
  ↓
[chat invokes create_plugin_spec({ id: "github-mine", language: "python", transport: "stdio", ... })]
  ↓
[atomic write to ~/.ainative/plugins/github-mine/ — 4 files]
  ↓  returns { ok: true, pluginDir, ... }
  ↓
[card collapses to "scaffolded" state with link to plugin dir]
  ↓  user reloads ainative
  ↓
[plugin discovered by src/lib/plugins/registry.ts scan]
[classifyPluginTrust(manifest, rootDir) → "self"  (signal 1: origin === "ainative-internal")]
[capability-check early-returns "accepted" — NO lockfile write, NO ceremony]
[mcp-loader spawns: python3 ~/.ainative/plugins/github-mine/server.py]
[tools appear in chat as mcp__github-mine__<tool-name>]
```

---

## Tests

### `src/lib/chat/tools/__tests__/create-plugin-spec-tool.test.ts` (new)

- Happy path: scaffold writes all 4 files at `~/.ainative/plugins/<id>/`
- `plugin.yaml` contains `author: ainative` AND `origin: ainative-internal`
- `.mcp.json` has correct stdio+python transport config with `${PLUGIN_DIR}` template
- `server.py` imports nothing beyond stdlib; has a handler stub per declared tool
- `README.md` is non-empty and references echo-server
- Refuses to overwrite existing dir → `PluginSpecAlreadyExistsError`
- Rejects invalid id (uppercase, spaces, leading digit) → `PluginSpecInvalidIdError`
- Rejects reserved id ("echo-server") → `PluginSpecInvalidIdError`
- Atomic-write: simulated mid-write failure leaves no partial `<id>` dir (only `<id>.tmp-*`, cleaned up)
- **Classifier integration assertion:** load the written manifest via `readYaml`, call `classifyPluginTrust(manifest, pluginDir)`, expect `"self"`. Proves the Phase 4 classifier routes scaffold output correctly without a separate smoke.

Use `AINATIVE_DATA_DIR` override to isolate test writes to a temp dir.

### `src/components/chat/__tests__/extension-fallback-card.test.tsx` (new)

- Renders in `prompt` state with explanation, compose-alt, and scaffold paths
- "Try this" button invokes `onTryAlt` with the compose-alt prompt
- "Scaffold a plugin" button invokes `onScaffold` with the provided inputs
- On `onScaffold` success, transitions to `scaffolded` state with collapsed copy
- On `onScaffold` failure, transitions to `failed` state with error + retry button
- Snapshot stability (Calm Ops surface classes unchanged)

### SKILL.md edit — no tests

Skill is a Markdown instruction document. Verification is inline review — manifest-location fix from Phase 4 stays intact, fall-through section added at Phase 2/4 references.

---

## Verification

### Commands to run after implementation

```bash
# 1. Typecheck clean
npx tsc --noEmit

# 2. New test suites green
npm test -- src/lib/chat/tools/__tests__/create-plugin-spec-tool.test.ts
npm test -- src/components/chat/__tests__/extension-fallback-card.test.tsx

# 3. Chat tool count regression — should be 92, was 91
rg -l "buildMcpTool|ainativeTools" src/lib/chat/ | xargs -I{} echo {} | wc -l

# 4. No runtime-registry imports from new files — verify Phase 6 additions stay out of the catalog chain
rg "from\s+['\"].*runtime/catalog" src/lib/chat/tools/create-plugin-spec-tool.ts \
  src/components/chat/extension-fallback-card.tsx
# Expect: zero matches. (Phase 6 must not trigger the CLAUDE.md smoke-test budget.)

# 5. Manual smoke — not required per CLAUDE.md (chat-tools/components, not runtime-registry)
#    But a sanity check: invoke create_plugin_spec in chat with test inputs, verify files
#    land at ~/.ainative/plugins/<id>/ and classifier returns "self".
```

### CLAUDE.md smoke-test budget

Not triggered. Phase 6 adds imports only in:
- `src/lib/chat/tools/create-plugin-spec-tool.ts` (new; imports `node:fs`, `node:path`, Zod, manifest types)
- `src/lib/chat/ainative-tools.ts` (tool registration)
- `src/components/chat/extension-fallback-card.tsx` (new; imports React, lucide icons, shadcn primitives)
- `.claude/skills/ainative-app/SKILL.md` (Markdown only)

None of these are transitively reachable from `@/lib/agents/runtime/catalog.ts`. Verified via grep during exploration.

---

## Critical-file cross-reference

| Purpose | Path | Action |
|---|---|---|
| New chat tool | `src/lib/chat/tools/create-plugin-spec-tool.ts` | create |
| Chat tool registration | `src/lib/chat/ainative-tools.ts` | modify (add tool) |
| Plugin path util (may need extension) | `src/lib/utils/ainative-paths.ts` | modify if `getAinativePluginsDir()` missing |
| Chat tool tests | `src/lib/chat/tools/__tests__/create-plugin-spec-tool.test.ts` | create |
| Skill extension | `.claude/skills/ainative-app/SKILL.md` | modify |
| Fallback card component | `src/components/chat/extension-fallback-card.tsx` | create |
| Fallback card tests | `src/components/chat/__tests__/extension-fallback-card.test.tsx` | create |
| Echo-server reference (read-only) | `src/lib/plugins/examples/echo-server/*` | no change |
| Manifest schema (read-only) | `src/lib/plugins/sdk/types.ts` | no change — `author` + `origin` already optional per TDR-037 |
| Classifier (read-only) | `src/lib/plugins/classify-trust.ts` | no change — tests will assert classifier returns `"self"` for scaffold output |

---

## Regression guards — don't undo these

- **Scaffold must write BOTH `author: "ainative"` AND `origin: "ainative-internal"`.** Either alone triggers classifier signal, but both survive future refactors independently. A future contributor stripping one thinking it's redundant breaks belt-and-suspenders.
- **v1 ships Python+stdio body only.** Node/inprocess writes a TODO stub. Phase 6.5 fills in Node. Do not retroactively scaffold Node in v1 without updating tests and SKILL.md examples.
- **No auto-reload / auto-register.** Plan says "next reload". Adding auto-reload couples `create_plugin_spec` to mcp-loader internals and bypasses the user's reload-as-checkpoint mental model.
- **ExtensionFallbackCard is renderable-only in v1.** Do not wire it to the planner in Phase 6 — that's 6.5 work and needs its own design discussion (planner contract, event shape, retry semantics).
- **`~/.ainative/plugins/` ≠ `~/.ainative/apps/`.** Composition bundles go to `apps/`, Kind 1 plugins go to `plugins/`. The skill's dual-target fall-through writes to BOTH — do not collapse them.
- **Reserved id list.** `echo-server` is reserved to protect the reference fixture; any future reserved ids go in the same reject list.

---

## Risks and watches

### Risk: the scaffold's `server.py` handlers are too stub-like

If `create_plugin_spec` returns handlers that just echo args back, users may be confused about where their real logic goes. Mitigation: each handler carries a `# TODO: implement — see README` comment pointing at the echo-server reference's `_handle_tools_call` function as the template. Low risk.

### Risk: `ExtensionFallbackCard` ships with no trigger

Phase 6.5 needs to actually wire it. Until then, card is dead code in the chat surface. Mitigation: card exports are internal-only (not in any barrel); tests exercise the component via direct import. Low risk, temporary.

### Risk: skill users hand-edit scaffolded `plugin.yaml` and strip `origin`

Would flip the plugin from self to third-party classification silently. Mitigation: SKILL.md `origin: ainative-internal` sticky contract callout, README.md in scaffold output with same callout, plugin.yaml has a leading comment (`# Do not remove 'origin: ainative-internal' — self-extension contract`). Medium risk; three callouts make it hard to miss.

### Risk: `~/.ainative/plugins/<id>/` collision with user-authored hand-written plugin

If a power-user already has `~/.ainative/plugins/github-mine/` hand-written and invokes `create_plugin_spec` with the same id, we refuse. But they might be confused why. Mitigation: `PluginSpecAlreadyExistsError` message includes the full path and suggests picking a different id. Low risk.

---

## Open decisions deferred to Phase 6.5 / later

- **`ExtensionFallbackCard` → planner wiring.** Needs its own design — event shape, when planner decides to emit, retry semantics on scaffold failure, error recovery.
- **Node+inprocess template body.** Phase 6.5; needs `@modelcontextprotocol/sdk` dependency decision and inprocess spawn contract documented.
- **Auto-reload after scaffold.** Defer unless users ask. Respects the user's checkpoint mental model.
- **Reserved id list extension.** Currently just `echo-server`; extend as new fixture plugins land.
- **Plugin delete chat tool (`delete_plugin_spec`).** The counterpart to `create_plugin_spec`. Would let chat undo a scaffold within a session. Scope out of Phase 6; consider for Phase 6.5 or M4.

---

## Acceptance

Phase 6 is complete when:

1. `create_plugin_spec` chat tool is registered and scaffolds a valid runnable plugin on disk.
2. Tests green: `npm test -- src/lib/chat/tools/__tests__/create-plugin-spec-tool.test.ts` and `npm test -- src/components/chat/__tests__/extension-fallback-card.test.tsx`.
3. `.claude/skills/ainative-app/SKILL.md` describes the fall-through to `create_plugin_spec` with dual-target emit.
4. `ExtensionFallbackCard` component renders with its three states (`prompt`, `scaffolded`, `failed`).
5. `npx tsc --noEmit` clean.
6. `features/chat-tools-plugin-kind-1.md` remains `shipped` (Phase 6 is additive to M3, not a re-scoping).
7. `features/changelog.md` gets a dated `## 2026-04-20` entry with an H3 `### Shipped — Phase 6` section capturing the three deliverables.
8. Single commit on `main`, working tree clean, push deferred to user.

No TDR status flip (TDR-037 already `accepted`). No feature spec status flip (M3 already shipped).

---

## What this plan deliberately does not do

Already covered under "Non-goals" above. Reiterated for skim-readers:

- No `/plugins` page.
- No planner integration for `ExtensionFallbackCard`.
- No Node/inprocess template body (stub only).
- No auto-reload.
- No modifications to Phase 4 trust machinery.
- No new TDR, no TDR status flips.
