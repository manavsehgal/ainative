import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";
import {
  searchConversations,
  searchMessages,
  getMessages,
  getConversation,
} from "@/lib/data/chat";

export function chatHistoryTools(ctx: ToolContext) {
  return [
    // ── list_conversations ──────────────────────────────────────────
    defineTool(
      "list_conversations",
      "List recent chat conversations. Use to find past discussions, filter by project or status, or search titles.",
      {
        projectId: z.string().optional().describe("Filter by project ID"),
        status: z
          .enum(["active", "archived"])
          .optional()
          .describe("Filter by status (default: active)"),
        search: z
          .string()
          .optional()
          .describe("Search conversation titles"),
        limit: z
          .number()
          .optional()
          .describe("Max results (default 20, max 50)"),
      },
      async (args) => {
        try {
          const rows = await searchConversations({
            search: args.search,
            projectId: args.projectId ?? ctx.projectId ?? undefined,
            status: args.status ?? "active",
            limit: args.limit,
          });

          const results = rows.map((r) => ({
            id: r.id,
            title: r.title,
            modelId: r.modelId,
            runtimeId: r.runtimeId,
            status: r.status,
            messageCount: r.messageCount,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }));

          return ok(results);
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to list conversations"
          );
        }
      }
    ),

    // ── get_conversation_messages ────────────────────────────────────
    defineTool(
      "get_conversation_messages",
      "Get message history from a past conversation. Use to recall what was discussed, review decisions, or find specific information from a prior chat.",
      {
        conversationId: z
          .string()
          .describe("The conversation ID to fetch messages from"),
        limit: z
          .number()
          .optional()
          .describe("Max messages to return (default 50, max 100)"),
        role: z
          .enum(["user", "assistant"])
          .optional()
          .describe("Filter by message role"),
      },
      async (args) => {
        try {
          const conversation = await getConversation(args.conversationId);
          if (!conversation) {
            return err("Conversation not found");
          }

          const limit = Math.min(args.limit ?? 50, 100);
          const allMessages = await getMessages(args.conversationId, { limit });

          // Filter by role and exclude system messages
          const messages = allMessages
            .filter((m) => m.role !== "system")
            .filter((m) => !args.role || m.role === args.role)
            .map((m) => ({
              id: m.id,
              role: m.role,
              content:
                m.content.length > 500
                  ? m.content.slice(0, 500) + "..."
                  : m.content,
              createdAt: m.createdAt,
            }));

          return ok({
            conversation: {
              id: conversation.id,
              title: conversation.title,
              modelId: conversation.modelId,
              createdAt: conversation.createdAt,
            },
            messages,
          });
        } catch (e) {
          return err(
            e instanceof Error
              ? e.message
              : "Failed to get conversation messages"
          );
        }
      }
    ),

    // ── search_messages ─────────────────────────────────────────────
    defineTool(
      "search_messages",
      "Search across all conversations for specific content. Use when the user asks about prior discussions, decisions, or any topic from past chats.",
      {
        query: z
          .string()
          .describe("Text to search for in message content"),
        projectId: z
          .string()
          .optional()
          .describe("Scope search to a specific project's conversations"),
        limit: z
          .number()
          .optional()
          .describe("Max results (default 20, max 50)"),
      },
      async (args) => {
        try {
          const rows = await searchMessages({
            query: args.query,
            projectId: args.projectId ?? ctx.projectId ?? undefined,
            limit: args.limit,
          });

          // Build content snippets (~200 chars around match)
          const results = rows.map((r) => {
            const idx = r.content
              .toLowerCase()
              .indexOf(args.query.toLowerCase());
            const start = Math.max(0, idx - 100);
            const end = Math.min(r.content.length, idx + args.query.length + 100);
            const snippet =
              (start > 0 ? "..." : "") +
              r.content.slice(start, end) +
              (end < r.content.length ? "..." : "");

            return {
              conversationId: r.conversationId,
              conversationTitle: r.conversationTitle,
              messageId: r.messageId,
              role: r.role,
              contentSnippet: snippet,
              createdAt: r.createdAt,
            };
          });

          return ok(results);
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to search messages"
          );
        }
      }
    ),
  ];
}
