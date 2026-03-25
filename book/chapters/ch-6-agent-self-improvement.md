---
title: "Agent Self-Improvement"
subtitle: "Learning from Execution Logs and Feedback"
chapter: 6
part: 2
readingTime: 13
relatedDocs: [agent-intelligence, profiles]
relatedJourney: developer
---

## The Problem

An agent that makes the same mistake twice isn't learning. Most AI systems are stateless -- each invocation starts fresh with no memory of past successes or failures. This is fine for simple tasks, but it's a fundamental limitation for complex, ongoing work. Stagent's learned context system closes this loop, feeding execution outcomes back into agent behavior.

Consider what happens in a typical AI-assisted workflow today. You ask an agent to refactor a module. It makes a choice that breaks your test suite -- maybe it renames an export without updating the barrel file. You correct it. The agent apologizes, fixes the issue, and you move on. Two weeks later, you ask it to refactor another module. It makes the exact same mistake. The apology is just as polite. The fix is just as quick. But the waste is just as real.

This is not a problem of model capability. GPT-4, Claude, Gemini -- they can all reason about barrel files and named exports. The problem is architectural. Each invocation is an island. There is no bridge between what the agent learned at 2pm on Tuesday and what it knows at 9am on Thursday. The context window is the agent's entire universe, and when that window closes, the universe ends.

The industry has developed several approaches to this problem, and it is worth understanding them before explaining why we chose a different path.

**Fine-tuning** modifies the model's weights using task-specific data. It is powerful but expensive, slow to iterate on, and requires significant infrastructure. You cannot fine-tune a model every time an agent learns that your project prefers tabs over spaces. The feedback cycle is measured in hours or days, not seconds.

**RLHF (Reinforcement Learning from Human Feedback)** shapes model behavior through preference signals, but it operates at the model provider level, not the application level. You cannot run RLHF on your deployment of Claude to teach it your team's coding conventions.

**DSPy's prompt optimization** is closer to what we need -- it programmatically tunes prompts based on execution outcomes. But it requires a metric function, a training set, and an optimization loop. It is a research framework, not an operational one.

**RAG (Retrieval-Augmented Generation)** retrieves relevant documents at query time and injects them into context. This is the closest cousin to our approach, but RAG systems typically retrieve static documents. They do not learn from their own execution. The knowledge base is populated by humans, not by the agent's experience.

What we wanted was something simpler and more immediate: a system where an agent's own execution outcomes become future context, where learning happens at runtime without model modification, and where a human stays in the loop to validate what gets learned. We wanted feedback loops as intelligence -- the idea that a system's capacity for learning matters more than its capacity at any single point in time.

> [!info]
> **Feedback Loops as Intelligence**
> The most important characteristic of an AI-native system is not how smart it is on any given task, but how quickly it gets smarter. A system with strong feedback loops will outperform a more capable system without them, given enough iterations. This is the central thesis of this chapter: intelligence is not a snapshot, it is a trajectory.

## The Learned Context System

Stagent's self-improvement system operates in three phases: **Capture**, **Store**, and **Inject**. Each phase is deliberately simple. The power comes from the loop, not from the sophistication of any individual step.

**Capture** happens automatically after every task completes. The pattern extractor analyzes the task's execution logs -- what tools were called, what errors occurred, what the final result looked like -- and uses a meta-completion (a separate LLM call dedicated to reflection) to identify patterns worth remembering. These patterns are categorized as error resolutions, best practices, shortcuts, or preferences.

**Store** persists these patterns in a versioned, append-only table. Every change -- whether a new proposal, an approval, a rejection, or a rollback -- creates a new version. This gives you a complete audit trail of how an agent's knowledge has evolved over time.

**Inject** happens at the start of every task execution. The system retrieves the latest approved context for the agent's profile and prepends it to the task prompt. The agent does not know this context was learned from past executions. It simply sees additional instructions that help it avoid past mistakes and follow established patterns.

