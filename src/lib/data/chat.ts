import { db } from "@/lib/db";
import {
  conversations,
  chatMessages,
  type ConversationRow,
  type ChatMessageRow,
} from "@/lib/db/schema";
import { eq, and, desc, gt, lte, like, sql, count, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

// ── Types ──────────────────────────────────────────────────────────────

/**
 * chat-conversation-branches v1 — depth cap on ancestor walks. Prevents
 * pathological chains (linked-list attack, lossy migrations) from blowing
 * out the context-builder. When a branch chain exceeds this depth, the
 * walk truncates at the cap and returns `depthCapped: true`. Callers
 * (today: only the chat context builder) can render a truncation notice.
 */
export const MAX_BRANCH_DEPTH = 8;

export interface CreateConversationInput {
  projectId?: string | null;
  title?: string | null;
  runtimeId: string;
  modelId?: string | null;
  sessionId?: string | null;
  contextScope?: string | null;
  /**
   * chat-conversation-branches v1 — when set, this conversation is a
   * branch of `parentConversationId`. `branchedFromMessageId` is the
   * assistant message in the parent at which the branch forks. Both
   * must be provided together; validation lives in the API route.
   */
  parentConversationId?: string | null;
  branchedFromMessageId?: string | null;
}

export interface ListConversationsFilter {
  projectId?: string;
  status?: "active" | "archived";
  limit?: number;
}

export interface AddMessageInput {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: string | null;
  status?: "pending" | "streaming" | "complete" | "error";
}

export interface GetMessagesOptions {
  limit?: number;
  after?: string; // message ID for cursor-based pagination
}

// ── Conversation CRUD ──────────────────────────────────────────────────

export async function createConversation(
  input: CreateConversationInput
): Promise<ConversationRow> {
  const id = randomUUID();
  const now = new Date();

  await db.insert(conversations).values({
    id,
    projectId: input.projectId ?? null,
    title: input.title ?? null,
    runtimeId: input.runtimeId,
    modelId: input.modelId ?? null,
    status: "active",
    sessionId: input.sessionId ?? null,
    contextScope: input.contextScope ?? null,
    parentConversationId: input.parentConversationId ?? null,
    branchedFromMessageId: input.branchedFromMessageId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const row = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .get();

  return row!;
}

export async function listConversations(
  filters?: ListConversationsFilter
): Promise<ConversationRow[]> {
  const conditions = [];
  if (filters?.projectId) {
    conditions.push(eq(conversations.projectId, filters.projectId));
  }
  if (filters?.status) {
    conditions.push(eq(conversations.status, filters.status));
  }

  const query = db
    .select()
    .from(conversations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(conversations.updatedAt));

  if (filters?.limit) {
    return query.limit(filters.limit).all();
  }
  return query.all();
}

export async function getConversation(
  id: string
): Promise<ConversationRow | null> {
  const row = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .get();

  return row ?? null;
}

export async function updateConversation(
  id: string,
  updates: Partial<
    Pick<
      ConversationRow,
      "title" | "status" | "sessionId" | "modelId" | "runtimeId" | "contextScope"
    >
  >
): Promise<ConversationRow | null> {
  await db
    .update(conversations)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(conversations.id, id));

  const row = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .get();

  return row ?? null;
}

export async function archiveConversation(id: string): Promise<void> {
  await db
    .update(conversations)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(conversations.id, id));
}

export async function deleteConversation(id: string): Promise<void> {
  // Delete messages first (FK safety), then conversation
  await db
    .delete(chatMessages)
    .where(eq(chatMessages.conversationId, id));
  await db
    .delete(conversations)
    .where(eq(conversations.id, id));
}

// ── Message CRUD ───────────────────────────────────────────────────────

export async function addMessage(
  input: AddMessageInput
): Promise<ChatMessageRow> {
  const id = randomUUID();
  const now = new Date();

  await db.insert(chatMessages).values({
    id,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    metadata: input.metadata ?? null,
    status: input.status ?? "complete",
    createdAt: now,
  });

  // Touch conversation updatedAt so listing reflects latest activity
  await db
    .update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, input.conversationId));

  const row = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, id))
    .get();

  return row!;
}

