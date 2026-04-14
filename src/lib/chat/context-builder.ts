import { db } from "@/lib/db";
import { projects, tasks, workflows, documents, schedules } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getMessages } from "@/lib/data/chat";
import { getProfile } from "@/lib/agents/profiles/registry";
import { STAGENT_SYSTEM_PROMPT } from "./system-prompt";
import type { WorkspaceContext } from "@/lib/environment/workspace-context";
import { expandFileMention } from "./files/expand-mention";
import { conversations } from "@/lib/db/schema";

// ── Token budget constants ─────────────────────────────────────────────

const TIER_0_BUDGET = 1500; // System identity, tool catalog, intent routing
const TIER_1_BUDGET = 8_000; // Conversation history (sliding window)
const TIER_2_BUDGET = 5_000; // Project summary data
const TIER_3_BUDGET = 8_000; // On-demand entity expansion via @mentions (sized for document content)

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

function buildTier0(
  projectName?: string | null,
  workspace?: WorkspaceContext | null
): string {
  const parts = [
    STAGENT_SYSTEM_PROMPT,
    "",
    `Current time: ${new Date().toISOString()}`,
  ];
  if (projectName) parts.push(`Active project: ${projectName}`);
  if (workspace?.cwd) parts.push(`Working directory: ${workspace.cwd}`);
  if (workspace?.gitBranch) parts.push(`Git branch: ${workspace.gitBranch}`);
  if (workspace?.isWorktree) {
    parts.push("");
    parts.push(
      "## Workspace Note\n" +
        "You are operating inside a git worktree. All file reads and writes MUST use paths " +
        "relative to the working directory shown above. Do NOT navigate to or create files " +
        "in the main repository directory. The working directory IS the correct project root."
    );
  }
  return parts.join("\n");
}

// ── Active skill injection (Ollama-first, runtime-agnostic) ────────────

/**
 * Token budget for a conversation-bound skill's SKILL.md content.
 *
 * Per spec §7.1: 1000-4000 tokens typical, with 300 tokens of index/
 * metadata on top. We cap at ~4000 tokens (≈16K chars) so a large skill
 * can't blow out a small-context local model. Single-active-skill is
 * enforced at the MCP-tool layer.
 */
const ACTIVE_SKILL_BUDGET = 4_000;

/**
 * Build the "Active Skill" section of the system prompt, if one is bound
 * to the conversation via `conversations.active_skill_id`. Returns "" for
 * conversations without an active skill.
 *
 * Primary use case: Ollama has no SDK-native skill support, so this is
 * how SKILL.md reaches a local model. Claude and Codex runtimes can
 * also bind a skill via this path alongside their native Skill tools.
 *
 * See `features/chat-ollama-native-skills.md`.
 */
async function buildActiveSkill(conversationId: string): Promise<string> {
  const row = await db
    .select({
      activeSkillId: conversations.activeSkillId,
      runtimeId: conversations.runtimeId,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();
  const id = row?.activeSkillId;
  if (!id) return "";

  // Respect the runtime capability matrix: only inject SKILL.md when the
  // active runtime declares `stagentInjectsSkills: true`. Runtimes that
  // discover skills natively (Claude SDK, Codex App Server) already load
  // the same SKILL.md from .claude/skills or .agents/skills via their
  // own machinery — injecting on top would duplicate context. Today only
  // Ollama opts in to Stagent-driven injection.
  if (row?.runtimeId) {
    try {
      const { getRuntimeFeatures } = await import("@/lib/agents/runtime/catalog");
      // Cast — runtimeId is a free-form string in the DB but the catalog
      // accepts only known IDs. Catalog throws on unknown; the catch
      // below handles that as "fall through and inject".
      const features = getRuntimeFeatures(
        row.runtimeId as Parameters<typeof getRuntimeFeatures>[0]
      );
      if (!features.stagentInjectsSkills) return "";
    } catch {
      // Unknown runtime — fall through and inject (safer default than
      // silently dropping the skill on an unrecognized runtime id).
    }
  }

  // Dynamic import keeps the scanner + fs dependency off the hot path for
  // conversations that don't have an active skill (the common case).
  const { getSkill } = await import("@/lib/environment/list-skills");
  const skill = getSkill(id);
  if (!skill) return "";

  const header = `## Active Skill: ${skill.name}\n`;
  const body = truncateToTokenBudget(skill.content, ACTIVE_SKILL_BUDGET);
  return `${header}\n${body}`;
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
      parts.push(`- [${t.status}] ${t.title} (id: ${t.id})`);
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
      parts.push(`- [${w.status}] ${w.name} (id: ${w.id})`);
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
      parts.push(`- ${d.filename} (id: ${d.id})`);
    }
  }

  const text = parts.filter(Boolean).join("\n");
  return truncateToTokenBudget(text, TIER_2_BUDGET);
}

