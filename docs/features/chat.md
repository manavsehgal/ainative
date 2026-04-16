---
title: "Chat"
category: "feature-reference"
section: "chat"
route: "/chat"
tags: ["chat", "conversation", "ai", "tool-catalog", "mentions", "channels", "bidirectional", "skills", "templates", "filters", "saved-searches"]
features: ["chat-data-layer", "chat-engine", "chat-api-routes", "chat-ui-shell", "chat-message-rendering", "chat-input-composer", "bidirectional-channel-chat", "chat-skill-composition", "chat-composition-ui-v1", "chat-conversation-templates", "chat-filter-namespace", "chat-pinned-saved-searches", "saved-search-polish-v1"]
screengrabCount: 4
lastUpdated: "2026-04-15"
---

# Chat

The Chat page is your AI-powered command center for everything in your workspace. Instead of a blank prompt, you land on a **Tool Catalog** that organizes suggested prompts into four action-oriented categories -- Explore, Create, Debug, and Automate -- plus a Smart Picks row of personalized suggestions drawn from your actual projects, tasks, and documents. Pick a model, choose a prompt (or type your own), and get context-aware answers with direct links to the items the assistant mentions. Conversations can also originate from Slack and Telegram via bidirectional delivery channels.

## Screenshots

![Chat tool catalog](../screengrabs/chat-list.png)
*Tool catalog with hero heading, category tabs (Explore / Create / Debug / Automate), Smart Picks row, and conversation sidebar*

![Model selector](../screengrabs/chat-model-picker.png)
*Model selector dropdown showing Claude and Codex models organized by provider with cost tiers*

![Create category tab](../screengrabs/chat-actions-tab.png)
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

### Skill Composition

On runtimes that support multiple active skills, you can stack specialized behaviors onto a single conversation. Open the slash (`/`) popover and switch to the **Skills** tab — each skill card has an **+ Add** button. Active skills show a badge, and the header reads "N of M active" so you always know where you stand against the runtime's cap (`maxActiveSkills`).

- **Modes** — add a skill in `replace` mode to swap it in, or `add` mode to layer it on top of the current stack.
- **Conflict heuristic** — if a new skill clashes with one already active (overlapping tool needs, contradictory instructions), a confirmation dialog surfaces the conflict so you can choose which to keep.
- **Prompt-budget eviction** — when the active skill set approaches the model's context budget, the oldest or lowest-priority skill is evicted automatically and shown in a lightweight toast.
- **Capability gating** — runtimes that do not support composition (currently gated by `RuntimeFeatures.supportsSkillComposition`) render the Skills tab read-only with a "composition disabled on this runtime" hint.

The currently active skills are persisted on the conversation itself (`conversations.active_skill_ids`) so re-opening a conversation restores the exact same stack.

### Conversation Templates

Rather than starting every conversation from a blank prompt, you can kick one off from a saved blueprint. Three entry points:

- **Empty-state button** — the chat hero shows a "Start from template" button when no conversation is active.
- **Slash command** — type `/new-from-template` in the composer to open the picker inline.
- **Command palette** — press `⌘K` and pick the **Templates** group to browse by name.

Each template resolves its opening prompt from the blueprint's optional `chatPrompt` field (falling back to the first step's prompt template if `chatPrompt` is not set). Variables in the prompt are filled in at launch so the conversation opens already primed with context.

### Filter Namespace

Type `#` in the chat search, the `@` popover, or the Skills popover to filter by namespace. Values can be double-quoted to include spaces — for example, `#scope:"customer support"` matches only entries whose scope equals that phrase. Supported qualifiers include `#scope:`, `#type:`, and surface-specific keys. The same `FilterInput` component powers the `/documents` list page and the `⌘K` palette, so the syntax is identical everywhere.

### Saved Searches

Frequently used filter + query combinations can be pinned and reused:

- **Save a view** — run any search, then click **Save view** in the footer to name and pin it.
- **Reuse from the palette** — `⌘K` shows a **Saved** group at the top; pick one to re-apply instantly.
- **Reuse from mentions** — the `@` popover also surfaces saved searches in a dedicated group for in-composer reuse.

Saved searches round-trip via `GET/PUT /api/settings/chat/saved-searches`, and the `cleanFilterInput()` helper strips any mention-trigger residue (`@`, `#`, `/`) so a pinned query stays clean no matter where you saved it from.

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
