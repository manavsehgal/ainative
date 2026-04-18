---
title: Multi-Channel Delivery
status: completed
priority: P2
milestone: post-mvp
source: ideas/vision/ainative-OpenClaw-Companion-Research-Report.md
dependencies: [heartbeat-scheduler]
---

# Multi-Channel Delivery

## Description

Add Slack and Telegram as outbound delivery channels for agent results, heartbeat notifications, workflow completions, and approval requests. Phase 1 is delivery-only (ainative pushes to channels). Phase 2 (bidirectional interaction — users reply in Slack/Telegram to trigger agent actions) is deferred.

This removes the "dashboard-only" limitation that the vision docs identify as a key adoption barrier. Solo founders live in messaging apps, not browser tabs. A heartbeat that surfaces customer inquiries in Slack at 8am is the difference between "another tool" and "an AI that runs my business."

Inspired by OpenClaw's 24+ channel architecture but focused on the two highest-value channels for the target personas: Slack (professional/team) and Telegram (personal/solo founder).

## User Story

As a solo founder, I want my AI agents to send me results, alerts, and heartbeat summaries in Slack or Telegram, so that I stay informed without needing to check the ainative dashboard.

## Technical Approach

### Channel Adapter Architecture

New module: `src/lib/channels/`

```
src/lib/channels/
  types.ts           -- Channel adapter interface, message format types
  registry.ts        -- Channel registry (discover + configure)
  slack-adapter.ts   -- Slack adapter (Bolt SDK)
  telegram-adapter.ts -- Telegram adapter (grammY or node-telegram-bot-api)
  formatter.ts       -- Format ainative outputs into channel-appropriate messages
```

**Channel adapter interface:**
```typescript
interface ChannelAdapter {
  id: string;                        // 'slack' | 'telegram'
  name: string;                      // Display name
  isConfigured(): boolean;           // Has valid credentials
  send(target: ChannelTarget, message: ChannelMessage): Promise<void>;
  testConnection(): Promise<boolean>;
}

interface ChannelTarget {
  channelType: 'slack' | 'telegram';
  destination: string;               // Slack channel ID or Telegram chat ID
}

interface ChannelMessage {
  title: string;
  body: string;                      // Markdown-formatted
  severity: 'info' | 'warning' | 'urgent';
  source: {
    type: 'heartbeat' | 'workflow' | 'task' | 'approval';
    id: string;                      // Task/workflow/schedule ID
    profileName: string;             // Which agent sent this
  };
  actions?: ChannelAction[];         // Optional buttons (Phase 2)
}
```

### Slack Adapter

- **Auth:** Slack Bot Token (stored in settings table, encrypted at rest)
- **Library:** `@slack/bolt` (official SDK)
- **Message format:** Slack Block Kit — structured blocks with sections, dividers, and context. Severity maps to emoji prefix and color sidebar.
- **Target:** Specific channel ID (user configures per-schedule or per-workflow which Slack channel receives results)

### Telegram Adapter

- **Auth:** Telegram Bot Token via BotFather (stored in settings table)
- **Library:** `node-telegram-bot-api` (lightweight, no framework)
- **Message format:** Telegram Markdown V2 — formatted text with bold, code blocks, and links. Severity maps to emoji prefix.
- **Target:** Chat ID (user configures per-schedule or per-workflow which Telegram chat receives results)

### Schema Changes

New table: `channel_configs`
```
channel_configs:
  id TEXT PRIMARY KEY
  channelType TEXT NOT NULL         -- 'slack' | 'telegram'
  name TEXT NOT NULL                -- User-friendly name ("My Slack workspace", "Personal Telegram")
  credentials TEXT NOT NULL         -- Encrypted JSON (bot token, etc.)
  defaultDestination TEXT           -- Default channel/chat ID
  isActive INTEGER DEFAULT 1
  createdAt INTEGER NOT NULL
  updatedAt INTEGER NOT NULL
```