// ── Tier 3: Mentioned entity expansion ────────────────────────────────

export interface MentionReference {
  entityType: string;
  entityId: string;
  label: string;
}

async function buildTier3(mentions: MentionReference[]): Promise<string> {
  if (!mentions.length) return "";

  const parts: string[] = ["## Referenced Entities"];

  for (const mention of mentions) {
    switch (mention.entityType) {
      case "project": {
        const project = await db
          .select()
          .from(projects)
          .where(eq(projects.id, mention.entityId))
          .get();
        if (project) {
          parts.push(`\n### Project: ${project.name}`);
          if (project.description) parts.push(`Description: ${project.description}`);
          parts.push(`Status: ${project.status}`);
          if (project.workingDirectory) parts.push(`Directory: ${project.workingDirectory}`);
          // Include recent tasks for this project
          const projectTasks = await db
            .select({ id: tasks.id, title: tasks.title, status: tasks.status })
            .from(tasks)
            .where(eq(tasks.projectId, mention.entityId))
            .orderBy(desc(tasks.updatedAt))
            .limit(5);
          if (projectTasks.length > 0) {
            parts.push("Tasks:");
            for (const t of projectTasks) {
              parts.push(`  - [${t.status}] ${t.title}`);
            }
          }
        }
        break;
      }
      case "task": {
        const task = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, mention.entityId))
          .get();
        if (task) {
          parts.push(`\n### Task: ${task.title}`);
          parts.push(`Status: ${task.status}, Priority: ${task.priority}`);
          if (task.description) parts.push(`Description: ${task.description}`);
          if (task.result) parts.push(`Result: ${task.result.slice(0, 500)}`);
        }
        break;
      }
      case "workflow": {
        const workflow = await db
          .select()
          .from(workflows)
          .where(eq(workflows.id, mention.entityId))
          .get();
        if (workflow) {
          parts.push(`\n### Workflow: ${workflow.name}`);
          parts.push(`Status: ${workflow.status}`);
          if (workflow.definition) {
            parts.push(`Definition: ${workflow.definition.slice(0, 500)}`);
          }
        }
        break;
      }
      case "document": {
        const doc = await db
          .select()
          .from(documents)
          .where(eq(documents.id, mention.entityId))
          .get();
        if (doc) {
          parts.push(`\n### Document: ${doc.originalName}`);
          parts.push(`Type: ${doc.mimeType}, Size: ${doc.size} bytes, Status: ${doc.status}`);
          if (doc.extractedText) {
            // Progressive disclosure: inline small docs, hint for large ones
            if (doc.extractedText.length <= 8000) {
              parts.push(`\nContent:\n${doc.extractedText}`);
            } else {
              parts.push(`\nContent preview:\n${doc.extractedText.slice(0, 2000)}`);
              parts.push(`\n...(${doc.extractedText.length} chars total — use the read_document_content tool with documentId "${doc.id}" to read the full text)`);
            }
          } else if (doc.status === "processing") {
            parts.push("Content: Document is still being processed. Check back shortly.");
          } else {
            parts.push("Content: No extracted text available.");
          }
        }
        break;
      }
      case "schedule": {
        const schedule = await db
          .select()
          .from(schedules)
          .where(eq(schedules.id, mention.entityId))
          .get();
        if (schedule) {
          parts.push(`\n### Schedule: ${schedule.name}`);
          parts.push(`Status: ${schedule.status}, Cron: ${schedule.cronExpression}`);
          if (schedule.prompt) parts.push(`Prompt: ${schedule.prompt}`);
        }
        break;
      }
      case "profile": {
        const profile = getProfile(mention.entityId);
        if (profile) {
          parts.push(`\n### Agent Profile: ${profile.name}`);
          parts.push(`Domain: ${profile.domain}`);
          if (profile.description) parts.push(`Description: ${profile.description}`);
          if (profile.tags?.length) parts.push(`Tags: ${profile.tags.join(", ")}`);
          if (profile.allowedTools?.length) parts.push(`Allowed Tools: ${profile.allowedTools.join(", ")}`);
          if (profile.maxTurns) parts.push(`Max Turns: ${profile.maxTurns}`);
          if (profile.outputFormat) parts.push(`Output Format: ${profile.outputFormat}`);
          if (profile.skillMd) {
            if (profile.skillMd.length <= 4000) {
              parts.push(`\nProfile Instructions (SKILL.md):\n${profile.skillMd}`);
            } else {
              parts.push(`\nProfile Instructions (SKILL.md, preview):\n${profile.skillMd.slice(0, 3000)}`);
              parts.push(`\n...(truncated — use the get_profile tool with profileId "${profile.id}" for full content)`);
            }
          }
        } else {
          parts.push(`\n### Profile: ${mention.label}`);
          parts.push(`Profile ID: ${mention.entityId} (not found in registry)`);
        }
        break;
      }
      case "file": {
        // `entityId` is a relative path scoped to the active project's
        // workingDirectory (preferred) or the stagent launch cwd (fallback).
        // Security is enforced inside expandFileMention — the caller cannot
        // influence cwd.
        const { getLaunchCwd } = await import("@/lib/environment/workspace-context");
        let cwd = getLaunchCwd();
        // If the mention has a known project context in scope, prefer the
        // project's workingDirectory. We don't have it at this scope today,
        // so launch cwd is the safe default — matches the API route.
        // (Future: plumb projectId into buildTier3 so file expansion honors
        // per-project cwds exactly the same way as the search API.)
        void cwd;
        cwd = getLaunchCwd();
        parts.push(...expandFileMention(mention.entityId, cwd));
        break;
      }
    }
  }

  const text = parts.join("\n");
  return truncateToTokenBudget(text, TIER_3_BUDGET);
}


