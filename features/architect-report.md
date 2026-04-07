---
generated: 2026-04-07
mode: integration
---

# Architect Report

## Integration Design — Self-Upgrade System for Stagent Clones

### New Capability

Every git-clone user of stagent customizes their checkout via stagent chat itself (self-modifying dev environment). They need a safe path to pull new upstream features from `origin/main` into their customized local branch without losing work, and without accidentally pushing their private changes back to the public repo. Multi-instance users (private domain clones like `stagent-wealth`, `stagent-investor`) are a specialization of the same flow.

Three capabilities to integrate:

1. **Upgrade detection** — poll GitHub for new `origin/main` commits, surface a badge when upstream has moved ahead of local `main`
2. **Guided upgrade session** — one-click "Upgrade" spawns a Claude-agent task with an `upgrade-assistant` profile that runs `git fetch / merge` commands, asks the user to resolve merge conflicts inline, and restarts the dev server on completion
3. **Branch discipline guardrails** — first-boot creates a `local` branch (if user is on clean `main`), per-branch pushRemote config blocks origin pushes, a pre-push hook catches accidental pushes to any branch marked as an "instance branch" in `settings`

Hybrid license model: local tier features work across any number of `STAGENT_DATA_DIR`s without gating; cloud-side features (sync, marketplace, telemetry) meter seats using `(email, machineFingerprint, instanceId)` tuples.

### Pattern Alignment

| Core Pattern | Applies | How |
|---|---|---|
| Fire-and-forget execution (TDR-001) | **yes** | Upgrade session is a `task` row with `agentProfile='upgrade-assistant'`, `sourceType='manual'`. API returns 202, runner polls. |
| Notification-as-queue (TDR-002) | **yes** | Merge conflicts surface as pending approvals via `canUseTool`. User's "keep mine / take theirs / show diff" response rides the existing notification → response flow. |
| DB polling over WebSockets (TDR-003) | **yes** | No new polling channels — upgrade task uses the same `tasks.status` + `agent_logs` SSE streaming every task already uses. |
| Server Components for reads (TDR-004) | **yes** | Upgrade badge reads `settings.instance.upgradeAvailable` directly from DB in the Server Component sidebar. |
| SSE for log streaming (TDR-005) | **yes** | Upgrade session's real-time `git fetch / merge` output streams via the existing per-task SSE endpoint. |
| Multi-runtime adapter (TDR-006) | no | Upgrade assistant is Claude-only; git command execution doesn't need runtime abstraction. |
| Profile-as-skill-directory (TDR-007) | **yes** | `upgrade-assistant` ships as `src/lib/agents/profiles/builtins/upgrade-assistant/` with `profile.yaml` + `SKILL.md`. Same distribution to `~/.claude/skills/` on first run. |
| Learned context versioning (TDR-008) | no | Upgrade sessions are one-shot; no learning loop. |
| Idempotent bootstrap (TDR-009) | **yes** | First-boot branch creation + git hook install run from `src/instrumentation.ts` alongside scheduler startup. Idempotent checks: "is HEAD on main with no local commits? → create `local`", "does `.git/hooks/pre-push` exist? → skip, else write". |
| SQLite WAL mode (TDR-010) | **yes** | Settings writes during upgrade polling use the existing WAL-enabled DB connection. |
| JSON-in-TEXT columns (TDR-011) | **yes** | `settings.instance.config` stores `{branchName, dataDir, instanceId, upgradeAvailable, lastPolledAt, lastUpstreamSha}` as JSON. |
| Epoch integer timestamps (TDR-012) | **yes** | All new timestamps (last_polled_at, etc.) follow existing pattern. |
| Text primary keys (TDR-013) | **yes** | `instanceId` is a UUID text PK stored in settings. |
| Calm Ops design system (TDR-014) | **yes** | Upgrade modal uses StatusChip + DetailPane + existing sheet patterns. Badge is a standard badge variant. |
| Permission pre-check caching (TDR-015) | **yes** | The upgrade-assistant profile declares an allowlist of git commands (`git fetch`, `git merge`, `git status`, `git stash`, `git checkout`); the cache handles the rapid-fire approvals during a merge session so users aren't prompted for each one individually. |
| Chat conversation engine (TDR-023) | **partial** | The upgrade session is NOT a `conversations` row — it's a `tasks` row. The UI surfaces it inside a sheet that looks chat-like but runs on the task execution pipeline. This preserves the Bash/git tool access that the chat tool surface intentionally lacks. |
| Permission-gated chat tools (TDR-024) | no | We do NOT expose git commands as chat tools. That would let any conversation shell out, which crosses a trust boundary the chat surface is designed to preserve. Git execution happens only via the task runner with an explicit upgrade-assistant profile. |
| Natural language scheduling (TDR-027) | **yes** | Upgrade polling is registered as an NLP schedule: "every 1 hour, check upstream". Uses `schedules` table + existing scheduler engine, no new polling infrastructure. |