The schema that makes this possible is straightforward:

<!-- filename: src/lib/db/schema.ts -->
```typescript
export const learnedContext = sqliteTable("learned_context", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  version: integer("version").notNull(),
  content: text("content"),
  diff: text("diff"),
  changeType: text("change_type", {
    enum: ["proposal", "approved", "rejected", "rollback", "summarization"],
  }).notNull(),
  sourceTaskId: text("source_task_id").references(() => tasks.id),
  proposalNotificationId: text("proposal_notification_id"),
  proposedAdditions: text("proposed_additions"),
  approvedBy: text("approved_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```
*Learned context schema -- versioned, scoped by profile, with full change-type audit trail*

Several design choices here deserve explanation. The `profileId` field scopes context to a specific agent profile. The code-reviewer profile learns different things than the general assistant. Scoping prevents knowledge contamination -- a lesson about TypeScript linting rules should not pollute the researcher profile that works primarily with documents.

The `version` field creates an append-only history. We never update a learned context row. We only insert new versions. This means you can always answer the question "what did this agent know last Tuesday?" -- a question that turns out to be surprisingly important when debugging unexpected agent behavior.

The `changeType` enum tracks the lifecycle of every piece of knowledge. A pattern starts as a `proposal`, gets `approved` or `rejected` by a human, and might eventually be `summarized` when the context grows too large. The `rollback` type lets you revert to any previous version if a recently approved pattern turns out to be harmful.

> [!tip]
> **Confidence Decay**
> Context entries start at full confidence. When contradicted by newer evidence or rejected by human reviewers, their influence decreases. The summarization process automatically archives low-value entries when context grows beyond the 6,000-character threshold, keeping the agent's working memory focused on what actually matters. This is managed by a dedicated meta-completion call that condenses the context while preserving actionable patterns.

## The Feedback Loop

The feedback loop is where the system earns its name. Three channels feed information back into agent behavior, each operating at a different timescale and with a different level of confidence.

### Explicit Feedback: Human Corrections

The highest-signal channel is direct human intervention. When a user reviews an agent's work and makes corrections -- editing a task result, rejecting an approach, or providing specific guidance -- the pattern extractor captures this as a high-confidence learning opportunity.

In practice, this works through the notification system. After every task execution, the pattern extractor runs a meta-completion to identify noteworthy patterns from the execution logs. If it finds any, it creates a context proposal and sends it to the human for review via a notification. The human can approve the proposal as-is, edit it before approving, or reject it entirely.

<!-- filename: src/lib/agents/learned-context.ts -->
```typescript
export async function proposeContextAddition(
  profileId: string,
  taskId: string,
  additions: string,
  options?: { silent?: boolean }
): Promise<string> {
  const version = getNextVersion(profileId);
  const rowId = crypto.randomUUID();
  const now = new Date();

  // Insert proposal row
  await db.insert(learnedContext).values({
    id: rowId,
    profileId,
    version,
    content: null, // not yet approved
    diff: additions,
    changeType: "proposal",
    sourceTaskId: taskId,
    proposalNotificationId: notificationId,
    proposedAdditions: additions,
    createdAt: now,
  });

  // Create notification for human review
  if (notificationId) {
    await db.insert(notifications).values({
      id: notificationId,
      taskId,
      type: "context_proposal",
      title: `Context proposal for ${profileId}`,
      body: additions.slice(0, 500),
      toolName: profileId,
      toolInput: JSON.stringify({ profileId, additions, learnedContextId: rowId }),
      createdAt: now,
    });
  }

  return rowId;
}
```
*The proposal flow -- every learning starts as a suggestion, not a certainty*

This human-in-the-loop design is not incidental. It is the cornerstone of what I think of as progressive autonomy -- the principle that an agent should earn trust through demonstrated competence, not demand it through configuration. Early in a project, every context proposal goes through human review. As the human builds confidence in the agent's pattern extraction quality, they can choose to auto-approve certain categories or profiles. The system grows more autonomous as it proves itself, not before.

