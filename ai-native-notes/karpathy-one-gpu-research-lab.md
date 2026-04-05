---
title: "Karpathy Just Turned One GPU Into a Research Lab"
source: https://garryslist.org/posts/karpathy-just-turned-one-gpu-into-a-research-lab-f55754a6
author: Garry Tan
date_published: 2026-03-08
date_captured: 2026-03-08
content_type: article
tags: [autoresearch, agentic-engineering, ralph-wiggum, gas-town, ai-agents, autonomous-research]
---

# Karpathy Just Turned One GPU Into a Research Lab

**By Garry Tan · Mar 08, 2026 · 7 min read**

---

Andrej Karpathy has open-sourced autoresearch, an AI agent that autonomously runs approximately 100 machine learning experiments on a single GPU overnight. The system requires no human intervention after initial setup—researchers simply write a Markdown file describing their research strategy, and the agent handles the rest.

## How It Works

The autoresearch system consists of three essential files. The prepare.py file handles one-time data preparation and remains unchanged. The train.py file contains the full GPT model, optimizer configuration, and training loop—approximately 630 lines of code that the AI agent freely modifies. The program.md file is where humans define the agent's research strategy.

The system operates within a fixed 5-minute wall-clock training budget per experiment. Regardless of architectural changes, optimizer modifications, or hyperparameter adjustments, each run receives exactly 5 minutes and is evaluated using validation bits per byte (val_bpb), a vocabulary-size-independent metric. This ensures fair comparison across different architectural variations.

This schedule produces roughly 12 experiments per hour, yielding approximately 100 overnight. The agent maintains work on a git feature branch, accumulating commits as it discovers improved settings for neural network architecture, optimizer choices, and hyperparameters.

## The Vision

Karpathy included a fictional prologue dated March 2026, noting that "frontier AI research used to be done by meat computers" but that "research is now entirely the domain of autonomous swarms of AI agents running across compute cluster megastructures." Written in past tense from a fictional future perspective, it functions as both joke and manifesto.

He continues operating a larger version on 8 H100 GPUs with production nanochat, where 276 experiments have been run with 29 kept improvements. His approach illustrates a pattern: design the arena, provide clear success metrics, and let AI iterate indefinitely.

## Evolution of Agentic Development

The progression reveals an accelerating trend in AI-assisted development:

**February 2025:** Karpathy tweets about "vibe coding," which subsequently appears on his Wikipedia page.

**February 8, 2026:** He proposes "agentic engineering," explaining that "you are not writing the code directly 99% of the time, you are orchestrating agents who do."

**March 7, 2026:** Autoresearch launches, where humans write specifications rather than orchestrating agents.

Each iteration removes another layer of human involvement from the development process.

## The Ralph Wiggum Technique

Geoffrey Huntley, an Australian developer, created what he calls the Ralph Wiggum technique. In its simplest form:

```bash
while :; do cat PROMPT.md | claude-code ; done
```

One engineer used this method to complete a $50,000 contract for $297 in API costs. A Y Combinator hackathon team ran Claude Code in a loop overnight and accumulated 1,000+ commits across six ported codebases. Huntley developed CURSED, a complete programming language with Gen Z slang keywords compiled to native binaries via LLVM, using the technique over three months.

Anthropic subsequently built an official Ralph Wiggum plugin for Claude Code with stop hooks, iteration limits, and structured completion conditions, transforming a bash hack into institutional tooling within a year.

## Gas Town: Multi-Agent Orchestration

Steve Yegge built Gas Town, a factory-like system featuring 20 to 30 agents working in parallel. Released January 1, 2026, it was built in 17 days with AI agents writing Go code. The system contains 75,000 lines of code across 2,000 commits and has accumulated 11,200 GitHub stars and 919 forks with 185 contributors.

The architecture mirrors Kubernetes: a Control Plane (Mayor and Deacon) manages a Data Plane (Polecats and Witnesses). While Kubernetes asks "is it running?", Gas Town asks "is it done?"

Users describe features in natural language. The Mayor breaks them into tasks. Polecats swarm the work. The Refinery resolves merge conflicts. Work survives crashes via git-backed hooks. The human becomes a Product Manager rather than a developer.

## The Arena as Product

