---
title: "Settings"
category: "feature-reference"
section: "settings"
route: "/settings"
tags: ["settings", "configuration", "auth", "runtime", "browser-tools", "permissions", "budget", "ollama", "channels", "instance", "upgrade"]
features: ["session-management", "tool-permission-persistence", "tool-permission-presets", "browser-use", "spend-budget-guardrails", "settings-interactive-controls", "ollama-runtime-provider", "multi-channel-delivery", "bidirectional-channel-chat", "database-snapshot-backup", "instance-bootstrap", "upgrade-detection", "upgrade-session", "instance-license-metering"]
screengrabCount: 11
lastUpdated: "2026-04-15"
---

# Settings

The Settings page is the central configuration hub for `ainative-business`. From a single scrollable page you can manage authentication for all provider runtimes, configure local AI models via Ollama, tune agent execution parameters, enable browser automation, set monthly cost caps, choose permission presets, manage delivery channels for Slack and Telegram, and reset workspace data. Each section saves changes immediately with confirmation feedback.

## Screenshots

![Settings page overview showing authentication and runtime sections](../screengrabs/settings-list.png)
*Full settings page with authentication, Codex runtime, chat defaults, runtime configuration, and browser tools sections visible.*

![Ollama runtime section](../screengrabs/settings-ollama.png)
*Ollama section for local model management and configuration.*

![Ollama connected with local models](../screengrabs/settings-ollama-connected.png)
*Ollama connected with 4 local models listed and ready for use.*

![Browser tools section with Chrome DevTools and Playwright toggles](../screengrabs/settings-browser-tools.png)
*Browser Tools section showing independent toggles for Chrome DevTools and Playwright browser automation.*

![Delivery Channels section](../screengrabs/settings-channels.png)
*Delivery Channels section showing configured Slack, Telegram, and webhook channels with Chat and Active toggles.*

![Add Slack channel form](../screengrabs/settings-channels-add-form.png)
*Add Delivery Channel dialog with Slack configuration fields including bot token and signing secret.*

![Budget guardrails section with spend caps and split configuration](../screengrabs/settings-budget.png)
*Cost and Usage Guardrails with overall spend cap, monthly split, billing indicator, and pacing meter.*

![Permission presets with risk badges and toggle controls](../screengrabs/settings-presets.png)
*Permission Presets showing Read Only, Git Safe, and Full Auto tiers with color-coded risk badges.*

![Data management section with clear and populate options](../screengrabs/settings-data.png)
*Data Management section for resetting or populating workspace data.*

![Database Snapshots settings](../screengrabs/settings-snapshots.png)
*Database Snapshots section with automatic backup configuration, retention settings, and snapshot list with restore/delete actions.*

## Key Features

### Authentication

Choose how `ainative-business` connects to each provider runtime. For **Anthropic**, **OAuth** uses your existing Max subscription at no additional API cost, while **API Key** uses the Anthropic key stored in your environment. For **OpenAI**, Codex App Server can use either an **OpenAI API key** or **ChatGPT** browser sign-in, while OpenAI Direct continues to use an API key. Connection tests validate the currently selected runtime mode and the OpenAI section shows active ChatGPT account and Codex rate-limit state when available.

### Ollama Runtime (Local Models)

Connect to a local Ollama instance for private, zero-cost AI execution. The Ollama section provides:

- **Connection test** -- verify that Ollama is running and reachable at the configured URL (default: `http://localhost:11434`)
- **Model discovery** -- automatically lists all models available on your Ollama instance
- **Model management** -- see model names, sizes, and last-modified dates for each local model
- **Smart router integration** -- once connected, Ollama models appear as runtime options throughout the workspace (tasks, schedules, workflows, chat)

Ollama is ideal for privacy-sensitive tasks, offline operation, and eliminating API costs for development and testing. Tasks routed to Ollama are tracked at $0 in the cost dashboard.

### Runtime Configuration

Two controls govern how agents behave during execution:

- **SDK Timeout** -- how many seconds an individual agent call is allowed to run before timing out. Lower values return faster; higher values give the agent more time for complex reasoning.
- **Max Turns** -- how many back-and-forth tool-use cycles the agent can perform in a single run. Fewer turns suit quick lookups; more turns allow extended multi-step work.

