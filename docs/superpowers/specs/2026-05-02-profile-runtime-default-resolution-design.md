---
title: Profile Runtime Default Resolution
status: design
priority: P1
milestone: post-phase-5
scope_mode: HOLD
predecessor: docs/superpowers/specs/2026-05-02-row-trigger-blueprint-execution-design.md
related_handoff: HANDOFF.md (Phase 5 shipped — pick the next feature)
---

# Profile Runtime Default Resolution

## Problem

Phase 5 row-trigger dispatch works end-to-end through workflow creation and task creation, then fails at task execution with:

```
NoCompatibleRuntimeError: No compatible configured runtime is available for this task.
```

The `cs-coach` profile referenced by the seeded `customer-follow-up-drafter` app manifest has **no profile body anywhere on disk** — neither at `~/.ainative/profiles/cs-coach.yaml` nor in the builtin profiles directory. The manifest declares it inline:

```yaml
profiles:
  - id: cs-coach
    name: CS coach
    description: Helpful customer-success agent
```

…and the profile registry never learns about it. `getProfile("cs-coach")` returns `undefined`, `filterCompatibleRuntimes()` (`compatibility.ts`) returns `[]` for missing profiles, and the dispatcher throws because `compatibleCandidates.length === 0` at `execution-target.ts:243`.

This shape — manifest-only profile reference with no profile.yaml — is allowed by `AppManifestSchema` (`AppArtifactRefSchema` only requires `id`). The composition kit's design intent is terse manifests; forcing every app author to author a full profile.yaml violates that. The runtime layer must accept the inline reference.

## Goals

1. Inline-only manifest profile references **resolve to a working profile** at task dispatch.
2. When dispatch genuinely cannot find a compatible runtime, the error message **names the gap** (profile expectation vs. user configuration) so it's actionable.
3. App-install detects the runtime gap **before the first task runs** and surfaces a notification.

## Non-Goals (explicitly deferred)

| Deferred | Why |
|----------|-----|
| User-level "default runtime for orphan profiles" setting | Adds config surface for an inference problem better solved by synthesis. YAGNI. |
| Dispatcher silent fallback when a profile is unknown | Masks real misconfigurations. Violates Zero Silent Failures. |
| App-level `defaultRuntime` cascading to all profiles | Premature abstraction; one inline-stub use case so far. Extract on third use. |
| Auto-generating `profile.yaml` files on disk during composition | Future composition-kit work; synthesis covers the runtime gap until then. |
| Builtin profile resolution changes | All builtins declare `supportedRuntimes` correctly. No bug to fix there. |
| Profile-runtime auto-discovery from model capability declarations | Unrelated; would be a separate proposal. |
| Backfill SKILL.md content for synthesized profiles via LLM | Out of scope for "default resolution"; this is profile authoring. |
| New `ProfileOrigin` value (`app-manifest`) | Reuse existing `"import"` to avoid migration surface area for this small fix. |

## What Already Exists (reusable)

- **`SUPPORTED_AGENT_RUNTIMES`** at `src/lib/agents/runtime/catalog.ts` — used directly in synthesis.
- **`AgentProfile` type** at `src/lib/agents/profiles/types.ts:42` — synthesized objects conform to this.
- **`getSupportedRuntimes()`** at `src/lib/agents/profiles/compatibility.ts:44` — unchanged; still applies its `["claude-code"]` default to profiles whose `supportedRuntimes` is empty/missing. Synthesized profiles set `SUPPORTED_AGENT_RUNTIMES` explicitly, so the default never fires for them.
- **Profile registry merge logic** at `src/lib/agents/profiles/registry.ts` — already merges multiple profile sources with field-level precedence; synthesis slots in as a new lowest-precedence source so file-based profiles always shadow synthesized ones with the same id. Exact integration point is for the planning phase.
- **`parseAppManifest()`** at `src/lib/apps/registry.ts:182` — reused for the synthesizer's manifest read.
- **`getAinativeAppsDir()`** at `src/lib/utils/ainative-paths.ts` — reused for the synthesizer's directory scan.
- **`listConfiguredRuntimeIds()`** at `src/lib/settings/runtime-setup.ts` — reused for install-time validation.
- **`notifications` table** insert patterns — reused for install-time validation surface.
- **`invalidateAppsCache()`** at `src/lib/apps/registry.ts:109` — pattern to mirror for profile registry invalidation on app mutations.

