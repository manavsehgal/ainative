---
title: "Project Management"
subtitle: "From Manual Planning to Autonomous Sprint Planning"
chapter: 1
part: 1
readingTime: 12
lastGeneratedBy: "2026-03-31T21:00:00Z"
---

## The Problem

Every software team knows the ritual. Monday morning, the sprint planning meeting begins. A product manager reads from a backlog. Engineers estimate in story points — a unit of measurement that means something different to every person in the room. Dependencies are sketched on whiteboards or dragged around in Jira. Two hours later, the team emerges with a plan that will be obsolete by Wednesday.

This is the planning bottleneck, and it is one of the most expensive inefficiencies in modern software development. Not because the meetings are long (though they are), and not because the estimates are wrong (though they usually are), but because the entire process assumes that humans must be the ones doing the planning. We treat project management as an inherently human activity — something that requires judgment, intuition, and the kind of contextual reasoning that only a person can provide.

But what if that assumption is wrong?

When we started building Stagent — the AI Business Operating System — we did not set out to replace project managers. We set out to answer a simpler question: what would project management look like if an AI agent were a first-class participant in the process from day one? Not bolted on after the fact — not a chatbot sidebar in an existing tool — but woven into the foundation of how projects are structured, planned, and executed.

The answer surprised us. It was not about making AI do what humans already do. It was about rethinking what needed to be done in the first place.

> [!lesson]
> **The Meta Insight**
> Stagent is building itself using itself. The project management features described in this chapter were planned, tracked, and executed within Stagent's own project management system. When you read about agent profiles and task schemas, know that those same structures were used to build the features you are reading about. This recursive quality — a tool shaping its own creation — turns out to be one of the most powerful validation mechanisms we have found.

![Stagent generating book reader components via code-generation workflow](/book/images/code-generation-book-components.png "The screenshot above captures a moment from our own development process — Stagent generating the book reader components you are using right now to read this chapter. The agent created React components, set up the routing, and structured the reading experience, all tracked as tasks within the system described in this chapter.")

## The AI-Native Approach

The traditional approach to adding AI to project management follows a predictable pattern. Take an existing tool — Jira, Linear, Asana, Monday.com — and bolt a language model onto it. The AI becomes a feature: it can summarize tickets, suggest labels, maybe auto-assign issues based on past patterns. These are genuine improvements, but they are incremental ones. They make the existing workflow slightly faster without questioning whether the workflow itself should change.

The AI-native approach starts from a different premise. Instead of asking "how can AI help with our current process?", we ask "what process would we design if AI were a founding team member?"

The answer reshapes everything. In a traditional tool, the human creates tasks, assigns them, monitors progress, and makes decisions at every step. The tool is a passive ledger — it records what humans decide. In an AI-native system, the relationship inverts. The human defines objectives and constraints. The AI agent decomposes those objectives into tasks, reasons about dependencies, identifies risks, and executes work. The human reviews, redirects, and refines.

This is the shift from executor to architect. In the old model, a project manager spends most of their time doing operational work: writing tickets, updating statuses, chasing people for updates, running standups. In the AI-native model, that operational layer is handled by agents. The human's job becomes designing the system — defining what good looks like, setting boundaries, establishing the rules by which agents operate.

Consider how a typical feature request flows through each model. In the traditional approach, a PM writes a ticket, breaks it into subtasks, estimates each one, assigns engineers, schedules the work, and tracks it daily. In Stagent, the PM describes the feature objective and its constraints. An agent profile — a structured configuration that defines an agent's personality, capabilities, and guardrails — takes over. The agent analyzes the codebase, proposes a task breakdown, identifies dependencies on existing code, flags risks, and begins execution. The human approves the plan, adjusts priorities, and intervenes only when judgment calls arise.

This is not a theoretical distinction. The agent profile is a concrete artifact — a pair of files that turns an abstract AI model into a specialized team member with defined responsibilities. In Stagent, every profile lives as a directory under `~/.claude/skills/` containing a `profile.yaml` for configuration and a `SKILL.md` for behavioral instructions. The system ships with 20 built-in profiles spanning technical roles (code-reviewer, devops-engineer, data-analyst) and business functions (marketing-strategist, financial-analyst, sales-researcher, customer-support-agent, content-creator, operations-coordinator).

