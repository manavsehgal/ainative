---
title: "Solo Founder Use Case"
category: "use-case"
lastUpdated: "2026-03-31"
---

# Solo Founder

You are one person running a business. You handle product, marketing, support, ops, and finance — often in the same afternoon. Stagent lets you deploy AI agents as your team, with the governance and cost controls a business requires.

## How Stagent Maps to Your Business

| Business Concept | Stagent Feature | What It Does |
|-----------------|----------------|--------------|
| Business units | **Projects** | Organize work by product line, client, or initiative. Each project scopes tasks, documents, and agent activity |
| Business processes | **Workflows** | Multi-step automations with 6 patterns — sequence, parallel, loop, planner-executor, checkpoint, swarm |
| AI team members | **Profiles** | 21 specialist agents (researcher, writer, code reviewer, DevOps, etc.) with consistent instructions and tool policies |
| Recurring ops | **Schedules** | Automated agent execution on intervals or cron — content publishing, report generation, monitoring sweeps |
| Business spend | **Cost & Usage** | Per-task, per-provider spend tracking with budget guardrails to prevent surprise bills |
| Oversight | **Inbox & Permissions** | Approve high-stakes actions, answer agent questions, and maintain an audit trail for every decision |

## Example Scenarios

### 1. Content Pipeline

**Goal:** Publish three blog posts per week without writing each one from scratch.

**Setup:**
- Create a "Content" project with your brand guidelines as a linked document
- Use the **document-writer** profile for drafting and the **researcher** profile for topic research
- Build a **sequence workflow**: Research trending topics → Draft outline → Write full post → Format for publishing

**Schedule:** Run the research step every Monday and Thursday at 9 AM. The workflow pauses at a checkpoint for your review before the agent publishes.

**Cost control:** Set a per-task budget of $2.00 to prevent runaway generation. The cost dashboard shows exactly how much each post costs to produce.

### 2. Lead Research

**Goal:** Build a qualified prospect list from public data every week.

**Setup:**
- Create a "Sales Pipeline" project
- Use the **researcher** profile with browser tools enabled for web research
- Build a **parallel workflow**: Fork into 3-5 industry verticals → Each branch researches companies and contacts → Join step synthesizes into a ranked list

**Schedule:** Run every Monday morning. Results land in the project as a document you can review and export.

**Governance:** The researcher profile has read-only tool permissions — it can browse and read, but cannot modify files or run shell commands. Browser automation requests route through the inbox for approval.

### 3. Support Triage

**Goal:** Classify incoming support emails and draft responses without manual sorting.

**Setup:**
- Create a "Customer Support" project
- Upload your FAQ and standard operating procedures as reference documents
- Use a custom **support-triage** profile that references these documents
- Build a **loop workflow**: The agent processes support items iteratively, classifying priority and drafting responses, until the queue is empty or it hits the iteration limit

**Schedule:** Run every 2 hours during business hours with an expiry at end of day. The agent draft responses wait in the inbox for your approval before sending.

**Audit trail:** Every classification decision and draft response is logged in the monitor, so you can review the agent's reasoning and correct patterns over time through the learned context loop.

## Getting Started

```bash
npx stagent
```

1. Create your first project for one of the scenarios above
2. Browse the profile gallery and assign a specialist to your first task
3. Run the task and approve tool requests from the inbox
4. Check the cost dashboard after a few runs to establish your baseline spend

See the [Personal Use Journey](../journeys/personal-use.md) for a step-by-step walkthrough, or [Why Stagent](../why-stagent.md) for the full platform overview.