// ── Public API ─────────────────────────────────────────────────────────

export interface ChatContext {
  systemPrompt: string;
  history: HistoryMessage[];
}

/**
 * Build the full context for a chat turn.
 * Returns a system prompt (Tier 0 + Tier 2 + Tier 3) and conversation history (Tier 1).
 */
export async function buildChatContext(opts: {
  conversationId: string;
  projectId?: string | null;
  projectName?: string | null;
  workspace?: WorkspaceContext | null;
  mentions?: MentionReference[];
}): Promise<ChatContext> {
  const [history, tier2, tier3, activeSkill] = await Promise.all([
    buildTier1(opts.conversationId),
    buildTier2(opts.projectId),
    buildTier3(opts.mentions ?? []),
    buildActiveSkill(opts.conversationId),
  ]);

  const tier0 = buildTier0(opts.projectName, opts.workspace);

  const systemParts = [tier0];

  // Active skill (from conversations.active_skill_id) sits right below
  // Tier 0 so its instructions carry the most weight. Empty string when
  // no skill is bound — common case.
  if (activeSkill) systemParts.push(activeSkill);

  if (tier3) systemParts.push(tier3);
  if (tier2) systemParts.push(tier2);

  return {
    systemPrompt: systemParts.join("\n\n"),
    history,
  };
}
