---
title: "Tool Permissions"
category: "feature-reference"
section: "tool-permissions"
route: "cross-cutting"
tags: [permissions, trust, safety, approval, human-in-the-loop, presets]
features: ["tool-permission-persistence", "tool-permission-presets", "ambient-approval-toast", "upgrade-session"]
screengrabCount: 1
lastUpdated: "2026-05-05"
---

# Tool Permissions

`ainative-business` provides a layered permission system that balances agent autonomy with human oversight. Trust tiers control what tools an agent can invoke, while persistence and ambient approval mechanisms reduce friction for trusted operations.

## Screenshots

![Permission presets in settings](../screengrabs/settings-presets.png)
*Settings page showing the three trust tier presets -- Read Only, Git Safe, and Full Auto.*

## Key Features

### Trust Tier Presets

Three built-in permission tiers provide progressively broader agent access:

- **Read Only** -- safe browsing and file reading. No writes, no shell commands.
- **Git Safe** -- read operations plus git commands (status, diff, log, commit). No arbitrary shell execution.
- **Full Auto** -- all tools available, including shell commands and file writes.

Presets are configured in the Settings page and apply globally to all agent executions.

### Trust Tier Badge

The sidebar footer displays a trust tier badge showing the current permission level at a glance. Clicking the badge opens a popover with details about what the active tier permits.

### Tool Permission Persistence ("Always Allow")

When an agent requests a tool that requires approval, you can click "Always Allow" to persist that permission. On subsequent runs, the tool is pre-approved without prompting. Persisted permissions can be revoked in Settings.

### Permission Pre-Check

Before executing a task, the runtime performs a permission pre-check against the current trust tier and any persisted "Always Allow" entries. Tools that fall within scope proceed automatically; tools outside scope trigger the approval flow.

### Human-in-the-Loop Approval

When a tool request exceeds the current trust tier and has not been persisted, a notification is created in the inbox. You can approve or deny from the Inbox or from the task detail view, keeping the agent paused until a decision is made.

### AskUserQuestion Tool

A special tool — `AskUserQuestion` — lets agents ask you for direct input rather than request permission. Instead of an Approve / Deny pair, the inbox notification renders a typed reply box (the `QuestionReplyActions` branch of the permission response view). This is the primitive behind the upgrade assistant's conflict resolution flow: when the merge hits an ambiguous decision, the upgrade profile asks a targeted question and waits for your reply before proceeding. `AskUserQuestion` is never auto-approved and is explicitly allowlisted on the `upgrade-assistant` profile.

### Ambient Approval Toast

For quick permission grants without navigating away from the current context, ambient toast notifications appear when an agent requests a tool. You can approve directly from the toast, maintaining workflow continuity.

## Related

- [Settings](./settings.md)
- [Inbox & Notifications](./inbox-notifications.md)
- [Provider Runtimes](./provider-runtimes.md)