### Chat Defaults

Pick the default model for new chat conversations. The selector shows available Claude, Codex, and Ollama models with relative cost tiers so you can balance capability against spend before starting a conversation.

### Browser Tools

Enable browser automation for chat and task execution without leaving `ainative-business`. Two independent toggles control complementary capabilities:

- **Chrome DevTools** -- connects to a running Chrome window. Useful for debugging your own app, inspecting network traffic, running performance audits, and taking screenshots of live pages.
- **Playwright** -- launches its own headless browser. Useful for autonomous web research, page scraping, structured analysis, and cross-browser testing.

When enabled, read-only browser actions (screenshots, page snapshots, console reads) are auto-approved. Actions that change page state (clicking, typing, navigating) go through the normal permission approval flow.

### Delivery Channels

Configure external messaging integrations for outbound notifications and bidirectional chat:

- **Slack** -- connect via webhook URL for notifications, or add a bot token for bidirectional chat directly from Slack
- **Telegram** -- connect via bot token for both notifications and bidirectional chat
- **Webhook** -- send notifications to any HTTP endpoint (outbound only)

Each channel card has four controls: a **Chat** toggle for bidirectional mode (Slack and Telegram only), an **Active** toggle, a **Test** button, and a **Delete** button. When Chat is enabled, you can message `ainative-business` directly from Slack or Telegram and receive AI responses in the same conversation. See the [Delivery Channels](./delivery-channels.md) guide for detailed setup instructions.

### Cost and Usage Guardrails

Set spend caps to prevent runaway costs from autonomous agent work:

- **Overall spend cap** -- a hard monthly ceiling across all providers.
- **Monthly split** -- distribute the budget across billing periods.
- **Per-provider caps** -- optional daily and monthly limits for Claude, Codex, and other providers independently.

A pacing meter shows current spend against the cap with color-coded health (green, amber, red). When usage crosses 80% of a configured cap an inbox notification is sent. After the cap is exceeded, new agent work is blocked.

### Permission Presets

Three one-click bundles set tool permissions in bulk:

| Preset | What it allows | Risk |
|--------|---------------|------|
| **Read Only** | File reading, search, directory listing | Lowest |
| **Git Safe** | Everything in Read Only plus file edits and git commands | Medium |
| **Full Auto** | All tools except direct user questions | Highest |

Presets are additive -- enabling Git Safe automatically includes Read Only tools. Disabling a preset removes only its unique additions without affecting tools you approved individually.

### Tool Permissions

Below the presets, a list shows every individually approved tool pattern. Patterns follow the format used by Claude Code. Each pattern has a **Revoke** button. The special `AskUserQuestion` tool is never auto-approved regardless of presets.

### Data Management

Two operations for managing workspace content:

- **Clear Data** -- removes tasks, logs, documents, schedules, and other workspace content. Settings and permissions are preserved.
- **Populate Sample Data** -- seeds the workspace with example projects, tasks, and documents.

### Database Snapshots

Protect your workspace with automatic and manual database backups:

- **Automatic backup** -- enable scheduled backups with a configurable cron interval (e.g., every 6 hours, daily). Snapshots are created in the background without interrupting your workflow.
- **Retention settings** -- control how many snapshots to keep with a maximum count and a maximum age in weeks. Older snapshots beyond the retention limits are pruned automatically.
- **Snapshot list** -- view all existing snapshots with timestamps and sizes. Each snapshot has **Restore** and **Delete** action buttons for quick management.
- **Pre-restore safety snapshot** -- before restoring an older snapshot, `ainative-business` automatically creates a safety snapshot of the current database state so you can roll back if needed.

## How To

### Connect Ollama for Local Models

