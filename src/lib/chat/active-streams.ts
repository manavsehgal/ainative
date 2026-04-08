/**
 * In-memory tracker for chat conversations that currently have an SSE stream
 * in flight. Used by the scheduler tick loop to apply a soft pressure signal
 * — when chat is active, new schedule firings are deferred by N seconds to
 * keep the Node event loop responsive for the user's conversation.
 *
 * Module-level state; single-process (same Node instance as the scheduler).
 * Must NOT be persisted — crash recovery relies on the set starting empty.
 */

const activeStreams = new Set<string>();

export function registerChatStream(conversationId: string): void {
  activeStreams.add(conversationId);
}

export function unregisterChatStream(conversationId: string): void {
  activeStreams.delete(conversationId);
}

export function getActiveChatStreamCount(): number {
  return activeStreams.size;
}

export function isAnyChatStreaming(): boolean {
  return activeStreams.size > 0;
}