The critical insight is that you cannot simply ask an agent to self-improve. Instead, you must design the arena and provide direction based on your understanding of the system. Karpathy designed a fixed 5-minute arena with a single metric. Huntley created a bash loop with specifications and backpressure. Yegge built an entire city of agents with defined roles, patrol patterns, and merge queues.

This represents constant gardening rather than prompt-and-forget approaches. Humans design the soil and climate; plants grow themselves, but require pruning.

## Current Landscape

Donald Knuth, a legendary computer scientist, reported that Claude Opus 4.6 solved a graph theory problem he had worked on for weeks in one hour through 31 LLM-guided explorations. He called it "a dramatic advance in automatic deduction and creative problem solving."

Approximately one-third of top technical CEOs are coding again. Many Y Combinator teams now have 95% of their code written by AI, with the strongest teams reaching $10 million in revenue with fewer than 10 people in under 18 months.

The cutting edge is at recursive self-improvement. Most developers remain skeptical of vibe coding for production. The gap between frontier and mainstream development has never been wider and continues accelerating monthly.

## Conclusion

Every founder has access to a GPU and a weekend. The winning companies will not have the most engineers or compute—they will have agents that never stop running. Success belongs to those with the best program.md.

---

# Related Links: Detailed Content

## Karpathy's autoresearch — GitHub README

**Source:** https://github.com/karpathy/autoresearch

"Give an AI agent a small but real LLM training setup and let it experiment autonomously overnight."

The system implements a simplified single-GPU version of nanochat. Rather than manually editing Python files, researchers program `program.md` Markdown files that instruct AI agents.

### Core Components

1. **prepare.py** — Constants, initial data preparation, and runtime utilities (unchanged by agents)
2. **train.py** — Complete GPT model, optimizer logic, and training loop (agent-modified)
3. **program.md** — Agent instructions and research guidelines (human-modified)

### Setup