<!-- filename: src/lib/agents/profiles/builtins/project-manager/profile.yaml -->
```yaml
id: project-manager
name: Project Manager
version: "1.0.0"
domain: work
tags: [planning, estimation, dependencies, project, management, decomposition]
supportedRuntimes: [claude-code, openai-codex-app-server]

allowedTools:
  - Read
  - Grep
  - Glob

canUseToolPolicy:
  autoApprove: [Read, Grep, Glob]
  autoDeny: []

maxTurns: 25

tests:
  - task: "Break down a user authentication feature into implementable tasks"
    expectedKeywords: [task, dependency, acceptance criteria, estimate]
  - task: "Create a sprint plan for the next two weeks"
    expectedKeywords: [sprint, priority, capacity, milestone]
```
*The Project Manager profile — notice how `allowedTools` and `canUseToolPolicy` encode trust boundaries, while `tests` define verifiable behavioral expectations*

Notice what this configuration encodes. It is not just a name and a prompt. It defines `allowedTools` — the specific tools the agent can invoke (read-only filesystem access, no writes). It defines `canUseToolPolicy` — which tools auto-approve without human confirmation and which are auto-denied. The `supportedRuntimes` field declares that this profile works across both Claude Code and OpenAI Codex runtimes — and indeed across all five of Stagent's runtime providers (Claude Code SDK, Codex App Server, Anthropic Direct, OpenAI Direct, and Ollama). The `tests` array provides smoke tests: give the agent a task, check that its output contains expected keywords. This is how we verify that a profile actually produces the behavior we designed for.

This is the principle of progressive autonomy at work: not all-or-nothing automation, but a graduated spectrum of trust encoded in declarative configuration.

## Implementation

Building an AI-native project management system required us to rethink three foundational pillars: how we structure data, how we define agent behavior, and how we keep humans in control.

### Pillar 1: Structured Data as Agent Affordance

The first pillar — and the one that surprised us most with its importance — is the database schema. In a traditional application, your schema serves the UI. Tables are designed around what users need to see and edit. In an AI-native application, the schema serves double duty: it must work for both human users and AI agents.

This turns out to be a powerful design constraint. AI agents work best when data is explicit, queryable, and self-describing. A status field with an enum of `planned`, `queued`, `running`, `completed`, `failed`, `cancelled` gives an agent clear semantics to reason about. A free-text "status" field where humans type "kinda done, waiting on Dave" gives the agent nothing useful.

We call this the affordance of structure. Just as a well-designed physical tool affords certain uses through its shape, a well-designed schema affords intelligent behavior from AI agents through its structure.

<!-- filename: src/lib/db/schema.ts -->
```typescript
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  workingDirectory: text("working_directory"),
  status: text("status", { enum: ["active", "paused", "completed"] })
    .default("active")
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    workflowId: text("workflow_id").references(() => workflows.id),
    scheduleId: text("schedule_id").references(() => schedules.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["planned", "queued", "running", "completed", "failed", "cancelled"],
    })
      .default("planned")
      .notNull(),
    assignedAgent: text("assigned_agent"),
    agentProfile: text("agent_profile"),
    priority: integer("priority").default(2).notNull(),
    result: text("result"),
    sessionId: text("session_id"),
    resumeCount: integer("resume_count").default(0).notNull(),
    /** How this task was created: manual, scheduled, heartbeat, or workflow */
    sourceType: text("source_type", {
      enum: ["manual", "scheduled", "heartbeat", "workflow"],
    }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_tasks_status").on(table.status),
    index("idx_tasks_project_id").on(table.projectId),
    index("idx_tasks_agent_profile").on(table.agentProfile),
  ]
);
```
*The Drizzle ORM schema that makes AI-native project management possible — every field is typed, every enum is explicit, every relationship is a foreign key*

Look at the `workingDirectory` field on the projects table. In a traditional PM tool, there is no concept of a working directory — projects exist in an abstract namespace. But an AI agent that needs to analyze code, run tests, or generate files needs to know where to look. This field bridges the gap between the abstract world of project management and the concrete world of a filesystem where work actually happens.

