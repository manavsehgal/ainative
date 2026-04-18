# Chat Screenshot Display — Design Spec

**Date:** 2026-03-27
**Scope mode:** HOLD
**Approach:** Metadata-Driven Screenshot Attachments (Approach A)

## Overview

When the agent uses browser MCP tools (Chrome DevTools or Playwright) during chat conversations or task execution, screenshots are persisted to disk and the documents table, then displayed inline in the chat UI and task log views. Clicking a thumbnail opens a lightbox overlay with the full-resolution image.

## Requirements

- Screenshots from `take_screenshot` (Chrome DevTools) and `browser_take_screenshot` (Playwright) displayed inline
- Dual surface: chat messages AND task log views
- Persisted to disk + documents table (survives restart, visible in Documents manager)
- Original + 800px-wide thumbnail stored (thumbnail for inline, original for lightbox)
- Inline in assistant messages at point of capture
- Lightbox overlay on click (zoom, pan, Escape to close)

## Data Flow

```
── Chat Path (engine.ts) ──────────────────────────────

1. Agent SDK calls take_screenshot via MCP server
2. SDK stream yields assistant event with tool_use block
   └─ Capture tool name for screenshot detection
3. SDK stream yields tool_result with image content block
   └─ content: [{ type: "image", source: { type: "base64", data: "..." } }]
4. NEW → Detect screenshot tool names:
   └─ mcp__chrome-devtools__take_screenshot
   └─ mcp__playwright__browser_take_screenshot
5. NEW → persistScreenshot(base64, metadata)
   ├─ Decode base64 → Buffer
   ├─ Write ~/.ainative/screenshots/{uuid}.png (original)
   ├─ Generate thumbnail → {uuid}_thumb.png (800px wide, sharp)
   └─ INSERT into documents table (source="screenshot")
6. NEW → Yield SSE: { type: "screenshot", documentId, thumbnailUrl, ... }
7. Accumulate in attachments[] array
8. On stream complete → merge into message metadata.attachments

── Task Path (claude-agent.ts) ────────────────────────

1. Same SDK stream event detection
2. NEW → Call same persistScreenshot() module
3. NEW → Log as event: "screenshot" in agent_logs
   └─ payload: { documentId, thumbnailUrl, toolName }
```

## Schema Changes

### documents table — new columns

```sql
ALTER TABLE documents ADD COLUMN source TEXT DEFAULT 'upload';
-- "upload" | "screenshot"

ALTER TABLE documents ADD COLUMN conversation_id TEXT REFERENCES conversations(id);
-- Links screenshot to chat context

ALTER TABLE documents ADD COLUMN message_id TEXT;
-- Links to the assistant message that generated it
```

Existing columns reused:
- `taskId` → for task execution screenshots
- `processedPath` → thumbnail path
- `direction` → "output"
- `category` → "screenshot"

### Drizzle schema update (schema.ts)

Add to `documents` table definition:
```typescript
source: text("source").default("upload"),
conversationId: text("conversation_id").references(() => conversations.id),
messageId: text("message_id"),
```

### ChatStreamEvent (types.ts) — new variant

```typescript
| { type: "screenshot";
    documentId: string;
    thumbnailUrl: string;
    originalUrl: string;
    width: number;
    height: number; }
```

### Message metadata — attachments field

```typescript
interface ScreenshotAttachment {
  documentId: string;
  thumbnailUrl: string;   // /api/documents/{id}/file?inline=1&thumb=1
  originalUrl: string;    // /api/documents/{id}/file?inline=1
  width: number;
  height: number;
}

// Added to existing metadata JSON:
{
  modelId?: string,
  quickAccess?: QuickAccessItem[],
  attachments?: ScreenshotAttachment[]  // NEW
}
```

## New Module: src/lib/screenshots/persist.ts

```typescript
persistScreenshot(base64: string, opts: {
  conversationId?: string,
  messageId?: string,
  taskId?: string,
  projectId?: string,
  toolName: string
}): Promise<ScreenshotAttachment | null>
```

**Behavior:**
1. Ensure `~/.ainative/screenshots/` directory exists (`mkdirSync` with `recursive: true` on first call)
2. Validate base64 length (reject > 20MB)
3. Decode to Buffer
4. Extract dimensions via `image-size`
5. Write original to `~/.ainative/screenshots/{uuid}.png`
5. Generate 800px-wide thumbnail via `sharp` (optional dep with fallback)
6. Write thumbnail to `~/.ainative/screenshots/{uuid}_thumb.png`
7. Insert document record with `source: "screenshot"`, `direction: "output"`, `category: "screenshot"`
8. Return `{ documentId, thumbnailUrl, originalUrl, width, height }` or `null` on failure

