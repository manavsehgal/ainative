# Search Index: Building Effective Agents (Anthropic)

Source: https://www.anthropic.com/engineering/building-effective-agents | Captured: 2026-03-07 | Files: 1 | ~8KB total

## Quick Reference

| File | Category | Summary |
|------|----------|---------|
| building-effective-agents.md | Core Concepts | Agentic system patterns: workflows, routing, parallelization, orchestration, agents |

## Heading Outlines

### building-effective-agents.md (~160 lines)
- ## Introduction
- ## What are Agents?
- ## When (and When Not) to Use Agents
- ## When and How to Use Frameworks
- ## Building Blocks, Workflows, and Agents
  - ### Building Block: The Augmented LLM
  - ### Workflow: Prompt Chaining
  - ### Workflow: Routing
  - ### Workflow: Parallelization
  - ### Workflow: Orchestrator-Workers
  - ### Workflow: Evaluator-Optimizer
  - ### Agents
- ## Combining and Customizing These Patterns
- ## Summary
- ## Appendix 1: Agents in Practice
  - ### A. Customer Support
  - ### B. Coding Agents
- ## Appendix 2: Prompt Engineering Your Tools
  - ### Suggestions for Tool Format Decisions
  - ### Agent-Computer Interface (ACI) Design

## Key Concepts

- **Workflows vs Agents**: Workflows = predefined code paths; Agents = LLM-driven dynamic processes
- **Prompt Chaining**: Sequential LLM calls with gates between steps
- **Routing**: Classify inputs → specialized handlers
- **Parallelization**: Sectioning (independent subtasks) or Voting (multiple perspectives)
- **Orchestrator-Workers**: Central LLM dynamically delegates to worker LLMs
- **Evaluator-Optimizer**: Generator + evaluator in feedback loops
- **ACI (Agent-Computer Interface)**: Tool design principles analogous to HCI
- **Model Context Protocol (MCP)**: Integration with third-party tools

## Task Map

- Understand agent architectures → building-effective-agents.md (What are Agents?, Building Blocks)
- Choose between workflows and agents → building-effective-agents.md (When and When Not to Use Agents)
- Design tool interfaces → building-effective-agents.md (Appendix 2: Prompt Engineering Your Tools)
- Implement prompt chaining → building-effective-agents.md (Workflow: Prompt Chaining)
- Build routing systems → building-effective-agents.md (Workflow: Routing)
- Parallelize LLM tasks → building-effective-agents.md (Workflow: Parallelization)
- Design orchestrator patterns → building-effective-agents.md (Workflow: Orchestrator-Workers)
- Build customer support agents → building-effective-agents.md (Appendix 1: A. Customer Support)
- Build coding agents → building-effective-agents.md (Appendix 1: B. Coding Agents)
