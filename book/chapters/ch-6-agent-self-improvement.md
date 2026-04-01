---
title: "Agent Self-Improvement"
subtitle: "From Learned Context to Episodic Memory"
chapter: 6
part: 2
readingTime: 13
relatedDocs: [agent-intelligence, profiles]
relatedJourney: developer
lastGeneratedBy: "2026-03-31T21:00:00Z"
---

# Agent Self-Improvement

## The Problem

An agent that makes the same mistake twice is not learning. Most AI systems are stateless -- each invocation starts fresh with no memory of past successes or failures. This is fine for simple tasks, but it is a fundamental limitation for complex, ongoing work. Stagent's self-improvement system closes this loop through two complementary mechanisms: **learned context** for behavioral patterns and **episodic memory** for factual knowledge. Together, they give agents a persistent, evolving understanding of the projects and people they serve.

Consider what happens in a typical AI-assisted workflow today. You ask an agent to refactor a module. It makes a choice that breaks your test suite -- maybe it renames an export without updating the barrel file. You correct it. The agent apologizes, fixes the issue, and you move on. Two weeks later, you ask it to refactor another module. It makes the exact same mistake. The apology is just as polite. The fix is just as quick. But the waste is just as real.

This is not a problem of model capability. GPT-4, Claude, Gemini -- they can all reason about barrel files and named exports. The problem is architectural. Each invocation is an island. There is no bridge between what the agent learned at 2pm on Tuesday and what it knows at 9am on Thursday. The context window is the agent's entire universe, and when that window closes, the universe ends.

The industry has developed several approaches to this problem. **Fine-tuning** modifies model weights but is expensive, slow to iterate on, and operates at the provider level. **RLHF** shapes model behavior through preference signals but is not application-level. **DSPy's prompt optimization** is closer -- programmatic prompt tuning based on execution outcomes -- but requires a metric function, a training set, and an optimization loop. **RAG** retrieves relevant documents at query time, but RAG systems typically retrieve static documents populated by humans, not by the agent's own experience.

What we wanted was something simpler and more immediate: a system where an agent's own execution outcomes become future context, where learning happens at runtime without model modification, and where a human stays in the loop to validate what gets learned. The result is two systems that operate at different timescales and serve different purposes, but share the same principle: intelligence is not a snapshot, it is a trajectory.

> [!info]
> **Feedback Loops as Intelligence**
> The most important characteristic of an AI-native system is not how smart it is on any given task, but how quickly it gets smarter. A system with strong feedback loops will outperform a more capable system without them, given enough iterations. This is the central thesis of this chapter: intelligence is not a snapshot, it is a trajectory.

## The Learned Context System

Stagent's first self-improvement mechanism operates in three phases: **Capture**, **Store**, and **Inject**. Each phase is deliberately simple. The power comes from the loop, not from the sophistication of any individual step.

**Capture** happens automatically after every task completes. The pattern extractor analyzes the task's execution logs -- what tools were called, what errors occurred, what the final result looked like -- and uses a meta-completion (a separate LLM call dedicated to reflection) to identify patterns worth remembering. These patterns are categorized as error resolutions, best practices, shortcuts, or preferences.

**Store** persists these patterns in a versioned, append-only table. Every change -- whether a new proposal, an approval, a rejection, or a rollback -- creates a new version. This gives you a complete audit trail of how an agent's knowledge has evolved over time.

**Inject** happens at the start of every task execution. The system retrieves the latest approved context for the agent's profile and prepends it to the task prompt. The agent does not know this context was learned from past executions. It simply sees additional instructions that help it avoid past mistakes and follow established patterns.

<!-- filename: src/lib/agents/learned-context.ts -->
```typescript
const DEFAULT_CONTEXT_CHAR_LIMIT = 8_000;
const SUMMARIZATION_RATIO = 0.75;

/** Get the latest approved context for a profile */
export function getActiveLearnedContext(profileId: string): string | null {
  const [row] = db
    .select({ content: learnedContext.content })
    .from(learnedContext)
    .where(
      and(
        eq(learnedContext.profileId, profileId),
        eq(learnedContext.changeType, "approved")
      )
    )
    .orderBy(desc(learnedContext.version))
    .limit(1)
    .all();

  return row?.content ?? null;
}
```
> Learned context retrieval -- scoped by profile, always returns the latest approved version

