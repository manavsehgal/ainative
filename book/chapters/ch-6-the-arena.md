---
title: "The Arena"
subtitle: "Scheduled Intelligence"
chapter: 6
part: 2
readingTime: 12
lastGeneratedBy: "2026-04-18T17:10:00.000Z"
relatedDocs: ["schedules", "monitoring"]
relatedJourney: "power-user"
---

## The Arena Insight

As Garry Tan observed in his analysis of Andrej Karpathy's autoresearch project: "The critical insight is that you cannot simply ask an agent to self-improve. Instead, you must design the arena and provide direction based on your understanding of the system."

The statement sounds deceptively simple until you unpack it. An agent given an open-ended instruction like "improve the codebase" will thrash. It will make changes that look plausible but lack direction. It will optimize for the wrong metric, or no metric at all. It will burn tokens without producing value. The problem is not the agent's capability — the problem is the absence of constraints.

An arena is a designed environment with fixed rules, limited resources, and a clear success metric. A boxing ring is an arena: fixed size, timed rounds, one winner. A chess tournament is an arena: fixed rules, fixed time controls, objective scoring. The constraints do not limit the competitors — they channel competitive energy into productive directions.

For AI agents, the arena is a combination of three elements: a recurring schedule (when the agent runs), a fixed budget (how many resources it can consume), and a single metric (how we measure whether it did something useful). Remove any one of these and the agent degenerates. Without a schedule, it runs once and is forgotten. Without a budget, it runs forever and bankrupts you. Without a metric, it runs and you cannot tell if it helped.

This is the insight that separates toy demos from production agent systems. The agent is not the hard part. The arena is.

> [!case-study]
> **Karpathy's Autoresearch: 100 Experiments Overnight**
> Karpathy described a system he built called autoresearch — an arena for machine learning experimentation. The setup: a single GPU, a fixed five-minute budget per experiment, a clear metric (validation loss), and a loop that runs approximately 100 experiments overnight while the researcher sleeps. The agent proposes an experiment, runs it within the budget, records the result, and moves to the next idea. By morning, the researcher has a ranked list of 100 approaches sorted by the metric that matters. The researcher's job shifts from "run experiments" to "design the arena and evaluate results." This is not a marginal productivity improvement. It is a structural transformation of how research gets done. The arena did the exploring; the human does the judging.

The machine that builds machines does not run once. It runs on a schedule, under constraints, measured against objectives. That is what makes it a machine and not a demo.

## Heartbeats vs Arenas

Scheduled agent execution comes in two flavors, and confusing them leads to poor outcomes.

A **heartbeat** is a recurring check. It runs on a schedule, performs a predefined checklist of inspections, and reports what it finds. A nightly codebase health check is a heartbeat: run the type checker, run the test suite, check for outdated dependencies, report the results. Heartbeats are diagnostic. They tell you the state of things. They do not change the state of things.

An **arena** is a recurring improvement loop. It runs on a schedule, attempts to improve a specific metric, and measures the delta. A nightly performance optimization loop is an arena: measure current bundle size, attempt to reduce it, measure again, record the improvement (or lack thereof). Arenas are therapeutic. They change the state of things and measure whether the change was good.

The distinction matters because they require different safety profiles. A heartbeat can run with read-only permissions — it only observes. An arena needs write permissions — it modifies code, runs experiments, creates artifacts. The tool policies encoded in agent profiles enforce this distinction at the system level. A heartbeat schedule uses a profile with `autoApprove: [Read, Grep, Glob]` and `autoDeny: [Write, Bash]`. An arena schedule uses a profile with broader permissions and stricter budget constraints.

`ainative-business` supports both through the same scheduling infrastructure but encourages users to be explicit about which type they are creating. The `type` field on a schedule declaration distinguishes `heartbeat` from `arena`, and the UI surfaces different configuration options for each.

## Natural Language Scheduling

One of the smallest features that produces the largest usability improvement is natural language interval parsing. Humans do not think in cron syntax. They think in phrases: "every weekday at 9am," "twice a day," "every 30 minutes during business hours," "the first Monday of each month."

```typescript
// Building with ainative: Arena-style scheduled intelligence
const schedule = await fetch("/api/schedules", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Nightly codebase health check",
    type: "heartbeat",
    interval: "every weekday at 9pm",
    assignedAgent: "claude-code",
    agentProfile: "code-reviewer",
    heartbeatChecklist: [
      { id: "deps", instruction: "Check for outdated dependencies", priority: "high" },
      { id: "types", instruction: "Run type checker, report errors", priority: "high" },
      { id: "tests", instruction: "Run test suite, flag failures", priority: "medium" },
      { id: "perf", instruction: "Check bundle size trends", priority: "low" },
    ],
    stopConditions: { maxIterations: 1, timeoutMinutes: 30 },
  }),
}).then((r) => r.json());
```

The interval parser in `src/lib/schedules/interval-parser.ts` converts natural language time expressions into executable schedule configurations. It handles relative intervals ("every 30 minutes"), absolute times ("at 9pm"), day filters ("weekdays," "Monday and Thursday"), and compound expressions ("every 2 hours on weekdays between 9am and 5pm").

