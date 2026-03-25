---
title: "Project Management"
subtitle: "From Manual Planning to Autonomous Sprint Planning"
chapter: 1
part: 1
readingTime: 12
lastGeneratedBy: "2026-03-25T03:32:34.423Z"
---

## The Problem

Every software team knows the ritual. Monday morning, the sprint planning meeting begins. A product manager reads from a backlog. Engineers estimate in story points — a unit of measurement that means something different to every person in the room. Dependencies are sketched on whiteboards or dragged around in Jira. Two hours later, the team emerges with a plan that will be obsolete by Wednesday.

This is the planning bottleneck, and it is one of the most expensive inefficiencies in modern software development. Not because the meetings are long (though they are), and not because the estimates are wrong (though they usually are), but because the entire process assumes that humans must be the ones doing the planning. We treat project management as an inherently human activity — something that requires judgment, intuition, and the kind of contextual reasoning that only a person can provide.

But what if that assumption is wrong?

When we started building Stagent, we did not set out to replace project managers. We set out to answer a simpler question: what would project management look like if an AI agent were a first-class participant in the process from day one? Not bolted on after the fact — not a chatbot sidebar in an existing tool — but woven into the foundation of how projects are structured, planned, and executed.

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

This is not a theoretical distinction. The agent profile is a concrete artifact — a pair of files that turns an abstract AI model into a specialized team member with defined responsibilities. In Stagent, every profile lives as a directory under `~/.claude/skills/` containing a `profile.yaml` for configuration and a `SKILL.md` for behavioral instructions.

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

Notice what this configuration encodes. It is not just a name and a prompt. It defines `allowedTools` — the specific tools the agent can invoke (read-only filesystem access, no writes). It defines `canUseToolPolicy` — which tools auto-approve without human confirmation and which are auto-denied. The `supportedRuntimes` field declares that this profile works across both Claude Code and OpenAI Codex runtimes, making it provider-agnostic. And the `tests` array provides smoke tests: give the agent a task, check that its output contains expected keywords. This is how we verify that a profile actually produces the behavior we designed for.

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

The `agentProfile` field on the tasks table is equally revealing. In Jira, you assign a task to a person. In Stagent, you assign a task to an agent profile — a behavioral configuration that determines how the AI approaches the work. A task assigned to the `code-reviewer` profile will be handled differently than one assigned to the `document-writer` profile, even though the same underlying AI model powers both. The profile is the personality; the model is the engine.

Notice also the foreign keys linking tasks to `workflows` and `schedules`. A task does not exist in isolation — it can be part of an automated workflow chain or spawned by a recurring schedule. These relationships let agents reason about context: "this task was triggered by a weekly code-quality schedule, so I should focus on regression patterns rather than new features." The schema encodes organizational knowledge that would otherwise live only in a human's head.

The indexing strategy is another agent affordance. Indexes on `status`, `project_id`, and `agent_profile` are not just performance optimizations — they define the query patterns that agents use most frequently. When an agent asks "what are my pending tasks?", that query hits `idx_tasks_status` and `idx_tasks_agent_profile` directly. The schema is optimized for agent access patterns, not just human ones.

> [!tip]
> **The Affordance of Structure**
> AI agents work best when database schemas are explicit, enumerated, and queryable. Every field you add to your schema is an affordance — a handle that agents can grasp. Free-text fields are slippery; enum fields are grippy. Timestamps enable temporal reasoning. Foreign keys encode relationships that agents can traverse. Design your schema as if your most important user cannot read between the lines — because it cannot.

### Pillar 2: Agent Profiles as Behavioral Architecture

The second pillar is the agent profile system. Traditional PM tools have roles — admin, member, viewer. These roles control access. Agent profiles control behavior. They define not just what an agent can do, but how it approaches work.

Stagent ships with 14 built-in profiles spanning multiple domains: `general`, `project-manager`, `code-reviewer`, `document-writer`, `researcher`, `technical-writer`, `data-analyst`, `devops-engineer`, `sweep` (for codebase maintenance), and lifestyle profiles like `wealth-manager`, `travel-planner`, `health-fitness-coach`, `shopping-assistant`, and `learning-coach`. Each profile carries its own SKILL.md behavioral instructions, tool permissions, runtime compatibility declarations, and constraint boundaries.

