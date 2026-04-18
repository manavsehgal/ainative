---
title: Agent Episodic Memory
status: completed
priority: P1
milestone: post-mvp
source: ideas/vision/ainative-OpenClaw-Companion-Research-Report.md
dependencies: [agent-self-improvement]
---

# Agent Episodic Memory

## Description

Add a persistent knowledge memory system where agents accumulate facts, preferences, and patterns over time — distinct from the existing behavioral `learned_context` system that evolves agent instructions. Episodic memory enables agents to remember what happened (knowledge), while learned context governs how they behave (instructions).

The existing `learned_context` table stores versioned instruction proposals that agents submit to improve their own behavior. An operator approves or rejects these proposals, and approved changes update the profile's system prompt. This is behavioral memory — the agent gets better at its job.

Episodic memory is knowledge memory — the marketing agent remembers which content topics performed well, the sales agent recalls lead preferences, the support agent builds institutional knowledge about recurring issues. Entries have confidence scores, relevance filtering, and decay mechanisms. Operators can review, edit, and delete memories — a governance feature that OpenClaw's MEMORY.md pattern lacks.

## User Story

As a solo founder, I want my AI agents to remember important facts from previous tasks (customer preferences, successful strategies, recurring issues) so that each interaction builds on past knowledge instead of starting from scratch.

## Technical Approach

### Schema: `agent_memory` Table

New table in `src/lib/db/schema.ts`:

```
agent_memory:
  id TEXT PRIMARY KEY              -- UUID
  profileId TEXT NOT NULL          -- Which agent profile owns this memory
  key TEXT NOT NULL                -- Semantic key (e.g., "customer:acme:preference")
  value TEXT NOT NULL              -- The remembered fact (natural language)
  category TEXT DEFAULT 'general'  -- fact | preference | pattern | outcome | context
  source TEXT                      -- Where this memory came from (task ID, conversation ID)
  confidence REAL DEFAULT 0.8     -- 0.0-1.0, decays over time unless reinforced
  accessCount INTEGER DEFAULT 0   -- How many times this memory was injected into a prompt
  lastAccessedAt INTEGER          -- Timestamp of last injection
  createdAt INTEGER NOT NULL      -- Timestamp
  updatedAt INTEGER NOT NULL      -- Timestamp
  expiresAt INTEGER               -- Optional TTL; memory auto-archived after this time
  status TEXT DEFAULT 'active'    -- active | archived | flagged
```

Add to bootstrap.ts and clear.ts (FK-safe: delete agent_memory before profiles if needed).

### Memory Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `fact` | Objective information learned from tasks | "Acme Corp uses Salesforce as their CRM" |
| `preference` | User or customer preferences observed | "Customer prefers weekly email over daily" |
| `pattern` | Recurring patterns detected across tasks | "Blog posts about case studies get 3x more engagement" |
| `outcome` | Results and effectiveness data | "Cold email campaign to manufacturing had 12% reply rate" |
| `context` | Background context for future tasks | "Q1 budget review happens first week of April" |

### Memory Extraction

After each task execution completes (in `src/lib/agents/claude-agent.ts` or direct runtime adapters):

1. **Extraction prompt**: Append a post-task system message asking the agent to identify memorable facts from the task's output. The prompt constrains output to a structured JSON array of memory entries.
2. **Deduplication**: Before inserting, check for existing memories with similar keys using fuzzy matching on the `key` field (Levenshtein distance or keyword overlap). If a near-duplicate exists, update the existing entry's value and bump confidence instead of creating a duplicate.
3. **Confidence assignment**: New memories start at 0.8. If the same fact is extracted from multiple tasks, confidence increases (capped at 1.0). If a memory contradicts new information, the old memory's confidence drops.
4. **Governance gate**: Memories in the `preference` and `outcome` categories that affect decision-making can optionally require operator approval before becoming active (controlled by a profile-level `memoryApprovalRequired` flag).

### Memory Injection

At the start of each agent run (in the context builder):

1. **Relevance filtering**: Select memories for this profile where `status = 'active'` and `confidence >= 0.5`, ordered by relevance score. Relevance = `confidence * recency_weight * access_frequency_weight`.
2. **Token budget**: Cap injected memories at a configurable token limit (default: 2000 tokens). Higher-relevance memories get priority.
3. **Injection format**: Memories are injected as a structured block in the system prompt:
   ```
   ## Agent Memory
   The following facts have been learned from previous tasks. Use them to inform your work:
   - [fact] Acme Corp uses Salesforce as their CRM (confidence: 0.9)
   - [preference] Customer prefers weekly email over daily (confidence: 0.8)
   - [pattern] Blog posts about case studies get 3x engagement (confidence: 0.85)
   ```
