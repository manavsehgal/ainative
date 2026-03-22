import { db } from "@/lib/db";
import { projects, tasks, workflows, documents, schedules } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getMessages } from "@/lib/data/chat";

// ── Token budget constants ─────────────────────────────────────────────

const TIER_0_BUDGET = 500; // System identity, time, workspace
const TIER_1_BUDGET = 8_000; // Conversation history (sliding window)
const TIER_2_BUDGET = 5_000; // Project summary data
// Tiers 3-4 are reserved for future on-demand entity/document expansion

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokenBudget(text: string, budget: number): string {
  const charBudget = budget * 4;
  if (text.length <= charBudget) return text;
  return text.slice(0, charBudget) + "\n...(truncated)";
}

// ── Tier 0: System identity ────────────────────────────────────────────

function buildTier0(projectName?: string | null, cwd?: string | null): string {
  const parts = [
    `Current time: ${new Date().toISOString()}`,
    `You are an AI assistant in the Stagent workspace.`,
  ];
  if (projectName) parts.push(`Active project: ${projectName}`);
  if (cwd) parts.push(`Working directory: ${cwd}`);
  return parts.join("\n");
}

// ── Tier 1: Conversation history ───────────────────────────────────────

interface HistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function buildTier1(
  conversationId: string
): Promise<HistoryMessage[]> {
  const messages = await getMessages(conversationId);
  const history: HistoryMessage[] = [];
  let tokenCount = 0;

  // Walk from newest to oldest, collecting until budget exhausted
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = estimateTokens(msg.content);
    if (tokenCount + tokens > TIER_1_BUDGET) break;
    tokenCount += tokens;
    history.unshift({
      role: msg.role as HistoryMessage["role"],
      content: msg.content,
    });
  }

  return history;
}

// ── Tier 2: Project context summary ────────────────────────────────────

async function buildTier2(projectId?: string | null): Promise<string> {
  if (!projectId) return "";

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) return "";

  const parts: string[] = [
    `## Project: ${project.name}`,
    project.description ? `Description: ${project.description}` : "",
  ];

  // Recent tasks (top 10)
  const recentTasks = await db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.updatedAt))
    .limit(10);

  if (recentTasks.length > 0) {
    parts.push("\n### Recent Tasks");
    for (const t of recentTasks) {
      parts.push(`- [${t.status}] ${t.title} (id: ${t.id.slice(0, 8)})`);
    }
  }

  // Active workflows (top 5)
  const activeWorkflows = await db
    .select({ id: workflows.id, name: workflows.name, status: workflows.status })
    .from(workflows)
    .where(and(eq(workflows.projectId, projectId)))
    .orderBy(desc(workflows.updatedAt))
    .limit(5);

  if (activeWorkflows.length > 0) {
    parts.push("\n### Workflows");
    for (const w of activeWorkflows) {
      parts.push(`- [${w.status}] ${w.name} (id: ${w.id.slice(0, 8)})`);
    }
  }

  // Document count
  const docs = await db
    .select({ id: documents.id, filename: documents.originalName })
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .limit(10);

  if (docs.length > 0) {
    parts.push(`\n### Documents (${docs.length})`);
    for (const d of docs) {
      parts.push(`- ${d.filename} (id: ${d.id.slice(0, 8)})`);
    }
  }

  const text = parts.filter(Boolean).join("\n");
  return truncateToTokenBudget(text, TIER_2_BUDGET);
}

// ── Public API ─────────────────────────────────────────────────────────

export interface ChatContext {
  systemPrompt: string;
  history: HistoryMessage[];
}

/**
 * Build the full context for a chat turn.
 * Returns a system prompt (Tier 0 + Tier 2) and conversation history (Tier 1).
 */
export async function buildChatContext(opts: {
  conversationId: string;
  projectId?: string | null;
  projectName?: string | null;
  cwd?: string | null;
}): Promise<ChatContext> {
  const [history, tier2] = await Promise.all([
    buildTier1(opts.conversationId),
    buildTier2(opts.projectId),
  ]);

  const tier0 = buildTier0(opts.projectName, opts.cwd);

  const systemParts = [tier0];
  if (tier2) systemParts.push(tier2);

  return {
    systemPrompt: systemParts.join("\n\n"),
    history,
  };
}
