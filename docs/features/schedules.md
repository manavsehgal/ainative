---
title: "Schedules"
category: "feature-reference"
section: "schedules"
route: "/schedules"
tags: [schedules, automation, loops, recurring, intervals, autonomous]
features: ["scheduled-prompt-loops", "autonomous-loop-execution"]
screengrabCount: 1
lastUpdated: "2026-03-21"
---

# Schedules

Schedule recurring agent tasks with configurable intervals and autonomous loop execution. The scheduler engine manages the full execution lifecycle, running prompts on a cadence you define with preset intervals or custom timing. Autonomous loops add intelligent stop conditions so agents can iterate toward a goal and stop when done.

## Screenshots

![Schedules list showing active and paused schedules](../screengrabs/schedules-list.png)
*The schedules list displays all configured schedules with their status, interval, next run time, and associated project.*

## Key Features

### Preset Intervals
Choose from six built-in interval presets for common scheduling patterns: every 5 minutes, 15 minutes, 30 minutes, hourly, every 2 hours, or daily at 9 AM. Presets cover the most common automation cadences without requiring manual configuration.

### Custom Intervals
Define custom intervals beyond the presets using the interval parser. Specify any duration to match your exact automation needs, from rapid polling to weekly recurring tasks.

### Schedule Configuration
Each schedule captures a complete execution context: a descriptive name, the execution interval, the prompt to send to the agent, the project context for scoping, the provider runtime (Claude or Codex), and the agent profile that governs behavior.

### Scheduler Engine
The scheduler engine runs as a background process initialized via the Next.js instrumentation hook. It tracks all active schedules, calculates next run times, triggers executions on cadence, and manages the lifecycle of each schedule through active, paused, and completed states.

### Autonomous Loop Execution
Autonomous loops extend scheduled execution with intelligent stop conditions. Four stop condition types are available: max iterations (stop after N runs), time limit (stop after a duration), goal achieved (agent determines the objective is met), and error threshold (stop after too many failures). The loop executor passes iteration context between runs so the agent can build on previous results.

### Pause and Resume
Schedules can be paused and resumed without losing their configuration or execution history. Pausing a schedule suspends future runs while preserving the next-run calculation, so resuming picks up right where it left off.

## How To

### Create a Recurring Schedule
1. Navigate to `/schedules` from the sidebar under the **Manage** group.
2. Click the **Create Schedule** button to open the creation form.
3. Enter a descriptive name for the schedule.
4. Select an interval from the presets (5min, 15min, 30min, hourly, 2h, daily 9AM) or define a custom interval.
5. Write the prompt that the agent will execute on each run.
6. Optionally select a project for context scoping.
7. Choose the provider runtime and agent profile.
8. Save the schedule. It begins executing on the configured cadence.

### Set Up an Autonomous Loop
1. Create a schedule with your desired prompt and interval.
2. Configure one or more stop conditions: set a max iteration count, a time limit, a goal description, or an error threshold.
3. Start the schedule. The loop executor passes context from each iteration to the next.
4. The loop automatically stops when any stop condition is met.

### Pause or Resume a Schedule
1. Open the schedules list at `/schedules`.
2. Locate the schedule you want to control.
3. Click the pause button to suspend future executions, or the resume button to reactivate a paused schedule.
4. The schedule status updates to reflect the current state.

## Related
- [Monitoring](./monitoring.md)
- [Profiles](./profiles.md)
- [Cost & Usage](./cost-usage.md)
