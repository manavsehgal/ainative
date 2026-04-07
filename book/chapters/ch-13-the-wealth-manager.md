---
title: "The Wealth Manager"
subtitle: "When a Solo Founder Builds a Domain Application in a Day Using the Machine That Built Itself"
chapter: 13
part: 4
readingTime: 16
lastGeneratedBy: "2026-04-07T00:00:00.000Z"
relatedDocs: ["workflows", "profiles", "schedules", "prediction-markets"]
---

## The One-Day Build

On April 6, 2026, a single developer sat down with Stagent and built a wealth management application. Not a mockup. Not a wireframe. A working application with a portfolio dashboard, positions table, transaction history, watchlist, alerts engine, tax center, and reports feed — 7 pages, 7 components, a full data layer reading from Stagent's own tables — in a single session. The commit message is terse: "feat: add Wealth Manager app (Phase 1-4)." The diff is not: 2,181 lines of insertion across 17 files.

Then, without pausing, the same developer and the same system added prediction market integration — connecting Polymarket's real-money-backed probability data to portfolio decisions. Six features shipped in rapid sequence: a prediction markets data layer, a price monitor extension, a macro signals dashboard, a prediction-enhanced rebalance analyzer, a news/prediction divergence detector, and a scenario modeler with market-priced probabilities. By the end of the day: 7,435 lines of new code across 44 files. A domain application that a fintech startup might spend months building.

The developer was the founder of Stagent. The system used to build it was Stagent itself. And the application was not a demo — it was a working extension of the platform, reading from the same database, using the same workflow engine, governed by the same approval gates. The machine that builds machines had built something new, and the something new was a proof of concept for what any solo founder could build by shaping Stagent around their own domain.

This is the chapter about what happens when the self-building property described in Chapter 11 meets a concrete domain. Not in theory. In git history.

## Why Wealth Management

The choice of domain was not arbitrary. It was strategic for three reasons.

**First, wealth management is a coordination problem.** A portfolio is not a static thing. It is a system of positions, alerts, transactions, tax events, benchmarks, and market signals that interact continuously. The work is not "analyze this stock" — it is "monitor 20 positions against their targets, track wash sale windows, fire alerts when thresholds cross, check prediction markets for forward-looking signals, synthesize everything into actionable recommendations." This is exactly the kind of multi-step, multi-source, time-sensitive orchestration that Stagent's workflow engine was designed to handle.

**Second, prediction markets are a uniquely valuable signal layer.** Polymarket's public APIs provide something that no other data source offers: real-money-backed probabilities on macro events. When traders put dollars behind a 68% probability of a Fed rate cut, that number carries more information than any analyst's opinion. It is a price signal, not a sentiment signal. Integrating it into portfolio decisions is the kind of enhancement that separates a sophisticated wealth management tool from a spreadsheet with charts.

**Third, every knowledge worker has a domain.** The wealth manager is one instance of a universal pattern: a solo operator who knows their domain deeply but needs a system that can orchestrate the dozens of interlocking tasks that domain requires. A litigation attorney tracking case deadlines, discovery documents, and judge-specific precedents. A real estate investor monitoring property values, lease expirations, cap rates, and zoning changes. A supply chain manager watching inventory levels, supplier lead times, tariff probabilities, and logistics costs. The wealth manager is the case study. The pattern applies everywhere.

> [!case-study]
> **The Solo Operator Pattern** — Carta data shows solo-founded startups increased from 23.7% (2019) to 36.3% (H1 2025) of all new ventures. Dario Amodei estimates 70-80% odds of one-person billion-dollar companies emerging in 2026. These founders do not need a bigger team. They need a system that multiplies the intelligence they already possess across every function of their business.

## The Git Log as Narrative

The commit history tells a story that no product roadmap could have predicted. It is worth reading as a sequence of decisions, because the decisions reveal how a solo builder works with an AI-native system.

**Commit #1 — The Foundation**
```
feat: add Wealth Manager app (Phase 1-4)
Data layer, 7 pages, 7 components, sidebar integration.
Reads from Stagent tables (positions, transactions, watchlist,
alerts, wash_sales, portfolio_snapshots, alert_history).

17 files changed, 2,181 insertions(+)
```

Notice what this commit does not do. It does not create a new database. It does not build a separate backend. It reads from Stagent's existing tables. The positions, transactions, watchlist items, and alerts are all stored in `userTables` — the same structured data tables that any Stagent project uses. The wealth manager is not a separate application bolted onto Stagent. It is a view layer over Stagent's own data model.

