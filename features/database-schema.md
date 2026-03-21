---
title: Database Schema & Data Layer
status: completed
priority: P0
milestone: mvp
source: ideas/tech-stack-stagent.md
dependencies: []
---

# Database Schema & Data Layer

## Description

The local-first data layer using SQLite (better-sqlite3) with Drizzle ORM. This defines the core data model that all other features build on: projects, tasks, workflows, agent logs, and notifications.

The database lives at `~/.stagent/stagent.db` in WAL mode for concurrent access from multiple API routes. Drizzle ORM provides type-safe queries with a SQL-like API, and Drizzle Kit generates versioned SQL migration files that the CLI runs on every startup.

This feature establishes the data access pattern: a shared `db` instance exported from `src/lib/db/index.ts` that all server components and API routes import.

## User Story

As a developer building Stagent features, I want a type-safe, migration-based database layer so that I can reliably store and query projects, tasks, and agent activity without manual SQL.

## Technical Approach

- **Driver**: better-sqlite3 (synchronous, fast, no native addon build issues)
- **ORM**: drizzle-orm with `drizzle-orm/better-sqlite3` adapter
- **Location**: `~/.stagent/stagent.db` via `STAGENT_DATA_DIR` env var
- **Journal mode**: WAL (concurrent reads + single writer)
- **Foreign keys**: Enabled via pragma

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `projects` | Group related tasks | id, name, description, status |
| `tasks` | Individual work units assigned to agents | id, projectId, title, status, assignedAgent, priority, result |
| `workflows` | Multi-step workflow definitions | id, projectId, name, definition (JSON), status |
| `agent_logs` | Event stream from agent execution | id, taskId, agentType, event, payload (JSON), timestamp |
| `notifications` | Agent-to-human messages | id, taskId, type, title, body, read, createdAt |

### Task Status State Machine

```
planned → queued → running → completed
                           → failed
              → cancelled
```

### Data Access Pattern

```typescript
// src/lib/db/index.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dataDir = process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent");
const sqlite = new Database(join(dataDir, "stagent.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
```

### Drizzle Configuration

```typescript
// drizzle.config.ts
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: join(homedir(), ".stagent", "stagent.db") },
});
```

- **Next.js config**: Add `serverExternalPackages: ["better-sqlite3"]` to prevent bundling the native binary
- **ID generation**: Use `crypto.randomUUID()` for text primary keys
- **Timestamps**: Store as integer (Unix epoch) with `{ mode: "timestamp" }` for Drizzle Date mapping

## Acceptance Criteria

- [ ] Schema defines all 5 core tables (projects, tasks, workflows, agent_logs, notifications)
- [ ] All tables have proper foreign key relationships (tasks → projects, agent_logs → tasks, notifications → tasks)
- [ ] Drizzle Kit generates clean SQL migration files from schema
- [ ] `db` export from `src/lib/db/index.ts` is importable by any server component or API route
- [ ] WAL mode and foreign keys are enabled on every connection
- [ ] Task status enum matches the kanban state machine (planned, queued, running, completed, failed, cancelled)
- [ ] Notification type enum covers all agent-to-human message types

## Scope Boundaries

**Included:**
- Drizzle ORM schema definition (`src/lib/db/schema.ts`)
- Database connection module (`src/lib/db/index.ts`)
- Drizzle config file (`drizzle.config.ts`)
- Initial SQL migration file generation
- next.config.mjs `serverExternalPackages` setting

**Excluded:**
- Migration runner (that's in `cli-bootstrap`)
- Seed data / templates (deferred — can be added incrementally)
- PGlite / vector storage (post-MVP)
- Query helpers or repository patterns (features create their own queries)

## References

- Source: `ideas/tech-stack-stagent.md` — Database Layer section, Schema Design
- Source: `ideas/mvp-vision.md` — task states, notification types
- Related features: `cli-bootstrap` (runs migrations), `task-board` (queries tasks), `inbox-notifications` (queries notifications)