1. Install Ollama from [ollama.com](https://ollama.com) and pull at least one model (e.g., `ollama pull llama3`).
2. Open **Settings** and scroll to the **Ollama** section.
3. Verify the URL (default: `http://localhost:11434`).
4. Click **Test Connection** -- the status should show "Connected" with a list of available models.
5. Once connected, Ollama models appear in runtime selectors across the workspace.

### Add a Delivery Channel

1. Scroll to the **Delivery Channels** section in Settings.
2. Click **+ Add Channel**.
3. Select the channel type (Slack, Telegram, or Webhook).
4. Enter the required configuration fields (see the [Delivery Channels](./delivery-channels.md) guide for per-type details).
5. Click **Create Channel**, then **Test** to verify connectivity.
6. Toggle **Chat** on for bidirectional mode (Slack and Telegram only).

### Enable Browser Automation

1. Scroll to the **Browser Tools** section.
2. Toggle **Chrome DevTools** on for debugging live pages, or **Playwright** for headless automation.
3. Both can be enabled simultaneously. Changes take effect immediately.

### Set a Monthly Budget

1. Scroll to **Cost & Usage Guardrails**.
2. Enter an overall monthly spend cap.
3. Optionally set per-provider caps for finer control.
4. Watch the pacing meter throughout the month.

### Configure Permission Presets

1. Scroll to **Permission Presets**.
2. Toggle on the preset that matches your comfort level.
3. The preset's tools are added to your approved list immediately.

## Instance & Upgrades

![Settings page scrolled to the Instance section](../screengrabs/settings-instance.png)
*The Instance section shows the installation metadata and the upgrade flow entry point.*

### Instance Section
The **Instance** card surfaces metadata about this installation: the stable `instanceId`, the current instance branch (e.g., `local` for single-clone users, `wealth-mgr` for private instances), the upstream remote it tracks, and whether the first-boot bootstrap has completed. Power users also see the guardrail state — whether a pre-push hook is installed and whether `pushRemote=no_push` is set on the instance branch.

### Dev Mode Gate
When `AINATIVE_DEV_MODE=true` is set in `.env.local` or the `.git/ainative-dev-mode` sentinel file is present, the Instance section displays a "Dev mode" banner and the upgrade machinery is intentionally bypassed. This is the gate that protects the main dev repo from having a pre-push hook installed by the instance-bootstrap flow — contributors working on `ainative-business` itself must not have their own push workflow broken.

### Upgrade Detection
An hourly scheduled poll runs `git fetch` against the upstream remote and compares `HEAD` to `origin/main`. When upstream is ahead, the sidebar shows a small **Upgrade available** badge next to Settings and the Instance card surfaces a "New version available" card with the number of commits behind. Detection is `git`-based rather than GitHub REST to avoid rate limits. Three consecutive poll failures escalate to a persistent notification.

### Upgrade Session
Clicking **Start upgrade** opens the upgrade session as a right-side sheet — not a full-page navigation, so you can glance back at your workspace while the upgrade runs. The session is backed by a task row with the `upgrade-assistant` profile, so it reuses all the existing execution infrastructure: fire-and-forget launch, canUseTool approval caching, SSE log streaming, and conflict resolution via the pending-approval host. If merge conflicts occur, a 3-card cluster (Keep mine / Take theirs / Show diff) appears inline and you resolve them without leaving the sheet. When the assistant needs a direct answer (e.g., to disambiguate a conflict), it now calls **AskUserQuestion**, which renders a typed reply field via the inbox's `QuestionReplyActions` branch — you answer in-place and the assistant resumes. The `upgrade-assistant` profile explicitly allowlists AskUserQuestion so it is not gated behind a generic permission prompt.

### Footer Upgrade Button
A subtle **Upgrade** button appears in the sidebar footer once an upgrade is available — the same surface that shows trust tier and the command palette shortcut. Clicking it opens the same upgrade session sheet from any page without navigating to Settings first.

### Hybrid Licensing
Local-only features (task execution, workflows, schedules, tables) remain unlimited regardless of license state. Cloud features (sync, marketplace, team sharing) are metered via a `(email, machineFingerprint, instanceId)` tuple so the same user on the same machine counts as one seat across multiple instance branches. Seat state is refreshed on each boot via the LicenseManager.

## Related

- [Cost & Usage](./cost-usage.md)
- [Tool Permissions](./tool-permissions.md)
- [Delivery Channels](./delivery-channels.md)
- [Provider Runtimes](./provider-runtimes.md)
