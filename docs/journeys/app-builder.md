---
title: "App Builder Guide"
category: "user-journey"
persona: "app-builder"
difficulty: "beginner"
estimatedTime: "20 minutes"
sections: ["apps", "chat", "apps-detail", "user-guide"]
tags: ["beginner", "app-composition", "no-code", "starters", "kits", "chat-driven", "habit-tracker"]
lastUpdated: "2026-05-05"
---

# App Builder Guide

Meet Casey, a solo entrepreneur who wants a small, personal-use app to log a daily habit -- a Personal Habit Tracker. Casey has never used an AI business operating system before, has no patience for writing code, and wants the simplest path to a working app. Over the next 20 minutes, Casey will discover the Apps section in `ainative-business`, pick a starter from the showcase, hand off to chat to seed the primitives, and then use a kit-aware view to log today's run -- all without writing a single line of TypeScript or YAML by hand.

## Prerequisites

- `ainative-business` installed and running locally (`npm run dev`)
- A browser pointed at `http://localhost:3000`
- A small habit or workflow you want to track. We will use "log today's run" for a Personal Habit Tracker, but the same flow works for an expense ledger, a lead inbox, a research notebook, or any of the other starters

## Journey Steps

### Step 1: Discover the Apps Section

Casey opens `ainative-business` and notices a new sidebar entry called **Apps** under the **Home** group. The Apps page is the launchpad for composed apps -- bundles of agent profiles, workflow blueprints, tables, and schedules that work together as a single useful tool.

![Apps page with materialized apps grid plus starters showcase](../screengrabs/apps-list.png)

1. Click **Apps** in the sidebar under the **Home** group
2. Scan the page -- the top section shows **materialized apps** (apps you have already installed) and the bottom section shows the **starters showcase** (templates you can pick from)
3. Notice that each starter card lists the kit it uses -- Tracker, Coach, Ledger, Inbox, Research, or Workflow Hub -- which determines the layout you will see once the app is composed

> **Tip:** Apps are not new code. They are *compositions* of existing primitives -- profiles, blueprints, tables, schedules. The starters showcase is the easiest entry point because every starter is one click away from a working app.

### Step 2: Browse the Starters Showcase

Casey scrolls through the starters showcase and reads the descriptions to pick one that matches the habit-tracking goal.

![Apps page focused on the starters showcase grid](../screengrabs/journey-app-builder-overview.png)

![Closer view of the starters grid showing all six kits side by side](../screengrabs/apps-starters-grid.png)

1. Read each starter card -- the title, kit name, and one-line description
2. Find **Personal Habit Tracker** -- a Tracker-kit starter built around a daily-cadence schedule and a habit-log table
3. Compare it to **Portfolio Coach** (Coach kit, weekly cadence) and **Expense Ledger** (Ledger kit, transaction-table hero) to confirm the Tracker kit is the right fit for daily logging

> **Tip:** Starters are intentionally narrow -- they each pick one realistic personal-use scenario. Once you build one, you can always create a second app with a different kit. There is no limit on how many composed apps live in your workspace.

### Step 3: Click the Starter to Hand Off to Chat

Casey clicks the **Personal Habit Tracker** starter card. Instead of installing immediately, `ainative-business` opens a chat conversation pre-seeded with the starter's prompt -- this is where the actual primitives get materialized.

![Intermediate hand-off state — the starter card click transitioning into a new chat conversation](../screengrabs/apps-starter-to-chat.png)

![Chat seeded with a starter prompt for the Personal Habit Tracker app](../screengrabs/journey-app-builder-starter-handoff.png)

1. Click the **Personal Habit Tracker** starter card on the Apps page
2. Notice the chat opens with a pre-filled prompt explaining what should be installed -- a profile, a blueprint, a habit-log table, and a daily schedule
3. Read the seeded prompt to confirm it matches what you want -- you can edit it before sending if you want a different table column or schedule cadence
4. Press **Enter** to send the prompt to the chat agent