### Data Model Design

**Reuse `settings` table** (key-value JSON-in-TEXT) — no new tables.

New settings keys (all JSON-in-TEXT values):

```typescript
// settings key: "instance"
interface InstanceConfig {
  instanceId: string;              // UUID, generated once on first boot
  branchName: string;              // "local" by default, "<domain>-mgr" for private instances
  isPrivateInstance: boolean;      // true if STAGENT_DATA_DIR !== default
  createdAt: number;               // epoch seconds
}

// settings key: "instance.upgrade"
interface UpgradeState {
  lastPolledAt: number | null;
  lastUpstreamSha: string | null;  // origin/main HEAD as last seen
  localMainSha: string | null;     // our main HEAD as last compared
  upgradeAvailable: boolean;
  commitsBehind: number;           // commits main is behind origin/main
  lastSuccessfulUpgradeAt: number | null;
  lastUpgradeTaskId: string | null;
  pollFailureCount: number;
  lastPollError: string | null;
}

// settings key: "instance.guardrails"
interface Guardrails {
  prePushHookInstalled: boolean;
  prePushHookVersion: string;      // so we can upgrade the hook itself
  pushRemoteBlocked: string[];     // branch names where branch.<name>.pushRemote was set
  firstBootCompletedAt: number | null;
}
```

Why key-value settings rows instead of a dedicated `instances` table:
- Every clone has exactly one instance config — no need for a multi-row table
- Matches existing pattern for single-row config (auth settings, budget settings all use `settings` key-value)
- Makes `clearAllData()` trivially correct (already preserves `settings`)
- No migration coupling concerns (TDR-009 covers this)

**New profile directory:** `src/lib/agents/profiles/builtins/upgrade-assistant/`

Files:
- `profile.yaml` — tool allowlist (`Bash(git:*)`, `Read`, `Write` scoped to repo), runtime config, system prompt pointer
- `SKILL.md` — system prompt (merge flow, conflict resolution language, push guardrails reminder)

No new DB tables. No schema.ts additions. **Zero migration work.**

### API Surface Design

New routes (all follow existing fire-and-forget or DB-read patterns):

```
POST   /api/instance/upgrade          → 202 Accepted, returns {taskId}
                                        Spawns upgrade task with upgrade-assistant profile
                                        Body: {} (all config derived from settings)

GET    /api/instance/upgrade/status   → 200 {upgradeAvailable, commitsBehind, lastPolledAt, ...}
                                        Read from settings.instance.upgrade
                                        Used by sidebar badge + upgrade modal pre-flight

POST   /api/instance/upgrade/check    → 202 {taskId} or 200 {cached result}
                                        Force an upgrade availability check now (vs waiting for scheduled poll)
                                        Rate-limited to 1 call per 5 minutes

POST   /api/instance/init             → 200 {instanceId, branchName, isPrivateInstance, firstBoot: bool}
                                        Idempotent. Creates local branch + installs hooks + writes settings.
                                        Called from instrumentation.ts on boot; also exposed for manual re-run.

GET    /api/instance/config           → 200 InstanceConfig
                                        Sidebar + settings page read this
```

No new SSE endpoints — upgrade task log streaming reuses the existing `/api/tasks/[id]/logs/stream` SSE endpoint.

### Runtime Integration

