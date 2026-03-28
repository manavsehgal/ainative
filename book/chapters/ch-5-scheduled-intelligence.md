---
title: "Scheduled Intelligence"
subtitle: "Time-Based Automation and Recurring Intelligence Loops"
chapter: 5
part: 2
readingTime: 11
relatedDocs: [schedules, monitoring]
lastGeneratedBy: "2026-03-27"
---

## The Problem

Not all intelligence is triggered by human action. Some of the most valuable automation runs on a schedule — daily reports, weekly reviews, continuous monitoring. These are the heartbeat of an AI-native organization. While the previous chapters explored how agents execute tasks on demand and how humans gate dangerous operations, this chapter addresses a different question entirely: what happens when the human is not there at all?

Traditional software answered this question decades ago with cron. A crontab entry, a shell script, a log file — the pattern is so old that it feels beneath discussion. But cron executes commands. It does not execute *intelligence*. The difference matters. A cron job runs the same script every time, producing output that varies only with the data it encounters. A scheduled intelligence loop runs a prompt through an agent that reasons, adapts, and makes decisions based on context that evolves between executions. The output of iteration three informs the behavior of iteration four. That is not batch processing. That is a feedback loop.

The industry is converging on this insight from several directions. GitHub Actions supports `schedule` triggers with cron syntax, but the workflows themselves are static YAML pipelines — they do not learn between runs. Temporal and its spiritual predecessor Cadence brought durable execution to scheduled workflows, with retry policies, timeouts, and workflow versioning. These are powerful systems, but they orchestrate deterministic code paths. The AI-native equivalent orchestrates reasoning — and reasoning is neither deterministic nor idempotent.

Stagent's scheduler engine turns prompts into recurring intelligence loops, executing at defined intervals with configurable stop conditions. It is, at its core, a bridge between the predictability that operators demand and the adaptability that makes AI valuable. The architecture is deliberately simple — a poll-based tick loop backed by SQLite — because the complexity belongs in the agent, not in the scheduler.

## The Scheduler Engine

Every scheduler needs an answer to the bootstrapping question: how does it start? In Stagent, the answer is Next.js instrumentation. The `register()` hook in `instrumentation.ts` fires once when the server process starts, and it is the only place where long-lived background work can safely begin in a Next.js application.

<!-- filename: src/instrumentation.ts -->
```typescript
export async function register() {
  // Only start the scheduler on the server (not during build or edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/schedules/scheduler");
    startScheduler();
  }
}
```
*The instrumentation hook — three lines that turn a web server into a scheduler*

That dynamic import is not accidental. Next.js evaluates `instrumentation.ts` in multiple runtimes — Node.js, Edge, and during the build step. The `NEXT_RUNTIME` guard ensures the scheduler only starts in the Node.js server process, where it has access to SQLite and the filesystem. Without this check, you would get cryptic build failures as the scheduler tries to open a database connection during static page generation.

The engine itself is a poll-based loop that ticks every 60 seconds. On each tick, it queries the database for schedules whose `nextFireAt` timestamp has passed, claims each one atomically to prevent double-firing, creates a child task, and hands it off to the execution pipeline.

<!-- filename: src/lib/schedules/scheduler.ts -->
```typescript
export function startScheduler(): void {
  if (intervalHandle !== null) return;

  // Bootstrap: recompute nextFireAt for any active schedules that are missing it
  bootstrapNextFireTimes();

  intervalHandle = setInterval(() => {
    tickScheduler().catch((err) => {
      console.error("[scheduler] tick error:", err);
    });
  }, POLL_INTERVAL_MS);
}

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

    if (claimResult.changes === 0) continue; // Another tick already claimed it

    await fireSchedule(schedule, now);
  }
}
```
*The scheduler tick loop — simple polling with atomic claim to prevent double-firing*

I want to dwell on the atomic claim pattern, because it solves a subtle problem. In a world where tick intervals are perfectly regular and each tick completes before the next one starts, you would never fire the same schedule twice. But the real world is not like that. A tick might take longer than 60 seconds if the database is under load or if a previous task creation involves heavy I/O. The claim pattern — setting `nextFireAt` to null and checking that the update affected exactly one row — ensures that even overlapping ticks cannot double-fire a schedule. It is the same optimistic locking pattern that job queues like Sidekiq and BullMQ use, adapted for SQLite's synchronous write model.

The bootstrap step at startup deserves attention too. If the server crashes mid-tick, some schedules may have their `nextFireAt` set to null (claimed but never completed). On restart, `bootstrapNextFireTimes()` scans for these orphaned schedules and recomputes their next fire time. This self-healing behavior means the scheduler recovers gracefully from unclean shutdowns without manual intervention — a property that matters far more in production than any amount of clever scheduling logic.

