---
title: "Schedules"
category: "feature-reference"
section: "schedules"
route: "/schedules"
tags: ["schedules", "automation", "recurring", "prompts"]
features: ["scheduled-prompt-loops"]
screengrabCount: 3
lastUpdated: "2026-03-27"
---

# Schedules

Automate recurring AI prompts on configurable intervals. Define what you want an agent to do, set a schedule, and let it run unattended. Each firing creates a tracked task with full execution history, so you always know what ran, when it ran, and what it produced. Pause, resume, or edit schedules at any time without losing history.

## Screenshots

![Schedules list showing active and paused schedules with status, frequency, and next firing time](../screengrabs/schedules-list.png)
*The schedules list displays all configured schedules with their current status, interval, next run time, and associated project.*

![Schedule detail sheet showing configuration and firing history](../screengrabs/schedules-detail.png)
*The schedule detail sheet shows the full configuration, execution statistics, and a chronological firing history with results from each run.*

![Schedule edit dialog with name, prompt, interval, runtime, and profile fields](../screengrabs/schedules-edit-form.png)
*The edit dialog lets you modify a schedule's name, prompt, interval, runtime provider, and agent profile without recreating it.*

## Key Features

### Schedule Management
Create, edit, pause, resume, and delete schedules from a single list view. Each schedule captures a complete execution context: a descriptive name, the prompt to send to the agent, the execution interval, a project for scoping, the provider runtime, and the agent profile that governs behavior. Schedules persist in the database and survive server restarts.

### Schedule Editing
Edit any schedule after creation using the edit dialog. Update the schedule name, prompt text, execution interval, runtime provider (Claude or Codex), and agent profile without deleting and recreating the schedule. All changes take effect on the next firing.

### Firing History
Every schedule firing creates a tracked child task. The detail view shows a chronological history of all past executions with their results, making it easy to audit what the agent did on each run and spot patterns over time.

### Flexible Intervals
Choose from six built-in presets (every 5 minutes, 15 minutes, 30 minutes, hourly, every 2 hours, or daily at 9 AM) or define a custom interval. Advanced users can enter standard 5-field cron expressions for precise control. Human-friendly shorthand like `5m`, `2h`, or `1d` is also accepted.

### Runtime and Profile Selection
Choose which AI provider runtime (Claude or Codex) and which agent profile each schedule uses. This lets you match the right model and behavioral profile to each automation task, whether it needs a code reviewer, researcher, or general assistant.

### Pause and Resume
Suspend a schedule without losing its configuration or execution history. Pausing stops future runs while preserving the next-run calculation, so resuming picks up right where it left off.

## How To

### Create a New Schedule
1. Navigate to **Schedules** from the sidebar under the Manage group.
2. Click the **Create Schedule** button to open the creation form.
3. Enter a descriptive name for the schedule.
4. Select an interval from the presets or define a custom interval.
5. Write the prompt that the agent will execute on each run.
6. Optionally select a project for context scoping.
7. Choose the provider runtime and agent profile.
8. Save the schedule. It begins executing on the configured cadence.

### Edit an Existing Schedule
1. Open the schedules list at **Schedules**.
2. Select a schedule to open its detail view.
3. Click the **Edit** button to open the edit dialog.
4. Modify any combination of name, prompt, interval, runtime, or agent profile.
5. Save your changes. They take effect on the next scheduled firing.

### Pause and Resume a Schedule
1. Open the schedules list at **Schedules**.
2. Locate the schedule you want to control.
3. Click the pause button to suspend future executions, or the resume button to reactivate a paused schedule.
4. The schedule status updates immediately and the list reflects the new state.

## Related
- [Profiles](./profiles.md) — Agent profiles used by schedule firings
- [Monitor](./monitoring.md) — View execution logs from schedule firings
