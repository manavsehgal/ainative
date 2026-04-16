---
title: "Keyboard Navigation"
category: "feature-reference"
section: "keyboard-navigation"
route: "cross-cutting"
tags: [keyboard, command-palette, accessibility, aria, a11y, navigation, templates, saved-searches, slash-commands]
features: ["command-palette-enhancement", "accessibility", "keyboard-shortcut-system", "chat-conversation-templates", "chat-pinned-saved-searches", "saved-search-polish-v1"]
screengrabCount: 2
lastUpdated: "2026-04-15"
---

# Keyboard Navigation

Stagent is designed for keyboard-first operation. The command palette provides instant access to any resource, and all interactive elements support full keyboard navigation with visible focus indicators.

## Screenshots

![Command palette in empty state](../screengrabs/command-palette-empty.png)
*The command palette (Meta+K) showing recent items and navigation shortcuts.*

![Command palette with search results](../screengrabs/command-palette-search.png)
*Searching across projects, tasks, and workflows from the command palette.*

## Key Features

### Command Palette

Activated with **Meta+K** (Cmd+K on macOS, Ctrl+K on other platforms), the command palette provides:

- **Recent items** -- quick access to recently viewed projects, tasks, and workflows.
- **Cross-entity search** -- type to search across projects, tasks, workflows, documents, and schedules in a single unified list.
- **Keyboard navigation** -- arrow keys to browse results, Enter to select, Escape to dismiss.
- **Action shortcuts** -- create new tasks, projects, or workflows directly from the palette.
- **Templates group** -- browse conversation templates generated from workflow blueprints; pick one to open a pre-primed chat.
- **Saved group** -- recall pinned search + filter combinations across Chat, Documents, and Tables. Saved searches round-trip through a settings endpoint and refetch automatically when new ones are added.

### Slash Commands

In addition to the palette, the Chat composer recognizes slash commands for fast actions:

- `/new-from-template` -- open the conversation template picker inline without leaving the composer.
- Additional slash commands live alongside the `/` popover tabs (Actions, Skills, Tools, Entities).

### Focus-Visible Rings

All interactive cards, buttons, and links display a visible focus ring when navigated via keyboard (`:focus-visible`). The ring uses the accent color at reduced opacity to remain visible without being distracting.

### Skip-to-Content Link

A hidden skip link appears on Tab press, allowing keyboard users to bypass the sidebar and jump directly to the main content area.

### ARIA Labels

All interactive elements carry descriptive ARIA labels. Status badges include `aria-label` text that reads the status aloud. Icon-only buttons have accessible names.

### Kanban Keyboard Drag-and-Drop

Kanban board cards support full keyboard-driven reordering:

1. **Space** -- pick up the focused card.
2. **Arrow keys** -- move the card between columns or positions.
3. **Space** -- drop the card in its new position.
4. **Escape** -- cancel the drag and return the card to its original position.

A live region announces the card's current position during the drag operation for screen reader users.

## Related

- [Design System](./design-system.md)
- [Dashboard & Kanban](./dashboard-kanban.md)
- [Shared Components](./shared-components.md)
