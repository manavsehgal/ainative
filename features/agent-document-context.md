---
title: Agent Document Context
status: completed
priority: P1
milestone: post-mvp
dependencies:
  - file-attachment-data-layer
  - document-preprocessing
---

# Agent Document Context

## Description

Agents can access uploaded documents during task execution. When a task has attached documents, the agent prompt is augmented with document context — extracted text for text-extractable files, and file path references for binary files. This enables users to say "analyze the attached documents" and have the agent work with the content.

## User Story

As a user, I want agents to automatically have access to files I attach to tasks, so I can ask them to analyze, summarize, or act on uploaded documents without manually copying content.

## Technical Approach

### Prompt Augmentation

- Query documents linked to a task before execution
- Build a document context section appended to the agent prompt
- Context includes extracted text (with clear delimiters) and file paths

### Content Strategy

| Document State | Context Format |
|----------------|----------------|
| Text extracted (< 10K chars) | Full extracted text with delimiters |
| Text extracted (≥ 10K chars) | Truncated to 10,000 chars + full file path reference |
| Image (ready) | File path for agent to use Read tool |
| Processing/failed | File path only with status note |

### Prompt Format

```
--- Attached Documents ---

[Document 1: report.pdf]
Path: ~/.ainative/uploads/abc123-report.pdf
Content:
<document>
...extracted text...
</document>

[Document 2: screenshot.png]
Path: ~/.ainative/uploads/def456-screenshot.png
Type: image/png (use Read tool to view)

--- End Attached Documents ---
```

### Integration Points

- `executeClaudeTask` — augment prompt before `query()` call
- `resumeClaudeTask` — augment prompt for resumed sessions
- Agent SDK `query({ prompt })` takes a string — document context is prepended to user prompt

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/documents/context-builder.ts` | Build document context section for prompts |
| `src/lib/agents/claude-agent.ts` | Augment prompt with document context (lines ~154, ~226) |

## Acceptance Criteria

- [ ] When a task has attached documents, agent prompt includes document context
- [ ] Text-extractable documents: extracted text appended with clear delimiters
- [ ] Images: file paths referenced so agent can use Read tool
- [ ] Large documents (≥ 10K chars) truncated with full path reference
- [ ] Prompt format includes file paths for agent filesystem access
- [ ] Works with both `executeClaudeTask` and `resumeClaudeTask`
- [ ] Agent can be instructed to "analyze the attached documents"

## Scope Boundaries

**Included:**
- Prompt augmentation with document content
- Truncation for large documents
- File path references for binary content
- Support for both execute and resume flows

**Excluded:**
- Multimodal content blocks (agent SDK takes string prompt only)
- Agent-initiated file uploads
- Document modification by agents
- Streaming document content during execution