Several design choices deserve explanation. The `profileId` field scopes context to a specific agent profile. The code-reviewer profile learns different things than the general assistant. Scoping prevents knowledge contamination -- a lesson about TypeScript linting rules should not pollute the researcher profile that works primarily with documents.

The `version` field creates an append-only history. We never update a learned context row. We only insert new versions. This means you can always answer the question "what did this agent know last Tuesday?" -- a question that turns out to be surprisingly important when debugging unexpected agent behavior.

The `changeType` enum tracks the lifecycle of every piece of knowledge. A pattern starts as a `proposal`, gets `approved` or `rejected` by a human, and might eventually be `summarized` when the context grows too large. The `rollback` type lets you revert to any previous version if a recently approved pattern turns out to be harmful.

### The Proposal Flow

Every learning starts as a suggestion, not a certainty. The pattern extractor runs fire-and-forget after each task completion, analyzing execution logs through a meta-completion call. If it identifies patterns worth remembering, it creates a context proposal and sends it to the human for review via a notification.

```typescript
// Fire-and-forget pattern extraction for self-improvement
analyzeForLearnedPatterns(taskId, agentProfileId).catch((err) => {
  console.error("[self-improvement] pattern extraction failed:", err);
});
```

This means self-improvement never slows down task execution. It is a background process, invisible to the user, that quietly accumulates knowledge. If it fails -- network error, model overload, parsing glitch -- the task still completes successfully. Learning is valuable but not critical. The system degrades gracefully.

> [!tip]
> **Confidence Decay for Learned Context**
> Context entries start at full confidence. When contradicted by newer evidence or rejected by human reviewers, their influence decreases. The summarization process automatically archives low-value entries when context grows beyond the 6,000-character threshold (75% of the 8,000-character limit), keeping the agent's working memory focused on what actually matters.

## Episodic Memory: The Knowledge Layer

Learned context captures behavioral patterns -- how an agent should work. Episodic memory captures factual knowledge -- what an agent has discovered. This distinction is critical. "Always check for barrel file updates when renaming exports" is a behavioral pattern. "The payments service uses Stripe API v2023-10-16 and requires idempotency keys" is a fact. Both are valuable. They serve different purposes and decay at different rates.

Episodic memory was introduced in Sprint 36 to address a gap we kept running into: agents re-discovering the same facts on every execution. A researcher agent would spend tokens looking up a company's latest funding round, find the answer, complete the task -- and then spend the same tokens looking up the same fact two days later on a related task. The information was in the task result, but not in the agent's memory.

The episodic memory system has four components: **extraction**, **storage with confidence scoring**, **time-based decay**, and **relevance-filtered retrieval**.

### Memory Extraction

After a task completes, the memory extractor analyzes the result text using heuristic pattern matching -- no LLM calls required. It identifies statements that look like facts, preferences, patterns, or outcomes based on keyword signals.

<!-- filename: src/lib/agents/memory/extractor.ts -->
```typescript
function classifyStatement(line: string): MemoryExtractionResult["category"] {
  const lower = line.toLowerCase();
  if (PATTERN_KEYWORDS.some((kw) => lower.includes(kw))) return "pattern";
  if (PREFERENCE_KEYWORDS.some((kw) => lower.includes(kw))) return "preference";
  if (OUTCOME_KEYWORDS.some((kw) => lower.includes(kw))) return "outcome";
  return "fact";
}

export async function extractMemories(
  taskResult: string,
  profileId: string
): Promise<MemoryExtractionResult[]> {
  // Get existing memory contents for deduplication
  const existingMemories = db
    .select({ content: agentMemory.content })
    .from(agentMemory)
    .where(
      and(eq(agentMemory.profileId, profileId), eq(agentMemory.status, "active"))
    )
    .all();
  const existingContents = existingMemories.map((m) => m.content);

  const statements = extractStatements(taskResult);
  const results: MemoryExtractionResult[] = [];

  for (const statement of statements) {
    if (isSimilarToExisting(statement, existingContents)) continue;
    const category = classifyStatement(statement);
    const tags = extractTags(statement);
    const confidence = category === "fact" ? 0.7 : category === "pattern" ? 0.5 : 0.6;
    results.push({ category, content: statement, tags, confidence });
  }

  return results.slice(0, 20); // Cap at 20 memories per extraction
}
```
> Memory extraction -- heuristic classification with deduplication against existing memories

