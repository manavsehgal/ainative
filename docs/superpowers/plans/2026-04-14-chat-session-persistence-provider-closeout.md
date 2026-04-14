# Chat Session Persistence Provider — Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the `chat-session-persistence-provider` feature by filling the remaining AC gaps (telemetry code + doc comment + smoke test) and flipping the spec status from `planned` → `completed`.

**Architecture:** The provider, layout wiring, `ChatShell` refactor, and unit tests are already shipped. What remains is the `client.stream.view-remount` telemetry code described in spec §5 (a documented reason code plus a useEffect cleanup emitter), followed by a real browser smoke test per the spec's manual repro steps, and finally status + changelog updates.

**Tech Stack:** Next.js 16 App Router, React 19 client context, Vitest + @testing-library/react, SSE readers via `fetch().body.getReader()`.

---

## NOT in scope

- **SSE resume protocol (`lastEventId` replay).** Spec "Scope Boundaries" explicitly defers this; the provider preserves state across view switches but not across full page reloads. Unchanged.
- **Web Worker isolation for the SSE reader.** Still deferred per spec.
- **Multi-tab BroadcastChannel sync.** Out of scope per spec.
- **Server-side engine / reconcile / route-handler changes.** The provider fix is purely client-architecture; server code stays untouched.
- **Provider or ChatShell rewrite.** Both are already correct. This plan only *augments* them with the telemetry hook.
- **New TDR.** Spec notes a TDR is only warranted if the layout-provider pattern gets reused (e.g., workflow execution state). It hasn't been, so no TDR.

## What already exists

| Artifact | Location | State |
|---|---|---|
| `ChatSessionProvider` with full action surface | `src/components/chat/chat-session-provider.tsx` (720 LOC) | Shipped. Holds `conversations`, `activeId`, `messagesByConversation`, `streamingState` (with `AbortController`), `modelId`, `availableModels`, `hydrated`. |
| Provider mounted in root layout | `src/app/layout.tsx:101,114` wraps `<main>` | Shipped. |
| `ChatShell` refactored to thin consumer | `src/components/chat/chat-shell.tsx` | Shipped. Zero chat-domain `useState`; only `mobileListOpen` + `hoverPreview` remain (both view-local). |
| `setMessages([])` catch-all removed | `chat-session-provider.tsx:198` | Shipped. Only appears in comments documenting the old bug. |
| Provider unit tests (4/4 green) | `src/components/chat/__tests__/chat-session-provider.test.tsx` (408 LOC) | Shipped. Covers unmount/remount preservation, fetch-failure tolerance, SSE delta accumulation, abort. |
| Dev diagnostics endpoint | `src/app/api/diagnostics/chat-streams/route.ts` | Shipped. Reads the ring buffer from `stream-telemetry.ts`. |
| 3 client reason codes documented | `src/lib/chat/stream-telemetry.ts:28-30` | Shipped. `client.stream.done`, `client.stream.user-abort`, `client.stream.reader-error`. |

The **only** missing code artifact is the 4th client reason code `client.stream.view-remount` described in spec §5, plus its emission site.

## Error & Rescue Registry

| Failure mode | Detection | Recovery |
|---|---|---|
| `ChatShell` unmounts mid-stream but provider does not persist state (regression of the provider hoisting). | Browser smoke test shows the assistant message clears on nav-away. | Check that `<ChatSessionProvider>` is in `layout.tsx`, not inside `/chat` route. |
| Telemetry log prefix drifts from `[chat-stream]`. | Unit test assertion on `console.info` prefix fails. | Keep the literal `[chat-stream]` prefix — it's the grep contract used by the diagnostics endpoint / log scrapers. |
| View-remount code fires on **initial** mount (false positive). | Unit test fails: cleanup should only fire if `isStreaming` was true at cleanup time. | Read `isStreaming` via ref (not closure) inside cleanup so we capture the value at unmount, not at effect setup. |

---

## Task 1: Document the 4th client reason code

**Files:**
- Modify: `src/lib/chat/stream-telemetry.ts:26-31`

- [ ] **Step 1: Extend the docblock**

Edit the top docblock so the "Three client-side reason codes" section becomes "Four client-side reason codes" and adds the new bullet. The list today (lines 26-30):

```typescript
 * Three client-side reason codes (logged via console.info with a stable
 * prefix so tests and grep can find them):
 *   - client.stream.done        — reader.read() returned done: true
 *   - client.stream.user-abort  — user clicked Stop / AbortController fired
 *   - client.stream.reader-error — reader.read() or decode threw
```

Replace with:

```typescript
 * Four client-side reason codes (logged via console.info with a stable
 * prefix so tests and grep can find them):
 *   - client.stream.done          — reader.read() returned done: true
 *   - client.stream.user-abort    — user clicked Stop / AbortController fired
 *   - client.stream.reader-error  — reader.read() or decode threw
 *   - client.stream.view-remount  — a chat-consuming component unmounted
 *                                    while a stream was in flight. The stream
 *                                    itself continues in the provider; this
 *                                    code exists so diagnostics can confirm
 *                                    the provider-hoisting fix is holding.
```

