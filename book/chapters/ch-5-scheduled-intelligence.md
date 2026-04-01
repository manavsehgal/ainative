---
title: "Scheduled Intelligence"
subtitle: "From Cron Jobs to Heartbeat-Driven Proactive Agents"
chapter: 5
part: 2
readingTime: 12
relatedDocs: [schedules, monitoring]
lastGeneratedBy: "2026-03-31T21:00:00Z"
---

# Scheduled Intelligence

## The Problem

Not all intelligence is triggered by human action. Some of the most valuable automation runs on a schedule -- daily reports, weekly reviews, continuous monitoring. These are the heartbeat of an AI-native organization. While the previous chapters explored how agents execute tasks on demand and how humans gate dangerous operations, this chapter addresses a different question entirely: what happens when the human is not there at all?

Traditional software answered this question decades ago with cron. A crontab entry, a shell script, a log file -- the pattern is so old that it feels beneath discussion. But cron executes commands. It does not execute *intelligence*. The difference matters. A cron job runs the same script every time, producing output that varies only with the data it encounters. A scheduled intelligence loop runs a prompt through an agent that reasons, adapts, and makes decisions based on context that evolves between executions. The output of iteration three informs the behavior of iteration four. That is not batch processing. That is a feedback loop.

The industry is converging on this insight from several directions. GitHub Actions supports `schedule` triggers with cron syntax, but the workflows themselves are static YAML pipelines -- they do not learn between runs. Temporal and its spiritual predecessor Cadence brought durable execution to scheduled workflows, with retry policies, timeouts, and workflow versioning. These are powerful systems, but they orchestrate deterministic code paths. The AI-native equivalent orchestrates reasoning -- and reasoning is neither deterministic nor idempotent.

Stagent's scheduler engine started as a simple cron-to-task bridge: define a prompt, pick an interval, let it run. That was Sprint 9. By Sprint 35, the scheduler had evolved into something fundamentally different -- a system with two distinct scheduling modes, natural language interval parsing, active hours windowing, heartbeat checklists, suppression logic, budget caps, and multi-channel delivery. This chapter traces that evolution and explains why the heartbeat scheduler represents a step change in how AI agents operate autonomously.

## The Scheduler Engine

Every scheduler needs an answer to the bootstrapping question: how does it start? In Stagent, the answer is Next.js instrumentation. The `register()` hook in `instrumentation.ts` fires once when the server process starts, and it is the only place where long-lived background work can safely begin in a Next.js application.

