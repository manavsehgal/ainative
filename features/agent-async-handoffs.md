---
title: Agent Async Handoffs
status: completed
priority: P2
milestone: post-mvp
source: ideas/vision/Stagent-OpenClaw-Companion-Research-Report.md
dependencies: [multi-agent-routing, heartbeat-scheduler]
---

# Agent Async Handoffs

## Description

Add asynchronous inter-agent communication where agents running on independent schedules or heartbeats can pass work to each other via a SQLite message bus. Unlike the existing multi-agent-swarm (synchronous coordination within a single workflow execution), handoffs enable decoupled coordination across independent agent lifecycles.

This enables the "AI Business Operating System" pattern: the marketing agent hands research to the content agent, which hands drafts to the review agent, with each running on their own heartbeat schedule. Work flows between agents like messages between team members — asynchronously, with governance gates for sensitive handoffs.

Inspired by OpenClaw's file-based handoff directories but implemented as a structured SQLite message bus with governance integration that file-based handoffs lack.

## User Story

As a solo founder, I want my marketing agent to automatically hand off research findings to my content agent for drafting, so that my AI team coordinates without me manually bridging every step.

## Technical Approach

### Schema: `agent_messages` Table

New table in `src/lib/db/schema.ts`:

```
agent_messages:
  id TEXT PRIMARY KEY                    -- UUID
  senderProfileId TEXT NOT NULL          -- Profile that sent the message
  senderTaskId TEXT                      -- Task that produced this message (nullable for direct sends)
  recipientProfileId TEXT NOT NULL       -- Target profile
  recipientTaskId TEXT                   -- Task that consumed this message (set on processing)
  messageType TEXT NOT NULL              -- 'handoff' | 'notification' | 'request' | 'response'
  subject TEXT NOT NULL                  -- Brief description of what's being handed off
  payload TEXT NOT NULL                  -- JSON: structured data + context for the recipient
  priority TEXT DEFAULT 'normal'         -- 'low' | 'normal' | 'high' | 'urgent'
  status TEXT DEFAULT 'pending'          -- 'pending' | 'approved' | 'processing' | 'completed' | 'rejected'
  requiresApproval INTEGER DEFAULT 0    -- 1 if this handoff needs human approval before processing
  approvedBy TEXT                        -- 'auto' or operator identifier
  approvedAt INTEGER                     -- Timestamp of approval
  createdAt INTEGER NOT NULL
  processedAt INTEGER                    -- When recipient agent picked up the message
  completedAt INTEGER                    -- When recipient agent finished processing
```

Add to bootstrap.ts and clear.ts (FK-safe order).

### Message Types

| Type | Flow | Example |
|------|------|---------|
| `handoff` | Agent A completes work → passes result to Agent B for next step | Marketing agent hands research to content creator |
| `notification` | Agent A surfaces information for Agent B's awareness | Financial analyst notifies operations of budget anomaly |
| `request` | Agent A asks Agent B to perform a specific action | Sales researcher requests content creator draft an outreach email |
| `response` | Agent B replies to Agent A's request with results | Content creator returns draft to sales researcher |

### Handoff Sending (Producer Side)

Extend the agent execution flow in `src/lib/agents/claude-agent.ts` and direct runtime adapters:

1. **Handoff tool**: Register a new tool `send_handoff` available to agents:
   ```
   send_handoff(recipientProfile, subject, payload, priority, requiresApproval)
   ```
   When an agent calls this tool during execution, it creates an `agent_messages` row.

2. **Automatic handoff detection**: After task completion, if the task output contains structured handoff markers (e.g., `[HANDOFF:content-creator] Draft this blog post based on the research above`), automatically create a handoff message.

3. **Workflow integration**: Workflow steps can declare handoff outputs in their blueprint definition:
   ```yaml
   steps:
     - name: Research
       profileId: sales-researcher
       handoffTo: content-creator    # Auto-send output as handoff
       handoffSubject: "Draft outreach based on research"
   ```

### Handoff Processing (Consumer Side)

Two processing modes:

**1. Heartbeat-triggered processing:**
When a heartbeat agent runs its checklist, it checks for pending messages in its inbox:
- Query: `SELECT * FROM agent_messages WHERE recipientProfileId = ? AND status IN ('pending', 'approved') ORDER BY priority DESC, createdAt ASC`
- If pending messages exist, include them in the heartbeat evaluation context
- The agent decides whether to process each message (same intelligence-driven pattern as heartbeat checklists)