This is the critical insight. The wealth manager did not require new infrastructure. It required a new interpretation of existing infrastructure. The `userTables` and `userTableRows` tables that Chapter 10 describes as the world model's structured data layer are the same tables that hold the portfolio. The `documents` table that stores workflow outputs stores the rebalance reports. The `alert_history` table that tracks any Stagent alert tracks prediction market shifts.

**Commits #2-3 — Dashboard Density**
```
refactor: redesign dashboard bento grid for denser above-the-fold layout
refactor: inline wealth-manager quick links into bento grid
```

These are design refinements — the builder looking at the dashboard and deciding it needs more information visible without scrolling. A bento grid replaces the two-column layout. Quick links move from a full-width section into compact chips. The AlertsPanel converts from card grid to dense table. This is the kind of micro-iteration that happens when the builder is also the user. The feedback loop is zero-latency: build it, look at it, fix it, commit.

**Commit #4 — The Specification**
```
docs: add wealth-manager screengrabs and prediction-markets spec
8 files changed, 721 insertions(+)
```

Here the builder pauses and writes. Not code — a specification. The prediction-markets feature spec is 722 lines of detailed design: six features (A through F), each with acceptance criteria, API integration details, data models, and UI wireframes. This is Karpathy's `program.md` pattern from Chapter 11, applied to a domain application. The builder designs the arena. The machine explores it.

The spec itself is a document worth studying. Feature A defines the prediction markets data table. Feature B extends the existing price monitor schedule. Feature C designs the macro signals dashboard. Feature D enhances the rebalance analyzer with prediction-weighted urgency. Feature E creates divergence detection between news sentiment and prediction probabilities. Feature F replaces arbitrary scenario assumptions with market-priced probabilities.

Each feature builds on the previous ones. A is the foundation, B adds live data, C-F are independent branches that all depend on A+B. This is a planner-executor structure — the same workflow pattern described in Chapter 5 — applied to the human's own development process.

**Commits #5-10 — The Build Sprint**

Six features ship in six commits:

| Commit | Feature | Files | Lines |
|--------|---------|-------|-------|
| #5 | Macro Signals + Price Monitor (B+C) | 4 | +527 |
| #6 | Rebalance Analyzer (D) | 4 | +599 |
| #7 | Divergence Detection (E) | 6 | +777 |
| #8 | Scenario Modeler (F) | 4 | +839 |
| #9 | Build fix + navigation | 3 | +42 |
| #10 | Daily Conviction Brief | 4 | +894 |

The last commit — the Daily Conviction Brief — is worth dwelling on. It was not in the original specification. It emerged because, after building features B through F, the builder realized something was missing: a synthesis layer. The individual features produced signals — probability shifts, divergence alerts, rebalance recommendations, scenario outcomes. But no single view brought them all together into an actionable morning brief.

So the builder designed one. The Conviction Brief synthesizes portfolio drift, prediction market signals, scenario analysis, and divergence detection into BUY/SELL/HOLD recommendations with confidence scoring, dollar-amount trade sizing, and per-position rationale. It classifies the market regime (risk-on, risk-off, rotation) by reading Polymarket probabilities. It scores position confidence 0-100 based on multiple signal sources.

This is the emergent roadmap in action — the pattern described in Chapter 12. The failure signal was not a crash or an error. It was the builder looking at six working features and realizing they needed a seventh to be useful together. The roadmap item emerged from using the system, not from planning the system.

## The Architecture of Composition

What makes this build remarkable is not the speed. It is the architecture. Every piece of the wealth manager is composed from existing Stagent primitives.

**Data Layer → Stagent Tables.** The portfolio data lives in `userTables` and `userTableRows`. The wealth manager's `data.ts` — 1,755 lines by the final commit — is a query layer that reads from and writes to the same tables that any Stagent project uses. Positions, transactions, watchlist items, alerts, wash sales, portfolio snapshots, prediction markets — all are rows in user-created tables. The functions — `getPositions()`, `getAlerts()`, `getPredictionMarkets()`, `computePortfolioSummary()`, `computeDailyConviction()` — are typed accessors over this shared data model.

