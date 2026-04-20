---
title: "Plugin Security Model"
category: "security"
lastUpdated: "2026-04-19"
---

# Plugin Security Model

`ainative-business` loads third-party `kind: chat-tools` plugins that can ship
MCP servers with real capabilities — filesystem, network, child processes.
This doc is the engineer-to-engineer account of how plugins are contained:
what each layer does, what it does **not** do, and the trade-offs behind
those choices. Read before accepting capabilities, and before shipping a
plugin.

## 1. The layered security model

The posture is ten layers deep. No single layer is sufficient; they are
stacked so that a failure at one level still leaves meaningful gates before a
plugin can cause harm.

1. **Stdio transport process isolation** — OS-level, free with stdio. Plugins
   run in a separate OS process and cannot touch ainative's Node heap. See
   `src/lib/plugins/transport-dispatch.ts:9` — `detached: false` is a
   TDR-035 §6 invariant.
2. **Capability declaration + click-accept + lockfile pinning** —
   `plugins.lock` records a SHA-256 of the manifest at accept time. Any drift
   suspends the plugin. See `src/lib/plugins/capability-check.ts:143`.
3. **Per-tool approval overlay** — Codex-style `never` / `prompt` / `approve`
   per tool, resolved inside the chat permission pipeline at
   `src/lib/agents/tool-permissions.ts:156` (Layer 1.8).
4. **Confinement modes** — opt-in OS enforcement via seatbelt (macOS),
   AppArmor (Linux), or Docker. See `src/lib/plugins/confinement/wrap.ts:153`.
5. **Namespacing is mandatory** — every plugin tool becomes
   `mcp__<server>__<tool>`. Collision with the ~91 builtin chat tools is
   prevented by spread order (ainative wins — last in the 5-source merge).
6. **`--safe-mode`** — boot-time kill switch. Kind-1 plugins are disabled
   globally; Kind-5 primitive bundles still load.
7. **MCP elicitation (SEP-1036)** — form and url modes are ready on the SDK
   side. In ainative v1 the user-facing surface is the existing approval
   notification; richer forms land in a follow-up.
8. **Revocation** — `revoke_plugin_capabilities` removes the lockfile entry,
   busts in-process module caches, and emits an Inbox notification. Stdio
   children die naturally when the SDK session ends.
9. **Optional capability expiry** — opt-in. A plugin accepted today can be
   forced into re-prompt in 30 / 90 / 180 / 365 days.
10. **Log trail** — every load, reload, disable, accept, revoke, safe-mode,
    and confinement-unsupported event is appended to `plugins.log`.

## 2. Capability declarations

A plugin's `plugin.yaml` declares one or more capabilities from the closed
set `fs`, `net`, `child_process`, `env` (see
`src/lib/plugins/sdk/types.ts:6`). Each label describes what the plugin
**intends to do**; with `confinementMode: "none"` (the default) the labels
drive UI, audit, and review — they do NOT enforce at runtime. Only with a
confinement mode set do the labels become OS-level constraints.

- **`fs`** — Reads and writes under the plugin's own directory
  (`<pluginDir>/state/`). Under `confinementMode: docker` that path is
  bind-mounted to `/state`. Without confinement, `[fs]` is intent, not a
  fence.
- **`net`** — Outbound network. Under Docker: `--network bridge`; absent
  this capability: `--network none` (`wrap.ts:331`).
- **`child_process`** — The plugin spawns subprocesses. Highest-risk; also
  the off-ramp trigger for mandatory Docker on external plugins (strategy
  §11 Risk D).
- **`env`** — Reads process env. A future pass will scrub
  `ANTHROPIC_API_KEY` and OAuth tokens from inherited env
  (`transport-dispatch.ts:127` TODO).

A capability declaration does not grant tool permission. Every invocation
still passes Layer 1.8 and (for `prompt` / `approve`) the standard
approval pipeline.

## 3. Click-accept and the lockfile

`$AINATIVE_DATA_DIR/plugins.lock` is a YAML v1 file (see
`src/lib/utils/ainative-paths.ts:66`) that pins the accepted state of every
Kind-1 plugin. Writes are atomic: tempfile → `rename`, with a `.bak` copy
taken first (`capability-check.ts:216`) and chmod 0600 on POSIX.