The profile system is filesystem-based and user-extensible. Built-in profiles ship in the source tree under `src/lib/agents/profiles/builtins/` and are copied to `~/.claude/skills/` on first run — but never overwritten, so users can customize them freely. The registry scans this directory, validates each `profile.yaml` against a Zod schema, pairs it with its `SKILL.md`, and caches the result.

<!-- filename: src/lib/agents/profiles/types.ts -->
```typescript
export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  domain: string;
  tags: string[];
  /** Full content of the SKILL.md file (system prompt + behavioral instructions) */
  skillMd: string;
  allowedTools?: string[];
  mcpServers?: Record<string, unknown>;
  canUseToolPolicy?: CanUseToolPolicy;
  maxTurns?: number;
  outputFormat?: string;
  version?: string;
  author?: string;
  tests?: ProfileSmokeTest[];
  supportedRuntimes: AgentRuntimeId[];
  runtimeOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeOverride>>;
}
```
*The `AgentProfile` interface — a profile is far more than a system prompt. It encodes domain, tool permissions, runtime compatibility, and behavioral tests.*

This matters because project management is not one activity — it is many. Breaking down a feature into tasks requires different reasoning than estimating effort. Identifying risks requires different attention patterns than writing acceptance criteria. By encoding these behavioral differences into profiles, we give the system a vocabulary for matching the right cognitive style to the right job.

The `runtimeOverrides` field deserves special attention. Stagent supports multiple AI runtimes — Claude Code and OpenAI Codex App Server — and a profile can carry different instructions for each. The project-manager profile might use Claude's deep reasoning for dependency analysis while leveraging Codex's code execution sandbox for estimation. This multi-runtime architecture means profiles are portable across providers, not locked to a single vendor.

The profile registry becomes a kind of team roster. When a new task comes in, the system can reason about which profile is best suited to handle it, just as a manager would reason about which team member to assign. The difference is that this matching happens in milliseconds, not in a scheduling meeting.