> [!info]
> **Why Not Cron?**
> An in-process scheduler has one critical advantage over OS-level cron: it shares the application's database. Cron jobs need external coordination to track state — which jobs ran, which failed, what their output was. The Stagent scheduler writes directly to the same SQLite database that the UI reads from, so schedule status, firing history, and task results are all visible in the same interface without any synchronization layer. The tradeoff is that the scheduler dies with the server process, but for a single-node application that is actually a feature — there is no orphaned cron job running against a stopped server.

## The Interval Parser

One of the smaller decisions that paid outsized dividends was building a natural language interval parser. Users should not need to know cron syntax to schedule a daily report. The parser accepts human-friendly shorthand — `5m`, `2h`, `1d` — and converts it to standard five-field cron expressions that the scheduler engine consumes.

<!-- filename: src/lib/schedules/interval-parser.ts -->
```typescript
const INTERVAL_RE = /^(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|day|days)$/i;

export function parseInterval(input: string): string {
  const match = input.trim().match(INTERVAL_RE);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase().charAt(0);

    switch (unit) {
      case "m": return value === 1 ? "* * * * *" : `*/${value} * * * *`;
      case "h": return value === 1 ? "0 * * * *" : `0 */${value} * * *`;
      case "d": return value === 1 ? "0 9 * * *" : `0 9 */${value} * *`;
    }
  }

  // Fall through to raw cron expression validation
  CronExpressionParser.parse(input);
  return input;
}
```
*The interval parser — six presets plus raw cron as an escape hatch*

The daily default of 9:00 AM is opinionated and deliberate. When someone says "run this every day," they almost never mean midnight. They mean the start of their workday. This kind of thoughtful default eliminates a class of user confusion that would otherwise generate support tickets.

For power users who need `0 9 * * 1-5` (weekdays only at 9 AM) or `0 */4 * * *` (every four hours), raw cron expressions pass through after validation. The parser is a convenience layer, not a constraint — it expands the accessibility of scheduling without limiting its expressiveness.

## Autonomous Loop Execution

Simple scheduling — fire a prompt on a timer — is useful but limited. The real power emerges when you combine scheduling with iteration context and stop conditions. This is what I call autonomous loop execution, and it represents the bridge between "run this periodically" and "keep running this until the job is done."

Consider a concrete example. You want an agent to monitor your application's error logs, identify recurring patterns, and draft a summary with recommended fixes. A simple schedule fires the prompt every hour, and each execution starts from scratch — the agent has no memory of what it found in previous runs. An autonomous loop, by contrast, carries context between iterations. The agent knows what patterns it has already identified, which fixes it has already recommended, and what changed since the last run. Each iteration builds on the previous one, and the loop terminates when a stop condition is met.

Four stop conditions govern loop execution:

| Condition | Behavior | Use Case |
|-----------|----------|----------|
| **Max Iterations** | Stop after N executions | Budget control, bounded exploration |
| **Time Limit** | Stop after elapsed duration | Meeting deadlines, resource caps |
| **Goal Achieved** | Agent declares the objective met | Research convergence, report completeness |
| **Error Threshold** | Stop after N consecutive failures | Graceful degradation, circuit breaking |

The goal-achieved condition is the most interesting of the four, because it requires the agent to evaluate its own progress. At the end of each iteration, the agent receives a meta-prompt: "Have you achieved the stated objective? Respond with a confidence score and reasoning." If the confidence exceeds a configurable threshold, the loop terminates. This is genuine self-assessment — the agent deciding that further iterations would not meaningfully improve the result.

I will be honest about the risks here. LLMs are famously bad at calibrating their own confidence. An agent might declare a research task complete when it has only scratched the surface, or it might never reach the confidence threshold and burn through all its iterations on diminishing returns. The max-iterations and time-limit conditions exist precisely as backstops for this failure mode. In practice, I use goal-achieved as the primary stop condition and max-iterations as a hard ceiling, treating it the same way a circuit breaker treats a timeout — the happy path never hits it, but it is there for the unhappy path.

> [!tip]
> **Convergence Is the Goal**
> The best autonomous loops converge. Each iteration should produce measurably better output than the last, with diminishing marginal improvement. If your loop is not converging — if iteration 10 is no better than iteration 5 — the problem is in the prompt design, not the loop engine. Goal-achieved is the most powerful stop condition precisely because it encodes convergence: the agent stops when improvement is no longer meaningful.

Iteration context is what makes convergence possible. Between iterations, the loop engine captures a structured summary of what the agent accomplished, what it found, and what questions remain. This summary is prepended to the next iteration's prompt as context, creating a chain of reasoning that spans multiple executions. The pattern is analogous to how a human researcher keeps running notes — each session begins by reviewing where the last session left off.

