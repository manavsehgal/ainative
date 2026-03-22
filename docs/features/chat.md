---
title: "Chat"
category: "feature-reference"
section: "chat"
route: "/chat"
tags: ["chat", "conversations", "ai", "model-selection", "suggested-prompts", "quick-access", "streaming"]
features: ["chat-data-layer", "chat-engine", "chat-api-routes", "chat-ui-shell", "chat-message-rendering", "chat-input-composer"]
screengrabCount: 5
lastUpdated: "2026-03-22"
---

# Chat

The Chat page is your conversational AI interface for managing and exploring your Stagent workspace. Ask questions about your projects, tasks, workflows, and documents — the assistant understands your setup and responds with context-aware answers, complete with direct links to the entities it mentions.

## Screenshots

![Chat empty state](../screengrabs/chat-list.png)
*Empty state with hero heading, suggested prompt categories, and conversation sidebar*

![Active conversation](../screengrabs/chat-conversation.png)
*Active conversation showing streamed responses with Quick Access navigation pills*

![Model selector](../screengrabs/chat-model-selector.png)
*Model selector dropdown showing available models grouped by provider with cost tiers*

![Suggested prompts — Create tab](../screengrabs/chat-create-tab.png)
*Suggested prompts with the Create tab selected, showing context-aware prompt suggestions*

![Quick Access pills](../screengrabs/chat-quick-access.png)
*Quick Access navigation pill linking directly to a mentioned task*

## Key Features

### Conversations

Every chat starts a new conversation that is saved automatically. Your conversation history appears in the left sidebar, sorted by most recent. Click any past conversation to pick up where you left off. You can rename, archive, or delete conversations from the context menu.

On mobile and tablet, the conversation list is tucked behind a menu icon and slides in as an overlay so the message area gets full screen space.

### Model Selection

Choose which AI model powers your conversation using the model selector at the bottom of the input area. Models are grouped by provider with clear cost and capability labels:

- **Haiku 4.5** — Fast responses at the lowest cost ($). The default choice for everyday questions.
- **Sonnet 4.6** — A balance of speed and depth ($$). Good for nuanced analysis.
- **Opus 4.6** — The most capable model ($$$). Best for complex reasoning and detailed answers.
- **GPT-4o-mini** — Fast alternative ($). Available when the Codex runtime is connected.
- **GPT-4o** — Balanced alternative ($$). Available when the Codex runtime is connected.

Your preferred default model can be set in the Settings page under "Chat default model." The selection persists per conversation, so switching models mid-conversation is seamless.

### Suggested Prompts

When you open Chat with no active conversation, the hero area displays a grid of suggested prompts organized into tabbed categories. These prompts are generated from your actual workspace data:

- **Project-aware** — "What's the status of [your project name]?"
- **Task-aware** — "Why did [a recently failed task] fail?"
- **Document-aware** — "Summarize [a recent document]"
- **System** — "What can you help me with?"

Click any suggestion to insert it into the input and start a conversation instantly.

### Quick Access Navigation Pills

When the assistant mentions a project, task, workflow, document, or schedule in its response, navigation pills appear at the bottom of the message bubble after streaming completes. Each pill shows an icon and label — click it to jump directly to that entity's page. This turns the chat into a workspace control plane: ask a question, then navigate to the relevant item in one click.

### Entity Management via Chat

The assistant understands your Stagent workspace — your projects, tasks, workflows, documents, and schedules. You can ask about statuses, request summaries, or get recommendations, and the assistant draws from your actual data to answer. The progressive context system loads relevant workspace information automatically so you don't need to explain your setup.

### Streaming Responses

Responses stream in token by token with a blinking cursor, so you see the answer forming in real time. A "Thinking..." indicator appears before the first token arrives. Markdown formatting — headings, lists, code blocks with syntax highlighting, tables, and links — renders as the text streams in. Code blocks include a copy button and language label for easy reference.

## How To

### Start a Conversation

1. Click **Chat** in the sidebar (under the Work section).
2. Type your question in the input area at the bottom, or click a suggested prompt.
3. Press **Enter** to send. The assistant's response streams in immediately.

### Switch Models

1. Click the model selector to the left of the input area (it shows the current model name).
2. Choose a different model from the dropdown. Models are labeled with cost tiers ($, $$, $$$).
3. Your next message will use the selected model. The choice is saved for this conversation.

### Use Suggested Prompts

1. On the Chat page with no active conversation, browse the suggested prompt categories.
2. Click a prompt to insert it into the input area.
3. Edit the prompt text if needed, then press **Enter** to send.

### Navigate to Entities from Chat

1. Ask the assistant about a project, task, or other workspace item.
2. After the response finishes streaming, look for the Quick Access pills at the bottom of the message.
3. Click a pill to navigate directly to that entity's detail page.

### Manage Conversations

1. Right-click (or long-press on mobile) a conversation in the sidebar to rename, archive, or delete it.
2. Click "New Chat" at the top of the conversation list to start a fresh conversation.
3. Archived conversations can be restored from the conversation list filters.

### Stop a Response

1. While a response is streaming, the Send button changes to a Stop button (square icon).
2. Click Stop to cancel the response. The partial text is preserved in the conversation.

## Related

- [Dashboard Kanban](./dashboard-kanban.md) — manage the tasks your chat assistant references
- [Profiles](./profiles.md) — agent profiles that shape task execution behavior
- [Projects](./projects.md) — the projects that provide context to your chat conversations
- [Documents](./documents.md) — documents the assistant can summarize and reference
- [Settings](./settings.md) — configure your default chat model and other preferences
