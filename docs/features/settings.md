---
title: "Settings"
category: "feature-reference"
section: "settings"
route: "/settings"
tags: ["settings", "configuration", "auth", "runtime", "browser-tools", "permissions", "budget", "ollama", "channels", "instance", "upgrade", "snapshots"]
features: ["session-management", "tool-permission-persistence", "tool-permission-presets", "browser-use", "spend-budget-guardrails", "settings-interactive-controls", "ollama-runtime-provider", "multi-channel-delivery", "bidirectional-channel-chat", "database-snapshots", "instance-bootstrap", "upgrade-detection", "upgrade-session", "instance-license-metering", "onboarding-runtime-provider-choice", "delivery-channels"]
screengrabCount: 12
lastUpdated: "2026-05-05"
---

# Settings

The Settings page is the central configuration hub for `ainative-business`. From a single scrollable page you can manage authentication for all provider runtimes, tune agent execution parameters, configure local AI models via Ollama and browser automation, set monthly cost caps, choose permission presets, manage delivery channels for Slack and Telegram, schedule database snapshots, and reset workspace data. Each section saves changes immediately with confirmation feedback, and a sticky table of contents on the left lets you jump between sections without scrolling.

## Screenshots

![Settings page top](../screengrabs/settings-list.png)
*Settings landing area showing the section index and the first configuration cards.*

![Full settings page](../screengrabs/settings-full.png)
*The full settings page captured end-to-end — every configurable section visible in one scroll.*

## Key Features

### Authentication

![Authentication section](../screengrabs/settings-auth.png)
*Authentication card with Anthropic OAuth/API key choice, OpenAI Codex key/ChatGPT sign-in, and per-runtime connection tests.*

Choose how `ainative-business` connects to each provider runtime. For **Anthropic**, **OAuth** uses your existing Max subscription at no additional API cost, while **API Key** uses the Anthropic key stored in your environment. For **OpenAI**, Codex App Server can use either an **OpenAI API key** or **ChatGPT** browser sign-in, while OpenAI Direct continues to use an API key. Connection tests validate the currently selected runtime mode and the OpenAI section shows active ChatGPT account and Codex rate-limit state when available.

### Runtime Configuration

![Runtime section with Ollama and browser tools](../screengrabs/settings-runtime.png)
*Runtime card grouping SDK timeout, max turns, Ollama connection, and the Chrome DevTools / Playwright browser toggles.*

The Runtime card consolidates execution-environment controls into one place:

- **SDK Timeout** — how many seconds an individual agent call is allowed to run before timing out. Lower values return faster; higher values give the agent more time for complex reasoning.
- **Max Turns** — how many back-and-forth tool-use cycles the agent can perform in a single run. Fewer turns suit quick lookups; more turns allow extended multi-step work.
- **Ollama** — connect to a local Ollama instance for private, zero-cost AI execution. The card shows connection status, the discovered local model list (with name, size, last-modified date), and a **Test Connection** button. Once connected, Ollama models appear as runtime options throughout the workspace and tasks routed to Ollama are tracked at $0 in the cost dashboard.
- **Browser Tools** — two independent toggles enable browser automation. **Chrome DevTools** connects to a running Chrome window (debug your own app, inspect network traffic, run performance audits, take screenshots of live pages). **Playwright** launches its own headless browser (autonomous web research, page scraping, structured analysis, cross-browser testing). When enabled, read-only actions auto-approve; state-changing actions still go through the permission flow.

### Chat Defaults

![Chat model preference card](../screengrabs/settings-chat-model-preference.png)
*Chat default model picker showing Claude, Codex, and Ollama options grouped by provider with cost tiers.*

Pick the default model for new chat conversations. The selector shows available Claude, Codex, and Ollama models with relative cost tiers so you can balance capability against spend before starting a conversation. The picker is the same one used in the chat composer; changing it here only updates the default for new conversations — existing conversations keep their selected model.

### Delivery Channels

![Delivery channels section](../screengrabs/settings-channels.png)
*Delivery Channels card showing configured Slack, Telegram, and webhook integrations with Chat mode and Active toggles.*

Configure external messaging integrations for outbound notifications and bidirectional chat:

- **Slack** — connect via webhook URL for notifications, or add a bot token for bidirectional chat directly from Slack.
- **Telegram** — connect via bot token for both notifications and bidirectional chat.
- **Webhook** — send notifications to any HTTP endpoint (outbound only).

Each channel card has four controls: a **Chat** toggle for bidirectional mode (Slack and Telegram only), an **Active** toggle, a **Test** button, and a **Delete** button. When Chat is enabled, you can message `ainative-business` directly from Slack or Telegram and receive AI responses in the same conversation. See the [Delivery Channels](./delivery-channels.md) guide for detailed setup instructions.

### Cost and Usage Guardrails

![Budget guardrails section](../screengrabs/settings-budget.png)
*Cost and Usage Guardrails with overall spend cap, monthly split, billing indicator, and pacing meter.*

Set spend caps to prevent runaway costs from autonomous agent work:

- **Overall spend cap** — a hard monthly ceiling across all providers.
- **Monthly split** — distribute the budget across billing periods.
- **Per-provider caps** — optional daily and monthly limits for Claude, Codex, and other providers independently.