Extend `schedules` table:
```
  deliveryChannels TEXT             -- JSON array of channel config IDs to deliver results to
```

Extend `workflows` table (or workflow step configs):
```
  deliveryChannels TEXT             -- JSON array for workflow completion notifications
```

### Delivery Triggers

Hook into existing completion flows:

1. **Heartbeat completion** (in scheduler.ts): After heartbeat evaluation, if `action_needed: true` AND schedule has `deliveryChannels`, format result and push to each configured channel.
2. **Task completion** (in execution-manager.ts): After task finishes, if task's workflow/schedule has delivery channels, push completion summary.
3. **Workflow completion** (in workflow engine): After all steps complete, if workflow has delivery channels, push final summary.
4. **Approval requests** (in notification system): When a canUseTool gate fires and requires human approval, push an approval notification to configured channels with a link back to the ainative inbox.

### Message Formatting

`formatter.ts` converts ainative's internal result format to channel-appropriate messages:

- **Heartbeat results:** "Heartbeat: [profile name] — [N] items need attention" + bullet list of action items
- **Task completion:** "[profile name] completed: [task title]" + truncated output (first 500 chars) + "View full results" link
- **Workflow completion:** "Workflow [name] completed: [N] steps, [duration]" + step summary
- **Approval request:** "Approval needed: [profile name] wants to use [tool]" + "Approve in ainative" link

### Settings UI

New "Channels" section in Settings page:

1. **Channel list:** Show configured channels with connection status
2. **Add channel:** Select type (Slack/Telegram) → enter credentials → test connection → save
3. **Per-schedule config:** In schedule edit form, add "Deliver results to" multi-select of configured channels
4. **Per-workflow config:** In workflow settings, add delivery channel selector
5. **Test button:** Send a test message to verify channel configuration

## Acceptance Criteria

- [ ] Slack adapter sends formatted messages to configured channels using Block Kit
- [ ] Telegram adapter sends formatted messages to configured chats using Markdown V2
- [ ] Channel credentials stored encrypted in `channel_configs` table
- [ ] Settings UI allows adding, testing, and removing channel configurations
- [ ] Schedules can be configured with delivery channels (per-schedule)
- [ ] Heartbeat results with `action_needed: true` are pushed to configured channels
- [ ] Task and workflow completions are pushed to configured channels
- [ ] Approval requests are pushed with a link back to the ainative inbox
- [ ] Message formatting is appropriate for each channel (Block Kit for Slack, Markdown V2 for Telegram)
- [ ] Test connection button verifies channel configuration works
- [ ] Delivery failures are logged but don't block task/workflow completion (fire-and-forget)
- [ ] No delivery occurs if no channels are configured (existing behavior unchanged)

## Scope Boundaries

**Included:**
- Outbound delivery to Slack and Telegram (Phase 1: push only)
- Channel adapter architecture supporting future channels
- Settings UI for channel configuration
- Per-schedule and per-workflow delivery channel selection
- Message formatting for heartbeat, task, workflow, and approval events

**Excluded:**
- Bidirectional interaction (receiving messages from Slack/Telegram to trigger actions) — Phase 2, deferred
- Email delivery — potential future channel
- Discord, WhatsApp, iMessage, Teams — future channels following same adapter pattern
- Custom webhook delivery — potential future channel type
- Message threading (grouping related messages in Slack threads) — Phase 2
- Rich interactive components (buttons, dropdowns in Slack) — Phase 2

## References

- Source: `ideas/vision/ainative-OpenClaw-Companion-Research-Report.md` — Section 3.4 (Multi-Channel Delivery)
- Source: `ideas/vision/machine-builds-machine-claude-ext-rsrch.md` — Section 7 Tier 2 (integration layer)
- Existing notification system: `src/app/api/notifications/` and inbox components
- Related features: heartbeat-scheduler (primary delivery source), agent-async-handoffs (handoff notifications)