Requirements: Single NVIDIA GPU (H100 tested), Python 3.10+, uv package manager

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync
uv run prepare.py   # One-time (~2 min)
uv run train.py     # Single experiment (~5 min)
```

### Design Principles

- **Single modification point:** Agents only edit `train.py`, maintaining reviewable diffs
- **Platform-optimized training:** Fixed time budget discovers optimal models for available compute
- **Minimal dependencies:** PyTorch-only with self-contained implementation; no distributed training infrastructure

CPU and Apple Metal support forks: miolini/autoresearch-macos, trevin-creator/autoresearch-mlx. License: MIT.

---

## The Ralph Wiggum Technique — Geoffrey Huntley

**Source:** https://ghuntley.com/ralph

### Core Concept

A Bash loop leveraging LLMs for autonomous software development:

```bash
while :; do cat PROMPT.md | claude-code ; done
```

### Key Principles

**One Thing Per Loop** — Strict single-task focus per iteration. Manages context window efficiently and prevents diffuse attention.

**Monolithic Architecture** — Single, vertically-scaling process within one repository. Non-deterministic agents would create chaos in distributed configurations.

**Deterministic Stack Allocation** — Each loop consistently allocates the same resources: specs (`@specs/`) and plans (`@fix_plan.md`).

### Implementation Stages

**Phase One: Generation** — Code generation is inexpensive and controllable through technical standard libraries and specifications. Incorrect generation indicates specification problems, not tool problems.

**Phase Two: Backpressure** — Critical phase ensuring correct code via:
- Type system constraints
- Test suites (single unit test per loop)
- Static analyzers, security scanners
- Compilation validation

The speed of the feedback loop matters more than perfection in individual attempts.

### Critical Prompting Techniques

**Anti-Placeholder Guardrails** — Explicit instructions counter Claude's bias toward minimal implementations: "DO NOT IMPLEMENT PLACEHOLDER OR SIMPLE IMPLEMENTATIONS. WE WANT FULL IMPLEMENTATIONS."

**Search Before Assuming** — "Before making changes search codebase (don't assume not implemented) using subagents. Think hard." Addresses code search non-determinism.

### Subagent Management

- Filesystem searches: up to 500 parallel subagents
- Code writing: substantial parallelism permitted
- Build/test validation: single sequential subagent (prevents backpressure collapse)

### The Fix Plan Document

`@fix_plan.md` is the primary tracking mechanism — a prioritized bullet-point list of unimplemented items. Treated as disposable scaffolding, frequently deleted and regenerated.

### Self-Improvement Mechanisms

**AGENT.md Learning Updates** — When Ralph discovers optimal command sequences, it updates `@AGENT.md` with brief, actionable notes.

**Loop-Back Evaluation** — Ralph programmatically evaluates its own outputs. "Always look for opportunities to loop Ralph back on itself."

### Expectations

Ralph produces underbaked, baked, or "baked with unspecified latent behaviours" outputs. Senior engineering expertise remains essential. The technique works optimally for greenfield projects achieving ~90% completion before requiring human intervention.

---

## How to Think About Gas Town — Steve Klabnik

**Source:** https://steveklabnik.com/writing/how-to-think-about-gas-town (January 15, 2026)

At its core, Gas Town is straightforward: "you have a workspace. In that workspace, you have projects. Each project has a bug tracker. Gas Town allows you to instruct AI agents to autonomously knock out those bugs."

The concept builds on established patterns from Erlang (supervisor trees and mailboxes). The core innovation: agents autonomously completing programming tasks rather than humans.

### Why Gas Town is Inevitable

Once you accept that "a software agent can successfully complete programming tasks," the natural progression follows: organize work into task lists, as humans have found useful for organizing labor. Agents benefit from similar structures.

### The Opacity Strategy

Gas Town's cryptic terminology serves multiple purposes:
1. Attracting like-minded people interested in the journey
2. Filtering out those uninterested
3. Challenging underlying assumptions about software development

### Broader Questions for 2026

- What does "rigor" actually mean when AI agents commit code?
- Is rigor synonymous with passing tests?
- Can rigor be an end state worked toward rather than a precondition?

"Gas Town is aggressively not rigorous. And while rigor is a great value to have, when you're in an experimental mindset, relaxing rigor can be a valid strategy to move forward."

---

## Gas Town — GitHub README

**Source:** https://github.com/steveyegge/gastown

A multi-agent orchestration system for Claude Code enabling persistent work tracking across distributed AI agents.

### Architecture

| Component | Role |
|-----------|------|
| **Mayor** 🎩 | Primary AI coordinator with full workspace context |
| **Town** 🏘️ | Workspace directory containing projects, agents, config |
| **Rigs** 🏗️ | Project containers wrapping git repos |
| **Polecats** 🦨 | Worker agents with persistent identity, ephemeral sessions |
| **Hooks** 🪝 | Git worktree-based persistent storage surviving crashes |
| **Convoys** 🚚 | Work tracking units bundling multiple beads |
| **Beads** 📿 | Git-backed issue tracking with structured data |

### Core Problem & Solution

| Challenge | Solution |
|-----------|----------|
| Agents lose context on restart | Work persists in git-backed hooks |
| Manual agent coordination | Built-in mailboxes, identities, handoffs |
| 4-10 agents become chaotic | Scale to 20-30 agents comfortably |
| Work state lost in agent memory | Work state stored in Beads ledger |

### Quick Start

```bash
gt install ~/gt --git && cd ~/gt
gt rig add myproject https://github.com/you/repo.git
gt crew add yourname --rig myproject
gt mayor attach
```

Built-in agent presets: `claude`, `gemini`, `codex`, `cursor`, `auggie`, `amp`, `opencode`, `copilot`, `pi`, `omp`.

---

## Welcome to Gas Town — Steve Yegge (Medium)

**Source:** https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04 (January 1, 2026 · 34 min read)

Gas Town is a new take on the IDE for 2026. It helps with the tedium of running lots of Claude Code instances — stuff gets lost, it's hard to track who's doing what. Gas Town helps with all that yak shaving and lets you focus on what your Claude Codes are working on.

### The Eight Stages of Dev Evolution to AI

1. Zero or Near-Zero AI: maybe code completions
2. Coding agent in IDE, permissions turned on
3. Agent in IDE, YOLO mode
4. In IDE, wide agent: code is just for diffs
5. CLI, single agent, YOLO
6. CLI, multi-agent, YOLO: 3-5 parallel instances
7. 10+ agents, hand-managed: pushing limits of hand-management
8. Building your own orchestrator: you are on the frontier

**If you're not at least Stage 7, you cannot use Gas Town.** "Gas Town is an industrialized coding factory manned by superintelligent robot chimps, and when they feel like it, they can wreck your shit in an instant."

### Seven Worker Roles

- **Town** 🏙️ — HQ directory (e.g., ~/gt) managing all workers across all rigs
- **Rigs** 🏗️ — Each project (git repo) under Gas Town management
- **Overseer** 👤 — You, the human, with your own identity and inbox
- **Mayor** 🎩 — Main agent you talk to most; your concierge and chief-of-staff
- **Polecats** 😺 — Ephemeral per-rig workers that spin up on demand and swarm work
- **Refinery** 🏭 — Handles the Merge Queue; intelligently merges all changes one at a time to main
- **Witness** 🦉 — Watches over polecats and helps them get un-stuck
- **Deacon** 🐺 — The daemon beacon; runs patrol in a loop, propagates DYFJ signal downward
- **Dogs** 🐶 — Deacon's personal crew for maintenance and handyman work
- **Boot** 🐕 — Special Dog awakened every 5 minutes just to check on the Deacon
- **Crew** 👷 — Per-rig coding agents working for the Overseer, with long-lived identities

### GUPP: Gastown Universal Propulsion Principle

"If there is work on your hook, YOU MUST RUN IT." All Gas Town workers have persistent identities in Beads (Git-backed). An agent is not a session — sessions are ephemeral cattle. The agent is a Bead with a persistent identity, mail inbox, Hook, and role pointer. Hooks are where you hang molecules (workflows).

When Claude Code is too polite and doesn't auto-start, Gas Town uses a "GUPP Nudge" — `gt nudge` sends a tmux notification to kick the worker into reading their mail.

### MEOW: Molecular Expression of Work

The deep iceberg beneath Gas Town:

1. **Beads** — Lightweight issue tracker, stored in JSON, tracked in Git. The atomic unit of work.
2. **Epics** — Beads with children (parallel by default, with explicit dependencies for sequencing)
3. **Molecules** — Sequenced small tasks chained with Beads; survive crashes, restarts, interruptions
4. **Protomolecules** — Templates of molecules for instantiation with variable substitution
5. **Formulas** — TOML source form for workflows; "cooked" into protomolecules then instantiated
6. **Guzzoline** — The big sea of molecularized work

### Nondeterministic Idempotence (NDI)

Similar to Temporal's durable replay but achieved through completely different machinery. Because agents, hooks, and molecules are all Git-backed Beads, workflows are durable. If Claude Code crashes, the next session picks up where it left off. "Even though the path is fully nondeterministic, the outcome eventually finishes, 'guaranteed', as long as you keep throwing agents at it."

### Convoys

Everything rolls up into a Convoy — Gas Town's ticketing/work-order system. Whether tech debt cleanup, a feature, or a bug fix, each convoy is a trackable unit. `gt sling` is the fundamental primitive for slinging work around.

### Key Stats

- 17 days of development
- 75,000 lines of Go code
- 2,000 commits
- 100% vibe coded — "I've never seen the code, and I never care to"
- Requires multiple Claude Max subscriptions ($100-200/month each)

### Kubernetes Comparison

Both systems coordinate unreliable workers toward a goal. Both have a control plane watching over execution nodes with local agents monitoring ephemeral workers. "Kubernetes asks 'Is it running?' while Gas Town asks 'Is it done?'" K8s optimizes for uptime; Gas Town optimizes for completion.

---

## Ralph Wiggum AI Agents: The Coding Loop of 2026 — Leanware

**Source:** https://leanware.co/insights/ralph-wiggum-ai-coding (January 28, 2026 · 10 min read)

Ralph is not a product. It's a pattern. You give an AI coding agent a task, and instead of watching it attempt once and stop, you run it in a loop. Each iteration builds on the previous one. The agent sees its own output, confronts its mistakes, and keeps trying until it succeeds or hits a limit.

### Two Versions of Ralph

**The Huntley Ralph** (Original Bash Loop):
```bash
while :; do cat PROMPT.md | claude-code ; done
```
Embraces "naive persistence" — the AI confronts broken builds, failed tests, and half-finished implementations. Forces the model against its own failures.

**The Anthropic Ralph** (Official Plugin):
```
/ralph-loop "Build a REST API for todos. Requirements: CRUD operations, input validation, tests. Output <promise>COMPLETE</promise> when done." --max-iterations 20
```
Uses a Stop Hook that intercepts exit attempts. Adds guardrails: iteration limits, progress tracking, structured completion conditions.

### Core Innovation: The Stop Hook

Traditional AI coding is single-shot. Ralph inverts this. The Stop Hook intercepts the agent's attempt to end the session and injects the original prompt again. Each iteration inherits state through the filesystem and git history. The agent doesn't need to remember what it did; it reads the evidence.

### Step-by-Step Mechanism

1. Provide a prompt with a completion signal (e.g., `<promise>COMPLETE</promise>`)
2. Claude works on the task — edits files, runs commands, executes tests, makes commits
3. Claude attempts to exit
4. Stop Hook intercepts — checks for completion promise
5. Same prompt fed back in — Claude sees modified files, git history, errors from previous iteration
6. Claude iterates until promise found or iteration limit hit

### Best Practices

- Write detailed specifications with acceptance criteria
- Start with test coverage — Ralph uses tests as verification
- Use sandbox environments for autonomous runs
- Set reasonable iteration limits (20 often sufficient; >50 suggests spec needs refinement)
- Review diffs, not just outcomes
- One feature per iteration with built-in verification

### Where It Works

Bugfixes with reproducible test cases, framework migrations with well-defined target states, test coverage expansion, greenfield projects with detailed specs. Common thread: **verification** — if a test suite can confirm completion, Ralph can probably get there.

### Where It Falls Short

Code quality: Ralph-generated codebases run but lack structural coherence. Cost: 50-iteration loop runs $50-100+ in API credits. Security: agents with filesystem access can leak credentials.

---

## Full Control: Gas Town Orchestrates Ten or More Coding Agents — Heise Online

**Source:** https://heise.de/en/background/Full-Control-Gas-Town-Orchestrates-Ten-or-More-Coding-Agents-11178824.html (February 21, 2026 · 13 min read)
**Author:** Ingo Eichhorst (AI architect and engineering trainer at IONOS)

Gas Town is part of a group of applications currently being hotly debated — orchestrators like Ralph, Loom, and AutoClaude — whose goal is to coordinate coding agents. Yegge released Gas Town on January 1, 2026, after 17 days of development incorporating over a year of experimental experience.

### From Chaos to Order

The parallel work of 3-5+ coding agents leads to chaotic system states. What happens when multiple agents work on the same tasks? Who handles merge conflicts? How is duplicate work prevented? Gas Town uses "non-deterministic idempotence" — seemingly contradictory terms that come together through the framework's control structures.

### A Mayor's Workday

1. Human developer (Overseer) and Mayor define tasks in natural language
2. Mayor breaks tasks into subtasks, stores in Beads (task manager)
3. Tasks bundled into Convoys (work orders) and sent to Rigs (repositories)
4. Polecats (worker agents) activate and process tasks using Git worktrees
5. Communication via Mailboxes (async, Erlang-inspired) and Handoffs (sync, for context transfer)
6. Deacon monitors overall system — cleans zombie processes, restarts stuck sessions
7. Witness monitors individual agents within a Rig — replaces slacking agents

### Context Window Management

Claude's 200K token context window fills up. Even at 60% capacity, output quality noticeably decreases. Gas Town addresses this by breaking tasks into smaller units and using Handoffs to transfer work state to fresh agent instances.

### The Refinery: Merge Conflict Resolution

Multiple agents create parallel changes, duplicate work, and merge conflicts. The Refinery checks all agent work results — combats merge conflicts and poor code quality through configurable review presets and project-specific CLAUDE.md.

### Sweeps: Garbage Collection for Technical Debt

When agents blindly produce code, technical debt accumulates. Agents lose sight of previous sessions, choose foreign design methods, violate architectural consistency. Gas Town uses **Sweeps**: systematic correction waves that curb architectural drift. A 60-minute review sweep results in concrete Beads tasks that steer future agent decisions in the right direction. Gradually, trust in the agent swarm increases and sweep effort decreases.

---

## Additional Related Links (not fetched)

- [Karpathy coins 'agentic engineering' (Feb 8, 2026)](https://x.com/karpathy/status/2019137879310836075)
