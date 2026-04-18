---
title: "Shared Components"
category: "feature-reference"
section: "shared-components"
route: "cross-cutting"
tags: [components, page-shell, detail-pane, status-chip, filter-bar, filter-input, data-table, reusable]
features: ["shared-component-library", "page-shell", "detail-pane", "status-chip", "filter-bar", "view-switcher", "chat-filter-namespace"]
screengrabCount: 0
lastUpdated: "2026-04-15"
---

# Shared Components

`ainative-business` maintains a library of reusable components that enforce layout consistency and reduce duplication across all surfaces. These components implement the Calm Ops design tokens and are used throughout the application.

## Key Features

### PageShell

Unified page layout wrapper used by all detail, create, and edit pages. Provides consistent max-width, padding, and spacing. Accepts a header slot and body content.

### DetailPane

A right-rail panel for viewing and editing entity details without leaving the list view. Slides in from the right with a semi-opaque backdrop. Used on projects, tasks, workflows, and documents surfaces.

### StatusChip

Five status chip families that map to entity lifecycle states. Each chip renders a colored dot indicator alongside the status label. Variants follow the badge color system (indigo/running, green/completed, gray/queued, red/failed, outline/planned).

### FilterBar

Horizontal filter strip placed below page headers. Supports multiple filter types (select, search, date range) and displays an active filter count badge. Filters persist in URL search params for shareable filtered views.

### FilterInput

Typed input used for namespace-aware filtering (`#scope:`, `#type:`, and similar qualifiers). Supports double-quoted values so phrases with spaces parse correctly — e.g. `#scope:"customer support"`. Used by Chat search, the `@` / `/` popovers, the `/documents` list page, and the `⌘K` palette, giving every surface the same filter syntax. Paired with the `cleanFilterInput()` helper, which strips mention-trigger residue (`@`, `#`, `/`) when a pinned saved search is reapplied.

### ViewSwitcher

Toggle between saved view modes on a per-surface basis. Common modes include table view and grid/card view. The active view preference persists in local storage.

### TrustTierBadge

Displayed in the sidebar footer, this badge shows the current tool permission tier (Read Only, Git Safe, Full Auto). Clicking opens a popover with tier details and a link to Settings.

### DataTable

A sortable, paginated table component built on shadcn Table primitives. Supports row selection, bulk actions, and column visibility toggles. Used on documents, schedules, and workflow steps surfaces.

### PageHeader

Renders the page title, optional subtitle, and action buttons in a consistent layout across all top-level pages.

### EmptyState

A centered illustration + message component shown when a list or table has no data. Includes a primary action button to help users get started.

### ErrorState

Displays error messages with a retry action. Used as an error boundary fallback and in API error scenarios.

### SectionHeading

A styled heading component used to separate logical sections within a page or form.

### FormSectionCard

Groups related form fields inside an elevation-1 card with a section title. Used in create and edit forms to visually organize field groups.

## Related

- [Design System](./design-system.md)
- [Keyboard Navigation](./keyboard-navigation.md)
- [Dashboard & Kanban](./tasks.md)