**2. Immediate processing (optional):**
For urgent handoffs, the system can immediately create and execute a task for the recipient agent:
- `priority: 'urgent'` + `requiresApproval: 0` → auto-create task, execute immediately
- `priority: 'urgent'` + `requiresApproval: 1` → create notification in inbox, wait for approval

### Governance Integration

1. **Approval gates**: Handoffs marked `requiresApproval: 1` enter the inbox approval queue before the recipient can process them. This prevents unsupervised agent-to-agent action chains.
2. **Handoff policies**: Profile-level configuration for which profiles can send handoffs to this profile:
   ```yaml
   # In profile.yaml
   handoffPolicy:
     acceptFrom: [marketing-strategist, sales-researcher]  # Whitelist
     requireApprovalFrom: [financial-analyst]               # Accept but require approval
     blockFrom: []                                          # Deny list
   ```
3. **Cost attribution**: Handoff-triggered tasks attribute costs to the originating schedule/workflow, maintaining cost visibility across agent coordination chains.
4. **Chain depth limit**: Maximum handoff chain depth (default: 5) prevents infinite agent loops. If a handoff would exceed the depth limit, it's auto-flagged for human review.

### Kanban Board Integration

Surface inter-agent handoffs on the Kanban board:
- **Handoff badge**: Tasks created from handoffs display a "handoff" badge with the sender profile name
- **Connection lines**: Optional visual indicator showing which task produced the handoff (sender → recipient arrow)
- **Pending handoffs counter**: Show count of pending handoff messages on each profile's card/section

### API Surface

```
GET    /api/handoffs                        -- List all handoff messages (filterable by profile, status, type)
GET    /api/handoffs/[id]                   -- Get handoff detail
POST   /api/handoffs                        -- Manually create a handoff (operator-initiated)
PATCH  /api/handoffs/[id]                   -- Approve/reject a handoff
GET    /api/profiles/[id]/handoffs/inbox    -- Pending handoffs for a specific profile
GET    /api/profiles/[id]/handoffs/sent     -- Handoffs sent by a specific profile
```

## Acceptance Criteria

- [ ] `agent_messages` table exists in schema, bootstrap, and clear.ts
- [ ] Agents can send handoffs via `send_handoff` tool during execution
- [ ] Automatic handoff detection from structured output markers
- [ ] Workflow blueprints support `handoffTo` step configuration
- [ ] Heartbeat agents check their handoff inbox during each heartbeat evaluation
- [ ] Urgent handoffs can trigger immediate task creation
- [ ] Governance: `requiresApproval` handoffs enter inbox approval queue
- [ ] Handoff policies: `acceptFrom`, `requireApprovalFrom`, `blockFrom` in profile.yaml
- [ ] Chain depth limit prevents infinite handoff loops (default: 5)
- [ ] Cost attribution traces handoff-triggered costs to originating schedule/workflow
- [ ] Kanban board shows "handoff" badge on handoff-triggered tasks
- [ ] API endpoints for listing, creating, approving/rejecting handoffs
- [ ] Existing multi-agent-swarm and workflow coordination are unaffected

## Scope Boundaries

**Included:**
- `agent_messages` table and message bus
- send_handoff tool for agents
- Heartbeat-triggered and immediate handoff processing
- Governance gates (approval, policies, chain depth)
- Kanban board handoff badges
- API endpoints for handoff management

**Excluded:**
- Broadcast messages (one-to-many) — future extension
- Agent-to-agent negotiation protocols (request/counter-request) — future
- Cross-instance handoffs (between different Stagent installations) — requires cloud sync
- Handoff message editing after creation — immutable once sent
- Visual handoff chain explorer (graph view) — simple list/badge for now

## References

- Source: `ideas/vision/Stagent-OpenClaw-Companion-Research-Report.md` — Section 3.6 (Agent-to-Agent Communication via Handoffs)
- Existing multi-agent swarm: `src/lib/workflows/swarm.ts` (synchronous coordination)
- Existing multi-agent routing: `src/lib/agents/profiles/` (profile registry and routing)
- Related features: heartbeat-scheduler (handoffs consumed during heartbeats), multi-channel-delivery (handoff notifications), business-function-profiles (primary handoff senders/receivers)