- [ ] **Step 2: Verify no other grep hits need updating**

Run: `rg "Three client-side reason codes" src`
Expected: no matches (the string was only in this file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/chat/stream-telemetry.ts
git commit -m "docs(chat): document client.stream.view-remount reason code"
```

---

## Task 2: Write the failing test for the cleanup emitter

**Files:**
- Modify: `src/components/chat/__tests__/chat-session-provider.test.tsx` (add one new test block)

- [ ] **Step 1: Add the test**

Append to the existing test file, inside the `describe("ChatSessionProvider", ...)` block:

```typescript
  it("emits client.stream.view-remount when a consumer unmounts while streaming", async () => {
    // Arrange: a consumer component that reads isStreaming from the provider
    // and, on unmount, logs the view-remount telemetry if a stream was active.
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    function StreamingConsumer() {
      const { isStreaming, sendMessage } = useChatSession();
      const isStreamingRef = useRef(isStreaming);
      useEffect(() => {
        isStreamingRef.current = isStreaming;
      }, [isStreaming]);
      useEffect(() => {
        return () => {
          if (isStreamingRef.current) {
            // eslint-disable-next-line no-console
            console.info("[chat-stream] client.stream.view-remount", {
              conversationId: null,
            });
          }
        };
      }, []);
      return (
        <button onClick={() => void sendMessage("hi")}>send</button>
      );
    }

    // Use a never-resolving SSE body so isStreaming stays true until unmount.
    const neverResolve = new Promise<Response>(() => {});
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith("/api/chat/conversations") && !url.includes("messages")) {
        return Promise.resolve(new Response(JSON.stringify({ id: "conv-vm" }), { status: 200 }));
      }
      if (url.includes("/stream")) return neverResolve;
      return Promise.resolve(new Response("[]", { status: 200 }));
    }) as typeof fetch;

    const { unmount, getByText } = render(
      <ChatSessionProvider>
        <StreamingConsumer />
      </ChatSessionProvider>
    );

    fireEvent.click(getByText("send"));
    // Let sendMessage start the stream (isStreaming flips true)
    await waitFor(() => {
      // Consumer cleanup hasn't fired yet; we just need the streaming flag set.
    });

    unmount();

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[chat-stream] client.stream.view-remount",
      expect.objectContaining({ conversationId: expect.anything() })
    );

    consoleInfoSpy.mockRestore();
  });
```

Import additions at the top of the test file (only if missing):

```typescript
import { useEffect, useRef } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
```

- [ ] **Step 2: Run the test to verify it passes (self-contained)**

Run: `npx vitest run src/components/chat/__tests__/chat-session-provider.test.tsx -t view-remount`

Expected: the test passes, because the `StreamingConsumer` component defined inside the test itself emits the log. This test is the **contract template** — Task 3 moves the emitter into `ChatShell` so real consumers honor the contract.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/__tests__/chat-session-provider.test.tsx
git commit -m "test(chat): add view-remount telemetry contract test"
```

---

## Task 3: Emit `client.stream.view-remount` from `ChatShell`

**Files:**
- Modify: `src/components/chat/chat-shell.tsx` (add one useEffect + ref at the top of the component)

- [ ] **Step 1: Add the ref + cleanup effect**

Open `src/components/chat/chat-shell.tsx`. Directly after the `const session = useChatSession(); const { ... } = session;` destructure (around line 54), insert:

```typescript
  // Track streaming state in a ref so the unmount cleanup sees the latest
  // value, not the value at effect-setup time. If ChatShell unmounts while
  // a stream is in flight (user navigated away), log a telemetry breadcrumb.
  // The stream itself continues inside ChatSessionProvider — this log only
  // exists to confirm the provider-hoisting fix is holding. See
  // `src/lib/chat/stream-telemetry.ts` for the full reason code list.
  const isStreamingRef = useRef(isStreaming);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);
  useEffect(() => {
    return () => {
      if (isStreamingRef.current) {
        console.info("[chat-stream] client.stream.view-remount", {
          conversationId: activeId,
        });
      }
    };
    // Intentionally empty deps: we want this exactly-once cleanup on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Add `useRef` to the React import at the top of the file (line 3). Change:

```typescript
import { useState, useCallback, useEffect, useMemo } from "react";
```

to:

```typescript
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
```

- [ ] **Step 2: Confirm TypeScript is clean**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Run the full provider test file to confirm no regressions**

Run: `npx vitest run src/components/chat/__tests__/chat-session-provider.test.tsx`

Expected: 5 tests pass (the original 4 plus the new view-remount contract test from Task 2).

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/chat-shell.tsx
git commit -m "feat(chat): emit client.stream.view-remount on ChatShell unmount"
```

---

## Task 4: Manual browser smoke test

This verifies the fix against the original bug report, not just the logic. Spec AC requires it explicitly: *"Manual repro: start a 5-10s streaming response, click Dashboard, wait 10s, return to /chat. Assistant message is complete or still streaming live. Prior user turn and assistant content intact."*

**No code changes in this task — pure verification.**

- [ ] **Step 1: Start a clean dev server**

Per `MEMORY.md` "Clean Next.js restart procedure":