### Implicit Feedback: Task Outcomes

The second channel is quieter but more prolific. Every completed task generates execution logs: which tools were invoked, what errors occurred, how many retries were needed, what the final outcome was. The pattern extractor sifts through these logs looking for signal.

<!-- filename: src/lib/agents/pattern-extractor.ts -->
```typescript
export async function analyzeForLearnedPatterns(
  taskId: string,
  profileId: string
): Promise<string | null> {
  // Gather task data and recent agent logs
  const [task] = await db
    .select({ title: tasks.title, description: tasks.description, result: tasks.result })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  const logs = await db
    .select({ event: agentLogs.event, payload: agentLogs.payload })
    .from(agentLogs)
    .where(eq(agentLogs.taskId, taskId))
    .orderBy(desc(agentLogs.timestamp))
    .limit(20);

  const currentContext = getActiveLearnedContext(profileId);

  // Meta-completion to extract patterns
  const { text } = await runMetaCompletion({
    prompt: `Analyze this completed task for patterns worth learning...

    Extract ONLY genuinely useful patterns — things that would help this
    profile avoid mistakes or work more efficiently on similar future tasks.
    Do NOT repeat patterns already in the learned context.`,
    activityType: "pattern_extraction",
  });

  // ... parse and propose
}
```
*Pattern extraction runs fire-and-forget after every task completion*

The fire-and-forget pattern is deliberate. In `claude-agent.ts`, after the main task execution stream completes, the pattern extraction call runs asynchronously without blocking the response to the user:

```typescript
// Fire-and-forget pattern extraction for self-improvement
analyzeForLearnedPatterns(taskId, agentProfileId).catch((err) => {
  console.error("[self-improvement] pattern extraction failed:", err);
});
```

This means self-improvement never slows down task execution. It is a background process, invisible to the user, that quietly accumulates knowledge. If it fails -- network error, model overload, parsing glitch -- the task still completes successfully. Learning is valuable but not critical. The system degrades gracefully.

A key design constraint here is the instruction to "NOT repeat patterns already in the learned context." The current context is passed to the meta-completion alongside the execution logs. This prevents the knowledge base from filling up with redundant entries. Without this constraint, every successful code review would generate a "remember to check for unused imports" pattern until the context window was consumed by repetition.

### Cross-Agent Learning via Workflow Sessions

The third channel operates across agent boundaries within a workflow. When a workflow executes multiple tasks -- perhaps a researcher gathers information, a code-reviewer analyzes it, and a document-writer produces a report -- each agent generates patterns independently. Without coordination, this produces a flood of individual notifications that overwhelms the human reviewer.

The learning session system solves this by buffering proposals during workflow execution and presenting them as a single batch when the workflow completes.

<!-- filename: src/lib/agents/learning-session.ts -->
```typescript
const activeSessions = new Map<string, {
  workflowId: string;
  proposalIds: string[];
  openedAt: Date;
}>();

export function openLearningSession(workflowId: string): void {
  activeSessions.set(workflowId, {
    workflowId,
    proposalIds: [],
    openedAt: new Date(),
  });
}

export async function closeLearningSession(
  workflowId: string
): Promise<string | null> {
  const session = activeSessions.get(workflowId);
  activeSessions.delete(workflowId);

  if (!session || session.proposalIds.length === 0) return null;

  // Group proposals by profile, create single batch notification
  // ...
}
```
*Learning sessions buffer cross-agent proposals into a single reviewable batch*

This batching serves two purposes. First, it reduces notification fatigue. A workflow with five tasks might generate eight proposals, and reviewing them as a group gives the human better context than reviewing them one by one. Second, it enables cross-pollination. When the human reviews the batch, they can see patterns that emerged across agents -- perhaps the researcher and the code-reviewer both struggled with the same API, suggesting a systemic issue rather than a profile-specific one.