<!-- filename: src/lib/agents/profiles/registry.ts -->
```typescript
export function getProfile(id: string): AgentProfile | undefined {
  return ensureLoaded().get(id);
}

export function listProfiles(): AgentProfile[] {
  return Array.from(ensureLoaded().values());
}

/** Force re-scan of .claude/skills/ — call after user adds/edits profiles */
export function reloadProfiles(): void {
  profileCache = null;
  profileCacheSignature = null;
}

/** Create a new custom profile in ~/.claude/skills/ */
export function createProfile(config: ProfileConfig, skillMd: string): void {
  const result = ProfileConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid profile: ${result.error.issues.map(i => i.message).join(", ")}`);
  }

  const dir = path.join(SKILLS_DIR, config.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "profile.yaml"), yaml.dump(config));
  fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd);
  reloadProfiles();
}
```
*The registry provides CRUD operations for profiles — users can create custom profiles at runtime, validated against the same Zod schema used for built-ins*

The registry uses a file-signature cache that tracks modification times of every `profile.yaml` and `SKILL.md` in the skills directory. If a user edits a profile between requests, the cache invalidates automatically on the next access. This means profiles are live-editable — change a YAML file, and the next task execution picks up the new configuration without a restart.

### Pillar 3: Human-in-the-Loop as System Design

The third pillar is the human oversight model. This is where most AI-in-a-tool approaches get it wrong. They either give the AI too little autonomy (requiring approval for every action, making it slower than doing it manually) or too much (letting it run unsupervised, leading to trust-destroying mistakes).

Our approach is progressive autonomy — a five-stage spectrum that we discovered through building Stagent with Stagent:

**Manual**: The human does everything. The AI observes and learns context. This is where every new project starts, because trust must be earned, not assumed.

**Assisted**: The AI suggests, the human decides. The agent might propose a task breakdown, but the human reviews and modifies it before any work begins. This is the stage where most traditional AI integrations stop — the chatbot-as-advisor pattern.

**Delegated**: The human defines the objective, the agent executes within guardrails. The `canUseToolPolicy` in the agent profile defines the boundaries — `autoApprove` for safe operations, `autoDeny` for forbidden ones, and everything else pauses for human confirmation. Within those boundaries, the agent acts autonomously. Outside them, it pauses and asks.

**Autonomous**: The agent plans and executes end-to-end, with the human monitoring via dashboards and logs rather than approving individual steps. This stage requires high trust and a proven track record of reliable agent behavior.

**Emergent**: The agent identifies opportunities the human has not considered. It notices patterns across projects, suggests process improvements, and proactively raises issues before they become blockers. This is the frontier — the stage we are actively building toward.

The key insight is that these stages are not global settings. They are per-task, per-profile, and per-project. You might trust the general assistant to autonomously break down tasks (stage 4) while keeping the code reviewer at the delegated level (stage 3) where deployments still require approval. Trust is granular, not binary.

The home workspace makes this oversight model tangible. Five stat cards at the top show tasks running, completed today, awaiting review, active projects, and active workflows. A "Needs Attention" section surfaces items requiring human action — permission requests, failed tasks, stalled workflows. The human does not need to poll or check in; the system pushes decision points to them.

> [!info]
> **The Dashboard as Control Surface**
> Stagent's home workspace at `/` is designed as an operations center, not a status page. Stat cards give pulse metrics. The "Needs Attention" section acts as a human-in-the-loop queue — every item there represents a moment where the system needs human judgment. The sidebar organizes the workspace into three groups: Work (Dashboard, Inbox, Projects, Workflows, Documents), Manage (Monitor, Profiles, Schedules, Cost & Usage), and Configure (Playbook, Settings). This hierarchy reflects the progressive autonomy model — most of your time should be spent in Work, occasionally in Manage, rarely in Configure.

## The Difference in Practice

To make this concrete, consider a real scenario from our own development. We needed to add a document management feature to Stagent — the ability to upload, process, and query documents within projects.

In a traditional PM workflow, this would involve: a planning meeting to scope the feature, a design review, ticket creation for each component (upload API, processing pipeline, storage layer, UI), estimation, sprint scheduling, daily standups to track progress, and a retrospective after delivery. A conservative estimate: 8-12 hours of pure planning and coordination overhead for a medium-complexity feature.

In Stagent, the workflow looked like this: we created a project, described the objective ("add document management: upload, preprocessing, agent context"), and assigned it to the project-manager profile for decomposition. The agent analyzed the existing codebase — using its `Read`, `Grep`, and `Glob` tools (the only tools its `allowedTools` configuration permits) — identified that we already had a documents table in the schema but no processing pipeline, proposed six subtasks with dependency ordering, and flagged that we would need a new document processor registry for extensibility. We reviewed the plan, adjusted one priority, and approved. Execution tasks were then routed to the appropriate profiles: `code-reviewer` for the API design, `general` for the implementation work.

Total planning overhead: about 20 minutes. And because the agent had analyzed the actual codebase (not a description of it), the plan was grounded in reality from the start. No "oh, we didn't realize this would require a schema migration" surprises on day three of the sprint.

The Kanban board at `/dashboard` made the execution visible. Tasks flowed through five columns — Planned, Queued, Running, Completed, Failed — with drag-and-drop to override agent decisions when human judgment called for it. Filter bars let us slice by project, status, or priority. The AI Assist button on the task creation form could enhance a rough title and description with structured context, acceptance criteria, and suggested parameters — turning a one-line idea into an agent-ready specification.

This is not about speed, though the speed improvement is real. It is about the quality of planning. An AI agent that can read the codebase, query the database schema, and reason about dependencies produces plans that are more technically grounded than plans produced in a meeting room with a whiteboard. The agent does not forget about that edge case in the authentication middleware. It does not overlook the foreign key constraint that makes the migration order critical. It reads the code and reasons from what is actually there.

## Lessons Learned

After building and using Stagent's project management system across dozens of features, several lessons have crystallized.

### Start with the Schema, Not the Agent

Our most counterintuitive lesson: the schema matters more than the AI model. We spent weeks tuning prompts and profiles before realizing that the single highest-leverage improvement was adding an `agentProfile` column to the tasks table. That one field transformed tasks from "things humans do" into "things that can be routed to the right cognitive style." Similarly, adding `workingDirectory` to projects unlocked filesystem-aware planning — something no amount of prompt engineering could achieve without it.

The schema kept growing as we discovered new agent affordances. Foreign keys to `workflows` and `schedules` let agents understand task provenance. The `sessionId` and `resumeCount` fields enabled long-running tasks that survive interruptions. Indexes on `agent_profile` made profile-based routing queries fast. Each schema addition was a new capability for every agent in the system — a multiplier, not an increment.

If you are building an AI-native application, design your schema first. Make every field explicit. Use enums instead of free text. Add the columns that AI agents need even if your UI does not display them yet. The schema is the foundation; everything else is built on top of it.

### Progressive Autonomy Works

The five-stage autonomy model (Manual, Assisted, Delegated, Autonomous, Emergent) is not just a theoretical framework — it is how trust actually develops between humans and AI systems. We started Stagent at stage 1, doing everything manually. As we validated the agent's judgment through experience, we gradually moved operations to higher autonomy levels.

Today, task decomposition runs at stage 3 (Delegated) — the project-manager profile breaks down features autonomously using only read-only tools. Code execution runs at stage 2 (Assisted) — the agent proposes, the human approves. Deployment remains at stage 1 (Manual). This granularity is essential. A single global autonomy knob would either hold everything back or push everything forward too fast.

The `canUseToolPolicy` mechanism made this granularity practical. Instead of a single permission flag, each profile declares which tools auto-approve, which auto-deny, and which require case-by-case human judgment. The project-manager profile auto-approves `Read`, `Grep`, and `Glob` (safe, read-only operations) while everything else requires confirmation. The general profile gets broader permissions. This is trust encoded as configuration, not trust assumed by default.

### The Human Role Evolves, It Does Not Disappear

The fear that AI will replace project managers misses the point. What disappears is the operational drudgery — the ticket-writing, status-chasing, meeting-scheduling overhead that consumes most of a PM's day. What remains — and grows in importance — is the system design work: defining objectives, setting constraints, designing agent profiles, establishing trust boundaries, and making judgment calls that require context no AI currently possesses.

In our experience, the humans who thrive in an AI-native workflow are the ones who shift from thinking "what tasks do I need to do?" to thinking "what system do I need to design so that tasks get done well?" It is a higher-leverage position. The PM becomes less like a foreman on a construction site and more like an architect — still essential, but operating at a different altitude.

### Profiles Are More Powerful Than Prompts

Early on, we tried to encode all agent behavior in system prompts. It worked, but it did not scale. A system prompt is a blob of text — you cannot query it, version it, validate it, or compose it with other configurations. Moving to the profile system — YAML configuration plus Markdown instructions, validated by Zod, cached by the registry, extensible by users — transformed how we thought about agent behavior.

Profiles compose. A task gets a profile, a project gets a working directory, a schedule gets a cron expression, and the system assembles the right context for each execution. Profiles are testable — the `tests` array in each profile.yaml lets us verify behavioral expectations in CI. Profiles are portable — the `supportedRuntimes` field means the same profile works across Claude and Codex. And profiles are user-extensible — anyone can drop a new directory into `~/.claude/skills/` and the registry picks it up on the next access.

### Existing Tools Will Adapt, But Slowly

Jira, Linear, and their peers are already adding AI features, and those features will get better over time. But they face a structural disadvantage: their data models were designed for human workflows. Adding AI to a schema built for humans is like adding power steering to a horse-drawn carriage — it helps, but it does not change the fundamental architecture. An AI-native schema, designed from the ground up with agent affordances, enables capabilities that bolt-on AI cannot match.

This is not a permanent advantage. Eventually, traditional tools will evolve their schemas, or new competitors will emerge with AI-native foundations. But for now, the gap between "AI-assisted traditional PM" and "AI-native PM" is wide enough to be meaningful.

---

The project management system described in this chapter is the foundation on which everything else in Stagent is built. Tasks, workflows, agent profiles, and human oversight — these are the primitives. In the chapters that follow, we will see how these primitives compose into increasingly sophisticated patterns: multi-agent collaboration, autonomous execution loops, and eventually, systems that improve themselves.

But it all starts here, with a schema and a profile and the willingness to ask: what if the AI were not a tool we use, but a team member we design for?

[Try: Create a Project](/projects)
