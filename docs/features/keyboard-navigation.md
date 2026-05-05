---
title: "Keyboard Navigation"
category: "feature-reference"
section: "keyboard-navigation"
route: "cross-cutting"
tags: [keyboard, command-palette, accessibility, aria, a11y, navigation, templates, saved-searches, slash-commands, rewind, branching]
features: ["command-palette-enhancement", "accessibility", "keyboard-shortcut-system", "chat-conversation-templates", "chat-pinned-saved-searches", "saved-search-polish-v1", "chat-conversation-branches", "chat-slash-commands"]
screengrabCount: 2
lastUpdated: "2026-05-05"
---

# Keyboard Navigation

`ainative-business` is designed for keyboard-first operation. The command palette provides instant access to any resource, chord shortcuts jump directly to the main sections, and the chat composer recognizes slash commands and rewind keystrokes. All interactive elements support full keyboard navigation with visible focus indicators.

## Sidebar Group Overview

The sidebar is divided into five groups. Chord shortcuts (press <kbd>g</kbd> then the letter) jump to items in the Home group; other items are reached via command palette or mouse click:

| Group | Routes |
|---|---|
| Home | Dashboard `/`, Tasks `/tasks`, Inbox `/inbox`, Chat `/chat` |
| Compose | Projects, Workflows, Profiles, Schedules, Documents, Tables |
| Observe | Monitor, Cost & Usage, Analytics |
| Learn | AI Native Book, User Guide |
| Configure | Environment, Settings |

## Chord Shortcuts

| Shortcut | Destination / Action |
|---|---|
| <kbd>g</kbd> <kbd>h</kbd> | Dashboard (`/`) |
| <kbd>g</kbd> <kbd>t</kbd> | Tasks (`/tasks`) |
| <kbd>Meta</kbd>+<kbd>K</kbd> | Command palette (open / close) |
| <kbd>/</kbd> *(in chat composer)* | Slash command popover |
| <kbd>@</kbd> *(in chat composer)* | Mentions popover |
| <kbd>#</kbd> *(in chat / palette / filters)* | Filter namespace popover |
| <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd> *(in chat composer)* | Rewind the last user/assistant pair |
| <kbd>⌘⇧Z</kbd> / <kbd>Ctrl+Shift+Z</kbd> *(in chat composer)* | Redo the most recently rewound pair |
| <kbd>Space</kbd> *(on focused kanban card)* | Pick up / drop card |
| <kbd>Escape</kbd> *(during kanban drag)* | Cancel and return card to origin |

The old <kbd>g</kbd> <kbd>d</kbd> shortcut was removed when the kanban moved from `/dashboard` to `/tasks`. If you had it in muscle memory, use <kbd>g</kbd> <kbd>t</kbd> for Tasks or <kbd>g</kbd> <kbd>h</kbd> for the Dashboard overview at `/`.

## Screenshots

![Command palette in empty state](../screengrabs/command-palette-empty.png)
*The command palette (Meta+K) showing recent items and navigation shortcuts in the empty state.*

![Command palette with search results](../screengrabs/command-palette-search.png)
*Searching across projects, tasks, workflows, documents, and schedules from a single unified palette query.*

## Key Features

### Command Palette

Activated with **Meta+K** (Cmd+K on macOS, Ctrl+K on other platforms), the command palette provides:

- **Recent items** — quick access to recently viewed projects, tasks, and workflows.
- **Cross-entity search** — type to search across projects, tasks, workflows, documents, and schedules in a single unified list.
- **Keyboard navigation** — arrow keys to browse results, Enter to select, Escape to dismiss.
- **Action shortcuts** — create new tasks, projects, or workflows directly from the palette.
- **Templates group** — browse conversation templates generated from workflow blueprints; pick one to open a pre-primed chat.
- **Saved group** — recall pinned search + filter combinations across Chat, Documents, and Tables. Saved searches round-trip through a settings endpoint and refetch automatically when new ones are added.

### Slash Commands

The Chat composer recognizes <kbd>/</kbd> for fast inline actions. The popover has four tabs:

- **Actions** — workspace shortcuts like `/new-from-template` (open the conversation template picker) and other built-in commands.
- **Tools** — every tool the active runtime exposes, with descriptions you can read inline before invoking.
- **Skills** — all available skills with **+ Add** buttons and a "N of M active" counter against the runtime's `maxActiveSkills` cap.
- **Entities** — projects, tasks, documents, profiles — mirrors the `@` popover for keyboard-only flows.

### Conversation Rewind / Redo

In the chat composer, <kbd>⌘Z</kbd> rewinds the last user/assistant pair (collapses the rendered turns to gray "Rewound" placeholders and pre-fills the composer with the rewound user message for retry). <kbd>⌘⇧Z</kbd> restores the most recently rewound pair. Both bindings are scoped to the composer's `onKeyDown` (not `window`), so they only fire when the composer is focused — they will not interfere with browser-native undo elsewhere.

For a full conversation tree view (every parent, sibling, and descendant of a branched conversation), open the **View branches** item in any conversation row's dropdown — see [Chat](./chat.md) for the branching workflow.

### Filter Namespace

Type <kbd>#</kbd> in the chat search, the `@` popover, the Skills popover, or any FilterInput-powered field to filter by namespace. Values can be double-quoted to include spaces — `#scope:"customer support"` matches only entries whose scope equals that phrase. Supported qualifiers include `#scope:`, `#type:`, and surface-specific keys. The same `FilterInput` component powers `/documents`, `/tables`, and the `⌘K` palette, so the syntax is identical everywhere.

### Focus-Visible Rings

All interactive cards, buttons, and links display a visible focus ring when navigated via keyboard (`:focus-visible`). The ring uses the accent color at reduced opacity to remain visible without being distracting.

### Skip-to-Content Link

A hidden skip link appears on Tab press, allowing keyboard users to bypass the sidebar and jump directly to the main content area.

### ARIA Labels

All interactive elements carry descriptive ARIA labels. Status badges include `aria-label` text that reads the status aloud. Icon-only buttons have accessible names.

### Kanban Keyboard Drag-and-Drop

Kanban board cards support full keyboard-driven reordering:

1. **Space** — pick up the focused card.
2. **Arrow keys** — move the card between columns or positions.
3. **Space** — drop the card in its new position.
4. **Escape** — cancel the drag and return the card to its original position.

A live region announces the card's current position during the drag operation for screen reader users.

## Related

- [Design System](./design-system.md)
- [Tasks](./tasks.md) — Kanban keyboard drag-and-drop and inline edit
- [Chat](./chat.md) — Slash commands, mentions, rewind/redo, branching
- [Shared Components](./shared-components.md)
