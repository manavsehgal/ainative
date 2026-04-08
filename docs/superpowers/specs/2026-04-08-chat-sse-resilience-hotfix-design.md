# Spec B — Chat SSE Resilience Hotfix

**Status:** Approved
**Created:** 2026-04-08
**Scope mode:** REDUCE
**Related:** [Schedule Orchestration (Spec A)](./2026-04-08-schedule-orchestration-design.md), [Swarm Visibility (Spec C)](./2026-04-08-swarm-visibility-design.md)

## Context

On 2026-04-08 at 12:20:49 UTC, five scheduled agents fired simultaneously and consumed ~12,600 combined turns on Claude Opus 4.6. A user sent a chat message ~66 seconds later; the SSE stream dropped mid-stream and the assistant message persisted with `content: ""` and `status: "streaming"`. The user saw the conversation "jank and reset."

This hotfix addresses the symptom — placeholder chat messages left in an empty/streaming state — independent of the underlying schedule-orchestration work (Spec A). It is a ~40 LOC defensive change that can ship in hours, in parallel with Spec A implementation.

## Goal

Uphold the invariant:

> After `sendMessage()` returns or throws, no `chat_messages` row for that conversation remains with `status='streaming'` and `content=''`.

## Root cause analysis

Code inspection of `src/app/api/chat/conversations/[id]/messages/route.ts` and `src/lib/chat/engine.ts` reveals three paths by which the invariant can be broken:

1. **Finally-block bypass via iterator abandonment.** When the route handler consumer `break`s out of the `for await` loop (route.ts:83), the async iterator's `return()` method is invoked. In an async generator, `return()` jumps to the `finally` block, **skipping the `catch` block entirely**. Engine.ts's catch at line 644 never runs, so `updateMessageContent()` is never called. The placeholder row from engine.ts:246 stays at `content=''`.

2. **Defensive fallback gap in error path.** engine.ts:680 writes `fullText || errorMessage`. If both are empty strings (e.g., `diagnoseProcessError()` returns empty from a blank stderr), the DB gets `content=''`.

3. **DB write hang under contention.** Under WAL contention from concurrent schedulers, `await updateMessageContent()` in the catch path can block past the HTTP request lifetime. Next.js tears down the request before it resolves; the update never commits.

4. **No orphan reconciliation.** Historical `streaming` rows from crashed processes or prior bugs remain visible in the UI forever.

## Fix design

### Change 1 — Finally-block safety net

In `src/lib/chat/engine.ts`, modify the top-level `finally` block (currently line 700, containing only `cleanupConversation(conversationId)`):

```typescript
} finally {
  try {
    const current = await getMessage(assistantMsg.id);
    if (current && current.status === "streaming") {
      const salvage =
        fullText && fullText.trim().length > 0
          ? fullText
          : "(Response interrupted. Please try again.)";
      await updateMessageContent(assistantMsg.id, salvage);
      await updateMessageStatus(
        assistantMsg.id,
        fullText && fullText.length > 50 ? "complete" : "error",
      );
    }
  } catch (finalizeErr) {
    console.error("[chat] finalize safety net failed:", finalizeErr);
  }
  cleanupConversation(conversationId);
}
```

**Why at the finally level:** catches every code path — happy path (already `complete`, safety net is no-op), engine catch path (already wrote content, safety net is no-op), abandoned iterator path (NEW — catches the bug), generator throw path (NEW — catches the bug).

### Change 2 — Defensive fallback in error path

At `src/lib/chat/engine.ts:680`, replace `fullText || errorMessage` with:

```typescript
fullText || errorMessage || "(Response failed — no error detail available.)"
```

Eliminates the empty-string write even if both sources are blank.

### Change 3 — Truncate oversized errorMessage

Before writing `errorMessage` to the DB, truncate at 4KB:

```typescript
const safeErrorMessage = errorMessage.length > 4096
  ? errorMessage.slice(0, 4096) + "... (truncated)"
  : errorMessage;
```

Prevents bloat from multi-MB stderr dumps.

### Change 4 — Orphan reconciliation sweep

Add a helper in `src/lib/chat/reconcile.ts` (new file):

```typescript
export async function reconcileStreamingMessages(): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
  const orphans = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.status, "streaming"),
        lt(chatMessages.createdAt, cutoff),
      ),
    );

  for (const row of orphans) {
    await db
      .update(chatMessages)
      .set({
        status: "error",
        content:
          row.content && row.content.length > 0
            ? row.content
            : "(Interrupted — this response was not completed. Please retry.)",
      })
      .where(eq(chatMessages.id, row.id));
  }

  return orphans.length;
}
```

Call from the chat conversations page loader (fire-and-forget). 10-min cutoff is far longer than any legitimate streaming duration — no risk of clobbering in-flight responses.

### Change 5 — Route handler cleanup