```typescript
// The wealth manager reads from the same tables as any Stagent project
import { db } from "@/lib/db";
import { userTables, userTableRows, documents } from "@/lib/db/schema";

// Positions, predictions, alerts — all live in Stagent's structured data tables
export async function getPositions(): Promise<Position[]> { ... }
export async function getPredictionMarkets(): Promise<PredictionMarket[]> { ... }
export async function computeDailyConviction(): Promise<DailyConviction> { ... }

// The conviction engine reads predictions, drift, divergences, and scenarios
// It synthesizes them into BUY/SELL/HOLD with confidence and trade sizing
export function computePositionConfidence(
  position: Position,
  drift: DriftResult,
  predictions: PredictionMarket[],
  divergences: DivergenceAlert[]
): number { ... }
```

**Schedules → Stagent Scheduler.** The price monitor runs every 30 minutes during market hours. The news sentinel runs every 2 hours. These are Stagent schedules — the same heartbeat system described in Chapter 6 — configured with domain-specific prompts. The prediction market data stays fresh because the same scheduling infrastructure that fires any Stagent recurring task fires the Polymarket API fetcher.

**Workflows → Stagent Workflow Engine.** The rebalance analyzer is a planner-executor workflow. The scenario modeler is a planner-executor with checkpoint. The divergence detector extends the news deep-dive workflow. These are not new workflow engines. They are new workflow definitions running on the existing engine described in Chapter 5.

**Agents → Stagent Profiles.** The wealth-manager agent profile defines the system prompt, tool permissions, and behavioral constraints for financial analysis tasks. It allows WebSearch, WebFetch, and Read. It auto-denies Bash, Write, and Edit. It always ends with a financial disclaimer. This profile slots into the same registry that holds the general, code-reviewer, researcher, and document-writer profiles.

**UI → Stagent Components.** The dashboard uses `PageShell`, the same layout wrapper as every other Stagent page. The components use shadcn/ui. The routing is Next.js App Router. The data fetching is server-side with Suspense boundaries. Nothing about the UI infrastructure is wealth-manager-specific.

The wealth manager is a composition, not a construction. It is assembled from the same parts that Stagent uses for everything else. The only new things are the domain logic — how to compute drift, how to score divergences, how to size trades — and the UI components that display the results. The infrastructure is borrowed whole.

This is what Chapter 11's self-building property looks like in practice. The factory does not need a new wing. It needs a new product on the existing assembly line.

## Prediction Markets as World Model

Chapter 10 introduced the concept of the world model — the database of everything the organization knows, queryable by agents, updated continuously. The wealth manager extends this concept with a specific and powerful data source: prediction markets.

Polymarket's APIs provide three things that no other data source offers:

**Real-money probabilities.** When a market says "Fed rate cut in June: 68%," that number is backed by traders who have wagered real dollars. It is not a poll, not a forecast, not an opinion. It is a price, and prices aggregate information more efficiently than any other known mechanism. The wealth manager reads these prices and uses them as probability inputs for scenario analysis, rebalance urgency, and divergence detection.

**Continuous updating.** Prices change in real time as new information arrives. The price monitor schedule fetches updated probabilities every 30 minutes during market hours, storing both the current probability and the 24-hour change. A 10+ percentage-point swing in a single day generates a `prediction_shift` alert. The world model does not go stale.

**Cross-domain linkage.** Each prediction market is linked to portfolio symbols and categories. The market "Will the Fed cut rates in June?" links to all positions (macro affects everything). The market "Oil >$80/barrel?" links to XOM, CVX, XLE (energy category). The market "Defense spending increase?" links to XAR, LMT, RTX, GD (defense category). These linkages allow agents to reason about how macro events affect specific positions.

The prediction-weighted urgency model in the rebalance analyzer demonstrates this. When a category is overweight in the portfolio and the linked prediction market is bullish (>65% probability), the rebalance urgency decreases — the market expects the overweight position to appreciate, so trimming is less urgent. When the linked market is bearish (<35%), urgency increases. The agent is not guessing. It is incorporating the market's collective probability estimate into its recommendation.

The divergence detector takes this further. It compares news sentiment with prediction market direction. When news is bearish on a symbol but the prediction market probability for a related event is rising, that is a bullish divergence — smart money buying despite negative headlines. When news is bullish but prediction probability is falling, that is a bearish divergence. These divergences are among the most actionable signals in finance, and they emerge naturally from the intersection of two data sources that the wealth manager brings together.

This is the world model doing what world models do: connecting information from different sources into a coherent picture that agents can reason about. The prediction markets table is not a standalone feature. It is a new dimension in the world model that makes every other feature — rebalancing, alerting, scenario analysis — more intelligent.

