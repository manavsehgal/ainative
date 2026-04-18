---
title: Scheduled Prompt Loops
status: completed
priority: P2
milestone: post-mvp
source: ideas/claude-code-scheduled-tasks.md
dependencies:
  - workflow-engine
  - agent-integration
---

# Scheduled Prompt Loops

## Description

Time-based scheduling for agent tasks — run prompts on a recurring cron schedule, set one-time delayed executions, or poll for status changes at intervals. Inspired by Claude Code's `/loop` command and cron scheduling system.

Users define a prompt, pick an interval (or cron expression), and ainative executes the agent task on schedule. Each firing creates a child task, building a history of results. Schedules persist in the database (unlike Claude Code's session-scoped approach) so they survive server restarts.

This complements the existing autonomous-loop-execution feature: loops iterate on agent output (stop conditions, refinement), while scheduled prompts iterate on wall-clock time (cron, intervals, one-shot delays).

## User Story

As a user, I want to schedule agent tasks to run at specific times or intervals so that I can automate recurring work like status checks, periodic reports, deployment monitoring, and timed reminders.

## Technical Approach

### Data Model — `schedules` table

New table in `src/lib/db/schema.ts`:

| Column | Type | Purpose |
|--------|------|---------|
| id | text PK | UUID |
| projectId | text FK | Optional project association |
| name | text | Human-readable schedule name |
| prompt | text | The prompt to execute each firing |
| cronExpression | text | 5-field cron (minute hour dom month dow) |
| agentProfile | text | Optional agent profile for execution |
| recurs | integer (boolean) | true = recurring, false = one-shot |
| status | text enum | active, paused, completed, expired |
| maxFirings | integer | Optional cap (null = unlimited until paused) |
| firingCount | integer | How many times it has fired |
| expiresAt | integer (timestamp) | Optional auto-expiry |
| lastFiredAt | integer (timestamp) | Last execution time |
| nextFireAt | integer (timestamp) | Computed next fire time for efficient polling |
| createdAt | integer (timestamp) | |
| updatedAt | integer (timestamp) | |

### Scheduler Engine — `src/lib/schedules/scheduler.ts`

- **Poll-based scheduler**: Runs on a 60s interval checking for due schedules
- Query: `SELECT * FROM schedules WHERE status = 'active' AND nextFireAt <= now()`
- For each due schedule: create child task, fire-and-forget execute, update counters
- **Cron parsing**: Uses `cron-parser` npm package
- **Concurrency**: Only one firing per schedule at a time
- **Working directory**: Child tasks inherit the project's `workingDirectory` (if set via projectId), so schedules operate on the target codebase

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/schedules` | GET | List all schedules |
| `/api/schedules` | POST | Create a new schedule |
| `/api/schedules/[id]` | GET | Get schedule details + firing history |
| `/api/schedules/[id]` | PATCH | Pause, resume, or edit schedule |
| `/api/schedules/[id]` | DELETE | Delete schedule |

### Interval Parsing — `src/lib/schedules/interval-parser.ts`

Parse human-friendly intervals into cron expressions:
- `5m` → `*/5 * * * *`
- `2h` → `0 */2 * * *`
- `1d` → `0 9 * * *` (daily at 9am)
- Raw 5-field cron expressions accepted directly

### UI Components

| Component | Purpose |
|-----------|---------|
| `ScheduleCreateDialog` | Create schedule with interval picker and profile selector |
| `ScheduleList` | Card grid with status, next fire time, firing count |
| `ScheduleDetailView` | Firing history, pause/resume, delete |
| `ScheduleStatusBadge` | Badge using status-colors.ts pattern |

### App Route

- `/schedules` page with sidebar navigation (Clock icon)
- `/schedules/[id]` detail page with back navigation

### Scheduler Lifecycle

- Started via Next.js instrumentation hook (`src/instrumentation.ts`)
- Runs in-process using `setInterval` (no external cron daemon)
- Bootstraps `nextFireAt` for active schedules on startup

## Acceptance Criteria

- [x] Create a recurring schedule with a prompt and interval (e.g., "every 5 minutes")
- [x] Create a one-shot delayed schedule (recurs toggle off)
- [x] Cron expression input for advanced users (5-field standard cron)
- [x] Human-friendly interval parsing (5m, 2h, 1d)
- [x] Each firing creates a child task
- [x] Schedule list shows status, next fire time, and firing count
- [x] Firing history shows all past executions with results
- [x] Pause and resume a running schedule
- [x] Delete a schedule
- [x] Schedules persist across server restarts (database-backed)
- [x] Optional agent profile selection per schedule
- [x] Optional expiry time (auto-expire after N hours or N firings)
- [x] Scheduler skips firing if previous execution is still running
- [x] `/schedules` page with sidebar navigation

## Scope Boundaries

**Included:**
- Cron-based recurring schedules
- One-shot delayed execution
- Human-friendly interval parsing
- Database persistence (survives restarts)
- Firing history and child task tracking
- Pause/resume/delete lifecycle

**Excluded:**
- Natural language date parsing beyond simple intervals (post-MVP)
- Schedule chaining (use workflows instead)
- External webhook triggers (post-MVP)
- Distributed scheduling across multiple server instances
- Sub-minute precision (minimum granularity is 1 minute)

## References

- Inspiration: Claude Code Scheduled Tasks
- Related: `autonomous-loop-execution` (iteration-based loops, not time-based)
- Related: `workflow-engine` (multi-step workflows)