**No runtime adapter changes.** Upgrade assistant runs on the default Claude runtime (`claude-sdk` adapter, `claude-opus-4-6` model).

**New Bash tool allowlist entries** — the upgrade-assistant profile's `profile.yaml` declares:

```yaml
tools:
  - Bash(git fetch *)
  - Bash(git status)
  - Bash(git stash *)
  - Bash(git checkout *)
  - Bash(git merge *)
  - Bash(git commit *)
  - Bash(git diff *)
  - Bash(git rev-parse *)
  - Bash(git log *)
  - Bash(npm install)
  - Read  # for reading conflicted files
  - Write # for writing merged files
```

These flow through the existing `canUseTool` → notification approval cache (TDR-015), so the user sees "Allow git fetch?" **once** per session (cached) rather than per-command.

### Frontend Integration

**New routes:** none.

**New components:**
- `src/components/instance/upgrade-badge.tsx` — Server Component rendered in `app-sidebar.tsx`, reads `settings.instance.upgrade.upgradeAvailable`, shows `StatusChip` variant when true
- `src/components/instance/upgrade-modal.tsx` — educational pre-flight dialog; explains what will happen, shows `commitsBehind` count, has "Start Upgrade" button that POSTs to `/api/instance/upgrade`
- `src/components/instance/upgrade-session-view.tsx` — the "chat-like" UI for an active upgrade task. Actually just a dressed-up `task-detail` view filtered to the upgrade task, reusing `AgentLogsView` + `PendingApprovalHost` components

**Changes to existing components:**
- `src/components/shared/app-sidebar.tsx` — add `UpgradeBadge` slot above Settings link (or in Configure group)
- `src/components/settings/` — add an "Instance" section showing `instanceId`, branch name, data dir, upgrade history (reuses `DetailPane` + `SectionHeading`)

**Server Component / Client boundary:**
- Badge is a Server Component (reads DB directly per TDR-004)
- Modal is a Client Component (`"use client"`) that POSTs via fetch — per TDR-004 client mutations go through API
- Upgrade session view is a hybrid: task detail is Server Component for initial render, approvals/logs stream on the client

### First-Boot & Guardrail Installer

Lives in `src/lib/instance/bootstrap.ts` (new file). Called from `src/instrumentation.ts` alongside scheduler startup. Order matters: runs **before** scheduler startup so the upgrade polling schedule can be registered as part of bootstrap.

Idempotent steps:

```
ensureInstanceConfig()
  ├── if settings.instance exists → no-op
  └── else → generate instanceId, detect isPrivateInstance, write

ensureLocalBranch()
  ├── read current branch via `git rev-parse --abbrev-ref HEAD`
  ├── if branch !== "main" → record as instance branch, done
  ├── if on main with local commits beyond origin/main → warn, done (respect user)
  └── else → git checkout -b local, record as instance branch

ensurePrePushHook()
  ├── if .git/hooks/pre-push exists and contains STAGENT_HOOK_VERSION marker → no-op
  ├── else → write hook from template (rejects push if HEAD branch is in blocked list, unless ALLOW_PRIVATE_PUSH=1)
  └── chmod +x

ensureBranchPushConfig()
  └── for each blocked branch: git config branch.<name>.pushRemote no_push

ensureUpgradePollingSchedule()
  ├── if schedule with name "instance-upgrade-check" exists → no-op
  └── else → create schedule: "every 1 hour check upstream" targeting internal handler
```

**All idempotent.** Safe to run every boot. Logs each action to `agent_logs` with `source='instance-bootstrap'`.