<!-- filename: src/instrumentation.ts -->
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/schedules/scheduler");
    startScheduler();
  }
}
```
> The instrumentation hook -- three lines that turn a web server into a scheduler

That dynamic import is not accidental. Next.js evaluates `instrumentation.ts` in multiple runtimes -- Node.js, Edge, and during the build step. The `NEXT_RUNTIME` guard ensures the scheduler only starts in the Node.js server process, where it has access to SQLite and the filesystem. Without this check, you would get cryptic build failures as the scheduler tries to open a database connection during static page generation.

The engine itself is a poll-based loop that ticks every 60 seconds. On each tick, it queries the database for schedules whose `nextFireAt` timestamp has passed, claims each one atomically to prevent double-firing, then branches based on schedule type -- clock-driven schedules create a task immediately, while heartbeat schedules evaluate their checklist first.

<!-- filename: src/lib/schedules/scheduler.ts -->
```typescript
export async function tickScheduler(): Promise<void> {
  const now = new Date();
  const dueSchedules = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.status, "active"),
        lte(schedules.nextFireAt, now)
      )
    );

  for (const schedule of dueSchedules) {
    // Atomic claim: update nextFireAt to null as a lock
    const claimResult = db
      .update(schedules)
      .set({ nextFireAt: null, updatedAt: now })
      .where(
        and(
          eq(schedules.id, schedule.id),
          eq(schedules.status, "active"),
          lte(schedules.nextFireAt, now)
        )
      )
      .run();

    if (claimResult.changes === 0) continue;

    // Branch on schedule type
    if (schedule.type === "heartbeat") {
      await fireHeartbeat(schedule, now);
    } else {
      await fireSchedule(schedule, now);
    }
  }

  // Process pending agent handoffs
  await processHandoffs();
}
```
> The scheduler tick loop -- atomic claim, type branching, and handoff processing in a single cycle

The atomic claim pattern deserves attention. In a world where tick intervals are perfectly regular and each tick completes before the next one starts, you would never fire the same schedule twice. But the real world is not like that. A tick might take longer than 60 seconds if the database is under load or if a previous task creation involves heavy I/O. The claim pattern -- setting `nextFireAt` to null and checking that the update affected exactly one row -- ensures that even overlapping ticks cannot double-fire a schedule. It is the same optimistic locking pattern that job queues like Sidekiq and BullMQ use, adapted for SQLite's synchronous write model.

Notice that the tick loop also processes pending agent handoffs. This is architectural frugality -- rather than running a separate background process for the handoff bus, we piggyback on the scheduler's existing 60-second heartbeat. Approved handoffs execute within one tick of approval, and the system stays simple.

> [!info]
> **Why Not Cron?**
> An in-process scheduler has one critical advantage over OS-level cron: it shares the application's database. Cron jobs need external coordination to track state -- which jobs ran, which failed, what their output was. The Stagent scheduler writes directly to the same SQLite database that the UI reads from, so schedule status, firing history, and task results are all visible in the same interface without any synchronization layer.

## Natural Language Scheduling

One of the decisions that paid outsized dividends was building a full natural language interval parser. Users should not need to know cron syntax to schedule a daily standup report. The NLP parser accepts plain English scheduling expressions and converts them to standard five-field cron expressions.

<!-- filename: src/lib/schedules/nlp-parser.ts -->
```typescript
const everyDayAtTime: PatternMatcher = (input) => {
  const m = input.match(
    /^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|...)\s+at\s+(.+)$/i
  );
  if (!m) return null;
  const dow = parseDayOfWeek(m[1]);
  const time = parseTime(m[2]);
  if (!dow || !time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} * * ${dow}`,
    description: `Every ${DAY_NAMES[dow]} at ${formatTime(time.hour, time.minute)}`,
    confidence: 1.0,
  };
};

const weekdaysAtTime: PatternMatcher = (input) => {
  const m = input.match(/^(?:every\s+)?weekdays?\s+at\s+(.+)$/i);
  if (!m) return null;
  const time = parseTime(m[1]);
  if (!time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} * * 1-5`,
    description: `Weekdays at ${formatTime(time.hour, time.minute)}`,
    confidence: 1.0,
  };
};
```
> The NLP parser -- twelve pattern matchers ordered by specificity, first match wins

The parser handles a rich set of expressions: "every Monday at 9am", "weekdays at 5pm", "daily at noon", "every 30 minutes", "twice a day", "first of every month at 10am", and single-word shortcuts like "hourly", "daily", "weekly". Each pattern matcher returns a confidence score (1.0 for unambiguous regex matches, 0.9 for implicit patterns like "at 9am" which assumes daily).

The NLP parser layers on top of the original interval parser, which handles shorthand formats (`5m`, `2h`, `1d`) and raw cron expressions. The resolution order is: try NLP first, then shorthand, then raw cron. A preview in the UI shows exactly how the system interpreted the input before saving, so there is never ambiguity about what "every weekday at 9am" actually means.

> [!tip]
> **The 9 AM Default**
> When someone says "run this every day," they almost never mean midnight. They mean the start of their workday. The daily default of 9:00 AM is opinionated and deliberate. This kind of thoughtful default eliminates a class of user confusion that would otherwise generate support tickets. For the 20% of users who need `0 3 * * *` (3 AM for overnight batch jobs), raw cron expressions pass through after validation.

## The Heartbeat Scheduler

Clock-driven schedules fire on a fixed cadence regardless of workspace state. They are the cron equivalent for AI agents -- useful, but blunt. The heartbeat scheduler introduces a fundamentally different model: **evaluate before acting**.

A heartbeat schedule includes a checklist of conditions. On each firing, the agent evaluates the checklist and determines whether any item needs attention. If nothing requires action, the firing is suppressed -- no task is created, no tokens are spent, no noise is added to the task board. The agent only acts when there is something worth acting on.

This is the difference between "generate a daily report" (clock-driven) and "check if anything needs my attention and act on it" (heartbeat). The first produces 365 reports a year, many of which say "nothing significant happened." The second produces reports only when something significant happened, saving tokens and human attention.

<!-- filename: src/lib/schedules/heartbeat-prompt.ts -->
```typescript
export interface HeartbeatChecklistItem {
  id: string;
  instruction: string;
  priority: "high" | "medium" | "low";
}