**sharp fallback:** If `sharp` is unavailable (try/catch dynamic import), skip thumbnail generation. Set `processedPath = storagePath`. Frontend serves original with CSS `max-width` constraint.

## File Serving Update

`src/app/api/documents/[id]/file/route.ts` — add `?thumb=1` query parameter:

Add `processedPath` to the existing `select()` clause (currently only fetches `originalName`, `mimeType`, `storagePath`):

```typescript
const [doc] = await db.select({
  originalName: documents.originalName,
  mimeType: documents.mimeType,
  storagePath: documents.storagePath,
  processedPath: documents.processedPath,  // NEW
}).from(documents).where(eq(documents.id, id));

const thumb = req.nextUrl.searchParams.get("thumb") === "1";
// If thumb=1 and processedPath exists, read from processedPath
// Otherwise fall back to storagePath
const filePath = (thumb && doc.processedPath) ? doc.processedPath : doc.storagePath;
```

## Frontend Components

### New: ScreenshotGallery (src/components/chat/screenshot-gallery.tsx)

- **Props:** `attachments: ScreenshotAttachment[]`
- **Renders:** flex-wrap grid of clickable thumbnails
- **Thumbnail sizing:** `max-w-[200px]`, `max-h-[150px]`, `object-cover`
- **Loading state:** skeleton placeholder until `<img onLoad>`
- **Overflow:** if `attachments.length > 4`, collapse with "Show N screenshots" toggle
- **Hover:** border highlight (primary color)
- **Click:** opens ScreenshotLightbox

### New: ScreenshotLightbox (src/components/shared/screenshot-lightbox.tsx)

- **Props:** `open: boolean`, `onClose: () => void`, `imageUrl: string`, `width: number`, `height: number`
- **Built on:** shadcn Dialog component
- **Features:**
  - Full-res image loaded on open
  - Fit-to-viewport with preserved aspect ratio
  - Mouse wheel → zoom in/out
  - Drag to pan when zoomed
  - Loading skeleton while image fetches
  - Footer: dimensions, "Open in new tab" link
  - Escape or overlay click to close
- **Shared:** Used by both chat messages and task log entries

### Modified: chat-message.tsx

Parse `metadata.attachments` and render `<ScreenshotGallery>` after `<ChatMessageMarkdown>`, before the streaming cursor:

```tsx
// Inside assistant message rendering
<ChatMessageMarkdown content={message.content} />
{attachments.length > 0 && (
  <ScreenshotGallery attachments={attachments} />
)}
{isStreaming && message.content && (
  <span className="... animate-pulse" />
)}
```

### Modified: chat-shell.tsx

New SSE event handler alongside existing delta, status, done, etc.:

```typescript
else if (event.type === "screenshot") {
  setMessages(prev => prev.map(m =>
    m.id === assistantMsgId
      ? { ...m, metadata: mergeAttachment(m.metadata, {
          documentId: event.documentId,
          thumbnailUrl: event.thumbnailUrl,
          originalUrl: event.originalUrl,
          width: event.width,
          height: event.height
        }) }
      : m
  ));
}
```

### Modified: log-entry.tsx

Detect `event: "screenshot"` and render inline thumbnail:

```typescript
// In LogEntry component
if (entry.event === "screenshot" && parsed.documentId) {
  return (
    // Thumbnail with click-to-lightbox, alongside timestamp and tool name
  );
}
```

Add `"screenshot"` to `eventColors` map with primary color.

## Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|-------|---------|--------|--------|
| Base64 decode fails | Corrupted/truncated MCP result | Screenshot lost, text unaffected | Log warning, skip persist, continue stream |
| Disk write fails | Disk full, permissions error | Screenshot not persisted | Catch in `persistScreenshot()`, return null, engine skips |
| sharp unavailable | Native module build fails | No thumbnails | Optional dep, fallback to serving original with CSS max-width |
| Oversized screenshot | Full-page 4K (15-20MB base64) | Memory spike | Reject base64 > 20MB, log warning with size |
| DB insert fails | WAL lock, schema mismatch | Orphan file on disk | Catch, cleanup written files, return null |
| Thumbnail load 404 | File deleted, path mismatch | Broken thumbnail | `<img onError>` → fallback to original URL → placeholder |
| SSE event lost | Network hiccup during stream | Screenshot not shown live | Self-heals on reload: metadata.attachments is authoritative |
| SDK event shape change | Agent SDK update | Detection stops working | Defensive extraction, multiple known paths, unit tests with fixtures |
| Rapid screenshots | 10+ screenshots in succession | I/O contention, UI jank | Sequential persist, collapsible gallery for 4+ items |
| Conversation reload | User switches/refreshes | Must reconstruct from DB | metadata.attachments persisted with message, renders on load |