This is where scheduled intelligence diverges most sharply from traditional batch processing. A batch job executes the same logic against new data. An autonomous loop executes evolving logic against an evolving understanding of the problem. The schedule provides the rhythm; the iteration context provides the memory; the stop conditions provide the discipline. Together, they produce something that feels less like a cron job and more like a colleague who works the night shift.

## Progressive Autonomy in Practice

The scheduler is also where progressive autonomy — a theme that runs through every chapter of this book — reaches its most advanced expression. Consider the trust gradient:

At the lowest level, a human creates a task and watches the agent execute it. Full visibility, full control, zero automation. This is the pattern from Chapter 2.

One level up, the human creates a schedule and the system fires it automatically. The human has delegated the *when* while retaining control over the *what*. They wrote the prompt, chose the interval, and set the stop conditions. The scheduler just keeps the clock.

One more level, and the agent itself decides when the loop is done. Goal-achieved stop conditions mean the human delegated not just the timing but the termination criteria. The agent runs, evaluates, and stops — all without human intervention.

The highest level is a schedule that fires an agent which creates new schedules. I have not built this yet, and I am not sure I should. But the architecture supports it, because schedules and tasks share the same database, and any agent with task-creation tools could theoretically insert a schedule row. The reason I have not enabled it is not technical — it is philosophical. Self-replicating scheduled agents are the "paperclip maximizer" of productivity software. The autonomy needs a ceiling, and I think human-authored schedules are the right one.

## Seeing It In Action

![Book reader showing a workflow executing in real-time with progress indicators](/book/images/book-reader-workflow-running.png "Here is a scheduled workflow running inside the book reader. The progress indicators show each firing as it happens, with iteration context flowing between executions. Notice how the firing count and next-run timestamp update in real time.")

## Lessons Learned

**Pause and Resume Is Essential.** I initially built schedules with only two states: active and expired. Within a week of using the system, I needed a third: paused. Sometimes you want to stop a schedule temporarily — during a deployment, over a holiday, while you rethink the prompt — without losing its configuration. Pausing preserves the schedule's interval, prompt, stop conditions, and firing history. Resuming recomputes the next fire time from the current moment. It sounds trivial, but the absence of pause-and-resume forced me to delete and recreate schedules, which meant losing firing history and iteration context. State machines matter even for simple entities.

**Editing Completes the Lifecycle.** Schedules can now be fully edited after creation through a dedicated edit dialog. Operators can modify the schedule name, prompt text, interval, runtime provider, and agent profile without recreating the schedule. The edit form shares the same validation and field layout as the creation form, maintaining consistency. Combined with pause/resume lifecycle controls and firing history tracking, this makes schedules a first-class managed resource rather than fire-and-forget automations. The progression from create-only to full CRUD may seem obvious in retrospect, but it reflects a broader lesson: any entity that lives long enough to accumulate history must eventually become editable, or users will destroy history to make corrections.

**The Interval Parser Saves Time.** I tracked how users create schedules during testing. Over 80% used the shorthand format — `30m`, `2h`, `1d` — rather than raw cron expressions. The parser is maybe 60 lines of code, and it eliminates the most common friction point in schedule creation. Not every convenience feature justifies its complexity, but this one has an exceptional ratio of user value to implementation cost.

**Monitor the Monitor.** A scheduler that silently fails is worse than no scheduler at all, because it creates the illusion of work being done. Every firing writes a log entry. Failed firings increment an error counter. If a schedule's error count crosses a threshold, it automatically pauses and creates a notification. The meta-lesson is that any system that runs without human oversight needs its own oversight mechanism — a monitor for the monitor. This is why the firing history is surfaced prominently in the schedule detail view, not buried in server logs.

**Concurrency Guards Prevent Runaway Execution.** The scheduler checks whether a previous firing is still running before creating a new task. Without this guard, a slow-running prompt on a fast interval could spawn dozens of concurrent executions, each consuming API credits and potentially conflicting with each other. The implementation is simple — a query for running tasks whose title matches the schedule's naming pattern — but its absence would be expensive.

**Think in Feedback Loops, Not Triggers.** The mental model shift from "scheduled trigger" to "feedback loop" changed how I design prompts for recurring execution. A trigger-oriented prompt says "summarize today's errors." A feedback-loop prompt says "review the error patterns you identified last time, check if they are still occurring, note any new patterns, and update your recommendations." The second prompt produces compounding value. The first produces a daily report that nobody reads after the first week.

[Try: Create a Schedule](/schedules)
