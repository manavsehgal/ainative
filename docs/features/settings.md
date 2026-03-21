---
title: "Settings"
category: "feature-reference"
section: "settings"
route: "/settings"
tags: [settings, authentication, budget, permissions, data, providers, oauth, api-key, codex]
features: ["tool-permission-persistence", "provider-runtime-abstraction", "spend-budget-guardrails", "tool-permission-presets", "openai-codex-app-server"]
screengrabCount: 4
lastUpdated: "2026-03-21"
---

# Settings

Configure authentication, budgets, tool permissions, and data management from a single settings page. Settings supports two provider runtimes -- Claude (Agent SDK with OAuth or API key) and Codex (App Server with WebSocket JSON-RPC) -- along with budget guardrails, permission presets with risk-level badges, and data management tools for clearing or exporting workspace data.

## Screenshots

![Settings page overview with authentication section](../screengrabs/settings-list.png)
*The settings page showing the authentication section with provider configuration, OAuth vs API key selection, and connection test.*

![Budget settings section](../screengrabs/settings-budget.png)
*Budget configuration with overall spend cap, monthly split, OAuth billing indicator, and current pacing meter.*

![Permission presets section](../screengrabs/settings-presets.png)
*Tool permission presets showing Read Only, Git Safe, and Full Auto tiers with risk-level badges.*

![Data management section](../screengrabs/settings-data.png)
*Data management section with clear data and export options.*

## Key Features

### Authentication
Configure how Stagent authenticates with provider runtimes. For Claude, choose between OAuth (uses your Max subscription with no additional API charges) and API Key (uses your Anthropic API key from `.env.local`). For Codex, configure the App Server connection endpoint. A connection test button validates that your credentials and endpoints are working.

### Provider Runtime Abstraction
Two provider runtimes are supported out of the box. Claude uses the Anthropic Agent SDK and supports both OAuth and API key authentication modes. Codex connects via the App Server using WebSocket JSON-RPC for real-time communication. The runtime abstraction means tasks and profiles work identically regardless of which provider executes them.

### Budget Configuration
Set an overall spend cap to limit total workspace costs. Configure monthly splits to distribute the budget across billing periods. The OAuth billing indicator shows whether the current authentication method incurs API charges. A pacing meter visualizes current spend against the budget, with color-coded status for healthy, warning, and critical spend levels.

### Permission Presets
Three permission tiers control what tools agents are allowed to use. **Read Only** grants access to file reading and search tools with no write permissions -- the lowest risk tier. **Git Safe** adds version-controlled write operations (file edits, git commits) with moderate risk. **Full Auto** enables all tools including shell commands, network access, and file system writes -- the highest risk tier. Each tier displays a risk badge for clear visibility.

### Tool Permission Persistence
The "Always Allow" feature remembers tool permission decisions across sessions. When you approve a tool for a given permission tier, the decision is stored in the settings table so agents do not prompt for the same permission again.

### Data Management
Clear workspace data or export it for backup. The clear data function removes tasks, logs, documents, and other workspace content while preserving settings. Export creates a snapshot of your workspace data for external storage or migration.

## How To

### Configure Claude Authentication
1. Navigate to `/settings` from the sidebar under the **Configure** group.
2. In the **Authentication** section, select either **OAuth** or **API Key** for the Claude runtime.
3. For OAuth, ensure you have an active Claude Max subscription. For API Key, verify that `ANTHROPIC_API_KEY` is set in `.env.local`.
4. Click **Test Connection** to validate the configuration.

### Set Up Codex Runtime
1. Open the **Authentication** section in settings.
2. Locate the Codex App Server configuration.
3. Enter the WebSocket endpoint for the Codex App Server.
4. Test the connection to verify connectivity.

### Configure Budget Guardrails
1. Navigate to the **Budget** section in settings.
2. Enter the overall spend cap amount.
3. Set the monthly split to distribute the budget.
4. Monitor the pacing meter to track spend against the cap.
5. Alerts will notify you when spend approaches the limit.

### Choose a Permission Preset
1. Open the **Permission Presets** section in settings.
2. Review the three tiers: Read Only, Git Safe, and Full Auto.
3. Note the risk badge on each tier to understand the permission scope.
4. Select the tier that matches your risk tolerance for agent operations.

### Clear Workspace Data
1. Scroll to the **Data Management** section in settings.
2. Click **Clear Data** to remove workspace content (tasks, logs, documents).
3. Confirm the action. Settings are preserved; only workspace data is cleared.

## Related
- [Cost & Usage](./cost-usage.md)
- [Tool Permissions](./tool-permissions.md)
- [Provider Runtimes](./provider-runtimes.md)
