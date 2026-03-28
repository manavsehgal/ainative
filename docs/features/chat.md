---
title: "Chat"
category: "feature-reference"
section: "chat"
route: "/chat"
tags: ["chat", "conversation", "ai", "tool-catalog", "mentions"]
features: ["chat-data-layer", "chat-engine", "chat-api-routes", "chat-ui-shell", "chat-message-rendering", "chat-input-composer"]
screengrabCount: 5
lastUpdated: "2026-03-27"
---

# Chat

The Chat page is your AI-powered command center for everything in your workspace. Instead of a blank prompt, you land on a **Tool Catalog** that organizes suggested prompts into four action-oriented categories -- Explore, Create, Debug, and Automate -- plus a Smart Picks row of personalized suggestions drawn from your actual projects, tasks, and documents. Pick a model, choose a prompt (or type your own), and get context-aware answers with direct links to the items the assistant mentions.

## Screenshots

![Chat tool catalog](../screengrabs/chat-list.png)
*Tool catalog with hero heading, category tabs (Explore / Create / Debug / Automate), Smart Picks row, and conversation sidebar*

![Model selector](../screengrabs/chat-model-selector.png)
*Model selector dropdown showing Claude and Codex models organized by provider with cost tiers*

![Create category tab](../screengrabs/chat-create-tab.png)
*Create category selected, showing prompts for spinning up tasks, workflows, and projects*

![Active conversation](../screengrabs/chat-conversation.png)
*Active conversation with @ document context injected and streamed response with formatted markdown*

![Quick Access navigation](../screengrabs/chat-quick-access.png)
*Response content with Quick Access navigation pills linking directly to mentioned entities*

## Key Features

### Tool Catalog

When no conversation is active, the chat page displays a curated grid of suggested prompts organized into tabbed categories:

- **Explore** -- Questions about your workspace: project statuses, task summaries, schedule overviews.
- **Create** -- Prompts that help you spin up new tasks, workflows, projects, and schedules.
- **Debug** -- Investigate failed tasks, review agent logs, and diagnose workflow issues.
- **Automate** -- Set up scheduled loops, bulk operations, and repeating workflows.
- **Smart Picks** -- A personalized row of suggestions generated from your actual workspace data. If you have a recently failed task, a prompt like "Why did [task name] fail?" appears automatically.

Click any suggestion to insert it into the input and start a conversation instantly.

### Model Selection

Choose which AI model powers your conversation using the model selector at the bottom-left of the input area. Models are grouped by provider with clear cost and capability labels:

- **Haiku 4.5** -- Fast responses at the lowest cost ($). The default choice for everyday questions.
- **Sonnet 4.6** -- A balance of speed and depth ($$). Good for nuanced analysis.
- **Opus 4.6** -- The most capable model ($$$). Best for complex reasoning and detailed answers.
- **GPT-4o-mini** -- Fast alternative ($). Available when the Codex runtime is connected.
- **GPT-4o** -- Balanced alternative ($$). Available when the Codex runtime is connected.

Your preferred default model can be set in the Settings page under "Chat default model." The selection persists per conversation, so switching models mid-conversation is seamless.

### @ Mentions and Context

Type **@** in the chat input to reference a specific project, task, workflow, document, profile, or schedule by name. An autocomplete popover appears with fuzzy-searchable results grouped by entity type. When you select a mention, the assistant receives the full details of that entity as part of the conversation context -- so it can give precise, informed answers without you having to copy-paste information.

The assistant also loads workspace context automatically in the background. Your active project, recent tasks, running workflows, and linked documents are all available to the model without any extra effort on your part.

### Conversation Management

Every chat starts a new conversation that is saved automatically. Your conversation history appears in the left sidebar, sorted by most recent. Click any past conversation to pick up where you left off. You can rename, archive, or delete conversations from the context menu.

On smaller screens, the conversation list is tucked behind a menu icon and slides in as an overlay so the message area gets full screen space.

### Quick Access Navigation

When the assistant mentions a project, task, workflow, document, or schedule in its response, navigation pills appear at the bottom of the message bubble after the response completes. Each pill shows an icon and label -- click it to jump directly to that entity's page. This turns the chat into a workspace control plane: ask a question, then navigate to the relevant item in one click.

### Streaming Responses

Responses stream in token by token with a blinking cursor, so you see the answer forming in real time. A "Thinking..." indicator appears before the first token arrives. Markdown formatting -- headings, lists, code blocks with syntax highlighting, tables, and links -- renders as the text streams in. Code blocks include a copy button and language label for easy reference.

## How To

### Start a New Conversation

1. Click **Chat** in the sidebar (under the Work section).
2. Browse the tool catalog categories or type your question in the input area at the bottom.
3. Click a suggested prompt to insert it, or type your own message.
4. Press **Enter** to send. The assistant's response streams in immediately.

### Switch AI Models

1. Click the model selector to the left of the input area (it shows the current model name and cost tier).
2. Choose a different model from the dropdown. Models are labeled with cost tiers ($, $$, $$$).
3. Your next message will use the selected model. The choice is saved for this conversation.

### Reference Documents in Chat

1. In the chat input, type **@** followed by the name of a document, project, task, or other entity.
2. An autocomplete popover appears -- use arrow keys or click to select the entity you want.
3. The selected mention appears as a highlighted reference in your message.
4. When you send the message, the assistant receives the full context of the mentioned entity and can answer questions about it in detail.

### Navigate to Entities from Chat

1. Ask the assistant about a project, task, or other workspace item.
2. After the response finishes, look for the Quick Access pills at the bottom of the message.
3. Click a pill to navigate directly to that entity's detail page.

### Manage Conversations

1. Right-click (or long-press on mobile) a conversation in the sidebar to rename, archive, or delete it.
2. Click "New Chat" at the top of the conversation list to start a fresh conversation.
3. Archived conversations can be restored from the conversation list filters.

### Stop a Response

1. While a response is streaming, the Send button changes to a Stop button (square icon).
2. Click Stop to cancel the response. The partial text is preserved in the conversation.

## Related

- [Settings](./settings.md) -- Configure default chat model and browser tools
- [Documents](./documents.md) -- Documents the assistant can summarize and reference via @ mentions
- [Projects](./projects.md) -- Projects that provide context to your chat conversations
- [Profiles](./profiles.md) -- Agent profiles that shape how the assistant responds
- [Dashboard Kanban](./dashboard-kanban.md) -- Manage the tasks your chat assistant references
