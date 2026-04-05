---
title: "I. From GPT-4 to AGI: Counting the OOMs"
source: https://situational-awareness.ai/from-gpt-4-to-agi/
author: Leopold Aschenbrenner
date_published: 2024-06
date_captured: 2026-04-05
content_type: essay
series: "Situational Awareness: The Decade Ahead"
chapter: 1
---

# I. From GPT-4 to AGI: Counting the OOMs

**AGI by 2027 is strikingly plausible.** GPT-2 to GPT-4 took us from ~preschooler to ~smart high-schooler abilities in 4 years. Tracing trendlines in compute (~0.5 orders of magnitude or OOMs/year), algorithmic efficiencies (~0.5 OOMs/year), and "unhobbling" gains (from chatbot to agent), we should expect another preschooler-to-high-schooler-sized qualitative jump by 2027.

> "Look. The models, they just want to learn. You have to understand this. The models, they just want to learn."
> — Ilya Sutskever (circa 2015, via Dario Amodei)

## The Last Four Years

GPT-4's capabilities came as a shock to many: an AI system that could write code and essays, reason through difficult math problems, and ace college exams. But GPT-4 was merely the continuation of a decade of breakneck progress in deep learning.

### GPT-2 to GPT-4 Progression

- **GPT-2 (2019) ~ preschooler**: Could string together a few plausible sentences. Could barely count to 5. A semi-coherent story about unicorns was cherry-picked as impressive.
- **GPT-3 (2020) ~ elementary schooler**: Could do some simple useful tasks with few-shot examples. Started being cohesive over multiple paragraphs. First commercially useful (simple copy for SEO).
- **GPT-4 (2023) ~ smart high schooler**: Can write sophisticated code and iteratively debug, reason through difficult high-school competition math, write intelligently about complicated subjects. Beats the vast majority of high schoolers on AP exams, SAT, LSAT, Bar Exam.

### Key Benchmark Data

| Exam | GPT-4 (2023) | GPT-3.5 (2022) |
|------|-------------|----------------|
| Uniform Bar Exam | 90th | 10th |
| LSAT | 88th | 40th |
| SAT | 97th | 87th |
| GRE (Verbal) | 99th | 63rd |
| AP Calculus BC | 51st | 3rd |

The MATH benchmark went from ~5% (GPT-3, 2021) to >90% (recent models). GPQA (PhD-level science) — Claude 3 Opus gets ~60% vs. in-domain PhDs at ~80%.

## Counting the OOMs

Progress from GPT-2 to GPT-4 can be decomposed into three categories:

### 1. Compute

Training compute has grown at roughly ~0.5 OOMs/year. Not from Moore's Law (which was 1-1.5 OOMs/decade) but from mammoth *investment*.

| Model | Estimated Compute | Growth |
|-------|------------------|--------|
| GPT-2 (2019) | ~4e21 FLOP | — |
| GPT-3 (2020) | ~3e23 FLOP | + ~2 OOMs |
| GPT-4 (2023) | 8e24 to 4e25 FLOP | + ~1.5-2 OOMs |

By end of 2027: expect +2-3 additional OOMs of compute ($10s-$100s of billions clusters).

### 2. Algorithmic Efficiencies

Algorithmic progress acts as "compute multipliers." ~0.5 OOMs/year of efficiency gains based on:
- Inference cost for ~50% MATH performance dropped ~1000x in two years
- Chinchilla scaling laws gave 3x+ (0.5 OOMs+) efficiency gain
- Gemini 1.5 Pro/Flash: major compute efficiency via MoE architecture
- Many gains in architecture, data, training stack

GPT-2 to GPT-4 included 1-2 OOMs of algorithmic efficiency gains. By 2027: expect 1-3 more OOMs (best guess ~2 OOMs).

### 3. "Unhobbling" Gains

Paradigm-expanding algorithmic improvements beyond just better base models:

- **RLHF**: An RLHF'd small model equivalent to >100x larger non-RLHF'd model in human preference
- **Chain of Thought (CoT)**: >10x effective compute increase on math/reasoning
- **Scaffolding**: On SWE-Bench, GPT-4 alone solves ~2%; with Devin's agent scaffolding, 14-23%
- **Tools**: Web browsing, code execution, calculators
- **Context length**: From 2k (GPT-3) to 1M+ tokens (Gemini 1.5 Pro)
- **Posttraining improvements**: GPT-4 went from ~50% to ~72% on MATH via posttraining alone

### From Chatbot to Agent-Coworker

Three key "unhobbling" ingredients for the next leap:

1. **Solving the "onboarding problem"**: Models need to be onboarded like a new hire — given company context, docs, Slack history, codebase understanding.

2. **Test-time compute overhang / System II reasoning**: Current models think for ~minutes equivalent. Unlocking millions of tokens of "thinking" (days/weeks/months equivalent) would be transformative. Each GPT-4 token is smart, but the model can only coherently use ~hundreds of tokens for chain-of-thought.

3. **Using a computer**: Multimodal models will soon use computers like humans — joining Zoom calls, reading shared docs, using dev tools, messaging colleagues.

The result: a **drop-in remote worker** — an agent onboarded like a human hire that can work independently on big projects for weeks.

## The Next Four Years: Summary

### GPT-2 to GPT-4 (2019-2024)
- Compute: 3.5-4 OOMs
- Algorithmic Efficiency: 1-2 OOMs
- Unhobbling: 2? OOMs (RLHF, CoT, scaffolding, basic tools)
- **Total: 4.5-6 OOMs base scaleup + "Base to Chatbot"**

### 2023-2027 (Projection)
- Compute: 2-3 OOMs
- Algorithmic Efficiency: 1-3 OOMs
- Unhobbling: ? OOMs (onboarding, System II, computer use)
- **Total: 3-6 OOMs base scaleup (best guess ~5) + "Chatbot to Agent"**

In 2027, a leading AI lab will be able to train a GPT-4-level model in a minute.

## The Data Wall

A potentially important source of variance: we're running out of internet data. Frontier models already trained on much of the internet (Llama 3: 15T tokens). But:

- Labs are making massive research bets on synthetic data, self-play, and RL approaches
- Industry insiders are bullish (Dario Amodei: "My guess is that this will not be a blocker")
- Intuition: current LLM training is like speed-reading a textbook; humans learn by thinking, practicing, failing — synthetic data/RL approaches try to replicate this

The data wall creates variance between labs: proprietary algorithmic breakthroughs become the key to AGI and superintelligence — "one of the United States' most prized secrets."

## Addendum: It's This Decade or Bust

We're racing through the OOMs at ~5 OOMs in 4 years, and over ~10 this decade overall. After the early 2030s, we face a slow slog:
- **Spending scaleup**: By end of decade, likely $100B-$1T clusters — near the feasible limit
- **Hardware gains**: We'll have totally specialized AI-specific chips, with diminishing returns
- **Algorithmic progress**: Low-hanging fruit will be picked; pace will slow

This means we are racing through many more OOMs this decade than in multiple decades thereafter. It's this decade or bust for AGI.

## Key Takeaway

We are on course for AGI by 2027. These AI systems will be able to automate basically all cognitive jobs. The trendlines are intense, and merely require trend extrapolation of straight lines — no esoteric beliefs required. AGI is no longer a distant fantasy. Forget scifi, count the OOMs.