A pacing meter shows current spend against the cap with color-coded health (green, amber, red). When usage crosses 80% of a configured cap an inbox notification is sent. After the cap is exceeded, new agent work is blocked.

### Permission Presets

![Permission presets card](../screengrabs/settings-presets.png)
*Permission Presets card with Read Only, Git Safe, and Full Auto tiers, color-coded risk badges, and individual toggles.*

Three one-click bundles set tool permissions in bulk:

| Preset | What it allows | Risk |
|--------|---------------|------|
| **Read Only** | File reading, search, directory listing | Lowest |
| **Git Safe** | Everything in Read Only plus file edits and git commands | Medium |
| **Full Auto** | All tools except direct user questions | Highest |

Presets are additive — enabling Git Safe automatically includes Read Only tools. Disabling a preset removes only its unique additions without affecting tools you approved individually.

### Tool Permissions

![Tool permissions list](../screengrabs/settings-permissions.png)
*Persisted tool-permission list with each pattern, the granting preset (if any), and a per-row Revoke button.*

Below the presets, a list shows every individually approved tool pattern. Patterns follow the format used by Claude Code (e.g., `Bash(git:*)`, `Read(/src/**)`). Each pattern has a **Revoke** button. The special `AskUserQuestion` tool is never auto-approved regardless of presets — it always renders an interactive reply field in the inbox.

### Database Snapshots

![Database snapshots section](../screengrabs/settings-snapshots.png)
*Database Snapshots card with automatic backup configuration, retention settings, and snapshot list with restore/delete actions.*

Protect your workspace with automatic and manual database backups:

- **Automatic backup** — enable scheduled backups with a configurable cron interval (e.g., every 6 hours, daily). Snapshots are created in the background without interrupting your workflow.
- **Retention settings** — control how many snapshots to keep with a maximum count and a maximum age in weeks. Older snapshots beyond the retention limits are pruned automatically.
- **Snapshot list** — view all existing snapshots with timestamps and sizes. Each snapshot has **Restore** and **Delete** action buttons for quick management.
- **Pre-restore safety snapshot** — before restoring an older snapshot, `ainative-business` automatically creates a safety snapshot of the current database state so you can roll back if needed.

### Data Management

![Data management section](../screengrabs/settings-data.png)
*Data Management card with Clear Data and Populate Sample Data actions.*

Two operations for managing workspace content:

- **Clear Data** — removes tasks, logs, documents, schedules, and other workspace content. Settings and permissions are preserved.
- **Populate Sample Data** — seeds the workspace with example projects, tasks, and documents so you can explore features against realistic data.

## Instance & Upgrades

![Instance section](../screengrabs/settings-instance.png)
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

## How To

### Connect Ollama for Local Models

1. Install Ollama from [ollama.com](https://ollama.com) and pull at least one model (e.g., `ollama pull llama3`).
2. Open **Settings** and scroll to the **Runtime** section.
3. Verify the Ollama URL (default: `http://localhost:11434`).
4. Click **Test Connection** — the status should show "Connected" with a list of available models.
5. Once connected, Ollama models appear in runtime selectors across the workspace.

### Switch Anthropic from API Key to OAuth

1. Scroll to the **Authentication** section.
2. Under Anthropic, select **OAuth**.
3. Click **Sign in with Anthropic** — a browser window opens to claim a token from your Max subscription.
4. After consent, the connection test runs automatically. New tasks now use OAuth (no per-call API charges).

### Add a Delivery Channel

1. Scroll to the **Delivery Channels** section in Settings.
2. Click **+ Add Channel**.
3. Select the channel type (Slack, Telegram, or Webhook).
4. Enter the required configuration fields (see the [Delivery Channels](./delivery-channels.md) guide for per-type details).
5. Click **Create Channel**, then **Test** to verify connectivity.
6. Toggle **Chat** on for bidirectional mode (Slack and Telegram only).

### Enable Browser Automation

1. Scroll to the **Runtime** section.
2. In the Browser Tools subgroup, toggle **Chrome DevTools** on for debugging live pages, or **Playwright** for headless automation.
3. Both can be enabled simultaneously. Changes take effect immediately.

### Set a Monthly Budget

1. Scroll to **Cost & Usage Guardrails**.
2. Enter an overall monthly spend cap.
3. Optionally set per-provider caps for finer control.
4. Watch the pacing meter throughout the month.

### Configure Permission Presets

1. Scroll to **Permission Presets**.
2. Toggle on the preset that matches your comfort level.
3. The preset's tools are added to your approved list immediately and appear in the **Tool Permissions** list below.

### Schedule Automatic Database Snapshots

1. Scroll to **Database Snapshots**.
2. Toggle **Automatic backup** on and choose a cron interval (e.g., every 6 hours).
3. Set retention: maximum count and maximum age in weeks.
4. New snapshots run on the schedule. Click **Snapshot now** for an on-demand backup.

## Related

- [Cost & Usage](./cost-usage.md)
- [Tool Permissions](./tool-permissions.md)
- [Delivery Channels](./delivery-channels.md)
- [Provider Runtimes](./provider-runtimes.md)
