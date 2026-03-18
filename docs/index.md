---
title: "Stagent Documentation"
category: "index"
lastUpdated: "2026-03-18"
---

# Stagent Documentation

Stagent is a governed AI agent workspace where every run is visible, every profile is reusable, and every approval is auditable. Run it locally with `npx stagent` and own your data from day one.

## Getting Started

- [Quick Start Guide](./getting-started.md) — install, configure, and run your first task

## User Journeys

| Guide | Difficulty | Time | Description |
|-------|-----------|------|-------------|
| [Personal Use](./journeys/personal-use.md) | Beginner | ~20 min | Solo productivity: create project, add tasks, track progress |
| [Work Use](./journeys/work-use.md) | Intermediate | ~24 min | Team context: organize projects, manage documents, schedule automations, track costs |
| [Power User](./journeys/power-user.md) | Advanced | ~24 min | Advanced: custom profiles, build workflows, autonomous loops, monitor execution |
| [Developer](./journeys/developer.md) | Advanced | ~20 min | Technical: CLI setup, auth config, provider runtimes, extending profiles |

## Feature Reference

### Core

| Section | Route | Key Capabilities |
|---------|-------|-----------------|
| [Home Workspace](./features/home-workspace.md) | `/` | Workspace briefing, active work, pending reviews, live activity, micro-visualizations |
| [Dashboard & Kanban](./features/dashboard-kanban.md) | `/dashboard` | Task board, AI assist, inline editing, bulk operations, workflow creation |
| [Inbox & Approvals](./features/inbox-notifications.md) | `/inbox` | Tool approval, agent questions, batch proposals, ambient toasts |
| [Monitoring](./features/monitoring.md) | `/monitor` | Live log streaming, event filters, task navigation |
| [Projects](./features/projects.md) | `/projects` | Portfolio organization, working directories, task scoping |

### Operations

| Section | Route | Key Capabilities |
|---------|-------|-----------------|
| [Workflows](./features/workflows.md) | `/workflows` | 6 orchestration patterns, blueprints, step retry, parallel + swarm |
| [Documents](./features/documents.md) | `/documents` | Upload, preview, text extraction, agent context injection |
| [Agent Profiles](./features/profiles.md) | `/profiles` | 13+ specialist profiles, catalog, testing, learned context |
| [Schedules](./features/schedules.md) | `/schedules` | Cron + human-friendly intervals, one-shot, recurring, pause/resume |
| [Cost & Usage](./features/cost-usage.md) | `/costs` | Token metering, spend tracking, budgets, provider breakdowns |
| [Settings](./features/settings.md) | `/settings` | Authentication, permissions, presets, data management |

### Cross-Cutting

| Section | Scope | Key Capabilities |
|---------|-------|-----------------|
| [Provider Runtimes](./features/provider-runtimes.md) | All execution | Claude Code + OpenAI Codex shared registry, runtime selection |
| [Agent Intelligence](./features/agent-intelligence.md) | AI features | Multi-agent routing, AI assist, autonomous loops, swarms, self-improvement |
| [Tool Permissions](./features/tool-permissions.md) | Governance | Always Allow patterns, layered presets, ambient approvals |