**What the hash covers.** `deriveManifestHash` canonicalises `plugin.yaml`
before SHA-256 (`capability-check.ts:143`). Cosmetic fields — `name`,
`description`, `tags`, `author` — are excluded. A description typo does not
invalidate the accept; a change to `capabilities`, `transport`, entry
paths, or `confinementMode` does. Capability arrays are canonicalised so
`[net, fs]` and `[fs, net]` hash identically — no false drift on reorder.

**Drift detection.** At every boot `isCapabilityAccepted` recomputes the
hash (`capability-check.ts:310`). The four states —
`accepted` / `hash_drift` / `expired` / `not_accepted` — map one-to-one to
lifecycle transitions. Drift suspends to `capability_accept_stale` with a
re-accept prompt in the Inbox.

**Why cosmetic fields are excluded.** A README typo fix should not
invalidate every user's lockfile. The security boundary is about what the
plugin *does*, not what it *says*.

## 4. Per-tool approval

Capability accept is install-time trust. Per-tool approval is the
second gate, applied at every invocation. For each MCP-prefixed tool name
(`mcp__<server>__<tool>`), the lockfile entry carries a mode:

- **`never`** — auto-allow. Used once a user has exercised the tool enough
  to trust it unconditionally. Hits the fast path at
  `tool-permissions.ts:171`.
- **`prompt`** — default on first install (or the plugin's
  `defaultToolApproval` if declared). Falls through to the standard DB
  notification → modal path.
- **`approve`** — same as `prompt` today; reserved for a future elicitation
  shape that demands a blocking approval before any argument is revealed
  to the plugin.

**Trust ramp pattern.** New plugin → leave all tools on `prompt`. After a
few invocations where the user sees what arguments the tool was called
with and what it returned, flip frequently-approved tools to `never` via
`set_plugin_tool_approval({ pluginId, toolName, mode: "never" })`. Anything
destructive stays on `prompt` forever.

First install defaults are chosen deliberately pessimistic: a plugin the
user has never seen before can do nothing without an explicit click.

## 5. Confinement modes

`plugin.yaml` accepts `confinementMode: "none" | "seatbelt" | "apparmor" |
"docker"` (see `src/lib/plugins/sdk/types.ts:33`). Default is `"none"`.

| Mode        | Platform    | Mechanism                          | Use when                          |
|-------------|-------------|------------------------------------|-----------------------------------|
| `none`      | all         | direct `spawn`                      | trusted first-party plugins       |
| `seatbelt`  | macOS       | `sandbox-exec -p <policy>`          | you are on macOS and want FS/net narrowing |
| `apparmor`  | Linux       | `aa-exec -p <profile>`              | you are on Linux with AppArmor loaded |
| `docker`    | any (Docker required) | `docker run --rm -i --network <scope> --label ainative-plugin=<id>` | external plugins with `child_process`, or anything you do not fully trust |

**Profile authoring — M3 ships stubs.** The files under
`src/lib/plugins/confinement/profiles/` (four `.sb` and four `.profile`,
one per capability) are deliberately minimal policy skeletons. The real
per-capability policy corpus is an M3.5 task. If you write your own
profile, drop it in at the same path with the same naming convention
(`seatbelt-<cap>.sb`, `apparmor-<cap>.profile`) and the loader will pick
it up.

**Platform mismatch.** Requesting `seatbelt` on Linux, `apparmor` on
macOS, or `docker` without Docker installed yields `disabled, reason:
confinement_unsupported_on_platform` and an Inbox message — the plugin
never loads. See `wrap.ts:196`.

**Dry-run.** Before accepting, run

```bash
node dist/cli.js plugin dry-run <pluginId>
```

to print the computed wrap policy (full `sandbox-exec` argv or the exact
`docker run` command) without spawning the plugin. See `bin/cli.ts:119`.

## 6. Revocation and safe mode

**Revoke a single plugin.** From chat:

```
revoke_plugin_capabilities({ pluginId: "my-plugin" })
```

