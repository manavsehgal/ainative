# Multi-agents

Codex can run multi-agent workflows by spawning specialized agents in parallel and collecting their results in one response.

This page explains the core concepts and tradeoffs. For setup, agent configuration, and examples, see [Multi-agents](https://developers.openai.com/codex/multi-agent).

## Why multi-agent workflows help

Even with large context windows, models have limits. If you flood the main conversation (where you're defining requirements, constraints, and decisions) with noisy intermediate output such as exploration notes, test logs, stack traces, and command output, the session can become less reliable over time.

This is often described as:

- **Context pollution**: useful information gets buried under noisy intermediate output.
- **Context rot**: performance degrades as the conversation fills up with less relevant details.

For background, see Chroma's writeup on [context rot](https://research.trychroma.com/context-rot).

Multi-agent workflows help by moving noisy work off the main thread:

- Keep the **main agent** focused on requirements, decisions, and final outputs.
- Run specialized **sub-agents** in parallel for exploration, tests, or log analysis.
- Return **summaries** from sub-agents instead of raw intermediate output.

As a starting point, use parallel agents for tasks that mostly read (exploration, tests, triage, and summarization). Be more careful with parallel write-heavy workflows, because multiple agents editing code at once can create conflicts and increase coordination overhead.

## Core terms

Codex uses a few related terms in multi-agent workflows:

- **Multi-agent**: A workflow where Codex runs multiple agents in parallel and combines their results.
- **Sub-agent**: A delegated agent that Codex starts to handle a specific task.
- **Agent thread**: The CLI thread for an agent, which you can inspect and switch between with `/agent`.

## Choosing models and reasoning

Different agents benefit from different model and reasoning settings.

`gpt-5.3-codex-spark` is available in research preview for ChatGPT Pro
  subscribers. See [Models](https://developers.openai.com/codex/models) for current availability. If you're
  using Codex via the API, use GPT-5.2-Codex today.

### Model choice

- **`gpt-5.3-codex`**: Use for agents that need stronger reasoning, such as code review, security analysis, multi-step implementation, or tasks with ambiguous requirements. The main agent and agents that propose or apply edits usually fit here.
- **`gpt-5.3-codex-spark`**: Use for agents that prioritize speed over depth, such as exploration, read-heavy scans, or quick summarization tasks. Spark works well for parallel workers that return distilled results to the main agent.

### Reasoning effort (`model_reasoning_effort`)

- **`high`**: Use when an agent needs to trace complex logic, validate assumptions, or work through edge cases (for example, reviewer or security-focused agents).
- **`medium`**: A balanced default for most agents.
- **`low`**: Use when the task is straightforward and speed matters most.

Higher reasoning effort increases response time and token usage, but it can improve quality for complex work. For details, see [Models](https://developers.openai.com/codex/models), [Config basics](https://developers.openai.com/codex/config-basic), and [Configuration Reference](https://developers.openai.com/codex/config-reference).