> **Tip:** The starter handoff is an authoring flow, not a one-click install. The prompt is intentionally editable so you can tweak the composition (e.g., "make the cadence weekly instead of daily") before any primitives are written to disk.

### Step 4: Watch the App Materialize

The chat agent reads the seeded prompt and uses the app-composition tools to write a manifest, register the profile, instantiate the blueprint, and seed the table. The user sees a **materialized-app card** in the chat once everything is in place.

1. Wait for the chat agent to finish -- it typically runs in 5-15 seconds
2. Look for a **materialized-app card** in the assistant turn -- it lists the primitives that were created (1 profile, 1 blueprint, 1 table, 1 schedule)
3. Click the **Open app** action on the card to navigate to the new app's detail page

> **Tip:** If the chat agent asks a clarifying question -- e.g., "Should the table track minutes or distance?" -- answer in the same conversation. The agent will incorporate your answer into the manifest before materializing.

### Step 5: Open the Composed App's Detail Page

Casey clicks **Open app** and lands on the new app's detail page at `/apps/[id]`. This is the kit-aware view -- the layout is determined by the Tracker kit the starter used.

![Composed app detail with Tracker-kit layout, daily cadence, KPIs, and habit-log table](../screengrabs/journey-app-builder-detail.png)

1. Notice the page title at the top -- it is the name from the manifest (e.g., "Personal Habit Tracker")
2. Scan the **kit hero** -- for the Tracker kit, this is the habit-log table with row-add affordances
3. Review the **cadence chip** -- it shows the schedule firing pattern ("Daily at 09:00 ET") and links to the Schedules page
4. Read the **KPI tiles** -- they summarize the habit-log table (e.g., "Logs this week", "Streak", "Last log")

> **Tip:** Each kit picks a different visual hero. The Tracker kit leads with the table; the Coach kit leads with the agent profile + run history; the Ledger kit leads with transaction totals. The kit reflects the *intent* of the app, not just its data shape.

### Step 6: Log Your First Habit Entry

Casey is ready to actually use the app -- log today's run.

1. Click **Add row** on the habit-log table hero
2. Fill in the row -- e.g., date = today, activity = "Run", duration_minutes = 30, notes = "Felt good"
3. Save the row -- the table refreshes and the KPI tiles update (streak goes from 0 to 1, last log shows "today")

> **Tip:** The table behaves like any other `ainative-business` table -- inline edit, bulk select, sort, filter. The composed-app shell does not hide any data; it just frames the same table data with a kit-specific layout.

### Step 7: Customize the Layout via Chat

Casey decides the KPI tiles should also show "Total minutes this month". Instead of editing YAML, Casey asks chat to update the view.

1. Open chat and find the conversation where the app was composed (the seeded-prompt conversation)
2. Type: *"Add a KPI tile for total minutes this month"*
3. Wait for the agent to respond with an **AppViewEditorCard** showing the proposed KPI binding
4. Click **Apply** on the card
5. Navigate back to the Apps detail page and refresh -- the new KPI tile appears next to the existing ones

> **Tip:** All of an app's view properties -- kit choice, KPI bindings, table columns shown -- can be edited via chat using the `set_app_view_kit`, `set_app_view_bindings`, and `set_app_view_kpis` tools. You never need to hand-edit the manifest YAML at `~/.ainative/apps/[id]/manifest.yaml`.

### Step 8: Explore Alternative Kits

Casey is curious what the other kits look like. Building a second app with a different kit is the fastest way to see the differences. Below is a quick tour of all six kits side-by-side.

![Tracker kit -- table hero, daily cadence, and KPI tiles (same family as the Personal Habit Tracker)](../screengrabs/apps-detail-tracker.png)

The **Tracker kit** is what Casey just built — a data-table hero with a daily-cadence schedule and KPI tiles summarizing the table. Best for habit logs, daily check-ins, or any "log a row per day" pattern.

