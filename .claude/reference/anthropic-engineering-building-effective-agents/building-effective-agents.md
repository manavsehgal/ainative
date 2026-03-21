# Building Effective Agents

Source: https://www.anthropic.com/engineering/building-effective-agents
Authors: Erik Schluntz and Barry Zhang (Anthropic)

## Introduction

Over the past year, Anthropic has collaborated with dozens of teams developing LLM agents across various industries. The most successful implementations consistently used simple, composable patterns rather than complex frameworks or specialized libraries.

## What are Agents?

"Agent" can be defined in several ways. Some define agents as fully autonomous systems operating independently over extended periods using various tools. Others describe more prescriptive implementations following predefined workflows. Anthropic categorizes all variations as **agentic systems** while distinguishing between:

- **Workflows**: Systems where LLMs and tools are orchestrated through predefined code paths
- **Agents**: Systems where LLMs dynamically direct their own processes and tool usage, maintaining control over task accomplishment

## When (and When Not) to Use Agents

When building LLM applications, find the simplest solution possible and increase complexity only when needed. Agentic systems often trade latency and cost for better performance—consider when this tradeoff makes sense.

Workflows offer predictability for well-defined tasks, while agents suit situations requiring flexibility and model-driven decision-making at scale. For many applications, optimizing single LLM calls with retrieval and in-context examples suffices.

## When and How to Use Frameworks

Available frameworks include:

- Claude Agent SDK
- Strands Agents SDK by AWS
- Rivet (drag-and-drop GUI workflow builder)
- Vellum (GUI tool for complex workflows)

These frameworks simplify low-level tasks like calling LLMs, defining tools, and chaining calls. However, they create abstraction layers that obscure prompts and responses, complicating debugging and tempting unnecessary complexity additions.

**Recommendation**: Start by using LLM APIs directly—many patterns require just a few lines of code. If using frameworks, understand the underlying code, as incorrect assumptions about implementation details commonly cause errors.

## Building Blocks, Workflows, and Agents

### Building Block: The Augmented LLM

The foundational building block combines an LLM with augmentations like retrieval, tools, and memory. Current models actively use these capabilities—generating search queries, selecting tools, and determining information retention.

Focus on two implementation aspects:

- Tailor capabilities to your specific use case
- Provide clear, well-documented interfaces

The Model Context Protocol allows integrating with third-party tools through simple client implementations.

### Workflow: Prompt Chaining

This workflow decomposes tasks into sequential steps where each LLM call processes previous output. Add programmatic checks (gates) at intermediate steps.

**When to use**: Tasks decomposable into fixed subtasks, trading latency for higher accuracy by simplifying each LLM call.

**Examples**:

- Generating marketing copy, then translating it
- Writing document outlines, verifying criteria, then writing based on outlines

### Workflow: Routing

Routing classifies inputs and directs them to specialized followup tasks, enabling separation of concerns and specialized prompts.

**When to use**: Complex tasks with distinct categories better handled separately, with accurate classification via LLM or traditional methods.

**Examples**:

- Directing customer service queries (general, refunds, technical support) to different processes
- Routing easy questions to efficient models like Claude Haiku 4.5, difficult questions to Claude Sonnet 4.5

### Workflow: Parallelization

LLMs work simultaneously on tasks with outputs aggregated programmatically. Two variations:

- **Sectioning**: Breaking tasks into independent parallel subtasks
- **Voting**: Running same tasks multiple times for diverse outputs

**When to use**: When divided subtasks parallelize for speed or multiple perspectives increase confidence. LLMs perform better handling each consideration separately.

**Examples**:

- *Sectioning*: Guardrails where one instance processes queries while another screens for inappropriate content; automated evaluations assessing different performance aspects
- *Voting*: Code vulnerability reviews with multiple prompts; content appropriateness evaluation with different thresholds

### Workflow: Orchestrator-Workers

A central LLM dynamically breaks down tasks, delegates to worker LLMs, and synthesizes results. Key difference from parallelization: subtasks aren't predefined but determined by the orchestrator based on input.

**When to use**: Complex tasks where subtasks can't be predicted (e.g., coding where file changes depend on task specifics).

**Examples**:

- Coding products making complex multi-file changes
- Search tasks gathering and analyzing information from multiple sources

### Workflow: Evaluator-Optimizer

One LLM generates responses while another provides evaluation and feedback in loops.

