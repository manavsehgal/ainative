---
title: Chat Message Rendering
status: completed
priority: P1
milestone: post-mvp
source: brainstorm (2026-03-22)
dependencies: [chat-ui-shell, chat-api-routes]
---

# Chat Message Rendering

## Description

Message bubbles with streaming markdown rendering, quick access navigation pills, and scroll management. This is the core conversational UI — the part users see and interact with during every chat turn.

User messages render right-aligned with the primary accent color. Assistant messages render left-aligned on a card surface with border-centric elevation. Streaming text appends progressively with a blinking cursor indicator. After the response completes, entity-detected Quick Access pills appear inside the bubble for one-click navigation to mentioned primitives.

## User Story

As a user, I want to see AI responses stream in real-time with properly rendered markdown, code blocks, and direct links to the entities mentioned in the response.

## Technical Approach

### Message List (`src/components/chat/chat-message-list.tsx`)
- Scrollable message feed: `flex-1 overflow-y-auto p-4 space-y-4`
- Auto-scroll to bottom on new message append
- Scroll lock: if user has scrolled up >100px from bottom, disable auto-scroll
- "Scroll to bottom" FAB: `fixed bottom-20 right-4 Button size="icon-sm" variant="outline"` with ChevronDown icon. Appears only when scroll-locked during streaming
- Uses `useRef` for scroll container + `useEffect` for scroll position tracking

### Message Bubble (`src/components/chat/chat-message.tsx`)
- **User message:**
  - `flex justify-end mb-4`
  - Bubble: `max-w-[65%] lg:max-w-[60%] rounded-xl rounded-br-sm bg-primary text-primary-foreground p-3 text-sm`
  - Mobile: `max-w-[85%]`
  - Timestamp: `text-[11px] text-primary-foreground/70 mt-1 text-right`
- **Assistant message:**
  - `flex justify-start mb-4`
  - Bubble: `max-w-[65%] lg:max-w-[60%] rounded-xl rounded-bl-sm bg-card border border-border elevation-1 p-4 text-sm`
  - Mobile: `max-w-[85%]`
  - Timestamp: `text-[11px] text-muted-foreground mt-2`
  - Quick Access row rendered inside bubble after content

### Markdown Renderer (`src/components/chat/chat-message-markdown.tsx`)
- Use `react-markdown` with `remark-gfm` plugin for GFM support (tables, strikethrough, task lists)
- Custom component overrides:
  - **Code blocks**: `bg-muted border border-border-subtle rounded-lg p-3 my-2`, font: JetBrains Mono (`font-mono text-xs`), copy button (top-right), language label (top-left, `text-[10px] text-muted-foreground`)
  - **Inline code**: `bg-muted px-1.5 py-0.5 rounded font-mono text-xs`
  - **Headings**: `text-sm font-semibold mt-3 mb-1` (h1-h3 same size in chat context)
  - **Lists**: `list-disc list-inside space-y-1 text-sm`
  - **Blockquotes**: `border-l-2 border-border pl-3 text-muted-foreground italic`
  - **Tables**: `text-xs` with `border-collapse` and `border-border` cells
  - **Links**: `text-primary underline underline-offset-2 hover:text-primary/80`
- Error boundary wrapping the entire renderer: on crash, fallback to `<pre className="whitespace-pre-wrap text-sm">{rawContent}</pre>`

### Streaming Cursor (`src/components/chat/chat-streaming-cursor.tsx`)
- Blinking `|` character: `inline-block w-[2px] h-[1em] bg-primary animate-pulse ml-0.5 align-text-bottom`
- Appended at the end of the streaming text content
- Before first token arrives: show `StatusChip`-style "Thinking..." indicator with pulsing dot

### Quick Access Pills (`src/components/chat/chat-quick-access.tsx`)
- Rendered inside the assistant message bubble, below the markdown content
- Visual separator: `border-t border-border-subtle mt-3 pt-3`
- Row: `flex flex-wrap gap-2`
- Each pill: `Button variant="outline" size="xs"` wrapping a `<Link>` to the entity page
- Icon (`h-3 w-3`) + label per entity type:
  - Project → FolderKanban → `/projects/[id]`
  - Task → CheckSquare → `/dashboard` (with task detail)
  - Workflow → GitBranch → `/workflows/[id]`
  - Document → FileText → `/documents/[id]`
  - Schedule → Clock → `/schedules`
- Only rendered after response is complete (status='complete'), not during streaming
- Data comes from `metadata.quickAccess` field on the chat message

## Acceptance Criteria

- [ ] User messages render right-aligned with `bg-primary` accent
- [ ] Assistant messages render left-aligned with `bg-card` surface and `elevation-1`
- [ ] Streaming text appends progressively with blinking cursor at end
- [ ] "Thinking..." indicator shows before first token arrives
- [ ] Markdown renders correctly: headings, bold, italic, lists, code blocks, tables, links
- [ ] Code blocks have copy button, language label, and JetBrains Mono font
- [ ] Quick Access pills appear after response completion with correct entity links
- [ ] Clicking a Quick Access pill navigates to the correct primitive page
- [ ] Auto-scroll follows new messages during streaming
- [ ] Scroll lock engages when user scrolls up; "scroll to bottom" FAB appears
- [ ] Error boundary prevents markdown render crash from breaking the chat
- [ ] Mobile: message bubbles take 85% width, touch-friendly pill targets (min 44px)

## Scope Boundaries

**Included:**
- Message bubbles (user + assistant), markdown rendering, streaming cursor
- Quick Access navigation pills, scroll management, error boundary

**Excluded:**
- Image/multimodal rendering
- Message editing or deletion
- Message reactions or annotations
- Input composer (chat-input-composer feature)

## References

- Source: Brainstorm session 2026-03-22
- Related features: Depends on chat-ui-shell, chat-api-routes. Sibling to chat-input-composer
- Pattern reference: `src/components/shared/status-chip.tsx` (StatusChip for "Thinking..."), existing `prose-reader-surface` CSS for markdown styling
- UX spec: Message max-width 65% desktop, 85% mobile. JetBrains Mono for code. DV=5, MI=4, VD=6