This is not a language model call. It is a deterministic parser with pattern matching. We made this choice deliberately. Schedule parsing needs to be fast, free, and deterministic. If the parser produces a different interpretation each time you submit the same string, users will not trust it. The parser handles common patterns reliably and rejects ambiguous input with clear error messages rather than guessing.

The scheduler engine in `src/lib/schedules/scheduler.ts` reads schedule configurations from the database, maintains a timer for each active schedule, and dispatches executions when timers fire. It starts automatically via Next.js's instrumentation hook in `src/instrumentation.ts`, which means schedules activate when the application starts and persist across page navigations.

## Stop Conditions

An arena without stop conditions is a runaway process. `ainative-business` supports four types of stop conditions, and every schedule must declare at least one:

**Max Iterations**: The simplest stop condition. The agent runs N times and stops. A heartbeat that checks codebase health once per night sets `maxIterations: 1`. An arena that tries ten optimization approaches sets `maxIterations: 10`.

**Budget Cap**: A cost ceiling in dollars or tokens. When the cumulative cost of all iterations reaches the cap, the schedule pauses. This is the primary defense against runaway API costs. Karpathy's autoresearch used a time-based variant: five minutes per experiment, fixed.

**Success Criteria**: A condition that, when met, terminates the loop early. "Stop when all tests pass." "Stop when bundle size is under 200KB." "Stop when the linter reports zero warnings." Success criteria turn open-ended loops into goal-directed ones. The agent does not run forever — it runs until it achieves the objective or exhausts its budget.

**Timeout**: A wall-clock limit on total execution time. Even if the agent has budget remaining and has not met its success criteria, the timeout forces termination. This catches pathological cases where an agent is stuck in a loop that consumes little budget but produces no progress.

These conditions compose. A typical arena might set `maxIterations: 20`, `budgetCap: "$5.00"`, `successCriteria: "all tests pass"`, and `timeoutMinutes: 120`. The arena terminates when any condition triggers — whichever comes first. This defense-in-depth approach means no single misconfiguration can produce a runaway agent.

One dimension these budgets do not capture is their trajectory. The economics of experimentation are improving on a predictable curve. Compute infrastructure investment — now measured in hundreds of billions of dollars globally — is expanding capacity while algorithmic efficiency gains continue to compound at roughly half an order of magnitude per year. Karpathy's hundred-experiment overnight run becomes more powerful with each model generation: the same five-minute budget per experiment buys a more capable agent, and the same dollar budget buys more experiments. When designing arena budgets today, it is worth accounting for this trajectory. A budget cap of $5.00 that funds twenty iterations now may fund thirty in twelve months — or produce significantly better results per iteration. The arena pattern is not just a technique for today's models. It is an architectural bet that appreciates as the cost of intelligence continues to fall.

> [!case-study]
> **Gas Town's Deacon: The Patrol Loop**
> In Gas Town, the Deacon runs patrol loops. His function is not creative or strategic — it is vigilant. He checks the perimeter, reports anomalies, and enforces the GUPP (Gas Town Unified Patrol Protocol): "If there is work on your hook, YOU MUST RUN IT." The Deacon is a heartbeat made flesh. He does not decide what to patrol or when to patrol. The schedule decides. He does not decide what constitutes an anomaly. The checklist decides. He does not decide when to stop. The shift rotation decides. Every degree of freedom has been removed except the one that matters: the quality of observation during each patrol. This is exactly how a well-designed heartbeat schedule works. The agent's only job is to execute the checklist well. Everything else — timing, scope, duration — is determined by the arena.

## The Autonomous Loop

The arena pattern extends naturally into longer-running autonomous loops. While a heartbeat runs once and reports, and an arena runs a fixed number of iterations, an autonomous loop runs continuously until an external condition changes.

`ainative-business`'s loop executor supports this through the `autonomous-loop-execution` feature. A loop has an executor that manages iteration context — passing the output of each iteration as input to the next — and supports pause/resume so humans can intervene without losing progress.

The iteration context is critical. Without it, each iteration starts from scratch, repeating work the previous iteration already did. With it, the agent builds on its own previous results. An optimization arena that reduced bundle size by 3KB in iteration one starts iteration two with that knowledge, looking for the next 3KB reduction rather than rediscovering the first one.

The pause/resume mechanism is equally important. Autonomous loops run for hours. During that time, a human might want to inspect intermediate results, adjust the prompt, change the stop conditions, or simply halt the loop because priorities shifted. The `LoopStatusView` component surfaces the current iteration, cumulative cost, elapsed time, and a pause button. The loop executor checks for pause signals between iterations — not mid-iteration — ensuring that each iteration completes cleanly.