The `agentProfile` field on the tasks table is equally revealing. In Jira, you assign a task to a person. In Stagent, you assign a task to an agent profile — a behavioral configuration that determines how the AI approaches the work. A task assigned to the `code-reviewer` profile will be handled differently than one assigned to the `financial-analyst` profile, even though the same underlying AI model may power both. The profile is the personality; the model is the engine.

The `sourceType` field tracks provenance — whether a task was created manually, spawned by a schedule, generated by a heartbeat evaluation, or produced as a step in a workflow. This distinction matters for the dashboard: heartbeat-generated tasks display a heartbeat badge on their Kanban card, making it easy to audit what your scheduled agents produced overnight versus what you created yourself.

Notice also the foreign keys linking tasks to `workflows` and `schedules`. A task does not exist in isolation — it can be part of an automated workflow chain or spawned by a recurring schedule with natural language timing like "every weekday at 9am." These relationships let agents reason about context: "this task was triggered by a weekly code-quality heartbeat, so I should focus on regression patterns rather than new features." The schema encodes organizational knowledge that would otherwise live only in a human's head.

> [!tip]
> **The Affordance of Structure**
> AI agents work best when database schemas are explicit, enumerated, and queryable. Every field you add to your schema is an affordance — a handle that agents can grasp. Free-text fields are slippery; enum fields are grippy. Timestamps enable temporal reasoning. Foreign keys encode relationships that agents can traverse. Design your schema as if your most important user cannot read between the lines — because it cannot.

### Pillar 2: The Home Workspace as Operations Center

The second pillar is the human oversight surface. The home workspace at `/` is not a status page — it is a control surface for an AI Business Operating System. Five stat cards at the top give an instant pulse: tasks running, completed today, awaiting review, active projects, and active workflows. A "Needs Attention" section surfaces items that require human judgment — permission requests from agents, failed tasks, stalled workflows, and agent handoff approvals waiting in the inbox.

The sidebar organizes the entire workspace into four groups that reflect how we think about AI-augmented operations:

- **Work** — Dashboard, Inbox, Chat, Projects, Workflows, Documents
- **Manage** — Monitor, Profiles, Schedules, Cost & Usage
- **Learn** — AI Native Book, User Guide
- **Configure** — Environment, Settings

A trust tier badge in the sidebar footer displays the current permission level (Read Only, Git Safe, Full Auto), making the autonomy boundary visible at all times. The workspace indicator shows which project context agents are operating within.

The Kanban board at `/dashboard` makes execution visible. Tasks flow through five columns — Planned, Queued, Running, Completed, Failed — with drag-and-drop to override agent decisions when human judgment calls for it. Filter bars slice by project, status, or priority. Bulk select mode lets you queue, move, or delete multiple tasks at once — essential when heartbeat schedules generate many tasks overnight. The AI Assist button on the task creation form enhances a rough title and description with structured context, acceptance criteria, and suggested parameters — turning a one-line idea into an agent-ready specification.

Stagent ships with five sample projects to demonstrate the breadth of the system: Investment Portfolio Tracker, SaaS Landing Page, Lead Generation Pipeline, Business Trip Planner, and Tax Filing Assistant. These span personal and professional domains, showing how the same AI-native project management primitives apply whether you are tracking code deployments or planning a vacation.

> [!info]
> **The Dashboard as Control Surface**
> Stagent's home workspace at `/` is designed as an operations center, not a status page. Stat cards give pulse metrics. The "Needs Attention" section acts as a human-in-the-loop queue — every item there represents a moment where the system needs human judgment. The sidebar hierarchy reflects the progressive autonomy model — most of your time should be spent in Work, occasionally in Manage, rarely in Configure.

### Pillar 3: Heartbeat Schedules and Proactive Work

The third pillar is one of the most distinctive features of Stagent's project management: the heartbeat scheduler. Traditional schedules are clock-driven — they fire at a fixed interval regardless of whether anything has changed. Heartbeat schedules are intelligence-driven — they evaluate a checklist of conditions and only produce work when the conditions warrant it.