4. **Access tracking**: When memories are injected, increment `accessCount` and update `lastAccessedAt`.

### Memory Decay

A periodic maintenance job (piggyback on the scheduler's poll loop):

1. **Confidence decay**: Memories not accessed in 30 days lose 0.1 confidence per 30-day period.
2. **Archive threshold**: Memories with confidence below 0.3 are auto-archived (`status: 'archived'`).
3. **TTL expiry**: Memories with `expiresAt` in the past are archived.
4. **Operator override**: Operators can pin memories (set confidence to 1.0, clear expiresAt) to prevent decay.

### Operator Review UI

New section on the agent profile detail view:

1. **Memory browser**: List all memories for a profile, sortable by confidence, category, recency
2. **Memory detail**: View full value, source task link, access history
3. **Actions**: Edit value, change category, adjust confidence, pin (prevent decay), archive, delete
4. **Flagged memories**: Memories flagged by the governance gate appear in a review queue
5. **Bulk operations**: Select multiple memories for archive or delete

### API Surface

```
GET    /api/profiles/[id]/memories         -- List memories with filters (category, confidence, status)
POST   /api/profiles/[id]/memories         -- Manually add a memory
PATCH  /api/profiles/[id]/memories/[memId] -- Update memory (value, confidence, status)
DELETE /api/profiles/[id]/memories/[memId] -- Delete a memory
POST   /api/profiles/[id]/memories/bulk    -- Bulk archive/delete
```

### Integration with Existing Systems

- **Learned context**: Episodic memory complements learned context. If the memory system detects a pattern that should become a behavioral rule (e.g., "always check inventory before quoting"), it can suggest a learned context proposal. The two systems feed into each other but operate independently.
- **Cost metering**: Memory extraction adds a small overhead to each task (one additional LLM call). This is metered through the existing usage ledger.
- **Heartbeat scheduler**: When heartbeat-scheduler ships, heartbeat agents can reference their episodic memory to make better suppression decisions (e.g., "revenue alert — but I remember this pattern happens every month-end, suppress").

## Acceptance Criteria

- [ ] `agent_memory` table exists in schema, bootstrap, and clear.ts
- [ ] Memory extraction runs after task completion and produces structured entries
- [ ] Deduplication prevents near-duplicate memories (same key + similar value)
- [ ] Memory injection adds relevant memories to agent system prompt with token budget
- [ ] Confidence scoring: new memories start at 0.8, reinforced memories increase, contradicted memories decrease
- [ ] Memory decay: unused memories lose confidence over time, auto-archive below 0.3
- [ ] Operator review UI shows memory browser on profile detail view
- [ ] Operators can edit, pin, archive, and delete individual memories
- [ ] Flagged memories (preference/outcome categories with `memoryApprovalRequired`) require approval
- [ ] API endpoints for CRUD operations on memories
- [ ] Memory extraction cost is tracked in the usage ledger
- [ ] Existing learned context system is unaffected

## Scope Boundaries

**Included:**
- New `agent_memory` table and API
- Memory extraction after task completion
- Relevance-filtered injection into system prompt
- Confidence scoring, decay, and deduplication
- Operator review UI on profile detail view
- Memory categories (fact, preference, pattern, outcome, context)

**Excluded:**
- Cross-agent memory sharing (agent A reading agent B's memories) — future feature
- Vector/embedding-based semantic search over memories — use keyword matching for now
- Memory import/export to Markdown files — see workspace-git-export (deferred)
- MEMORY.md file format compatibility with OpenClaw — the SQLite-backed approach is more governed
- Memory visualization (graphs, timelines) — simple list view for now

## References

- Source: `ideas/vision/ainative-OpenClaw-Companion-Research-Report.md` — Section 3.5 (Agent Memory System)
- Existing learned context: `src/lib/agents/learned-context.ts` (versioned proposal flow)
- Existing schema: `src/lib/db/schema.ts` (learned_context table definition, lines 178-208)
- Related features: agent-self-improvement (behavioral memory), heartbeat-scheduler (uses memory for smarter suppression), business-function-profiles (memory enables business agents to learn over time)