> [!case-study]
> **Geoffrey Huntley's Ralph Wiggum Revisited: Scheduled Persistence**
> Geoffrey Huntley's Ralph Wiggum loop (see Chapter 5) was not a one-off execution. It was persistent — running overnight, across many iterations, accumulating changes that compounded. Huntley's key principles included "One Thing Per Loop" (strict single-task focus per iteration) and a "backpressure" phase where type systems, test suites, and static analyzers validate each iteration's output before the next begins. The insight is not the cost savings — it is the patience. A human developer would have stopped after two hours. The loop ran for twelve. Scheduled persistence — keeping an agent running on a problem longer than a human would — turns out to be one of the most powerful capabilities an AI-native system can offer. Not because the agent is smarter, but because it is more patient.

## The Competitive Dimension

The arena metaphor is not just about constraints and schedules. It is about competition. When you run one agent on a problem, you get one approach. When you run five agents on the same problem with different strategies, you get five approaches — and you can pick the best one.

This is the logic behind competitive evaluation. SWE-bench, the software engineering benchmark, ranks agent systems against each other on identical problem sets. Claude Opus 4.6 currently holds the top position. DR-Arena takes this further: zero human intervention, automated evaluation, ranked results. The ICLR 2026 workshop on Recursive Self-Improvement explored the theoretical foundations of agents that improve through competitive dynamics.

In `ainative-business`, the competitive dimension is not yet fully realized, but the infrastructure supports it. A schedule can dispatch the same task to multiple profiles, collect results, and a human (or a judge agent) selects the best output. This is ensemble execution: not trusting any single agent's output, but sampling from multiple agents and selecting from the distribution.

The competitive pattern is particularly powerful for creative and architectural work — domains where there is no single right answer and the best approach depends on taste, context, and trade-offs that a single agent cannot fully explore. Having three agents propose three different architectures and a human architect choose the best one is faster and produces better outcomes than having one agent iterate three times.

## ainative Today

The scheduling infrastructure is complete and running in production:

**Scheduler Engine**: The engine in `src/lib/schedules/scheduler.ts` manages schedule timers, dispatches executions, and handles lifecycle transitions (active, paused, completed, failed). It starts via the Next.js `register()` hook in `src/instrumentation.ts` and survives page navigations.

**NLP Interval Parsing**: The parser in `src/lib/schedules/interval-parser.ts` converts natural language time expressions into schedule configurations. Supports relative intervals, absolute times, day filters, and compound expressions.

**Schedules Table**: The database stores schedule configurations including interval, type (heartbeat/arena), assigned agent, profile, checklist items, and stop conditions. The table schema in `src/lib/db/schema.ts` provides full typing via Drizzle ORM.

**Schedule UI**: Four components in `src/components/schedules/` provide the management interface — list view, creation dialog, detail view, and status indicators. The `/schedules` route is accessible from the sidebar under the "Manage" group.

**Loop Executor**: The autonomous loop executor supports multi-iteration execution with iteration context passing, four stop condition types, and pause/resume capability. The `LoopStatusView` component provides real-time monitoring.

**Heartbeat Checklists**: Heartbeat-type schedules accept structured checklists with prioritized inspection items. The agent receives the checklist as structured instructions and reports against each item.

**Upgrade Detection**: A concrete arena-style pattern is now running in production: the upgrade detector. An hourly poller checks upstream for new commits and surfaces available updates. A three-strike dedup mechanism prevents repeated failure notifications from flooding the inbox. When an upgrade is available, the `upgrade-assistant` profile drives a guided merge session — and critically, it can ask the user free-form questions or present structured three-choice option cards via `AskUserQuestion`. This is the arena pattern in miniature: a scheduled loop with a clear metric (is there an upstream update?), a fixed budget (one check per hour), and a human escalation path that goes beyond binary Allow/Deny to structured, contextual dialogue.

## Roadmap Vision

The arena today supports scheduled execution with basic stop conditions. The roadmap extends it toward true competitive evaluation and overnight experimentation:

**Competitive Evaluation with Ranked Metrics**: Multiple agents tackle the same problem, and results are automatically scored against defined metrics. A leaderboard surfaces which profile-runtime combination produces the best results for each task category. Over time, the system learns routing preferences: this type of task gets the best results from this profile on this runtime.

**Overnight Experimentation**: Following Karpathy's autoresearch model — define a hypothesis space, a fixed per-experiment budget, and an evaluation metric. The system runs experiments overnight, ranks results by morning. Applied to software: "try ten different approaches to reducing this function's latency, spending at most $0.50 per approach, report the fastest."

**Adaptive Scheduling**: Schedules that adjust their own frequency based on results. If a nightly health check finds issues three nights in a row, it escalates to running every four hours until the codebase stabilizes. If an arena finds no improvement for five consecutive iterations, it widens its search strategy or pauses and requests human guidance.

**Cross-Schedule Dependencies**: Schedules that trigger other schedules. A nightly test run that discovers failures triggers a fix-and-verify arena. A weekly dependency audit that finds critical updates triggers an upgrade-and-test workflow. This creates reactive agent systems that respond to their own observations.

The arena is where agents earn their keep. Not through single impressive demonstrations, but through consistent, constrained, measured work that compounds over time. The agent that checks your codebase every night for a year catches a thousand issues that a human would have missed — not because the human is less capable, but because the human sleeps, and the arena does not.