Detection of "clone vs npx vs dev-copy":
- `process.env.STAGENT_DEV_MODE === "true"` → skip everything (development in main stagent repo)
- No `.git` directory at `process.cwd()` → skip (npx runtime doesn't have a repo)
- Has `.git` and not dev mode → run the bootstrap

### Upgrade Task Execution Flow

```
┌──────────────────────────────────────────────────────────────┐
│ User clicks "Upgrade" in sidebar badge                       │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ Upgrade modal opens (educational pre-flight)                 │
│ ─ shows commitsBehind, last successful upgrade, branch name  │
│ ─ "this will stash WIP, merge origin/main into <branch>"     │
│ ─ [Start Upgrade]  [Cancel]                                  │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/instance/upgrade                                   │
│ ─ creates task row: title="Upgrade main → <branch>",         │
│   agentProfile="upgrade-assistant", sourceType="manual"      │
│ ─ returns 202 {taskId}                                       │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ UI navigates to /instance/upgrade/<taskId> (sheet overlay)   │
│ ─ renders upgrade-session-view                               │
│ ─ subscribes to SSE log stream + pending approvals           │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ claude-agent runs upgrade-assistant profile                  │
│ ─ SKILL.md system prompt tells it the exact merge sequence   │
│ ─ each git command triggers canUseTool → approved once (cached)│
│ ─ logs stream via agent_logs → SSE → UI                      │
│ ─ on merge conflict: agent writes conflict summary, asks user│
│   ("keep mine / take theirs / show diff") via regular        │
│   agent question → notification → user response loop         │
│ ─ after successful merge: runs npm install if pkg-lock changed│
│ ─ writes settings.instance.upgrade.lastSuccessfulUpgradeAt   │
│ ─ task completes                                             │
└──────────────────────────────────────────────────────────────┘
```

Failure modes are handled by the existing task execution machinery — no new error paths to design.

### Polling & License Metering

**GitHub polling:** registered as a scheduled task (TDR-027 natural language scheduling) — "every 1 hour, check upstream". The handler is a new internal endpoint `POST /api/instance/upgrade/check` that:

1. Calls `git fetch origin main` locally (no GitHub API, uses git protocol — avoids rate limits entirely)
2. Compares `git rev-parse origin/main` to `git rev-parse main`
3. Counts commits behind: `git rev-list --count main..origin/main`
4. Updates `settings.instance.upgrade` with new state
5. No network calls to GitHub REST API — purely local git operations after the fetch

**Why not GitHub REST API:** rate limits (60/hour unauthenticated), need for auth tokens, and introduces a network dependency. `git fetch` is what we'd do anyway during the actual upgrade.

**License metering** — hybrid model:

```
┌────────────────────────────────────────────────────────────┐
│ LicenseManager.validateAndRefresh() enhancement            │
├────────────────────────────────────────────────────────────┤
│ if STAGENT_CLOUD_DISABLED → skip (current behavior)        │
│ else call cloud with:                                       │
│   { email, machineFingerprint, instanceId }                 │
│                                                             │
│ Supabase edge function enforces:                            │
│   - seats(email).localInstances <= tier.maxInstances       │
│     * community: 1                                          │
│     * solo: 2                                               │
│     * operator: 5                                           │
│     * scale: unlimited                                      │
│   - machineFingerprint helps collapse stale instance IDs   │
│     when a user wipes ~/.stagent and re-activates          │
│                                                             │
│ Local tier/features are NOT gated by instance count.       │
│ Only cloud-side features (sync, marketplace) meter.        │
└────────────────────────────────────────────────────────────┘
```

The `instanceId` is the stable identifier: first-boot generates a UUID, stores in `settings.instance.instanceId`, survives DB clears (settings is preserved), survives rebases (DB is outside repo). The tuple `(email, machineFingerprint, instanceId)` uniquely identifies each running instance to the cloud. Scale tier: `maxInstances = Infinity` (current user's setup works unchanged).

Machine fingerprint can use `os.hostname() + os.userInfo().username + hash of primary network interface MAC` — stable per machine, not personally identifying.

### New TDRs Needed

Three new TDRs to codify decisions that emerge from this integration:

1. **TDR-028: Self-upgrade via task execution pipeline** — documents the decision to run git operations through the task runner (with a specialized profile) rather than as chat tools. Context: chat tools are DB-only by design; shell access would cross a trust boundary. Task execution already has Bash tool access, canUseTool approval flow, and SSE streaming — 100% reuse.

2. **TDR-029: Instance bootstrap in instrumentation.ts** — documents that self-managing instance setup (branch creation, hook install, polling schedule registration) runs at the same lifecycle point as scheduler startup, is fully idempotent (safe every boot), and is gated by `.git` presence + non-dev mode. Prevents future contributors from moving this logic into API routes or CLI flags.

3. **TDR-030: Hybrid instance licensing via cloud seat counting** — documents the decision that local features never meter on instance count, only cloud-side features do, using the `(email, machineFingerprint, instanceId)` tuple. Alternatives considered: strict per-instance activation (too much friction), generous unlimited (no upsell path), honor system (inconsistent with tier philosophy).

### Implementation Sequence

Ordered to respect layer dependencies (data → runtime → API → frontend → bootstrap):

1. **Settings keys + TypeScript interfaces** (`src/lib/instance/types.ts`, `src/lib/instance/settings.ts`) — read/write helpers for `instance`, `instance.upgrade`, `instance.guardrails`. Zero schema changes.

2. **Instance detection + fingerprint** (`src/lib/instance/detect.ts`) — detects dev mode, `.git` presence, `STAGENT_DATA_DIR` override, generates machine fingerprint.

3. **Guardrail installer** (`src/lib/instance/bootstrap.ts`) — the idempotent ensureX functions. Pure functions, unit-testable with a temp dir.

4. **Pre-push hook template** (`src/lib/instance/hooks/pre-push.sh`) — the actual hook script with `STAGENT_HOOK_VERSION` marker, `ALLOW_PRIVATE_PUSH=1` escape hatch, blocked-branches check against `settings.instance.branchName`.

5. **Upgrade-assistant profile** (`src/lib/agents/profiles/builtins/upgrade-assistant/{profile.yaml,SKILL.md}`) — tool allowlist + system prompt. The SKILL.md is the most important file: it encodes the exact merge sequence, conflict language, and restart flow.

6. **API routes** (`src/app/api/instance/*`) — the 5 endpoints above. Each is a thin wrapper around `src/lib/instance/*` functions.

7. **Scheduled polling registration** — modify `src/lib/schedules/bootstrap.ts` (or create if not present) to register the "instance-upgrade-check" schedule during instrumentation.

8. **License manager enhancement** — extend `validateAndRefresh` to pass `machineFingerprint` + `instanceId` to cloud. Add `maxInstances` to `TIER_LIMITS`. Supabase-side edge function is a separate workstream.

9. **Frontend badge + modal + session view** — three new components, one sidebar edit. Design system compliant, no new tokens.

10. **Instrumentation hook** (`src/instrumentation.ts`) — call `ensureInstance()` before scheduler startup. This is the last piece because it's the entry point that ties everything together.

11. **TDR-028, TDR-029, TDR-030** — written alongside implementation, not after.

### Risk Assessment

| Risk | Mitigation |
|---|---|
| Pre-push hook conflicts with user's existing hooks | Hook template checks for marker line; if a non-stagent hook exists, writes a `.stagent-backup` and installs ours; logs warning to agent_logs |
| First-boot creates `local` branch on a user who actually wanted to use main | Safety check: only creates `local` if zero local commits exist beyond origin/main. If local commits exist, records current branch as instance branch and moves on. |
| Upgrade merge conflicts trap the user in an unresolvable state | Escape hatch: every upgrade task has an "Abort" button that runs `git merge --abort` + `git stash pop` to return to pre-upgrade state. Abort is an explicit canUseTool approval so it shows in the UI. |
| Polling fires during active upgrade | Poll handler checks for in-progress upgrade task before running; skips if one exists. |
| License cloud call fails and blocks upgrade | Upgrade path never calls license cloud — that's a separate daily validation. Upgrade is purely local git. |
| User has uncommitted changes when upgrade starts | Upgrade assistant profile's first step is `git stash` (mirrors `sync-worktree.sh` logic); restored at end. If stash pop conflicts, surfaces as a separate conflict prompt. |
| Multi-instance user on machine with expired scale license | Cloud-side meter fails open for existing instances; new instance creation past the limit shows upgrade-seat CTA. Existing instances grandfather for 7 days (grace pattern). |
| `STAGENT_DATA_DIR` default collision (user manually sets it to `~/.stagent`) | `isPrivateInstance` is determined by comparing to default path — if user aliases default explicitly, detection returns false and they get the normal flow. No harm done. |

### What Already Exists (Reuse Inventory)

- **Task execution pipeline** (`src/lib/agents/execution-manager.ts`, `claude-agent.ts`) — fire-and-forget + canUseTool + SSE streaming
- **Profile registry + distribution** (`src/lib/agents/profiles/registry.ts`, `src/lib/agents/profiles/builtins/`) — skill directory loading, user edit detection
- **Permission pre-check cache** (TDR-015 implementation) — rapid-fire approval caching during merge sessions
- **Scheduler + NLP parser** (`src/lib/schedules/`) — hourly polling without new infrastructure
- **Settings key-value store** (`settings` table) — JSON-in-TEXT config storage
- **Notification queue** — merge conflict prompts use the existing pending-approval flow
- **DetailPane, StatusChip, SectionHeading** — UI primitives from Calm Ops for upgrade modal + settings section
- **`bin/sync-worktree.sh`** — reference implementation for stash → sync → install logic (port to SKILL.md prompt form)
- **`LicenseManager`** — extension points for fingerprint + instanceId, no rewrite
- **`src/lib/utils/stagent-paths.ts`** — `STAGENT_DATA_DIR` resolution for isPrivateInstance detection
- **`src/instrumentation.ts`** — Next.js register hook, already used for scheduler startup

### NOT in Scope (Deferred)

- **Instance listing UI / multi-instance dashboard** — the upgrade feature works per-clone; users still navigate between clones at the filesystem level. A future "Instance Manager" feature could list all local instances and let users switch. Deferred because: REDUCE-adjacent scope, complicates license metering, not needed for core upgrade flow.
- **Domain presets ("create a wealth-manager instance")** — would require a scaffolding system for seeded projects/profiles. Deferred because: presents as a separate feature (marketplace/templates), not core to upgrade discipline.
- **Conflict resolution inline editor** — users can resolve conflicts by asking the agent to edit files ("use mine", "use theirs", "merge smartly"). A visual diff/merge editor is nice-to-have but not required for HOLD scope.
- **Automatic upgrade scheduling** — users initiate upgrades manually; we poll for availability but never auto-apply. Rationale: upgrades can have conflicts, auto-apply without consent is hostile.
- **Pushing instance branches to user's own fork** — some users might want their `local` branch backed up to a private fork. Deferred because: adds git credential management, remote management, and fork detection. Current escape hatch (`ALLOW_PRIVATE_PUSH=1` env var) is sufficient.
- **Schema changes for an `instances` table** — deferred to avoid migration coupling. Current settings key-value is sufficient for single-instance-per-clone assumption.
- **Chat-based git tools** — explicitly **rejected**, not deferred. Adding shell access to chat tools would cross a trust boundary. Use the task pathway.

### Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|---|---|---|---|
| Pre-push hook write fails | Permissions, read-only FS | Guardrail missing on this clone | Log error to agent_logs, fall through to branch config, surface warning in Settings → Instance section |
| `git fetch` fails during poll | No network, auth failure on HTTPS | Badge stale | Increment `pollFailureCount`, surface after 3 consecutive failures as "Upgrade check failing" banner |
| `git merge` creates unmergeable conflict | Binary files, deleted-modified | Upgrade task blocked | Agent surfaces full file list, offers abort; abort runs `git merge --abort` + `git stash pop` |
| User on a branch that's not `local` or `*-mgr` | Manual branch creation | Guardrail blocklist may miss | Record whatever branch they're on as the instance branch in settings; blocklist is dynamic (reads settings) |
| First-boot runs during a rebase in progress | Orphaned `.git/rebase-merge` | Git operations fail | Detect rebase state via `.git/rebase-merge` presence; skip branch creation, surface notification "finish rebase first" |
| Settings.instance JSON malformed | DB corruption, concurrent write | Badge/upgrade breaks | Zod validation on read; if parse fails, re-run `ensureInstanceConfig()` to regenerate with fresh instanceId |
| Upgrade task crashes mid-merge | SDK error, runtime timeout | Repo in half-merged state | Task cleanup hook runs `git merge --abort`; logged and surfaced as failed upgrade task; user can retry |
| `npm install` fails after successful merge | Dependency conflict | App won't start | Task surfaces install error; agent asks user to resolve manually; doesn't mark upgrade as successful until install completes |
| Machine fingerprint changes (new MAC, VM migration) | Hardware change | Cloud meter sees "new instance" | Grace period: if (email, machineFingerprint) changes but instanceId is stable, cloud treats as same seat for 7 days |
| `ALLOW_PRIVATE_PUSH=1` used accidentally | User set it globally in shell | Guardrail defeated on all clones | Hook logs when escape hatch is used; surface as notification "Private push override used" for user awareness |
| Upgrade polling runs concurrently with user-triggered check | Schedule + manual trigger race | Double poll, wasted work | Use file lock `.git/.stagent-upgrade-check.lock` with 5-minute TTL |

### Data Flow Diagram

```
                 ┌───────────────────────┐
                 │ instrumentation.ts    │
                 │ (Next.js boot hook)   │
                 └───────────┬───────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │ ensureInstance()      │  ← idempotent
                 │ ─ instanceId          │
                 │ ─ local branch        │
                 │ ─ pre-push hook       │
                 │ ─ pushRemote config   │
                 │ ─ polling schedule    │
                 └───────────┬───────────┘
                             │
                             ▼
         ┌───────────────────┴───────────────────┐
         │                                       │
         ▼                                       ▼
 ┌───────────────┐                     ┌─────────────────┐
 │ Scheduler     │ every 1h            │ UI (Sidebar)    │
 │ poll handler  │────────────────────▶│ UpgradeBadge    │
 └───────┬───────┘                     │ (Server Comp)   │
         │                             └────────┬────────┘
         │ git fetch                            │
         │ compare SHAs                         │ user click
         │ update settings                      │
         │                                      ▼
         │                             ┌─────────────────┐
         │                             │ UpgradeModal    │
         │                             │ (Client)        │
         │                             └────────┬────────┘
         │                                      │ POST /api/instance/upgrade
         │                                      ▼
         │                             ┌─────────────────┐
         │                             │ Create task row │
         │                             │ profile:        │
         │                             │  upgrade-asst   │
         │                             └────────┬────────┘
         │                                      │ 202 taskId
         │                                      ▼
         │                             ┌─────────────────┐
         │                             │ UpgradeSessionView│
         │                             │ (task detail)   │
         │                             └────────┬────────┘
         │                                      │
         │                                      ▼
         │                             ┌─────────────────┐
         │                             │ claude-agent    │
         │                             │ runs profile    │
         │                             │ canUseTool→git  │
         │                             └────────┬────────┘
         │                                      │
         ▼                                      ▼
 ┌─────────────────────────────────────────────────┐
 │ settings.instance.upgrade                       │
 │   { lastPolledAt, upgradeAvailable,             │
 │     commitsBehind, lastSuccessfulUpgradeAt }    │
 └─────────────────────────────────────────────────┘
```

### State Machine: Upgrade Task Lifecycle

```
   idle
    │
    │ user clicks "Upgrade"
    ▼
  pre-flight ──┐
    │          │ user cancels
    │          └──▶ idle
    │ user confirms
    ▼
  task-created
    │
    │ runner picks up
    ▼
  running ──┬──▶ git-fetch
            ├──▶ stash-wip
            ├──▶ checkout-main
            ├──▶ merge-origin-main
            ├──▶ checkout-instance-branch
            ├──▶ merge-main ─────┐
            │                    │ conflict
            │                    ▼
            │             conflict-waiting
            │                    │
            │                    │ user resolves
            │                    ▼
            │             conflict-resolved
            │                    │
            │                    └──▶ (resume merge)
            ├──▶ npm-install (if pkg-lock changed)
            ├──▶ stash-pop
            ▼
        complete
            │
            │ or any step fails
            ▼
         failed
            │
            │ user clicks "Abort" or auto-cleanup
            ▼
         aborted ──▶ git-merge-abort + stash-pop ──▶ idle
```

---

*Generated by `/architect` — integration design mode*