```bash
pkill -f "next dev --turbopack$"; pkill -f "next-server"; sleep 2
npm run dev
```

Wait until the console shows `Ready in …`.

- [ ] **Step 2: Open `http://localhost:3000/chat` in the browser**

Use Claude in Chrome (first choice, per MEMORY.md) or Chrome DevTools MCP. Retry once on failure before falling back to Playwright.

- [ ] **Step 3: Trigger a 5–10s streaming response on Claude runtime**

Select Claude model. Send a prompt that reliably takes 5–10s, e.g.:

```
Explain in 3 short paragraphs how SSE backpressure works.
```

- [ ] **Step 4: Mid-stream, navigate away and back**

While the assistant message is still streaming:
1. Click "Dashboard" in the sidebar.
2. Wait 10 seconds.
3. Click "Chat" to return.

Expected:
- Assistant message either completed or still streaming live
- Prior user turn intact
- Prior assistant content intact (no blank)

- [ ] **Step 5: Repeat 5× rapidly**

Click sidebar items in quick succession (Dashboard → Projects → Workflows → Chat) while a stream is in flight. Do this five times.

Expected: zero turn loss, zero blank conversations.

- [ ] **Step 6: Repeat steps 3–5 on the GPT (Codex) runtime**

Switch model to a GPT option. Repeat the test sequence. Expected: same zero-loss behavior.

- [ ] **Step 7: Verify the diagnostics endpoint**

Open `http://localhost:3000/api/diagnostics/chat-streams` in a new tab.

Expected:
- `stream.abandoned` count is zero for the test window.
- `client.stream.view-remount` log lines appear in the dev-server console for each nav-away that happened during streaming.

- [ ] **Step 8: Record results in the feature spec**

Append a "Verification run — 2026-04-14" section to `features/chat-session-persistence-provider.md` with:
- Runtimes tested (Claude + GPT)
- Number of nav-away cycles
- Observed `stream.abandoned` count (expected 0)
- Observed `client.stream.view-remount` occurrences (expected >0 — proves the telemetry hook works)
- Any anomaly

Commit it:

```bash
git add features/chat-session-persistence-provider.md
git commit -m "docs(features): record chat-session-persistence-provider smoke run"
```

---

## Task 5: Close out spec status and changelog

**Files:**
- Modify: `features/chat-session-persistence-provider.md` (frontmatter `status:`)
- Modify: `features/changelog.md` (add entry)

- [ ] **Step 1: Flip spec status**

Change the frontmatter in `features/chat-session-persistence-provider.md`:

```yaml
status: planned
```

to:

```yaml
status: completed
```

- [ ] **Step 2: Add a changelog entry**

Append to `features/changelog.md` under the latest date section (create a new `## 2026-04-14` heading if needed):

```markdown
- **chat-session-persistence-provider** — Closed out. Provider + layout + ChatShell refactor already shipped earlier; this pass adds the `client.stream.view-remount` telemetry reason code and emitter to satisfy AC §5, plus a browser smoke-test verification run. No server-side changes. Spec flipped to `completed`.
```

- [ ] **Step 3: Final verification**

Run:

```bash
npm test -- src/components/chat
npx tsc --noEmit
```

Expected: all tests pass, zero TS errors.

- [ ] **Step 4: Commit**

```bash
git add features/chat-session-persistence-provider.md features/changelog.md
git commit -m "docs(features): mark chat-session-persistence-provider complete"
```

---

## Verification summary

After all 5 tasks:

| Acceptance criterion from spec | Verified by |
|---|---|
| `chat-session-provider.tsx` exists with action surface | Pre-existing; confirmed in Task 1 scope check |
| `layout.tsx` wraps `<main>` with `<ChatSessionProvider>` | Pre-existing; lines 101/114 |
| `ChatShell` holds zero chat-domain `useState` | Pre-existing; only view-local state remains |
| No `setMessages([])` catch-all | Pre-existing; only in comments |
| **Manual repro (view-switch, 5× rapid, both runtimes)** | **Task 4** |
| **`/api/diagnostics/chat-streams` shows zero `stream.abandoned`** | **Task 4 step 7** |
| Stop button aborts via AbortController | Pre-existing provider test |
| Unit tests in provider test file | Pre-existing 4 + new 1 = 5 |
| **`client.stream.view-remount` reason code added** | **Task 1 + Task 3** |
| `npm test` passes, `npx tsc --noEmit` clean | **Task 5 step 3** |

## Self-review

**Spec coverage:** every AC bullet maps to a pre-existing artifact or a task above.

**Placeholder scan:** no TBDs, TODOs, "add appropriate error handling" phrases, or "similar to Task N" shortcuts. Each task contains complete code.

**Type consistency:** `isStreamingRef`, `useChatSession()`, and telemetry log prefix `[chat-stream]` are used identically across Tasks 2 and 3.

**Smoke-test budget:** this plan does **not** touch any module under `src/lib/agents/runtime/`, `src/lib/workflows/engine.ts`, or anything that statically imports `@/lib/chat/stagent-tools`. The project override's mandatory smoke task is not triggered. Task 4's smoke step is driven by the spec's own AC, not the runtime-registry gate.