**Core invariant:** Screenshot failures NEVER break the chat stream or task execution. Every failure returns null, engine skips, text conversation continues.

## What Already Exists (reuse)

- **documents table** (`schema.ts:109-140`) — image MIME, storagePath, processedPath, direction, category
- **Document file API** (`api/documents/[id]/file/route.ts`) — serves files inline with MIME headers
- **Image processor** (`lib/documents/processors/image.ts`) — dimensions extraction via image-size
- **shadcn Dialog** (`components/ui/dialog.tsx`) — overlay, close-on-escape, portal
- **SSE infrastructure** (`engine.ts` + `chat-shell.tsx`) — event types, streaming, side-channel
- **Browser tool detection** (`engine.ts:isBrowserReadOnly()`) — screenshot tool name matching
- **STAGENT_DATA_DIR** (`lib/documents/processor.ts`) — centralized data dir resolution

## NOT In Scope

- **Screenshot annotations** — Drawing/highlighting on screenshots. Reason: no user request; significant complexity for uncertain value.
- **Screenshot comparison/diff** — Visual diff between before/after. Reason: requires separate image processing pipeline.
- **User-pasted images in chat input** — Clipboard paste into chat. Reason: different flow (user→agent); separate feature.
- **Screenshot gallery page** — Dedicated /screenshots route. Reason: Documents page with source filter covers this.
- **Video/GIF capture** — Recording browser interactions. Reason: fundamentally different data type.
- **Screenshot retention policy** — Auto-cleanup of old screenshots. Reason: premature optimization.
- **Codex (OpenAI) path** — Screenshot handling for Codex runtime. Reason: different event model; address when that runtime supports browser tools.

## File Manifest

### New files (5)
- `src/lib/screenshots/persist.ts` — core persistence module
- `src/lib/screenshots/__tests__/persist.test.ts` — unit tests
- `src/components/chat/screenshot-gallery.tsx` — inline thumbnail grid
- `src/components/shared/screenshot-lightbox.tsx` — fullscreen viewer
- `src/lib/db/migrations/XXXX_add_screenshot_columns.sql` — schema migration

### Modified files (11)
- `src/lib/db/schema.ts` — add source, conversationId, messageId columns
- `src/lib/db/index.ts` — bootstrap new columns
- `src/lib/chat/types.ts` — add screenshot SSE event type + ScreenshotAttachment interface
- `src/lib/chat/engine.ts` — intercept screenshot tool results, persist, emit SSE
- `src/lib/agents/claude-agent.ts` — intercept screenshot tool results, persist, log
- `src/app/api/documents/[id]/file/route.ts` — add ?thumb=1 support via processedPath
- `src/components/chat/chat-message.tsx` — render ScreenshotGallery from metadata.attachments
- `src/components/chat/chat-shell.tsx` — handle screenshot SSE event type
- `src/components/monitoring/log-entry.tsx` — render screenshot log events with thumbnail
- `src/lib/data/clear.ts` — add `~/.ainative/screenshots/` filesystem cleanup (no new table, only columns added)
- `package.json` — add sharp dependency

## Verification Plan

1. **Unit tests:** `persist.test.ts` — mock fs/sharp, test base64 decode, thumbnail generation, DB insert, error paths, size rejection
2. **Integration test:** Start dev server, open chat, enable Chrome DevTools MCP, send prompt that triggers `take_screenshot`, verify:
   - Screenshot file exists at `~/.ainative/screenshots/`
   - Thumbnail file exists alongside original
   - Document record in DB with `source: "screenshot"`
   - SSE event received by frontend
   - Thumbnail renders inline in chat message
   - Click opens lightbox with full-res image
3. **Task path:** Create a task that uses browser tools, verify screenshot appears in log entry view
4. **Reload test:** Refresh page, switch conversations, verify screenshots persist from metadata
5. **Error paths:** Test with sharp uninstalled, with oversized image mock, with disk permission error
6. **Documents surface:** Verify screenshots appear in /documents with source=screenshot filter