In `src/app/api/chat/conversations/[id]/messages/route.ts:95-98`, wrap `controller.close()` in a try/catch so a throw during close doesn't mask earlier errors:

```typescript
} finally {
  clearInterval(keepalive);
  try {
    controller.close();
  } catch {
    // Already closed; nothing to do
  }
}
```

## Data model changes

**None.** Uses existing schema.

## Tests

### Unit tests (new)

**`src/lib/chat/__tests__/engine.finalize-safety-net.test.ts`:**

1. **Mid-stream SDK throw with partial content**: mock SDK to yield 3 chunks then throw; assert placeholder ends up with salvaged `fullText` as content and `status='complete'` (because fullText > 50 chars).
2. **Mid-stream SDK throw with no content**: mock SDK to throw before any text; assert placeholder ends up with fallback string and `status='error'`.
3. **Empty errorMessage AND empty fullText**: mock `diagnoseProcessError` to return empty and SDK to throw immediately; assert the line-680 fallback string is written, never `''`.
4. **Iterator abandonment (consumer break)**: mock consumer that breaks on first yield; assert finally-block safety net salvages the row even though catch didn't run.
5. **Happy path no-op**: mock SDK to complete normally; assert finally-block safety net sees `status='complete'` and does nothing.

**`src/lib/chat/__tests__/reconcile.test.ts`:**

6. **20-min-old streaming row**: seed a row with `status='streaming'`, `createdAt = now - 20min`; assert reconcile marks it `error` with fallback content.
7. **30-sec-old streaming row**: seed a row with `status='streaming'`, `createdAt = now - 30s`; assert reconcile leaves it untouched.
8. **Partial content preservation**: seed a row with `status='streaming'`, `content='Hello wor'`, old timestamp; assert reconcile preserves the partial content, marks `error`.

### Integration

9. **Manual repro**: open chat, start a long prompt, send `SIGSTOP` to Next.js mid-stream for 15s, resume → assert assistant message ends finalized (never `streaming`/`content=''`).
10. **Spec A interaction**: after Spec A lands, fire 5 schedules via `POST /api/schedules/:id/execute?force=true`, send a chat message, force the SSE to drop → assert no `chat_messages` row with `content=''` remains.

## Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|---|---|---|---|
| Finalize safety-net DB write itself fails | Disk full, WAL locked | Placeholder stays empty (regression) | `try/catch` around the finalize block; log to console; `cleanupConversation` still runs |
| `getMessage()` returns undefined in finally | Race with delete | TypeError | Null-check (`if (current && ...)`) |
| Orphan sweep deletes legitimate in-flight row | 10-min window too tight | User sees interrupted message falsely | Use 10 min (far longer than any real SDK turn); monitor sweep hits post-ship |
| `errorMessage` is a multi-MB stderr dump | `diagnoseProcessError` returns huge string | Bloated chat_messages row | Truncate at 4KB (Change 3) |
| Reconcile runs concurrently with a new message | Race between page load and new send | Double-write | Reconcile's UPDATE is idempotent; only touches rows matching `status='streaming' AND createdAt < cutoff` |
| `controller.close()` throws in finally | Stream already closed by peer | Unhandled rejection | try/catch (Change 5) |

## NOT in scope (deferred)

- **SSE client-side reconnect / replay from last event ID** — future spec "Chat Streaming v2"
- **Heartbeat-based client timeout detection** — future spec "Chat Streaming v2"
- **Moving chat off the shared Node event loop** (worker isolation) — addressed by Spec A's concurrency cap instead
- **Refactor of `diagnoseProcessError()`** — use fallback string at call site instead
- **Adding `lastHeartbeatAt` column for more precise orphan detection** — defer until 10-min cutoff proves insufficient

## Files touched

- `src/lib/chat/engine.ts` — finally block (Change 1), error-path fallback (Change 2), truncation (Change 3)
- `src/app/api/chat/conversations/[id]/messages/route.ts` — controller.close try/catch (Change 5)
- `src/lib/chat/reconcile.ts` — NEW file with `reconcileStreamingMessages()` (Change 4)
- `src/app/chat/page.tsx` — call `reconcileStreamingMessages()` in loader (fire-and-forget)
- `src/lib/chat/__tests__/engine.finalize-safety-net.test.ts` — NEW
- `src/lib/chat/__tests__/reconcile.test.ts` — NEW

## Verification

1. All new unit tests pass.
2. Full chat test suite regression green.
3. Manual SIGSTOP repro (step 9 above) shows no orphaned `streaming` rows.
4. Post-ship query: `SELECT COUNT(*) FROM chat_messages WHERE content='' AND status IN ('streaming','pending')` stays at 0 after first full chat page reload.

## Ship plan

- No feature flag — hotfix is unconditional safety.
- Ships independently of Spec A (zero shared code).
- Ship as a standalone PR; commit separately from orchestration work for clean bisect-ability.