export async function getMessages(
  conversationId: string,
  opts?: GetMessagesOptions
): Promise<ChatMessageRow[]> {
  const conditions = [eq(chatMessages.conversationId, conversationId)];

  if (opts?.after) {
    // Cursor-based: get the createdAt of the "after" message, then fetch newer
    const cursor = await db
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.id, opts.after))
      .get();

    if (cursor) {
      conditions.push(gt(chatMessages.createdAt, cursor.createdAt));
    }
  }

  const query = db
    .select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(chatMessages.createdAt);

  if (opts?.limit) {
    return query.limit(opts.limit).all();
  }
  return query.all();
}

export async function updateMessageStatus(
  id: string,
  status: "pending" | "streaming" | "complete" | "error"
): Promise<void> {
  await db
    .update(chatMessages)
    .set({ status })
    .where(eq(chatMessages.id, id));
}

export async function updateMessageContent(
  id: string,
  content: string
): Promise<void> {
  await db
    .update(chatMessages)
    .set({ content })
    .where(eq(chatMessages.id, id));
}

// ── Search / History ──────────────────────────────────────────────────

export async function searchConversations(opts: {
  search?: string;
  projectId?: string;
  status?: "active" | "archived";
  limit?: number;
}): Promise<(ConversationRow & { messageCount: number })[]> {
  const conditions = [];
  if (opts.projectId) {
    conditions.push(eq(conversations.projectId, opts.projectId));
  }
  if (opts.status) {
    conditions.push(eq(conversations.status, opts.status));
  }
  if (opts.search) {
    conditions.push(like(conversations.title, `%${opts.search}%`));
  }

  const rows = await db
    .select({
      conversation: conversations,
      messageCount: count(chatMessages.id),
    })
    .from(conversations)
    .leftJoin(chatMessages, eq(chatMessages.conversationId, conversations.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(conversations.id)
    .orderBy(desc(conversations.updatedAt))
    .limit(Math.min(opts.limit ?? 20, 50))
    .all();

  return rows.map((r) => ({
    ...r.conversation,
    messageCount: r.messageCount,
  }));
}

export async function searchMessages(opts: {
  query: string;
  projectId?: string;
  limit?: number;
}): Promise<
  Array<{
    conversationId: string;
    conversationTitle: string | null;
    messageId: string;
    role: string;
    content: string;
    createdAt: Date;
  }>
> {
  const conditions = [
    like(chatMessages.content, `%${opts.query}%`),
    // Exclude system messages from search results
    sql`${chatMessages.role} != 'system'`,
  ];

  if (opts.projectId) {
    conditions.push(eq(conversations.projectId, opts.projectId));
  }

  const rows = await db
    .select({
      conversationId: chatMessages.conversationId,
      conversationTitle: conversations.title,
      messageId: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(conversations, eq(conversations.id, chatMessages.conversationId))
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(Math.min(opts.limit ?? 20, 50))
    .all();

  return rows;
}

// ── Branching: ancestor walk ───────────────────────────────────────────

/**
 * chat-conversation-branches v1 — return the flattened transcript for a
 * conversation, walking up the branch ancestry chain.
 *
 * For a root (linear) conversation, this is identical to `getMessages` with
 * the `rewoundAt IS NULL` filter applied. For a branch, it walks
 * parent → grandparent → … up to {@link MAX_BRANCH_DEPTH} levels, collecting
 * each ancestor's messages with `createdAt ≤ branchedFromMessage.createdAt`,
 * concatenated in root-to-leaf order, with the current conversation's
 * messages appended last.
 *
 * Rewound message pairs are excluded at every layer — they remain visible
 * in the UI but invisible to the agent.
 *
 * `depthCapped` is `true` when the chain is longer than {@link MAX_BRANCH_DEPTH}.
 * The caller (today: chat context builder) can use this to inject a synthetic
 * "branch chain truncated" notice so the agent knows context is incomplete.
 */
export async function getMessagesWithAncestors(
  conversationId: string
): Promise<{ messages: ChatMessageRow[]; depthCapped: boolean }> {
  // Walk up the chain leaf-to-root. For each conv we record its own
  // `branchedFromMessageId` (the message in *its parent* at which it forked).
  // When we later flatten root-to-leaf, each ancestor's prefix is constrained
  // to `createdAt <= branchPoint of its child`, i.e. the next link's
  // branchedFromMessageId.
  const chain: Array<{
    conversationId: string;
    branchedFromMessageId: string | null;
  }> = [];

  let cursor: string | null = conversationId;
  let depthCapped = false;

  for (let depth = 0; depth <= MAX_BRANCH_DEPTH; depth++) {
    if (cursor == null) break;

    if (depth === MAX_BRANCH_DEPTH) {
      // We've already followed MAX_BRANCH_DEPTH parent links and the cursor
      // still points to a real conversation. The chain is degenerate — stop
      // here with a flag so the caller can render a truncation notice.
      depthCapped = true;
      break;
    }

    const conv = (await db
      .select({
        id: conversations.id,
        parentConversationId: conversations.parentConversationId,
        branchedFromMessageId: conversations.branchedFromMessageId,
      })
      .from(conversations)
      .where(eq(conversations.id, cursor))
      .get()) as
      | {
          id: string;
          parentConversationId: string | null;
          branchedFromMessageId: string | null;
        }
      | undefined;

    if (!conv) break;

    chain.push({
      conversationId: conv.id,
      branchedFromMessageId: conv.branchedFromMessageId,
    });

    cursor = conv.parentConversationId;
  }

  // Reverse to root-to-leaf order. For each link, the messages we include
  // are bounded by the NEXT link's branchedFromMessageId (the prefix that
  // child conversation forked from). The last link (the leaf, current
  // conversation) has no upper bound.
  chain.reverse();

  const all: ChatMessageRow[] = [];
  for (let i = 0; i < chain.length; i++) {
    const link = chain[i];
    const childBranchedFromId = chain[i + 1]?.branchedFromMessageId ?? null;

    // Cutoff is by rowid, not createdAt: chat_messages.createdAt is stored
    // at second resolution (`mode: "timestamp"`), so messages inserted in
    // the same second can't be ordered reliably by timestamp. SQLite's
    // implicit rowid is monotonically assigned at INSERT, unique per row,
    // and exactly the property the cutoff needs ("at-or-before this
    // message in insertion order"). For real-world chat this matches
    // createdAt ordering; for tight test loops it still produces correct
    // results.
    const conditions = [
      eq(chatMessages.conversationId, link.conversationId),
      isNull(chatMessages.rewoundAt),
    ];
    if (childBranchedFromId) {
      conditions.push(
        sql`rowid <= (SELECT rowid FROM chat_messages WHERE id = ${childBranchedFromId})`
      );
    }

    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(...conditions))
      .orderBy(sql`rowid`)
      .all();
    all.push(...rows);
  }

  return { messages: all, depthCapped };
}

// ── Branching: rewind / redo ───────────────────────────────────────────

/**
 * chat-conversation-branches v1 — mark an assistant message and the
 * preceding user message in the same conversation as rewound. Returns
 * the user message's content so the UI can pre-fill the composer.
 *
 * Idempotent: re-rewinding an already-rewound pair is a no-op (the
 * timestamps don't change). If the assistant message has no preceding
 * user message (e.g. system-only history), only the assistant message
 * is marked.
 */
export async function markPairRewound(
  assistantMessageId: string
): Promise<{ rewoundUserContent: string | null }> {
  const assistant = (await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, assistantMessageId))
    .get()) as ChatMessageRow | undefined;

  if (!assistant) return { rewoundUserContent: null };
  if (assistant.role !== "assistant") return { rewoundUserContent: null };

  const now = new Date();

  // Find the most recent non-rewound user message at or before this one in
  // the same conversation. We use `lte` (not `lt`) on createdAt because
  // sequentially-inserted messages can share the same epoch-ms timestamp
  // when better-sqlite3 commits within a single tick. The role=user filter
  // naturally excludes the assistant message itself, so `<=` is safe.
  const priorUser = (await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, assistant.conversationId),
        eq(chatMessages.role, "user"),
        isNull(chatMessages.rewoundAt),
        lte(chatMessages.createdAt, assistant.createdAt)
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(1)
    .get()) as ChatMessageRow | undefined;

  await db
    .update(chatMessages)
    .set({ rewoundAt: now })
    .where(eq(chatMessages.id, assistant.id));

  if (priorUser) {
    await db
      .update(chatMessages)
      .set({ rewoundAt: now })
      .where(eq(chatMessages.id, priorUser.id));
  }

  return { rewoundUserContent: priorUser?.content ?? null };
}

