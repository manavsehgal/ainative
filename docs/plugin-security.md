---
title: "Plugin Security Model"
category: "security"
lastUpdated: "2026-04-20"
---

# Plugin Security Model

Ainative distinguishes **self-extension** (the user's own code, or code ainative wrote on the user's behalf) from **third-party plugins** (foreign code installed locally). Different posture, different surface, different ceremony.

See TDR-037 for the full decision record. Strategy §10 reference: marketplace / publish / trust-ladder lanes remain rolled back.

## Two paths

```
plugin.yaml loaded
  → classifyPluginTrust(manifest, rootDir, userIdentity) = 'self' | 'third-party'
    → 'self'         — zero ceremony, no lockfile, load directly
    → 'third-party'  — lockfile-gated, full M3 machinery
```

**Self-extension signals — any one flips to `self`:**

- `origin: ainative-internal` in manifest (set by ainative chat tools + `ainative-app` skill)
- `author: ainative` (builtin convention, e.g. `echo-server`)
- `author` matches current user identity (hand-authored plugins)
- bundle under `~/.ainative/apps/*` (composition surface)
- `capabilities: []` (nothing to gate)

**Kind 5 (primitives-bundle)** is always self-extension — data-only, no executable surface beyond Zod-validated loaders.

## Self-extension posture

When a bundle classifies as self-extension:
- `isCapabilityAccepted` returns `{ accepted: true, trustPath: 'self' }` immediately
- `plugins.lock` is never written or consulted
- No click-accept, no modal, no hash-drift re-prompt
- Plugin loads on first reload

Matches the CLI freedom users expect from Claude Code / Codex. Users who want stricter posture on their own code can flip the Settings toggle (below).

## Third-party posture

When classification falls through to `third-party`, the full M3 machinery engages:

1. **Canonical manifest hash** — SHA-256 of `plugin.yaml` with cosmetic fields excluded (`name`, `description`, `tags`, `author`). See `src/lib/plugins/capability-check.ts` `deriveManifestHash`.
2. **Click-accept + `plugins.lock`** — user explicitly grants the declared capabilities. Lockfile pins the hash.
3. **Silent-swap guard** — `grant_plugin_capabilities({ expectedHash })` rejects if the on-disk manifest changed since the user saw it.
4. **Hash-drift re-prompt** — manifest edited after accept → `capability_accept_stale` → plugin disabled until user re-grants.
5. **Revocation** — `revoke_plugin_capabilities` removes the lockfile entry, busts caches, posts Inbox notification.

## Capabilities

`plugin.yaml` declares what a plugin wants (read only — declarative, not enforced without confinement):

| Capability | Meaning |
|---|---|
| `fs` | Filesystem read/write beyond the plugin's own dir |
| `net` | Outbound network |
| `child_process` | Spawn subprocesses |
| `env` | Read non-public environment variables |

Declaring a capability is a contract with the user, not a runtime gate. OS-level enforcement is opt-in via confinement modes (see below).

## `--safe-mode`

`node dist/cli.js --safe-mode` boots with all Kind 1 plugins disabled globally. Kind 5 primitives bundles still load (they have no executable surface). `/api/plugins` surfaces each disabled plugin with `disabledReason: "safe_mode"` so incident responders can see what's blocked.

Mirrors Claude Code's `--no-plugins` posture. Incident-response tool; not a daily flag.

## Parked mechanisms

The following shipped in M3 but are **OFF by default** per TDR-037 §4. They activate only with an explicit env flag or Settings override, and only when third-party plugin distribution is genuinely needed.

| Mechanism | Flag | Why parked |
|---|---|---|
| Per-tool approval Layer 1.8 (`never` / `prompt` / `approve`) | `AINATIVE_PER_TOOL_APPROVAL=1` | MCP elicitation (SEP-1036) is the strategy-sanctioned runtime consent primitive per Amendment II. Keeping Layer 1.8 active duplicated it. |
| Seatbelt / AppArmor / Docker confinement wraps | `AINATIVE_PLUGIN_CONFINEMENT=1` | §11 Risk D off-ramp: "opt-in hardening layer, NOT a default". Activates when first external `child_process`-declaring plugin arrives. |
| Capability expiry TTL (`set_plugin_accept_expiry`) | DEPRECATED, scheduled for removal | Self-authored code doesn't age. Claude Code / Codex CLI have no TTL. |

When these flags are OFF, the wrap paths fall through to unconfined spawn, Layer 1.8 is skipped, and expiry is ignored. Code paths remain compiled for fast re-activation when a real external plugin arrives.

## Settings toggle — user autonomy

`Settings → Advanced → Plugin trust model`:

- **`auto`** (default) — path split per classifier
- **`strict`** — force third-party path for everything (forces lockfile even for ainative-internal bundles — training wheels over own code)
- **`off`** — trust-on-first-use for everything (Claude Code-grade freedom)

## Non-goals

These are explicitly out of scope. Not "deferred," not "future work" — **refused**:

- **Marketplace / publish flow / creator portal / trust ladder** — rolled back 2026-04-12, reinforced by §15 amendment.
- **PII sanitization pipeline** — premature; no seed data is published.
- **Plugins altering system DB tables** — Drizzle migrations are versioned; plugins never write them.
- **Plugins registering Next.js routes** — compile-time routing; source-mod only.
- **Node `vm.Module` sandboxing** — not a security boundary (CVE-class escapes). We don't pretend.
- **Feature gating by install method** — capability is identical on npx vs. git-clone.

## What we don't protect against

- Docker kernel escape (when `AINATIVE_PLUGIN_CONFINEMENT=1` and a plugin uses Docker mode). Sandbox-strong ≠ escape-proof.
- SHA-256 preimage / collision attacks. When the algorithm breaks, so does the hash pin.
- Plugin-author malice at install time. If a bundle is hostile before the first accept, the accept confirms the hostility.
- PII in plugin-sent logs. Plugins write their own log output; ainative doesn't inspect it.
- Timing side-channels in tool execution.

## Where to look

| What | Path |
|---|---|
| Classifier | `src/lib/plugins/classify-trust.ts` |
| Capability check + lockfile I/O | `src/lib/plugins/capability-check.ts` |
| MCP loader + registration | `src/lib/plugins/mcp-loader.ts` |
| Confinement wrap (parked) | `src/lib/plugins/confinement/wrap.ts` |
| Layer 1.8 per-tool approval (parked) | `src/lib/agents/tool-permissions.ts` |
| Chat tools (grant/revoke/list/reload/set-approval) | `src/lib/chat/tools/plugin-tools.ts` |
| CLI flags (`--safe-mode`, `plugin dry-run`) | `bin/cli.ts` |

## References

- TDR-037 — Two-Path Plugin Trust Model (primary authority)
- TDR-035 — Loader-Authority Cross-Runtime Contract
- TDR-032 — Runtime-AiNative MCP Injection (dynamic-import discipline)
- `ideas/self-extending-machine-strategy.md` §5, §10, §11 Risk D, §15 Amendment 2026-04-20
- `features/chat-tools-plugin-kind-1.md`
