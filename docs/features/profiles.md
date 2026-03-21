---
title: "Profiles"
category: "feature-reference"
section: "profiles"
route: "/profiles"
tags: [profiles, agents, routing, multi-agent, catalog, cross-provider]
features: ["agent-profile-catalog", "multi-agent-routing", "cross-provider-profile-compatibility"]
screengrabCount: 1
lastUpdated: "2026-03-21"
---

# Profiles

Browse and manage 21 specialized agent profiles that define how agents behave when executing tasks. Each profile encapsulates a distinct persona with tailored capabilities, system prompts, and behavioral constraints. Profiles work across providers (Claude and Codex), and the auto-detect router can automatically select the best-fit profile for any given task.

## Screenshots

![Agent profiles catalog showing profile cards](../screengrabs/profiles-list.png)
*The profiles catalog displays all 21 agent profiles as cards with name, description, and capability indicators.*

## Key Features

### Agent Profile Catalog
The catalog presents 21 specialized profiles organized as browsable cards: General, Code Reviewer, Data Analyst, DevOps Engineer, Document Writer, Researcher, Project Manager, QA Tester, Technical Writer, Wealth Manager, Health & Fitness Coach, Learning Coach, Travel Planner, Shopping Assistant, API Tester, Launch Copy Chief, Portfolio Review Coach, Pricing QA Analyst, Revenue Operations Analyst, and Sweep. Each card shows the profile name, a description of its specialization, and its core capabilities.

### Multi-Agent Routing
The task classifier analyzes incoming tasks and routes them to the most appropriate agent profile based on the task description, project context, and required capabilities. Auto-detect mode selects the best-fit profile automatically, while manual mode lets you choose a specific profile for any task.

### Cross-Provider Compatibility
Profiles are provider-agnostic and work with both Claude (via Agent SDK) and Codex (via App Server). The same profile definition produces consistent behavior regardless of which provider runtime executes the task, ensuring predictable results across your workspace.

### Profile Cards
Each profile card displays the agent's name, a concise description of its specialization, and the capabilities it brings to task execution. Cards are interactive with keyboard navigation and focus-visible rings following the Calm Ops design system.

## How To

### Browse Available Profiles
1. Navigate to `/profiles` from the sidebar under the **Manage** group.
2. Scroll through the catalog to see all 21 available agent profiles.
3. Read each card's description to understand what the profile specializes in.

### Assign a Profile to a Task
1. Open a task in the task detail or create a new task.
2. Locate the **Agent Profile** selector in the task form.
3. Choose a specific profile from the dropdown, or select **Auto-detect** to let the router choose.
4. Execute the task. The selected profile's system prompt and behavioral constraints will govern the agent's behavior.

### Use Auto-Detect Routing
1. When creating or editing a task, set the agent profile to **Auto-detect**.
2. The task classifier analyzes the task description and project context.
3. The best-fit profile is selected automatically when the task executes.
4. Check the agent logs to see which profile was selected and why.

## Related
- [Agent Intelligence](./agent-intelligence.md)
- [Settings](./settings.md)
- [Provider Runtimes](./provider-runtimes.md)