export function buildHeartbeatPrompt(
  checklist: HeartbeatChecklistItem[],
  scheduleName: string
): string {
  const checklistLines = checklist
    .map(
      (item, i) =>
        `${i + 1}. [${item.priority.toUpperCase()}] (id: "${item.id}") ${item.instruction}`
    )
    .join("\n");

  return `You are performing a heartbeat check for "${scheduleName}".

Evaluate each checklist item below and determine whether any action is needed.

## Checklist

${checklistLines}

## Instructions

For each item, evaluate whether the condition described needs attention RIGHT NOW.
- If the item's condition is satisfied, mark it as "action_needed"
- If everything looks normal, mark it as "ok"
- If you cannot evaluate the item, mark it as "skipped"`;
}
```
> The heartbeat prompt builder -- structured evaluation with priority-tagged checklist items

The heartbeat evaluation flow has six stages: active hours check, daily budget check, checklist parsing, evaluation task creation, result parsing, and conditional action. If the active hours window is outside the configured range (say, 9 AM to 6 PM weekdays), the firing is silently rescheduled. If the daily budget is exhausted, the firing is skipped. If the agent evaluates the checklist and finds nothing to report, the firing is marked as suppressed.

### Active Hours Windowing

Not every heartbeat should fire at 3 AM. Active hours windowing restricts firings to specific time windows, respecting timezone configuration.

<!-- filename: src/lib/schedules/active-hours.ts -->
```typescript
export function checkActiveHours(
  start: number | null,
  end: number | null,
  tz: string | null,
  now?: Date
): ActiveHoursResult {
  if (start === null || end === null) {
    return { isActive: true, nextActiveAt: null };
  }

  const timezone = tz || "UTC";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now ?? new Date()), 10);

  const isActive = start <= end
    ? currentHour >= start && currentHour < end   // e.g. 9-17
    : currentHour >= start || currentHour < end;  // e.g. 22-6 (overnight)

  if (isActive) return { isActive: true, nextActiveAt: null };
  return { isActive: false, nextActiveAt: computeNextActiveTime(start, timezone, now) };
}
```
> Active hours -- timezone-aware windowing with overnight range support

The overnight range handling (e.g., 22-6 for a team that works nights) was a late addition that caught a real edge case. The initial implementation assumed `start < end`, which meant "10 PM to 6 AM" was interpreted as an impossible window. A single conditional -- `start <= end` for daytime, `start > end` for overnight -- fixed it with no behavioral changes for normal ranges.

### Budget Caps and Suppression

Each heartbeat schedule can have a per-day cost budget. The scheduler tracks `heartbeatSpentToday` and resets it at the start of each calendar day. If a firing would exceed the budget, it is skipped. Combined with the global budget guardrails in Settings, this creates a two-tier cost control: per-schedule caps for granular control, global caps for organizational limits.

Suppression tracking is equally important. When a heartbeat evaluates its checklist and finds nothing to act on, the firing is recorded as suppressed rather than simply dropped. The schedule detail view shows the full history of firings -- including suppressed ones -- so the operator can see that the heartbeat is running correctly even when it has nothing to report. This is the difference between "nothing happened" and "I checked and nothing happened," and it matters enormously for trust.

> [!warning]
> **Fail-Open by Default**
> If the heartbeat agent's response cannot be parsed as valid JSON (model hallucination, timeout, format error), the system defaults to `action_needed: true`. This is a deliberate fail-open design. A heartbeat that silently suppresses when it should have alerted is far more dangerous than one that occasionally fires when it did not need to. False positives waste tokens. False negatives miss incidents.

## Delivery Channel Integration

Scheduled intelligence is only valuable if its outputs reach the right people. The delivery channel system connects schedules to Slack, Telegram, and webhook endpoints. When a schedule fires and produces results, a notification is sent to each configured channel with a summary and a link back to the full results.

```typescript
// Deliver to configured channels
if (schedule.deliveryChannels) {
  const channelIds = JSON.parse(schedule.deliveryChannels) as string[];
  if (channelIds.length > 0) {
    const message: ChannelMessage = {
      subject: `Schedule fired: ${schedule.name} (#${firingNumber})`,
      body: `Task "${schedule.name} -- firing #${firingNumber}" has been created...`,
      format: "text",
      metadata: { scheduleId: schedule.id, taskId, firingNumber },
    };
    sendToChannels(channelIds, message).catch(console.error);
  }
}
```
> Channel delivery -- fire-and-forget notifications to Slack, Telegram, or webhooks

The integration is intentionally fire-and-forget. A failed Slack delivery should never prevent a schedule from completing its work or computing its next fire time. Delivery failures are logged but do not propagate. This separation of concerns -- execution is primary, notification is secondary -- prevents a flaky webhook endpoint from disrupting the entire scheduling system.

For heartbeat schedules, delivery channels become particularly powerful. A heartbeat that monitors PR staleness, configured with a Slack channel, becomes a proactive team assistant: it checks every morning, and only pings the channel when there are actually stale PRs to address. No noise on quiet days, immediate visibility when action is needed.

## Autonomous Loop Execution

Simple scheduling -- fire a prompt on a timer -- is useful but limited. The real power emerges when you combine scheduling with iteration context and stop conditions. This is what we call autonomous loop execution, and it represents the bridge between "run this periodically" and "keep running this until the job is done."

Four stop conditions govern loop execution:

| Condition | Behavior | Use Case |
|-----------|----------|----------|
| **Max Iterations** | Stop after N executions | Budget control, bounded exploration |
| **Time Limit** | Stop after elapsed duration | Meeting deadlines, resource caps |
| **Goal Achieved** | Agent declares the objective met | Research convergence, report completeness |
| **Error Threshold** | Stop after N consecutive failures | Graceful degradation, circuit breaking |

The goal-achieved condition is the most interesting of the four, because it requires the agent to evaluate its own progress. At the end of each iteration, the agent receives a meta-prompt: "Have you achieved the stated objective?" If the confidence exceeds a configurable threshold, the loop terminates. We will be honest about the risks: LLMs are famously bad at calibrating their own confidence. The max-iterations and time-limit conditions exist precisely as backstops for this failure mode.

Iteration context is what makes convergence possible. Between iterations, the loop engine captures a structured summary of what the agent accomplished. This summary is prepended to the next iteration's prompt, creating a chain of reasoning that spans multiple executions. The pattern is analogous to how a human researcher keeps running notes -- each session begins by reviewing where the last session left off.

> [!tip]
> **Think in Feedback Loops, Not Triggers**
> The mental model shift from "scheduled trigger" to "feedback loop" changes how you design prompts for recurring execution. A trigger-oriented prompt says "summarize today's errors." A feedback-loop prompt says "review the error patterns you identified last time, check if they are still occurring, note any new patterns, and update your recommendations." The second prompt produces compounding value. The first produces a daily report that nobody reads after the first week.

## Progressive Autonomy in Practice

The scheduler is where progressive autonomy -- a theme that runs through every chapter of this book -- reaches its most advanced expression. Consider the trust gradient:

At the lowest level, a human creates a task and watches the agent execute it. Full visibility, full control, zero automation. This is the pattern from Chapter 2.

One level up, the human creates a clock-driven schedule and the system fires it automatically. The human has delegated the *when* while retaining control over the *what*.

One more level: a heartbeat schedule that evaluates conditions and decides whether to act. The human has delegated the *when* and the *whether*, retaining control over the *what to check*.

Higher still: the agent itself decides when the loop is done. Goal-achieved stop conditions mean the human delegated not just the timing and the filtering but the termination criteria.

The highest level we have built is a heartbeat schedule with delivery channels, budget caps, and active hours -- a fully autonomous monitoring agent that checks conditions during business hours, acts only when needed, stays within budget, and notifies the team through Slack when it finds something. The human designed the system once. The agent operates it continuously.

## Lessons Learned

**Heartbeats Changed Everything.** Clock-driven schedules produced noise. A daily "check for stale PRs" schedule created a task every single day, including the days when there were no stale PRs. Users quickly learned to ignore it. Heartbeats -- where the agent evaluates before acting -- eliminated the noise entirely. Task creation dropped by 60% in our testing while actual signal increased because users stopped ignoring schedule outputs. The lesson: proactive intelligence is only valuable if it knows when to stay quiet.

**Natural Language Parsing Has Outsized ROI.** We tracked how users create schedules during testing. Over 80% used natural language ("every weekday at 9am") rather than shorthand or raw cron. The NLP parser is about 300 lines of regex pattern matchers, and it eliminates the most common friction point in schedule creation. Not every convenience feature justifies its complexity, but this one has an exceptional ratio of user value to implementation cost.

**Budget Caps Prevent Surprise Bills.** A heartbeat schedule configured to check every 15 minutes, 24 hours a day, fires 96 times daily. If each firing costs $0.10 in API tokens, that is nearly $10 per day for a single schedule. Per-schedule budget caps and the daily reset mechanism were not premature optimization -- they were a direct response to the first user who configured an aggressive heartbeat and received an unexpected bill. The fail-open suppression design means that when the budget is exhausted, the heartbeat stops until tomorrow rather than silently missing events. Users can then increase the budget or reduce the frequency.

**Monitor the Monitor.** A scheduler that silently fails is worse than no scheduler at all, because it creates the illusion of work being done. Every firing writes a log entry. Failed firings increment an error counter. If a schedule's error count crosses a threshold, it automatically pauses and creates a notification. The meta-lesson is that any system that runs without human oversight needs its own oversight mechanism -- a monitor for the monitor.

**Pause and Resume Is Essential.** We initially built schedules with only two states: active and expired. Within a week, we needed a third: paused. Sometimes you want to stop a schedule temporarily -- during a deployment, over a holiday, while you rethink the prompt -- without losing its configuration. Pausing preserves the schedule's interval, prompt, stop conditions, and firing history. It sounds trivial, but the absence of pause-and-resume forced us to delete and recreate schedules, which meant losing firing history and iteration context.

[Try: Create a Schedule](/schedules)