> [!lesson]
> **Hot Reloading for Agents**
> Learned context is injected at execution time, not baked into the agent's configuration. This means approving a new pattern takes effect immediately on the next task -- no restart, no redeployment, no waiting for a training run. It is the agent equivalent of hot module replacement: change the knowledge, see the effect.

This runtime injection approach is what fundamentally distinguishes Stagent's learning system from fine-tuning or RLHF. When you fine-tune a model, you are modifying weights. The change is permanent, global, and expensive to reverse. When you approve a learned context entry in Stagent, you are modifying a database row. The change is scoped, versioned, and reversible with a single rollback operation.

The tradeoff is obvious: fine-tuning changes the model's deep capabilities, while context injection only changes what the model knows in a specific context window. But for the kinds of learning that matter in operational settings -- project conventions, error patterns, team preferences -- context injection is not just adequate, it is superior. These things change frequently. They differ across projects. They need human oversight. A database row is the right abstraction.

![Hot reloading a learned context entry with instant agent behavior change](/book/images/hot-reloading-feature.png "This screenshot shows the hot-reloading feature in action -- a learned context entry being approved and immediately influencing the next agent execution without any restart or redeployment.")

## Context Size Management

There is a practical constraint that makes this entire system possible or impossible: the context window. Every character of learned context competes with task instructions, document context, profile prompts, and tool definitions for space in the model's finite attention span. An unbounded learning system would eventually consume the entire context window with accumulated knowledge, leaving no room for the actual task.

Stagent manages this through an 8,000-character hard limit and a 6,000-character summarization threshold. When approved context for a profile crosses the threshold, a dedicated meta-completion condenses the accumulated knowledge -- merging related patterns, removing superseded entries, and preserving only what remains actionable.

<!-- filename: src/lib/agents/learned-context.ts -->
```typescript
const CONTEXT_CHAR_LIMIT = 8_000;
const SUMMARIZATION_THRESHOLD = 6_000;

export async function summarizeContext(profileId: string): Promise<void> {
  const content = getActiveLearnedContext(profileId);
  if (!content || content.length <= SUMMARIZATION_THRESHOLD) return;

  const { text } = await runMetaCompletion({
    prompt: `You are condensing learned context for an AI agent profile "${profileId}".
    Produce a condensed version that:
    1. Preserves all actionable patterns and best practices
    2. Merges related patterns into combined entries
    3. Removes redundant or superseded information
    4. Stays under ${SUMMARIZATION_THRESHOLD} characters`,
    activityType: "context_summarization",
  });

  // Create new summarization version
  await db.insert(learnedContext).values({
    id: crypto.randomUUID(),
    profileId,
    version: getNextVersion(profileId),
    content: summarized,
    diff: `Summarized from ${content.length} to ${summarized.length} chars`,
    changeType: "summarization",
    createdAt: new Date(),
  });
}
```
*Auto-summarization keeps learned context within the attention budget*

This summarization step is itself a form of learning. The model must decide what to keep and what to discard, which patterns are fundamental and which are circumstantial. It is compression through understanding, not truncation. The result is a more potent knowledge base -- fewer characters carrying more signal.

I think of this as cognitive budgeting. Every agent has an attention budget, and the learned context system must be a responsible steward of that budget. Injecting 8,000 characters of high-quality learned patterns is transformative. Injecting 8,000 characters of redundant, low-confidence noise is actively harmful -- it displaces task-relevant information and confuses the model's reasoning.

## Why Most Agent Frameworks Skip This

If runtime learning is so valuable, why do most agent frameworks ignore it? I think there are three reasons.

First, most frameworks are built for single-shot interactions. LangChain, CrewAI, AutoGen -- they excel at orchestrating complex chains of LLM calls within a single session. But the session is the boundary. When the chain completes, the framework's job is done. There is no mechanism for feeding results back into future sessions because the framework does not model sessions as part of a continuous history.