/**
 * chat-conversation-branches v1 — clear the rewoundAt flag on the most
 * recently rewound message pair in this conversation. Returns the
 * restored message ids so the UI can re-render them as live.
 *
 * "Most recent" = highest rewoundAt timestamp. Pairs are restored
 * together (the user/assistant turn is atomic from the UI's view).
 */
export async function restoreLatestRewoundPair(
  conversationId: string
): Promise<{ restoredMessageIds: string[] }> {
  // Find the highest rewoundAt timestamp in this conversation.
  const peak = (await db
    .select({ rewoundAt: chatMessages.rewoundAt })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        sql`${chatMessages.rewoundAt} IS NOT NULL`
      )
    )
    .orderBy(desc(chatMessages.rewoundAt))
    .limit(1)
    .get()) as { rewoundAt: Date | null } | undefined;

  if (!peak?.rewoundAt) return { restoredMessageIds: [] };

  // markPairRewound writes the same timestamp to both messages in a pair,
  // so all messages with that exact rewoundAt belong to the most-recent pair.
  const peakAt = peak.rewoundAt;
  const pair = (await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        eq(chatMessages.rewoundAt, peakAt)
      )
    )
    .all()) as Array<{ id: string }>;

  if (pair.length === 0) return { restoredMessageIds: [] };

  await db
    .update(chatMessages)
    .set({ rewoundAt: null })
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        eq(chatMessages.rewoundAt, peakAt)
      )
    );

  return { restoredMessageIds: pair.map((p) => p.id) };
}