<!-- filename: src/lib/db/schema.ts (schedules table) -->
```typescript
export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  cronExpression: text("cron_expression").notNull(),
  agentProfile: text("agent_profile"),
  /** 'scheduled' (default, clock-driven) or 'heartbeat' (intelligence-driven) */
  type: text("type", { enum: ["scheduled", "heartbeat"] })
    .default("scheduled")
    .notNull(),
  /** JSON array of checklist items the agent evaluates (heartbeat only) */
  heartbeatChecklist: text("heartbeat_checklist"),
  /** Hour of day (0-23) when heartbeats are active */
  activeHoursStart: integer("active_hours_start"),
  activeHoursEnd: integer("active_hours_end"),
  activeTimezone: text("active_timezone").default("UTC"),
  suppressionCount: integer("suppression_count").default(0).notNull(),
  /** JSON array of channel config IDs for delivery after firing */
  deliveryChannels: text("delivery_channels"),
  // ... timestamps, budget fields
});
```
*The heartbeat scheduler schema — active hours, suppression counts, and delivery channels turn a dumb cron into an intelligent, context-aware scheduling system*

A heartbeat schedule might say: "Every weekday at 9am, check whether (1) any tasks have been stuck in running state for more than 2 hours, (2) any scheduled workflows failed overnight, and (3) the deployment pipeline has pending approvals. If any condition is true, create a summary task and deliver it to Slack." The agent evaluates the checklist, decides whether action is warranted, and only creates work when something actually needs attention.

Active hours windowing prevents 3am wake-up notifications. Suppression counts track how many consecutive heartbeat runs produced no action — useful for tuning frequency. Daily budget caps prevent runaway evaluations. And delivery channels route results to Slack, Telegram, or webhook endpoints, with bidirectional chat support so you can respond to heartbeat findings directly from your messaging app.