Second, learning requires opinions about what to learn. A general-purpose framework cannot decide whether "always use semicolons" is a pattern worth persisting. That decision is domain-specific, project-specific, even team-specific. Building a learning system means building a curation system, and curation requires a point of view. Most frameworks deliberately avoid having a point of view because it would limit their generality.

Third, learning creates liability. If an agent learns an incorrect pattern and propagates it across future tasks, the damage compounds. This is the "bad habit" problem, and it is genuinely scary. A stateless agent can be wrong, but it is wrong in isolation. A learning agent can be wrong in a way that corrupts future behavior. The human-in-the-loop approval process is not just a nice feature -- it is the safety mechanism that makes persistent learning viable at all.

This is where progressive autonomy becomes essential. You do not give a new team member root access on their first day. You do not let a junior developer merge to main without review. Similarly, you should not let an agent modify its own knowledge base without human oversight -- at least not initially. As the agent demonstrates good judgment in its pattern extraction, the human can relax the review process. Trust is earned through track record, not granted through configuration.

## Lessons Learned

Building this system taught us several things the hard way.

**Context Window Is Finite.** This sounds obvious, but the implications are not. We started without summarization, and within a week of active use, the code-reviewer profile had accumulated so much learned context that it consumed half the context window before the task even started. The agent's performance actually degraded as it learned more, because the sheer volume of context overwhelmed its ability to focus on the task at hand. Aggressive filtering and auto-summarization were not optimizations -- they were survival mechanisms.

**Human Feedback Is Gold.** The most valuable learned context consistently comes from explicit human corrections, not from automated pattern extraction. When a human edits a proposal before approving it, they are distilling their judgment into a format the agent can use. The edited version is almost always better than the raw extraction. This is why the approval UI supports editing -- not just approve or reject, but approve-with-modifications. The system learns from the modification as much as from the approval.

**Scope Carefully.** Our first design used global scope -- patterns learned by any profile were visible to all profiles. This was a disaster. The code-reviewer learned that "always check for null pointer exceptions" was a critical pattern, which was true for code review but actively harmful when injected into the document-writer's context. Profile-scoped learning was not a feature we planned. It was a fix for a problem we created by being too ambitious with knowledge sharing.

**Learning Is Not Always Good.** Some patterns the extractor identifies are technically correct but operationally useless. "This task completed successfully" is a true pattern that teaches nothing. "The API returned a 429 rate limit error and the agent retried after 30 seconds" is a true pattern that might matter once but should not be learned as a permanent behavior. The quality of pattern extraction depends heavily on the meta-completion prompt, and we have iterated on that prompt more than any other part of the system.

**Versioning Saves You.** The append-only version history has saved us multiple times. In one case, an approved pattern caused the agent to skip a validation step that it had previously performed correctly. Because we could see exactly when the pattern was introduced and what the agent's context looked like before and after, we diagnosed the issue in minutes and rolled back to the previous version. Without versioning, we would have been debugging blind.

[Try: View Agent Profiles](/settings)

## The Trajectory of Intelligence

This chapter has been about a specific technical system -- learned context in Stagent. But the principle extends far beyond any single implementation. The question is not whether your agent is smart enough today. The question is whether your agent will be smarter tomorrow.

Feedback loops are the mechanism that converts experience into capability. Fine-tuning does this at the model level. RLHF does this at the alignment level. Stagent's learned context does this at the application level. Each operates at a different timescale and with different tradeoffs, but they all share the same fundamental insight: intelligence is not a property of a system at a point in time. It is the derivative -- the rate of change.

A system that learns from every interaction, even slowly, even imperfectly, will eventually outperform a system that does not. The compounding effect of thousands of small improvements -- a pattern here, a preference there, an error resolution that saves five minutes on every future task -- creates a gap that raw model capability cannot close.

This is why I believe learned context is not an optional feature for AI-native applications. It is a defining characteristic. An application that uses AI but does not learn from its own use is an application with AI, not an AI-native application. The difference is the feedback loop.