## The Conviction Brief: Synthesis as a Feature

The Daily Conviction Brief deserves its own section because it represents a pattern that will recur in every domain application built on Stagent.

The brief is a synthesis layer. It does not produce new data. It reads data from five other features — portfolio drift, prediction market signals, scenario analysis, divergence detection, and rebalance recommendations — and synthesizes them into a single narrative. The output is a morning note that a hedge fund CIO might write: market regime classification, capital flow summary, per-position BUY/SELL/HOLD recommendations with confidence scores and dollar-amount trade sizing.

```typescript
// The conviction engine is pure synthesis — no new data, only new intelligence
export function computeDailyConviction(
  positions: Position[],
  predictions: PredictionMarket[],
  drifts: DriftResult[],
  divergences: DivergenceAlert[],
  scenarios: ScenarioAnalysis
): DailyConviction {
  const regime = classifyMarketRegime(predictions);
  const convictions = positions.map(p => ({
    ...p,
    action: determineAction(p, drifts, predictions, divergences),
    confidence: computePositionConfidence(p, drifts, predictions, divergences),
    tradeSize: computeTradeSize(p, drifts, regime),
    rationale: synthesizeRationale(p, predictions, divergences, scenarios),
  }));
  return { regime, convictions, capitalFlowSummary: summarizeFlows(convictions) };
}
```

The pattern is: build individual signal generators, then build a synthesizer that reads all of them. The individual features are useful on their own — you can check the macro signals dashboard or the rebalance analyzer independently. But the synthesis layer multiplies their value by finding the narrative thread that connects them.

This pattern applies to every domain. A litigation attorney's synthesis layer would combine case timeline, discovery status, judge's ruling history, and opposing counsel's filing patterns into a daily strategy brief. A real estate investor's would combine property valuations, lease expirations, interest rate forecasts, and comparable sales into an acquisition priority list. The data sources change. The synthesis pattern does not.

## The Feedback Loop That Improved the Platform

The most important outcome of the wealth manager build was not the wealth manager. It was what the build revealed about Stagent itself.

During the build, the developer discovered that when multiple schedules — the price monitor (every 30 minutes) and the news sentinel (every 2 hours) — fired at the same minute, queue starvation could occur. The second schedule's task would wait for the next poll cycle, potentially 30+ minutes. This was not a hypothetical bug. It was a real problem discovered by a real user (who happened to be the developer) running real schedules.

The fix was substantial: schedule collision prevention with four phases. Phase 1: a drain loop that walks the queued task list after every firing completes, so collided schedules no longer wait. Phase 2: automatic staggering that offsets new schedules whose fire minutes land within 5 minutes of an existing active schedule. Phase 3: turn budget headers prepended to scheduled task descriptions, plus a prompt analyzer that warns about anti-patterns. Phase 4: firing metrics tracking with EMA of turns and auto-pause after 3 consecutive failures.

This fix was not specific to the wealth manager. It improved every Stagent user's scheduling experience. It was merged to main while the wealth manager stayed on its branch. The platform got better because a domain application stressed it in ways that no test suite had predicted.

```
Commit #11
feat: schedule collision prevention and turn budget optimization
9 files changed, 1,015 insertions(+), 10 deletions(-)
Tests: 19 new tests. Full suite 183/183 passing. tsc clean.
```

This is the feedback loop that makes self-building systems genuinely different from tools. A tool does what you ask and nothing else. A self-building system improves itself through use. The wealth manager was a domain application, but building it produced a platform improvement — schedule collision prevention — that benefits every user, every project, every schedule. The machine that builds machines was improved by the machine it built.

> [!case-study]
> **Cobus Greyling, "Eat Your Own AI"** — "The strongest signal an AI product works is internal dependency." The wealth manager build was not a dogfooding exercise planned by a product team. It was a founder building a tool they actually wanted. The schedule collision bug was discovered not by QA, but by a user whose portfolio alerts were arriving late. The fix shipped the same day. That is the velocity that internal dependency enables.

## The Numbers

Let us be concrete about what was built and how fast.