## Design

### Architectural seam

A new lightweight bridge module — `src/lib/agents/profiles/app-manifest-source.ts` — connects the apps registry to the profiles registry. At profile-registry load, it scans installed apps and synthesizes in-memory `AgentProfile` objects for any inline manifest entry without a corresponding profile.yaml on disk.

Synthesis is **eager**: by the time `getProfile("cs-coach")` is called downstream, the synthesized object is already in the registry. No code path downstream of registry-merge needs to change.

Synthesis is **lowest-precedence**: a user-authored `~/.ainative/profiles/cs-coach.yaml` shadows any synthesized version. This preserves the customization escape hatch without special handling.

### Synthesized profile shape

```ts
{
  id: manifestEntry.id,
  name: manifestEntry.name ?? titleCase(manifestEntry.id),
  description: manifestEntry.description ?? "",
  domain: "work",
  tags: [appId],
  systemPrompt: manifestEntry.description ?? "",
  skillMd: "",
  supportedRuntimes: SUPPORTED_AGENT_RUNTIMES,
  scope: "user",
  origin: "import",
  readOnly: true,
}
```

Rationale:
- `systemPrompt` falls back to `description` so the model gets *some* directive when no SKILL.md exists. Empty when description is absent.
- `tags: [appId]` enables future filtering ("show all profiles from this app").
- `readOnly: true` because the user can't edit a synthesized profile directly — they edit the source manifest or author a profile.yaml.
- `domain: "work"` matches the default seen across builtin profiles when no domain semantics apply.

### Component changes

| File | Change |
|------|--------|
| `src/lib/agents/profiles/app-manifest-source.ts` | **NEW.** Exports `loadAppManifestProfiles(appsDir, profilesDir): AgentProfile[]`. Scans `<appsDir>/*/manifest.yaml`; for each `profiles[]` entry whose id has no `<profilesDir>/<id>.yaml` (and no builtin), synthesize. |
| `src/lib/agents/profiles/registry.ts` | Hook `loadAppManifestProfiles()` into the registry-merge sequence at lowest precedence. Mirror `invalidateAppsCache()` so app mutations also invalidate the profile registry's app-derived layer. |
| `src/lib/agents/runtime/execution-target.ts` | Replace the two `NoCompatibleRuntimeError` message strings (lines 243, 303) with a builder that names profile id, expected runtimes, and configured runtimes. |
| `src/lib/apps/compose-integration.ts` | After `upsertAppManifest()`, run a validation pass; if any profile's `supportedRuntimes` does not intersect `listConfiguredRuntimeIds()`, write a `notifications` row with an actionable title. |
| `src/lib/agents/profiles/__tests__/app-manifest-source.test.ts` | **NEW.** Synthesis cases (see Testing). |
| `src/lib/agents/runtime/__tests__/execution-target.test.ts` | Add cases for the new error message format. |
| `src/lib/apps/__tests__/compose-integration.test.ts` | Add the install-time validation case. |

### Data flow