This removes the `plugins.lock` entry, busts `require.cache` for in-process
SDK plugins, emits an Inbox `agent_message` notification, and appends to
`plugins.log` (see `capability-check.ts:545`). Stdio children die naturally
when the next SDK session ends — ainative does not manage stdio lifetimes
directly (Option A per `transport-dispatch.ts:18`). Double-revoke is a
graceful no-op.

**Safe mode.** Start with `npx ainative-business --safe-mode`. The CLI
exports `AINATIVE_SAFE_MODE=true` into the Next.js child env
(`bin/cli.ts:161`). The loader short-circuits and emits a
`disabled, reason: safe_mode` registration for every Kind-1 plugin, so
`GET /api/plugins` still surfaces what is blocked. Kind-5 plugins are
unaffected — they carry no capability risk. Safe-mode is deliberately a
boot-time switch for audit and incident response; there is no runtime
Settings toggle in v1.

## 7. Trust model rationale

**Capabilities without confinement are declarative.** If you accept
`[child_process]` for a plugin with `confinementMode: "none"`, the plugin
can call `spawn('/bin/bash', ['-c', '...'])` and nothing at the ainative
layer stops it. The label drove the click-accept sheet, the Inbox review,
and the audit log — but not the syscall. If that matters, set
`confinementMode` to `seatbelt`, `apparmor`, or `docker`.

**Why we do not sandbox by default.** Claude Code and Codex both trust the
install-time accept and do not sandbox plugin code at run time. Matching
their convention keeps ainative plugins portable and keeps the surface
debuggable. Forcing confinement during iteration would slow the ecosystem
without shifting the main risk (install-time trust).

**Why Node `vm` is rejected.** Node's own documentation states `vm` is not
a security boundary (strategy §10). Stdio spawn gives a real OS boundary;
`vm` would be theatre.

**Alignment with the ecosystem.** The 5-source MCP merge contract
(TDR-035 §1) with ainative-as-last-wins is shared across adapters — Claude
SDK (`src/lib/agents/claude-agent.ts:77`), Anthropic direct
(`src/lib/agents/runtime/anthropic-direct.ts:63`), OpenAI direct
(`src/lib/agents/runtime/openai-direct.ts:65`), Codex App Server. A plugin
declaring `mcpServers: { ainative: ... }` is dropped by JS spread
semantics. Namespacing is enforced by the protocol, not by bespoke checks.

## 8. What we don't protect against

Being honest about the edges keeps plugin authors and users from building
false expectations.

- **Docker kernel escape.** `confinementMode: "docker"` is not a
  kernel-level sandbox-escape guarantee. The Docker privilege boundary is
  publicly documented; a rooted container or kernel CVE is outside the
  threat model.
- **SHA-256 collision.** Out of scope. If SHA-256 breaks we will swap
  algorithms.
- **Plugin author malice at trust-before-install time.** The click-accept
  is the sole gate that stops a user from installing a known-hostile
  plugin. If a user accepts a plugin that advertises `[net]` and it then
  exfiltrates, that is the trust model operating as designed. Read the
  manifest. Inspect the source.
- **PII sanitization.** Plugins may see anything the user passes to them,
  including chat fragments, file paths, and env vars (with `[env]`). Users
  sanitize or they don't.
- **Supply-chain attacks on plugin dependencies.** Ainative does not audit
  the contents of a plugin's `npm install` tree.
- **Timing and side-channel attacks.** Not in scope.

## References

- Spec: `features/chat-tools-plugin-kind-1.md` — see "Core security posture
  (summary)" at lines 294-307 and the capability-accept flow at
  lines 156-178.
- Architecture record: `.claude/skills/architect/references/tdr-035-plugin-mcp-cross-runtime-contract.md`
  — the cross-runtime registration contract, drift heuristics, and process-
  ownership invariants.
- Chat-tools module boundary: `.claude/skills/architect/references/tdr-032-*.md`
  (chat-tools static-import ban that keeps plugin code out of the runtime
  registry import graph).
- Source anchors cited above are in `src/lib/plugins/` (capability-check,
  transport-dispatch, mcp-loader, confinement/wrap) and
  `src/lib/agents/tool-permissions.ts`.
- Log trail: `$AINATIVE_DATA_DIR/logs/plugins.log`.
- Lockfile: `$AINATIVE_DATA_DIR/plugins.lock` (YAML v1, 0600).
