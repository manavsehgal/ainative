---
title: Browser Use
status: completed
priority: P1
milestone: post-mvp
source: plans/steady-cooking-eich.md
dependencies:
  - chat-engine
  - agent-integration
  - tool-permission-persistence
---

# Browser Use

## Description

Enable ainative agents to interact with web browsers — navigating pages, clicking elements, reading content, taking screenshots, running Lighthouse audits, and inspecting network traffic. This is achieved by integrating two complementary MCP servers as tool sources: **Chrome DevTools MCP** (CDP-based, 29 tools) for debugging live Chrome sessions, and **Playwright MCP** (accessibility-snapshot-based, 50+ tools) for headless automation.

ainative's architecture already supports MCP server passthrough in both the chat engine and task execution layer. This feature adds a settings-driven configuration layer that lets users enable one or both browser MCP servers, then merges them into the existing `query()` call alongside the ainative in-process MCP server. Browser tools become available to chat conversations and any task regardless of agent profile, with read-only tools auto-approved and mutation tools gated through the existing permission system.

The two servers serve complementary use cases. Chrome DevTools MCP connects to a running Chrome instance — ideal for debugging your own app, performance profiling, and network inspection. Playwright MCP launches its own headless browser — ideal for autonomous research, scraping, structured page analysis, and cross-browser testing. Users choose which to enable based on their workflow.

## User Story

As a ainative user, I want my agents to browse the web and interact with live pages so that tasks like research, testing, auditing, and scraping can be fully automated without leaving the ainative interface.

## Technical Approach

### Settings layer (data)
- Add 4 new keys to `src/lib/constants/settings.ts`:
  - `BROWSER_MCP_CHROME_DEVTOOLS_ENABLED` (boolean)
  - `BROWSER_MCP_PLAYWRIGHT_ENABLED` (boolean)
  - `BROWSER_MCP_CHROME_DEVTOOLS_CONFIG` (JSON — extra CLI args like `--headless`, `--browser-url`)
  - `BROWSER_MCP_PLAYWRIGHT_CONFIG` (JSON — extra CLI args like `--browser chromium`)
- No schema migration needed — uses existing `settings` key-value table

### Config builder (new module)
- Create `src/lib/agents/browser-mcp.ts` exporting `getBrowserMcpServers()`
- Reads enabled flags + config from settings DB
- Returns `Record<string, McpServerConfig>` with npx launch commands:
  - `"chrome-devtools"`: `{ command: "npx", args: ["-y", "chrome-devtools-mcp@latest", ...extraArgs] }`
  - `"playwright"`: `{ command: "npx", args: ["-y", "@playwright/mcp@latest", ...extraArgs] }`
- Returns `{}` when neither enabled — zero overhead when unused

### Chat engine integration
- In `src/lib/chat/engine.ts` before the `query()` call (~line 200):
  - Call `getBrowserMcpServers()` and merge: `mcpServers: { ainative: stagentServer, ...browserServers }`
  - Expand `allowedTools` to include `"mcp__chrome-devtools__*"` and/or `"mcp__playwright__*"` when enabled
- Update `canUseTool` callback with browser tool permission tiers:
  - **Auto-allow (read-only):** `take_screenshot`, `take_snapshot`, `list_pages`, `list_console_messages`, `list_network_requests`, `get_console_message`, `get_network_request`, `browser_snapshot`, `browser_console_messages`, `browser_network_requests`, `browser_tabs`
  - **Permission-gated (mutations):** `click`, `fill`, `navigate_page`, `evaluate_script`, `type_text`, `press_key`, `drag`, `hover`, `fill_form`, `handle_dialog`, `browser_navigate`, `browser_click`, `browser_fill_form`, `browser_type`, `browser_evaluate`, `browser_run_code`

### Task execution integration
- In `src/lib/agents/claude-agent.ts` context building (~line 470):
  - Call `getBrowserMcpServers()` and merge with profile-level mcpServers
  - Any task gets browser tools when enabled globally, regardless of profile
  - Profiles can still deny browser tools via `canUseToolPolicy.autoDeny`

### Settings UI
- Add "Browser Tools" section to the existing settings page
- Toggle for each MCP server with description and status indicator
- Expandable advanced config panel for extra CLI arguments
- UX: `/frontend-designer` review recommended for toggle card design

### Permission compatibility
- Existing permission pattern system already supports browser tool patterns:
  - `mcp__playwright__browser_snapshot` — allow specific tool
  - `mcp__chrome-devtools__*` — allow all Chrome DevTools tools
- No changes to `src/lib/settings/permissions.ts` needed

## Acceptance Criteria

- [ ] Settings page shows "Browser Tools" section with toggles for Chrome DevTools MCP and Playwright MCP
- [ ] Enabling Chrome DevTools MCP in settings makes `mcp__chrome-devtools__*` tools available in chat
- [ ] Enabling Playwright MCP in settings makes `mcp__playwright__*` tools available in chat
- [ ] Browser tools are available to task execution for any agent profile when enabled
- [ ] Read-only browser tools (screenshots, snapshots, console reads) are auto-approved in chat
- [ ] Mutation browser tools (click, fill, navigate, evaluate) require user permission in chat
- [ ] Both servers disabled by default — no MCP processes spawned when unused
- [ ] Advanced config allows extra CLI args (e.g., `--headless`, `--browser-url`, `--browser chromium`)
- [ ] A profile with `autoDeny: ["mcp__playwright__*"]` blocks browser tools for that profile's tasks
- [ ] "Always Allow" permission patterns work for browser tools (e.g., `mcp__playwright__browser_snapshot`)
- [ ] Unit tests cover `getBrowserMcpServers()` config builder

## Scope Boundaries

**Included:**
- Settings-driven enable/disable for two MCP browser servers
- Wiring into chat engine and task execution query calls
- Permission tiering (read-only auto-approve, mutations gated)
- Settings UI toggles with advanced config
- Profile-level deny support via existing canUseToolPolicy

**Excluded:**
- Custom browser tool abstractions or wrappers — uses MCP servers as-is
- Browser session management UI (tab list, active page viewer) — future enhancement
- Screenshot/visual rendering in chat message bubbles — future enhancement
- Auto-installation of MCP packages — user must have npx-resolvable packages
- Computer use / vision-based interaction — separate capability from MCP browser tools

## References

- Source: `plans/steady-cooking-eich.md` — architecture research and integration plan
- Related features: `chat-engine` (chat query call site), `agent-integration` (task query call site), `tool-permission-persistence` (permission patterns)
- External: [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) — 29 CDP tools, Node.js v20.19+
- External: [Playwright MCP](https://github.com/microsoft/playwright-mcp) — 50+ tools, Node.js 18+, accessibility-snapshot primary mode
