---
title: "Chat"
category: "feature-reference"
section: "chat"
route: "/chat"
tags: ["chat", "conversation", "ai", "tool-catalog", "mentions", "channels", "bidirectional"]
features: ["chat-data-layer", "chat-engine", "chat-api-routes", "chat-ui-shell", "chat-message-rendering", "chat-input-composer", "bidirectional-channel-chat"]
screengrabCount: 4
lastUpdated: "2026-03-31"
---

# Chat

The Chat page is your AI-powered command center for everything in your workspace. Instead of a blank prompt, you land on a **Tool Catalog** that organizes suggested prompts into four action-oriented categories -- Explore, Create, Debug, and Automate -- plus a Smart Picks row of personalized suggestions drawn from your actual projects, tasks, and documents. Pick a model, choose a prompt (or type your own), and get context-aware answers with direct links to the items the assistant mentions. Conversations can also originate from Slack and Telegram via bidirectional delivery channels.

## Screenshots

![Chat tool catalog](../screengrabs/chat-list.png)
*Tool catalog with hero heading, category tabs (Explore / Create / Debug / Automate), Smart Picks row, and conversation sidebar*

![Model selector](../screengrabs/chat-model-selector.png)
*Model selector dropdown showing Claude and Codex models organized by provider with cost tiers*

![Create category tab](../screengrabs/chat-create-tab.png)
*Create category selected, showing prompts for spinning up tasks, workflows, and projects*

![Active conversation](../screengrabs/chat-conversation.png)
*Active conversation with @ document context injected and streamed response with formatted markdown*

## Key Features

### Tool Catalog

When no conversation is active, the chat page displays a curated grid of suggested prompts organized into tabbed categories:

- **Explore** -- Questions about your workspace: project statuses, task summaries, schedule overviews.
- **Create** -- Prompts that help you spin up new tasks, workflows, projects, and schedules.
- **Debug** -- Investigate failed tasks, review agent logs, and diagnose workflow issues.
- **Automate** -- Set up scheduled loops, bulk operations, and repeating workflows.
- **Smart Picks** -- A personalized row of suggestions generated from your actual workspace data.

### Model Selection

Choose which AI model powers your conversation using the model selector at the bottom-left of the input area. Models are grouped by provider with clear cost and capability labels:

- **Haiku 4.5** -- Fast responses at the lowest cost ($).
- **Sonnet 4.6** -- A balance of speed and depth ($$).
- **Opus 4.6** -- The most capable model ($$$).
- **GPT-4o-mini** / **GPT-4o** -- Available when the Codex runtime is connected.
- **Ollama models** -- Available when a local Ollama instance is connected ($0).

### @ Mentions and Context

Type **@** in the chat input to reference a specific project, task, workflow, document, profile, or schedule by name. An autocomplete popover appears with fuzzy-searchable results. When you select a mention, the assistant receives the full details of that entity as part of the conversation context.

### Conversation Management

Every chat starts a new conversation that is saved automatically. Your conversation history appears in the left sidebar, sorted by most recent. Channel conversations from Slack and Telegram also appear here, titled "Channel: [channel name]," so you can continue them from the web UI.

### Channel Conversations

When bidirectional chat is enabled on a Slack or Telegram delivery channel, messages sent to Stagent from those platforms create conversations visible in the Chat sidebar. The same chat engine handles both web and channel conversations, including tool access, permission handling, and multi-turn context.

### Streaming Responses

Responses stream in token by token with a blinking cursor. Markdown formatting -- headings, lists, code blocks with syntax highlighting, tables, and links -- renders as the text streams in. Code blocks include a copy button and language label.

## How To

### Start a New Conversation

1. Click **Chat** in the sidebar (under the Work section).
2. Browse the tool catalog categories or type your question in the input area.
3. Click a suggested prompt to insert it, or type your own message.
4. Press **Enter** to send. The response streams in immediately.

### Switch AI Models

1. Click the model selector to the left of the input area.
2. Choose a different model from the dropdown. Models are labeled with cost tiers.
3. Your next message will use the selected model.

### Reference Entities in Chat

1. Type **@** followed by the name of a document, project, task, or other entity.
2. An autocomplete popover appears -- use arrow keys or click to select.
3. The assistant receives the full context of the mentioned entity.

### Chat from Slack or Telegram

1. Configure a delivery channel with Chat mode enabled (see [Settings](./settings.md)).
2. Send a message to Stagent from Slack or Telegram.
3. The conversation appears in the Chat sidebar and can be continued from either platform.

## Related

- [Settings](./settings.md) -- Configure default chat model, Ollama, and delivery channels
- [Documents](./documents.md) -- Documents the assistant can reference via @ mentions
- [Projects](./projects.md) -- Projects that provide context to conversations
- [Profiles](./profiles.md) -- Agent profiles that shape how the assistant responds
- [Delivery Channels](./delivery-channels.md) -- Bidirectional Slack and Telegram integration