**When to use**: When clear evaluation criteria exist and iterative refinement provides measurable value. Two signs: LLM responses improve with human feedback, and LLMs can provide similar feedback.

**Examples**:

- Literary translation capturing nuances through iterative critique
- Complex search requiring multiple rounds of searching and analysis

### Agents

Agents emerge in production as LLMs mature in key capabilities: understanding complex inputs, reasoning, planning, using tools reliably, and recovering from errors.

Agents begin with user commands or interactive discussion. Once tasks are clear, they plan and operate independently, potentially returning for information or judgment. During execution, agents gain ground truth from environment steps (tool results, code execution) to assess progress. They pause for feedback at checkpoints or blockers, typically terminating upon completion, with stopping conditions (iteration limits) maintaining control.

Implementation is typically straightforward—LLMs using tools based on environmental feedback in loops. Toolset design and documentation are crucial.

**When to use**: Open-ended problems where predicting required steps is difficult or impossible, and fixed paths can't be hardcoded. The LLM operates many turns requiring decision-making trust. Autonomy makes agents ideal for scaling trusted environments.

Higher costs and potential error compounding necessitate extensive sandboxed testing and appropriate guardrails.

**Examples**:

- Coding agents resolving SWE-bench tasks involving multi-file edits
- Computer use reference implementation where Claude accomplishes tasks via computers

## Combining and Customizing These Patterns

These building blocks aren't prescriptive—they're patterns developers can shape and combine for different use cases. Success requires measuring performance and iterating. Add complexity only when it demonstrably improves outcomes.

## Summary

Success isn't about sophisticated systems but building the **right** system for your needs. Start with simple prompts, optimize with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short.

Three core principles when implementing agents:

1. Maintain **simplicity** in agent design
2. Prioritize **transparency** by explicitly showing planning steps
3. Carefully craft agent-computer interfaces (ACI) through thorough tool **documentation and testing**

Frameworks help beginners, but reduce abstraction layers and build with basic components for production. This creates agents that are powerful, reliable, maintainable, and trusted.

## Appendix 1: Agents in Practice

Two particularly promising applications demonstrate practical agent value: customer support and coding agents. Both require conversation and action, clear success criteria, feedback loops, and meaningful human oversight.

### A. Customer Support

Customer support combines familiar chatbot interfaces with tool-integrated capabilities—a natural fit for open-ended agents because:

- Interactions naturally follow conversational flows requiring external information and actions
- Tools integrate customer data, order history, and knowledge bases
- Actions (refunds, ticket updates) are programmatically handled
- Success measured through user-defined resolutions

Several companies using usage-based pricing (charging only for successful resolutions) demonstrate confidence in agent effectiveness.

### B. Coding Agents

Software development shows remarkable LLM potential, evolving from code completion to autonomous problem-solving. Agents excel because:

- Code solutions verify through automated tests
- Agents iterate using test results as feedback
- Problem spaces are well-defined and structured
- Output quality is measurable objectively

Agents now solve real GitHub issues in SWE-bench Verified benchmarks from pull request descriptions alone. Automated testing verifies functionality, though human review ensures solutions align with broader system requirements.

## Appendix 2: Prompt Engineering Your Tools

Tools enable Claude to interact with external services and APIs by specifying exact structure and definition. Tool definitions deserve prompt engineering attention equal to overall prompts.

Multiple specification methods exist for identical actions. File edits can use diffs or complete rewrites. Structured output uses markdown or JSON. Some formats are significantly harder for LLMs than others—diffs require knowing line-count changes before writing new code; JSON requires escaping newlines and quotes.

### Suggestions for Tool Format Decisions

- Give models sufficient tokens to "think" before writing themselves into corners
- Keep formats close to naturally occurring internet text
- Eliminate formatting overhead (no arbitrary line-count tracking or string-escaping requirements)

### Agent-Computer Interface (ACI) Design

- Adopt HCI principles for ACI development, investing equal effort
- Put yourself in the model's shoes—would clarity be obvious to you? If not, likely unclear to models
- Change parameter names and descriptions for clarity, like excellent junior-developer docstrings
- Test tool usage across many examples in workbenches to identify mistakes and iterate
- Apply Poka-yoke principles—modify arguments making mistakes harder

**Example**: In SWE-bench implementation, more time optimized tools than overall prompts. Models made mistakes with relative filepaths after changing directories. Solution: require absolute filepaths—models subsequently used this flawlessly.
