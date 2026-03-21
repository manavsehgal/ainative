---
title: App Shell & Navigation
status: completed
priority: P0
milestone: mvp
source: ideas/tech-stack-stagent.md, ideas/mvp-vision.md
dependencies: []
---

# App Shell & Navigation

## Description

The Next.js application shell: root layout, global styles, navigation structure, and shadcn/ui setup. This provides the visual frame that all other views render inside — sidebar navigation, theme configuration, font loading, and the base component library.

The shell establishes the four primary navigation destinations from the MVP vision: Dashboard (kanban board), Inbox (notifications), Monitor (agent activity), and Projects (management). It uses Next.js App Router with Server Components, Tailwind v4 with inline theme configuration, and shadcn/ui New York style components.

## User Story

As a user, I want a clean, familiar navigation structure so that I can quickly move between my task board, inbox, monitoring, and project views.

## Technical Approach

- **Framework**: Next.js 16 with App Router, React 19, Server Components
- **Styling**: Tailwind v4 with inline `@theme` config in `globals.css`, OKLCH color space
- **Components**: shadcn/ui (New York style, RSC-compatible, Lucide icons)
- **Fonts**: Geist Sans + Geist Mono via `next/font`
- **Dark mode**: CSS custom variant `@custom-variant dark (&:is(.dark *))` with OKLCH dark palette
- **Navigation**: shadcn/ui Sidebar component with links to primary views

### Route Structure

```
src/app/
├── layout.tsx          # Root layout (fonts, theme provider, sidebar)
├── page.tsx            # Landing → redirects to /dashboard
├── globals.css         # Tailwind v4 inline theme config
├── dashboard/
│   └── page.tsx        # Kanban board (primary view)
├── inbox/
│   └── page.tsx        # Notifications hub
├── monitor/
│   └── page.tsx        # Agent monitoring dashboard
└── projects/
    └── page.tsx        # Project list and management
```

### Tailwind v4 Theme (globals.css)

Uses OKLCH colors for perceptually uniform palette. Defines CSS custom properties for background, foreground, primary, secondary, accent, muted, destructive. Dark mode overrides the same variables.

### shadcn/ui Setup

- `components.json` configured for New York style, RSC, Tailwind v4 CSS path
- Initial components: Button, Card, Badge, Sidebar, Dropdown Menu, Avatar, Tooltip
- Components live in `src/components/ui/` — owned, not imported from node_modules

### UX Considerations

- Flag for `/frontend-designer` review: sidebar layout, navigation hierarchy, and responsive behavior need UX design input before implementation
- Dark mode toggle in sidebar footer
- Responsive: sidebar collapses to icon-only on smaller screens

## Acceptance Criteria

- [ ] `npm run dev` starts the app with Turbopack on localhost:3000
- [ ] Root layout renders sidebar navigation with Dashboard, Inbox, Monitor, Projects links
- [ ] Each navigation link routes to its corresponding page (placeholder content is fine)
- [ ] Tailwind v4 inline theme applies correctly (OKLCH colors render in both light and dark modes)
- [ ] shadcn/ui components render correctly (at least Button, Card, Badge, Sidebar)
- [ ] Geist fonts load via `next/font`
- [ ] Landing page (`/`) redirects to `/dashboard`
- [ ] Dark mode toggle works

## Scope Boundaries

**Included:**
- Root layout with sidebar navigation
- `globals.css` with Tailwind v4 inline theme (OKLCH colors, dark mode)
- shadcn/ui configuration and initial component installation
- Route stubs for dashboard, inbox, monitor, projects
- `next.config.mjs` with `serverExternalPackages` and `devIndicators: false`
- Font loading (Geist Sans + Mono)
- Dark mode toggle

**Excluded:**
- Actual kanban board UI (see `task-board`)
- Inbox content (see `inbox-notifications`)
- Monitoring dashboard content (see `monitoring-dashboard`)
- Project CRUD (see `project-management`)
- Tauri IPC bridge (post-MVP)

## References

- Source: `ideas/tech-stack-stagent.md` — Web App Stack section, Project Structure, Styling
- Source: `ideas/mvp-vision.md` — MVP Scope Views & UX (four views)
- Related features: all view features render inside this shell