The decision to use heuristic extraction instead of an LLM call was deliberate. Learned context uses a meta-completion for pattern extraction because behavioral patterns require reasoning about what is generalizable. Factual knowledge, by contrast, can be identified through keyword signals: statements starting with "the API...", "the database...", "this project..." are almost always facts worth remembering. The heuristic approach is fast, free (no API tokens), and runs on every task completion without budget concerns.

The deduplication check prevents memory bloat. Before storing a new memory, the extractor compares it against all existing active memories for the profile. If the candidate has more than 80% word overlap with an existing memory, it is silently dropped. This keeps the memory store lean -- the same fact does not get stored twenty times because twenty tasks happened to mention it.

### Confidence Scoring and Decay

Every memory has a confidence score on a 0-1 scale (stored as 0-1000 in the database for integer precision). Initial confidence varies by category: facts start at 0.7, patterns at 0.5, preferences and outcomes at 0.6. These starting points reflect our observation that explicit factual statements are more likely to be correct than inferred patterns.

<!-- filename: src/lib/agents/memory/types.ts -->
```typescript
export interface MemoryExtractionResult {
  category: "fact" | "preference" | "pattern" | "outcome";
  content: string;
  tags: string[];
  confidence: number; // 0-1 scale (converted to 0-1000 for DB)
}
```

Confidence decays over time. The decay function runs periodically, reducing each memory's confidence based on how long it has been since the memory was last accessed. A memory that is retrieved frequently (because it keeps being relevant to new tasks) maintains high confidence. A memory that has not been accessed in weeks gradually fades.

<!-- filename: src/lib/agents/memory/decay.ts -->
```typescript
export function applyMemoryDecay(): { decayed: number; archived: number } {
  const now = Date.now();
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  const activeMemories = db
    .select()
    .from(agentMemory)
    .where(eq(agentMemory.status, "active"))
    .all();

  let decayed = 0;
  let archived = 0;

  for (const memory of activeMemories) {
    const lastAccess = memory.lastAccessedAt?.getTime() ?? memory.createdAt.getTime();
    const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);

    // newConfidence = confidence * (1 - decayRate/1000) ^ daysSinceLastAccess
    const decayFactor = Math.pow(1 - memory.decayRate / 1000, daysSinceAccess);
    const newConfidence = Math.round(memory.confidence * decayFactor);

    if (now - lastAccess > NINETY_DAYS_MS && newConfidence < 200) {
      newStatus = "archived";
      archived++;
    } else if (newConfidence < 100) {
      newStatus = "decayed";
      decayed++;
    }
  }

  return { decayed, archived };
}
```
> Memory decay -- exponential confidence reduction based on access recency, with archive threshold

The decay model uses three states: **active** (confidence >= 100, available for retrieval), **decayed** (confidence < 100, excluded from retrieval but still visible in the browser), and **archived** (not accessed for 90+ days with low confidence, hidden by default). This three-state model means memories are never deleted -- they fade gracefully, and an operator can always dig into the archive to understand what the agent used to know.

The decay rate is per-memory and configurable, but the default produces a half-life of roughly 14 days for unaccessed memories. A fact that was relevant two weeks ago but has not been touched since will have lost about half its confidence. If it is still relevant, the next task that retrieves it will reset its access timestamp and restore its standing. If it is not, it will continue to fade until it crosses the threshold into decayed status.

> [!warning]
> **Decay Is Not Deletion**
> Memory decay reduces confidence, it does not erase knowledge. A decayed memory still exists in the database and is visible in the memory browser. If circumstances change and an old fact becomes relevant again, an operator can manually restore it to active status. This is important for compliance and debugging -- the system maintains a complete history of what every agent profile has ever known.

### Relevance-Filtered Retrieval

The retrieval system is where episodic memory earns its keep. When an agent begins a new task, the system retrieves the most relevant memories for the current context using a multi-factor scoring function.

<!-- filename: src/lib/agents/memory/retrieval.ts -->
```typescript
export async function getRelevantMemories(
  profileId: string,
  taskContext: string,
  limit: number = 10
): Promise<AgentMemoryRow[]> {
  // Query active memories with confidence >= 300 (0.3)
  const candidates = db
    .select()
    .from(agentMemory)
    .where(
      and(
        eq(agentMemory.profileId, profileId),
        eq(agentMemory.status, "active"),
        gte(agentMemory.confidence, 300)
      )
    )
    .all();

  const scored = candidates.map((memory) => {
    const confidenceFactor = memory.confidence / 1000;          // 30%
    const recencyFactor = Math.exp(-0.05 * daysSinceAccess);    // 20%
    const tagOverlap = /* tag match score */;                   // 25%
    const contentFactor = Math.min(wordOverlap / 5, 1);         // 25%

    const score =
      confidenceFactor * 0.3 +
      recencyFactor * 0.2 +
      (tagOverlap > 0 ? 0.25 : 0) +
      contentFactor * 0.25;

    return { memory, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.memory);
}
```
> Relevance retrieval -- four-factor scoring with confidence, recency, tag overlap, and content similarity

