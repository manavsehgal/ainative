import { db } from "@/lib/db";
import {
  conversations,
  chatMessages,
  type ConversationRow,
  type ChatMessageRow,
} from "@/lib/db/schema";
import { eq, and, desc, gt, like, sql, count } from "drizzle-orm";
import { randomUUID } from "crypto";

// ── Types ──────────────────────────────────────────────────────────────

export interface CreateConversationInput {
  projectId?: string | null;
  title?: string | null;
  runtimeId: string;
  modelId?: string | null;
  sessionId?: string | null;
  contextScope?: string | null;
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