![Coach kit -- profile-led with weekly cadence and run history](../screengrabs/apps-detail-coach.png)

The **Coach kit** leads with the agent profile and weekly cadence -- well suited to portfolio coaches, study coaches, or any role-driven app where the agent narrative matters more than the table.

![Ledger kit -- transactions table and MTD income/spend KPIs](../screengrabs/apps-detail-ledger.png)

The **Ledger kit** leads with transactions and money-shaped KPIs (MTD income, MTD spend, net) -- perfect for expense logs, invoice trackers, or any app where amounts add up.

![Inbox kit -- leads triage with row-insert blueprint trigger](../screengrabs/apps-detail-inbox.png)

The **Inbox kit** leads with a triage table that fires a workflow blueprint on row-insert. Designed for lead inboxes, support queues, and any "items arrive, then get processed" flow.

![Research kit -- multi-blueprint research workspace and run timeline](../screengrabs/apps-detail-research.png)

The **Research kit** leads with multiple research blueprints and a run timeline. Built for research notebooks where each topic spawns a workflow run that adds rows to a notes table.

![Workflow Hub kit -- 4 blueprints with last-run summaries](../screengrabs/apps-detail-workflow-hub.png)

The **Workflow Hub kit** leads with multiple workflow blueprints and their last-run summaries -- the right shape when an app's value is "run these jobs on demand" rather than "store these rows".

1. Return to the Apps page and click a different starter (e.g., **Portfolio Coach** for the Coach kit)
2. Repeat steps 3-5 -- seed the prompt in chat, materialize, open the detail page
3. Compare the two apps side-by-side in the materialized-apps grid

> **Tip:** The 6 starter kits are: **Tracker** (table-led), **Coach** (profile-led), **Ledger** (money-led), **Inbox** (triage-led), **Research** (multi-blueprint research workspace), **Workflow Hub** (multi-blueprint job runner). One starter exists for each kit so the showcase is a complete tour.

### Step 9: Use the App as Your Daily Launchpad

Now that the Personal Habit Tracker is composed, Casey can return to it any day from the Apps page.

1. Open `ainative-business` -- the home page sidebar shows **Apps** in the Home group
2. Click **Apps** -- the materialized-apps grid lists Personal Habit Tracker at the top
3. Click the app card to jump straight to the kit-aware view
4. Add today's row, check the streak KPI, and you are done -- 30 seconds, no chat required for routine logging

> **Tip:** Use the materialized-apps grid as your "small workspace" for narrow personal-use cases. The full `ainative-business` workspace (Tasks, Workflows, Profiles, Documents) is still there for deeper work, but the Apps page becomes the front door for a focused, recurring habit.

### Step 10: Share or Iterate from the Manifest

When the app is working well, the manifest at `~/.ainative/apps/[id]/manifest.yaml` is the portable record of the composition. Casey can copy it, version-control it, or share it with a friend who can install it as a custom starter.

1. From the app detail page, look for the **manifest** affordance (or open the file directly via your editor)
2. Read the YAML -- it lists the profile slug, blueprint slug, table id, schedule cadence, and the view bindings
3. To iterate, ask chat for a change -- e.g., *"Add a notes column to the habit log"* -- and the chat agent will rewrite the manifest atomically

> **Tip:** Manifests are tiny -- typically 30-60 lines -- and they reference *existing* primitives by slug. They do not contain code. This is the "config-over-code" contract that makes composed apps portable: anyone with the same set of profiles and blueprints registered can install your manifest and get the same app.

## What's Next

- [Personal Use Guide](./personal-use.md) — broader workspace tour for solo users (chat, tasks, projects, schedules)
- [Power User Guide](./power-user.md) — once the starters showcase feels limiting, learn to author custom profiles and blueprints
- [Apps Feature Reference](../features/apps.md) — kit catalog, manifest schema, and chat-tool reference
- [Chat Feature Reference](../features/chat.md) — the chat surface where app composition and view-editing happen