```
App install / dev startup
        │
        ▼
┌─────────────────────────────────────┐
│ Profile registry load               │
│  1. builtins (from /src)            │
│  2. user (~/.ainative/profiles/...) │
│  3. project (.claude/skills/...)    │
│  4. NEW: app-manifest synthesis     │ ◀── for each apps/<id>/manifest.yaml
└─────────────────────────────────────┘     for each profiles[].id without an existing profile,
                │                            synthesize { ...permissive defaults }
                ▼
        registry holds cs-coach
                │
                ▼
Row insert → workflow → task created
                │
                ▼
resolveTaskExecutionTarget(profileId="cs-coach")
                │
                ▼
filterCompatibleRuntimes:
  getProfile("cs-coach") → synthesized profile (✓)
  supportedRuntimes ⊇ configured? → intersection non-empty
                │
                ▼
        Task dispatched ✓


Failure path (post-install runtime config change):
        │
        ▼
intersection empty → throw NoCompatibleRuntimeError(
  "Profile `cs-coach` expects [claude-code, anthropic-direct, ...].
   You have [openai-direct] configured.
   Configure one of the expected runtimes or update the profile.")


Install-time validation flow:
        │
upsertAppManifest()
        │
        ▼
for each profile in manifest.profiles:
  resolved = registry lookup OR synthesized shape
  if resolved.supportedRuntimes ∩ listConfiguredRuntimeIds() == ∅:
    insert notifications row {
      type: "task_failed",
      title: "App `customer-follow-up-drafter` cannot run on this environment",
      body: "Profile `cs-coach` expects [...]; you have [...] configured."
    }
```

### Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|-------|---------|--------|--------|
| Manifest references unknown profile id | App author typo, or profile.yaml deleted post-install | Synthesizer creates a stub with permissive runtimes; task runs but with no SKILL.md guidance | Acceptable for v1. App authors override by writing profile.yaml. Documented here. |
| Inline manifest entry has no `name` or `description` | Sparse manifest | Synthesized profile has empty systemPrompt → no guidance to model | titleCase the id for `name`; empty `description` is acceptable; install-time validation surfaces a soft warning if both empty (deferred — v1 only checks runtime intersection). |
| Two apps reference the same profile id (collision) | Cross-app reuse | Last-loaded synthesis wins | Use first-loaded synthesis; subsequent apps' tags get appended to the first synthesis's `tags` array. Log a warning. Do not crash. |
| User authored `profile.yaml` for the same id | User customization | File-based profile must shadow synthesized profile | Hook synthesis at lowest precedence in registry merge. Verified by test. |
| Manifest YAML is malformed | Corrupted file | `parseAppManifest()` returns null; synthesizer skips that app | Log a warning; continue with other apps. Tested. |
| Configured runtimes change between install and dispatch (e.g., user uninstalls Anthropic) | Settings change | `NoCompatibleRuntimeError` at task time | New error message names the gap. User reconfigures or edits profile. |
| All `profile.supportedRuntimes` are unconfigured at install | Fresh user with no API keys | Install-time validation fires warning notification | User sees notification before first task fails. Recoverable. |
| Synthesizer runs before any apps installed | First-time launch | Empty result; no-op | Function returns `[]`. Tested. |
| Race: app installed concurrently with profile registry load | Rare; both are filesystem ops | Stale registry might miss the new app | Mirror `invalidateAppsCache()` pattern: app mutations call `invalidateProfileRegistry()` (or equivalent). Profile registry refreshes on next `getProfile()` call. |
| `apps/` directory does not exist | Fresh install pre-`getAinativeAppsDir()` ensure | Synthesizer can't read | Function gracefully returns `[]` when directory missing. |
| Permissions error reading manifest.yaml | Filesystem permission | Synthesizer fails for that app | Try/catch per-manifest; skip and log. Other apps still synthesize. |

### NoCompatibleRuntimeError message format

Replace the two error throws with a builder:

```ts
function buildNoCompatibleRuntimeError(input: {
  profileId: string | null | undefined;
  profile: AgentProfile | undefined;
  configuredRuntimeIds: AgentRuntimeId[];
}): NoCompatibleRuntimeError {
  if (!input.profile) {
    return new NoCompatibleRuntimeError(
      `No profile registered for id \`${input.profileId ?? "(unknown)"}\`. ` +
      `If this profile comes from an app manifest, ensure the app is installed; ` +
      `otherwise author the profile.yaml.`
    );
  }
  return new NoCompatibleRuntimeError(
    `Profile \`${input.profile.id}\` expects ` +
    `[${input.profile.supportedRuntimes.join(", ")}]. ` +
    `You have [${input.configuredRuntimeIds.join(", ") || "(none)"}] configured. ` +
    `Configure one of the expected runtimes or update the profile.`
  );
}
```

The "no profile registered" branch is a defense-in-depth check; with synthesis in place, this branch should never fire in practice for app-manifest profiles. It exists for genuinely-orphaned profile id references.

## Testing

### Unit (`app-manifest-source.test.ts`)

- Synthesis with full manifest entry (id + name + description) → all fields populated correctly
- Synthesis with sparse entry (id only) → titleCase name, empty description
- Manifest entry's id has a corresponding `profile.yaml` on disk → no synthesis
- Manifest entry's id matches a builtin profile id → no synthesis
- Malformed manifest.yaml → skipped, no crash, other apps still synthesize
- Apps directory missing → returns `[]`
- Two apps reference same profile id → first wins, second app's id appended to `tags`
- Synthesized profile is `readOnly: true` and `origin: "import"`

### Unit (`execution-target.test.ts`)

- New error message includes profile id, expected runtimes, configured runtimes
- "No profile registered" branch: error names the missing id and suggests authoring profile.yaml
- Empty configured runtimes case: message reads "(none)" rather than empty brackets

### Unit (`compose-integration.test.ts`)

- `upsertAppManifest()` + intersection-empty manifest → notification row inserted
- `upsertAppManifest()` + intersection-nonempty manifest → no notification
- `upsertAppManifest()` + manifest with no profiles → no notification

### Integration

- Synthesized `cs-coach` resolves through `resolveTaskExecutionTarget()` against a configured runtime → returns expected `ResolvedExecutionTarget` shape with `effectiveRuntimeId` set.

### Browser smoke (mandatory per CLAUDE.md)

`execution-target.ts` is runtime-registry-adjacent under the project's smoke-test budget rule. End-to-end verification required:

- Cold-start dev server (no `ReferenceError`, no module-load cycle).
- POST a row into `customer-touchpoints` table → workflow created → task created → cs-coach dispatches successfully → drafted document lands in Inbox.
- Capture `output/profile-runtime-default-resolution-{pre,post}.png`.
- Sanity-check that file-based profiles still work (run any builtin profile task to verify no regression).

## Implementation order (sketch)

1. Synthesizer module + tests (no integration yet — pure synthesis logic).
2. Registry hook + invalidation hook + tests.
3. Improved error message + tests.
4. Install-time validation + tests.
5. Browser smoke verification.

The plan-writing skill will produce the detailed sequenced plan from this design.

## Risks and trade-offs

- **"Permissive but lying" supportedRuntimes.** Synthesized profiles claim all runtimes are supported. If an app's intended workflow actually needs vision/bash/MCP and the user only has Ollama, the dispatcher will route to Ollama and crash at task execution with a different error. Counter: app-manifest stubs ALSO have no SKILL.md, no allowedTools, no MCP servers — the dispatcher fundamentally can't know what they need. Permissiveness matches the information available. If a user wants stricter contracts, they author a full profile.yaml.
- **Synthesis is invisible.** A user looking at `~/.ainative/profiles/` won't see `cs-coach.yaml`. Mitigation: profile UIs that list profiles will include synthesized entries (since they go through the same registry); we surface the `origin: "import"` and `tags: [appId]` so users can see where it came from.
- **Install-time validation depends on configured-runtimes state at install time.** If the user installs an app, then later configures a new runtime, the warning notification doesn't auto-clear. Acceptable for v1; user can dismiss the notification. Future enhancement: re-validate on runtime-config change.