Four factors determine relevance: **confidence** (30% weight) ensures high-confidence memories rank higher; **recency** (20%) exponentially decays based on days since last access; **tag overlap** (25%) matches extracted technical terms against the task context; and **content similarity** (25%) measures word overlap between the memory text and the current task description.

The minimum confidence threshold of 0.3 (300 in DB units) acts as a quality gate. Memories that have decayed below 30% confidence are excluded from retrieval entirely, even if their content is relevant. This prevents stale or contradicted knowledge from polluting the agent's context.

Retrieval also updates access metadata. Every memory that gets retrieved has its `lastAccessedAt` timestamp reset and its `accessCount` incremented. This creates a virtuous cycle: memories that keep being relevant stay fresh, while irrelevant memories continue to decay. The system self-organizes without human intervention.

## Two Systems, One Agent

The distinction between learned context and episodic memory is subtle but important. Here is how they compare:

| Dimension | Learned Context | Episodic Memory |
|-----------|----------------|-----------------|
| **What it stores** | Behavioral patterns, best practices | Factual knowledge, discoveries |
| **How it's captured** | LLM meta-completion (reflection) | Heuristic keyword extraction |
| **Human approval** | Required before injection | Not required (auto-stored) |
| **Scope** | Per-profile, version-controlled | Per-profile, confidence-scored |
| **Decay model** | Manual summarization at threshold | Automatic time-based confidence decay |
| **Injection** | Prepended to every task prompt | Relevance-filtered per task |
| **Cost** | One API call per extraction | Zero API calls (heuristic) |

In practice, the two systems reinforce each other. Learned context tells the agent *how* to work: "always check barrel file exports when refactoring." Episodic memory tells the agent *what it knows*: "the auth module uses barrel exports in src/lib/auth/index.ts." When both are injected into a refactoring task, the agent knows both the rule and the relevant file, producing better results than either system alone.

> [!lesson]
> **Hot Reloading for Agents**
> Both learned context and episodic memory are injected at execution time, not baked into the agent's configuration. Approving a new learned context pattern or storing a new episodic memory takes effect immediately on the next task -- no restart, no redeployment, no waiting for a training run. It is the agent equivalent of hot module replacement: change the knowledge, see the effect.

## The Memory Browser

Episodic memory introduced a new operational need: visibility into what agents remember. The memory browser UI provides a searchable, filterable view of all stored memories across profiles. Operators can inspect individual memories to see their content, confidence score, category, tags, creation date, and access history.

The browser supports three operations: **editing** a memory's content (useful when the extractor captured a fact slightly wrong), **archiving** a memory that is no longer relevant, and **restoring** a previously decayed or archived memory. These CRUD operations are backed by an API that maintains the same audit trail as the rest of the system -- every change is recorded, and the history is browsable.

This visibility layer turned out to be essential for trust. Without it, episodic memory was a black box -- the agent seemed to know things, but operators could not tell what or why. The browser makes the agent's knowledge inspectable, which is a prerequisite for trusting it. You cannot delegate decision-making to a system whose knowledge base you cannot see.

## Cross-Agent Learning via Workflow Sessions

When a workflow executes multiple tasks -- perhaps a researcher gathers information, a code-reviewer analyzes it, and a document-writer produces a report -- each agent generates patterns independently. Without coordination, this produces a flood of individual notifications that overwhelms the human reviewer.