/**
 * chat-conversation-branches v1 — return all conversations in the same
 * branching tree as `conversationId`. Walks to the topmost ancestor
 * (parentConversationId IS NULL) then BFS-expands all descendants. Bounded
 * by `MAX_BRANCH_DEPTH * branching factor`, which is small in practice.
 *
 * Used by the branches tree dialog to render the family without N+1 queries.
 */
export async function getConversationFamily(
  conversationId: string
): Promise<ConversationRow[]> {
  // Phase 1: walk to root.
  let cursor: string | null = conversationId;
  let rootId: string | null = null;
  for (let depth = 0; depth <= MAX_BRANCH_DEPTH; depth++) {
    if (cursor == null) break;
    const conv = (await db
      .select({
        id: conversations.id,
        parentConversationId: conversations.parentConversationId,
      })
      .from(conversations)
      .where(eq(conversations.id, cursor))
      .get()) as
      | { id: string; parentConversationId: string | null }
      | undefined;
    if (!conv) return [];
    if (conv.parentConversationId == null) {
      rootId = conv.id;
      break;
    }
    cursor = conv.parentConversationId;
  }
  if (rootId == null) return [];

  // Phase 2: BFS down. Iteratively load children until no new ids are added.
  const known = new Set<string>([rootId]);
  const all: ConversationRow[] = [];
  const root = (await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, rootId))
    .get()) as ConversationRow | undefined;
  if (root) all.push(root);

  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = (await db
      .select()
      .from(conversations)
      .where(
        sql`${conversations.parentConversationId} IN (${sql.join(
          frontier.map((id) => sql`${id}`),
          sql.raw(", ")
        )})`
      )
      .all()) as ConversationRow[];

    const next: string[] = [];
    for (const child of children) {
      if (!known.has(child.id)) {
        known.add(child.id);
        all.push(child);
        next.push(child.id);
      }
    }
    frontier = next;
  }

  return all;
}
