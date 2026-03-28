---
title: "Settings"
category: "feature-reference"
section: "settings"
route: "/settings"
tags: ["settings", "configuration", "auth", "runtime", "browser-tools", "permissions", "budget"]
features: ["session-management", "tool-permission-persistence", "tool-permission-presets", "browser-use", "spend-budget-guardrails", "settings-interactive-controls"]
screengrabCount: 5
lastUpdated: "2026-03-27"
---

# Settings

The Settings page is the central configuration hub for Stagent. From a single scrollable page you can manage authentication for both Claude and Codex runtimes, tune how long agents are allowed to run, pick a default chat model, enable browser automation, set monthly cost caps, choose permission presets, review individually approved tools, and reset workspace data. Each section saves changes immediately with confirmation feedback.

## Screenshots

![Settings page overview showing authentication and runtime sections](../screengrabs/settings-list.png)
*Full settings page with authentication, Codex runtime, chat defaults, runtime configuration, and browser tools sections visible.*

![Browser tools section with Chrome DevTools and Playwright toggles](../screengrabs/settings-browser-tools.png)
*Browser Tools section showing independent toggles for Chrome DevTools and Playwright browser automation.*

![Budget guardrails section with spend caps and split configuration](../screengrabs/settings-budget.png)
*Cost and Usage Guardrails with overall spend cap, monthly split, billing indicator, and pacing meter.*

![Permission presets with risk badges and toggle controls](../screengrabs/settings-presets.png)
*Permission Presets showing Read Only, Git Safe, and Full Auto tiers with color-coded risk badges.*

![Data management section with clear and populate options](../screengrabs/settings-data.png)
*Data Management section for resetting or populating workspace data.*

## Key Features

### Authentication

Choose how Stagent connects to Claude. **OAuth** uses your existing Max subscription at no additional API cost. **API Key** uses the Anthropic key stored in your environment. A **Test Connection** button validates whichever method you select. A separate section configures the Codex App Server endpoint for tasks that run through the Codex runtime.

### Runtime Configuration

Two controls govern how agents behave during execution:

- **SDK Timeout** -- how many seconds an individual agent call is allowed to run before timing out. Lower values return faster; higher values give the agent more time for complex reasoning.
- **Max Turns** -- how many back-and-forth tool-use cycles the agent can perform in a single run. Fewer turns suit quick lookups; more turns allow extended multi-step work.

Both controls are planned for an upgrade to interactive sliders with contextual labels and recommended-range indicators (see the Settings Interactive Controls feature, currently pending).

### Chat Defaults

Pick the default model for new chat conversations. The selector shows available Claude and Codex models with relative cost tiers so you can balance capability against spend before starting a conversation.

### Browser Tools

Enable browser automation for chat and task execution without leaving Stagent. Two independent toggles control complementary capabilities:

- **Chrome DevTools** -- connects to a running Chrome window. Useful for debugging your own app, inspecting network traffic, running performance audits, and taking screenshots of live pages.
- **Playwright** -- launches its own headless browser. Useful for autonomous web research, page scraping, structured analysis, and cross-browser testing.

When enabled, read-only browser actions (screenshots, page snapshots, console reads) are auto-approved. Actions that change page state (clicking, typing, navigating) go through the normal permission approval flow. Both toggles are off by default -- no background processes are spawned when unused.

### Cost and Usage Guardrails

Set spend caps to prevent runaway costs from autonomous agent work:

- **Overall spend cap** -- a hard monthly ceiling across all providers.
- **Monthly split** -- distribute the budget across billing periods.
- **Per-provider caps** -- optional daily and monthly limits for Claude and Codex independently, with advanced token-level overrides.

A pacing meter shows current spend against the cap with color-coded health (green, amber, red). When usage crosses 80% of a configured cap an inbox notification is sent. After the cap is exceeded, new agent work is blocked with an explicit message -- already-running tasks are allowed to finish. The next reset time is displayed so you know when the budget window rolls over.

### Permission Presets

Three one-click bundles set tool permissions in bulk, reducing first-run friction:

| Preset | What it allows | Risk |
|--------|---------------|------|
| **Read Only** | File reading, search, directory listing | Lowest |
| **Git Safe** | Everything in Read Only plus file edits and git commands | Medium |
| **Full Auto** | All tools except direct user questions | Highest |

Each preset shows a color-coded risk badge. Presets are additive -- enabling Git Safe automatically includes Read Only tools. Disabling a preset removes only its unique additions without affecting tools you approved individually.

### Tool Permissions

Below the presets, a list shows every individually approved tool pattern. Patterns follow the format used by Claude Code:

- **Tool-level**: `Read`, `Write` -- blanket approval for any invocation.
- **Pattern-level**: `Bash(command:git *)` -- approve only when the command starts with `git`.
- **Browser tools**: `mcp__playwright__browser_snapshot` -- approve a specific browser action.

Each pattern has a **Revoke** button. Revoking a pattern means the agent will prompt for permission again the next time it tries to use that tool. The special `AskUserQuestion` tool is never auto-approved regardless of presets or saved patterns.

### Data Management

Two operations for managing workspace content:

- **Clear Data** -- removes tasks, logs, documents, schedules, and other workspace content. Settings and permissions are preserved.
- **Populate Sample Data** -- seeds the workspace with example projects, tasks, and documents for exploration or demo purposes.

## How To

### Enable Browser Automation

1. Open **Settings** from the sidebar (under the Configure group).
2. Scroll to the **Browser Tools** section.
3. Toggle **Chrome DevTools** on if you want to debug pages in your running Chrome browser.
4. Toggle **Playwright** on if you want agents to launch their own headless browser for research and scraping.
5. Both can be enabled at the same time. Changes take effect immediately for the next chat message or task execution.

### Set a Monthly Budget

1. Open **Settings** and scroll to **Cost & Usage Guardrails**.
2. Enter an overall monthly spend cap (in dollars).
3. Optionally set per-provider daily or monthly caps for finer control.
4. Watch the pacing meter to track spend throughout the month.
5. You will receive an inbox notification at 80% usage and a hard stop at 100%.

### Configure Permission Presets

1. Open **Settings** and scroll to **Permission Presets**.
2. Review the three tiers and their risk badges.
3. Toggle on the preset that matches your comfort level -- Read Only for cautious use, Git Safe for development workflows, Full Auto for fully autonomous operation.
4. The preset's tools are added to your approved list immediately. You can still revoke individual tools below if needed.

### Change the Default Chat Model

1. Open **Settings** and find the **Chat Defaults** section.
2. Select a model from the dropdown. Cost tier labels help you compare options.
3. New conversations will use this model by default. You can still switch models per-conversation from the chat input bar.

### Clear Workspace Data

1. Scroll to **Data Management** at the bottom of Settings.
2. Click **Clear Data**.
3. Confirm the action. All tasks, logs, documents, and schedules are removed. Your settings, permissions, and authentication configuration are preserved.

## Related

- [Cost & Usage](./cost-usage.md)
- [Tool Permissions](./tool-permissions.md)