| Metric | Value |
|--------|-------|
| Total new code | 7,435 lines across 44 files |
| Time | 1 day (April 6, 2026) |
| Commits | 11 (including merge and fix commits) |
| New pages | 10 (/wealth-manager/* routes) |
| New components | 12 (dashboard, tables, charts, modelers) |
| Data layer functions | 30+ typed accessors and computation functions |
| Data types defined | 18 TypeScript interfaces |
| Prediction markets tracked | 15-20 curated from Polymarket |
| Alert types added | 3 (prediction_shift, prediction_divergence, prediction_threshold) |
| Workflow patterns used | planner-executor, checkpoint, sequence |
| Agent profiles used | wealth-manager, general, researcher |
| Platform bugs discovered and fixed | 1 major (schedule collision), merged to main |
| API integrations | 3 (Polymarket Gamma, CLOB, Data APIs) |

Every one of these numbers is verifiable in the git log. The commits are there. The files are there. The diff stats are there. This is not a case study constructed from interviews and projections. It is a case study derived from version control.

## What This Means for Solo Founders

The wealth manager is a proof of concept for a thesis: that solo founders can build sophisticated domain applications on Stagent's infrastructure in a fraction of the time it would take to build from scratch.

The thesis rests on three pillars:

**Pillar 1: The data model is already there.** Stagent's structured data tables can hold any domain's entities. Positions, transactions, alerts, prediction markets — these are all rows in tables, managed by the same table editor, queryable by the same agents, chartable by the same visualization system. A solo founder does not need to design a database schema. They need to define their domain's entities and populate the existing tables.

**Pillar 2: The orchestration is already there.** Schedules, workflows, and agent profiles handle the coordination layer. The wealth manager's price monitor is a schedule. The rebalance analyzer is a workflow. The conviction brief is a computation that agents can trigger. The solo founder does not need to build a scheduler, a workflow engine, or an agent runtime. They need to configure the existing ones for their domain.

**Pillar 3: The governance is already there.** Every wealth manager action runs through Stagent's approval gates. The rebalance workflow pauses at checkpoints for human review. The agent profile auto-denies dangerous tools. The cost metering tracks spend per workflow. The solo founder does not need to build a governance layer. They inherit one.

What the solo founder does need to build is the domain logic — the TypeScript functions that compute drift, score divergences, classify market regimes, and size trades. That is the irreducible core of domain expertise. It cannot be abstracted away because it IS the value. But it is a small surface area compared to the full stack: data persistence, scheduling, workflow orchestration, agent management, governance, UI infrastructure, deployment. Stagent handles the stack. The founder handles the domain.

The math works out. The wealth manager's 7,435 lines of new code produced a 10-page application with prediction market integration, divergence detection, scenario modeling, and conviction synthesis. Without Stagent's infrastructure, that same application would require: a database (Postgres or SQLite setup, schema migrations, query layer), a scheduler (cron infrastructure, queue management, failure handling), a workflow engine (step execution, state management, checkpoint logic), an agent runtime (LLM integration, tool calling, context management), a governance layer (approval flows, permission scoping, budget tracking), and a deployment target (server, hosting, build pipeline). Conservatively, that is 30,000-50,000 lines of infrastructure code before a single line of wealth management logic is written.

The ratio — 7,435 lines of domain code versus 30,000-50,000 lines of infrastructure — is the business case for building on a platform. It is the same ratio that made Shopify viable for e-commerce merchants, that made Stripe viable for payment integrators, that made Heroku viable for application developers. The platform absorbs the undifferentiated heavy lifting. The builder focuses on what makes their application unique.

## The Recursive Proof

Chapter 11 argued that Stagent builds itself using itself. The wealth manager is the next step in that argument: Stagent enables others to build on Stagent using Stagent.

The recursion has three levels:

**Level 1: Stagent builds its own documentation.** The book pipeline captures case studies, generates chapters, and monitors the codebase for staleness. This is the self-building property described in Chapter 11.

**Level 2: Stagent builds its own features.** The schedule collision prevention fix discovered during the wealth manager build was implemented using Stagent's own development workflow — agent-assisted coding, automated testing, documented with Technical Decision Records. The platform improved itself through use.

**Level 3: Stagent enables domain applications that stress-test and improve the platform.** The wealth manager is the first instance. Future instances — the litigation tracker, the real estate analyzer, the supply chain monitor — will discover their own edge cases, generate their own platform improvements, and prove Stagent's viability in their own domains.

Each level feeds the next. Domain applications discover platform gaps. Platform improvements enable better domain applications. Better domain applications attract more builders. More builders discover more gaps. The flywheel is not a marketing metaphor. It is an engineering reality, visible in the commit history.

This is the machine that builds machines, building a machine that builds a case for more machines. And unlike a marketing slide, every claim in this chapter has a commit in the history.