The learning session system solves this by buffering proposals during workflow execution and presenting them as a single batch when the workflow completes.

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
```
> Learning sessions buffer cross-agent proposals into a single reviewable batch

This batching serves two purposes. First, it reduces notification fatigue. A workflow with five tasks might generate eight proposals, and reviewing them as a group gives the human better context than reviewing them one by one. Second, it enables cross-pollination. When the human reviews the batch, they can see patterns that emerged across agents -- perhaps the researcher and the code-reviewer both struggled with the same API, suggesting a systemic issue rather than a profile-specific one.

## Context Size Management

There is a practical constraint that makes the entire learned context system possible or impossible: the context window. Every character of learned context competes with task instructions, document context, profile prompts, episodic memories, and tool definitions for space in the model's finite attention span.

Stagent manages this through a configurable character limit (default 8,000) and a summarization threshold at 75% of the limit. When approved context for a profile crosses the threshold, a dedicated meta-completion condenses the accumulated knowledge -- merging related patterns, removing superseded entries, and preserving only what remains actionable.

The character limit is configurable through Settings (range: 2,000 to 32,000 characters). Teams that work with models that have larger context windows can increase the limit. Teams that need to reserve more space for document context can decrease it. The summarization ratio (75%) ensures there is always headroom for new patterns without hitting the hard ceiling.

We think of this as cognitive budgeting. Every agent has an attention budget, and the self-improvement systems must be responsible stewards of that budget. Injecting 8,000 characters of high-quality learned patterns plus 10 relevant episodic memories is transformative. Injecting the same volume of redundant, low-confidence noise is actively harmful -- it displaces task-relevant information and confuses the model's reasoning.

## Lessons Learned

**Two Memory Systems Are Better Than One.** Our first design tried to use a single system for both behavioral patterns and factual knowledge. It failed for a simple reason: behavioral patterns need human curation (the cost of a bad habit is high), while factual knowledge needs automatic ingestion (the cost of re-discovering a fact is wasted tokens). Splitting into learned context (curated) and episodic memory (automatic) let each system optimize for its purpose.

**Heuristic Extraction Is Surprisingly Good.** We expected the keyword-based memory extractor to be a temporary placeholder until we wired up an LLM-based extractor. Six weeks later, the heuristic version is still in production. It captures the right statements 70-80% of the time, costs nothing, and runs on every single task without budget concerns. The LLM meta-completion for learned context is better at identifying generalizable patterns, but for factual extraction, keyword matching is good enough.

**Confidence Decay Prevents Knowledge Rot.** Without decay, the memory store would accumulate stale facts indefinitely. "The staging server is at 10.0.1.42" might have been true in January but wrong by March. The 14-day half-life for unaccessed memories means that stale facts naturally fade unless something keeps them alive. This is not perfect -- there is no mechanism to actively invalidate a memory when the underlying fact changes -- but it is a reasonable default that prevents the worst case of confidently injecting outdated knowledge.

**Scope Carefully.** Our first design used global scope -- patterns learned by any profile were visible to all profiles. This was a disaster. The code-reviewer learned that "always check for null pointer exceptions" was a critical pattern, which was true for code review but actively harmful when injected into the document-writer's context. Profile-scoped learning was not a feature we planned. It was a fix for a problem we created by being too ambitious with knowledge sharing.

**Human Feedback Is Gold.** The most valuable learned context consistently comes from explicit human corrections, not from automated pattern extraction. When a human edits a proposal before approving it, they are distilling their judgment into a format the agent can use. The edited version is almost always better than the raw extraction. This is why the approval UI supports editing -- not just approve or reject, but approve-with-modifications.

**Versioning Saves You.** The append-only version history has saved us multiple times. In one case, an approved pattern caused the agent to skip a validation step that it had previously performed correctly. Because we could see exactly when the pattern was introduced and what the agent's context looked like before and after, we diagnosed the issue in minutes and rolled back to the previous version. Without versioning, we would have been debugging blind.

[Try: View Agent Profiles](/settings)

## The Trajectory of Intelligence

This chapter has been about two specific technical systems -- learned context and episodic memory in Stagent. But the principle extends far beyond any single implementation. The question is not whether your agent is smart enough today. The question is whether your agent will be smarter tomorrow.

Feedback loops are the mechanism that converts experience into capability. Fine-tuning does this at the model level. RLHF does this at the alignment level. Stagent's learned context and episodic memory do this at the application level, at two different timescales -- behavioral learning through human-curated patterns, and knowledge accumulation through automatic extraction with confidence decay.

A system that learns from every interaction, even slowly, even imperfectly, will eventually outperform a system that does not. The compounding effect of thousands of small improvements -- a pattern here, a remembered fact there, an error resolution that saves five minutes on every future task -- creates a gap that raw model capability cannot close.

This is why we believe self-improvement is not an optional feature for AI-native applications. It is a defining characteristic. An application that uses AI but does not learn from its own use is an application with AI, not an AI-native application. The difference is the feedback loop.