The scheduler engine itself is a poll-based system that runs on a 60-second interval, checking for schedules whose `nextFireAt` has passed:

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

  console.log("[scheduler] started — polling every 60s");
}
```
*The scheduler engine — poll-based simplicity with bootstrap self-healing*

Natural language scheduling parses expressions like "every weekday at 9am" or "twice daily" into cron expressions, making schedule creation conversational rather than technical. This connects back to the AI-native premise: the system should meet users where they think, not where the implementation is convenient.

## The Difference in Practice

To make this concrete, consider a real scenario from our own development. We needed to add a document management feature to Stagent — the ability to upload, process, and query documents within projects.

In a traditional PM workflow, this would involve: a planning meeting to scope the feature, a design review, ticket creation for each component (upload API, processing pipeline, storage layer, UI), estimation, sprint scheduling, daily standups to track progress, and a retrospective after delivery. A conservative estimate: 8-12 hours of pure planning and coordination overhead for a medium-complexity feature.

In Stagent, the workflow looked like this: we created a project, described the objective ("add document management: upload, preprocessing, agent context"), and assigned it to the project-manager profile for decomposition. The agent analyzed the existing codebase — using its `Read`, `Grep`, and `Glob` tools (the only tools its `allowedTools` configuration permits) — identified that we already had a documents table in the schema but no processing pipeline, proposed six subtasks with dependency ordering, and flagged that we would need a new document processor registry for extensibility. We reviewed the plan, adjusted one priority, and approved. Execution tasks were then routed to the appropriate profiles: `code-reviewer` for the API design, `general` for the implementation work.

Total planning overhead: about 20 minutes. And because the agent had analyzed the actual codebase (not a description of it), the plan was grounded in reality from the start. No "oh, we didn't realize this would require a schema migration" surprises on day three of the sprint.

This is not about speed, though the speed improvement is real. It is about the quality of planning. An AI agent that can read the codebase, query the database schema, and reason about dependencies produces plans that are more technically grounded than plans produced in a meeting room with a whiteboard. The agent does not forget about that edge case in the authentication middleware. It does not overlook the foreign key constraint that makes the migration order critical. It reads the code and reasons from what is actually there.

## Lessons Learned

After building and using Stagent's project management system across dozens of features, several lessons have crystallized.

### Start with the Schema, Not the Agent

Our most counterintuitive lesson: the schema matters more than the AI model. We spent weeks tuning prompts and profiles before realizing that the single highest-leverage improvement was adding an `agentProfile` column to the tasks table. That one field transformed tasks from "things humans do" into "things that can be routed to the right cognitive style." Similarly, adding `workingDirectory` to projects unlocked filesystem-aware planning — something no amount of prompt engineering could achieve without it.

The schema kept growing as we discovered new agent affordances. Foreign keys to `workflows` and `schedules` let agents understand task provenance. The `sourceType` enum distinguishes manual tasks from heartbeat-generated and workflow-spawned ones. The `sessionId` and `resumeCount` fields enabled long-running tasks that survive interruptions. Indexes on `agent_profile` made profile-based routing queries fast. Each schema addition was a new capability for every agent in the system — a multiplier, not an increment.

If you are building an AI-native application, design your schema first. Make every field explicit. Use enums instead of free text. Add the columns that AI agents need even if your UI does not display them yet. The schema is the foundation; everything else is built on top of it.

### Heartbeats Change the Relationship with Work

The heartbeat scheduler changed how we relate to our own system. Before heartbeats, we checked Stagent to see what was happening. After heartbeats, Stagent checked on our projects and told us what needed attention — delivered to Slack or Telegram, within active hours, only when conditions warranted it. The shift from pull to push is subtle but profound. You stop thinking "I should check on the deployment pipeline" and start trusting that the system will tell you when something matters. Active hours and suppression counts prevent alert fatigue. Budget caps prevent cost surprises. The heartbeat does not replace human judgment — it surfaces the moments where human judgment is needed.

### Progressive Autonomy Works

The five-stage autonomy model (Manual, Assisted, Delegated, Autonomous, Emergent) is not just a theoretical framework — it is how trust actually develops between humans and AI systems. We started Stagent at stage 1, doing everything manually. As we validated the agent's judgment through experience, we gradually moved operations to higher autonomy levels.

Today, task decomposition runs at stage 3 (Delegated) — the project-manager profile breaks down features autonomously using only read-only tools. Code execution runs at stage 2 (Assisted) — the agent proposes, the human approves. Deployment remains at stage 1 (Manual). This granularity is essential. A single global autonomy knob would either hold everything back or push everything forward too fast.

### The Human Role Evolves, It Does Not Disappear

The fear that AI will replace project managers misses the point. What disappears is the operational drudgery — the ticket-writing, status-chasing, meeting-scheduling overhead that consumes most of a PM's day. What remains — and grows in importance — is the system design work: defining objectives, setting constraints, designing agent profiles, establishing trust boundaries, configuring heartbeat checklists, and making judgment calls that require context no AI currently possesses.

In our experience, the humans who thrive in an AI-native workflow are the ones who shift from thinking "what tasks do I need to do?" to thinking "what system do I need to design so that tasks get done well?" It is a higher-leverage position. The PM becomes less like a foreman on a construction site and more like an architect — still essential, but operating at a different altitude.

### Profiles Are More Powerful Than Prompts

Early on, we tried to encode all agent behavior in system prompts. It worked, but it did not scale. A system prompt is a blob of text — you cannot query it, version it, validate it, or compose it with other configurations. Moving to the profile system — YAML configuration plus Markdown instructions, validated by Zod, cached by the registry, extensible by users — transformed how we thought about agent behavior.

Profiles compose. A task gets a profile, a project gets a working directory, a schedule gets a cron expression, and the system assembles the right context for each execution. Profiles are testable — the `tests` array in each profile.yaml lets us verify behavioral expectations in CI. Profiles are portable — the `supportedRuntimes` field means the same profile works across Claude, Codex, Anthropic Direct, OpenAI Direct, and Ollama. And profiles are user-extensible — anyone can drop a new directory into `~/.claude/skills/` and the registry picks it up on the next access.

---

The project management system described in this chapter is the foundation on which everything else in Stagent is built. Tasks, workflows, agent profiles, heartbeat schedules, and human oversight — these are the primitives. In the chapters that follow, we will see how these primitives compose into increasingly sophisticated patterns: multi-agent collaboration with episodic memory, autonomous execution loops with async handoffs, and document processing that turns unstructured files into agent-accessible knowledge.

But it all starts here, with a schema and a profile and the willingness to ask: what if the AI were not a tool we use, but a team member we design for?

[Try: Create a Project](/projects)
