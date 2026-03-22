import { db } from "@/lib/db";
import { projects, tasks, workflows, schedules } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { PromptCategory, SuggestedPrompt } from "./types";

function truncate(text: string, max = 40): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

// ── Explore category ───────────────────────────────────────────────────

async function buildExplorePrompts(): Promise<SuggestedPrompt[]> {
  const prompts: SuggestedPrompt[] = [];

  const activeProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.status, "active"))
    .orderBy(desc(projects.updatedAt))
    .limit(3);

  for (const p of activeProjects) {
    prompts.push({
      label: `Status of ${truncate(p.name)}`,
      prompt: `Give me a detailed status update on the "${p.name}" project, including task progress, active workflows, and any blockers. If you need more context, ask me 1-2 clarifying questions.`,
    });
  }

  const runningTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.status, "running"))
    .orderBy(desc(tasks.updatedAt))
    .limit(2);

  for (const t of runningTasks) {
    prompts.push({
      label: `Check on "${truncate(t.title, 30)}"`,
      prompt: `What's the current status of the running task "${t.title}" (id: ${t.id})? Show me the latest execution logs and any tool approvals that might be pending.`,
    });
  }

  // Fill with static fallbacks
  const fallbacks: SuggestedPrompt[] = [
    {
      label: "What projects am I working on?",
      prompt: "Give me an overview of all my active projects, their current status, task counts, and recent activity. Highlight anything that needs my attention.",
    },
    {
      label: "Show recent activity",
      prompt: "Summarize what was accomplished today across all projects. Include completed tasks, running workflows, and any errors that occurred.",
    },
    {
      label: "Summarize my workspace",
      prompt: "Give me a comprehensive workspace summary: active projects, pending tasks, scheduled jobs, and document counts. What should I focus on next?",
    },
  ];

  for (const f of fallbacks) {
    if (prompts.length >= 5) break;
    if (!prompts.some((p) => p.label === f.label)) prompts.push(f);
  }

  return prompts.slice(0, 5);
}

// ── Create category ────────────────────────────────────────────────────

function buildCreatePrompts(): SuggestedPrompt[] {
  return [
    {
      label: "Help me create a new task",
      prompt: "Help me create a new task. Ask me about the title, description, priority, and which project it belongs to. Suggest appropriate defaults based on my active projects.",
    },
    {
      label: "Set up a multi-step workflow",
      prompt: "Help me design a multi-step workflow. I want to define a sequence of tasks with dependencies. Ask me what the workflow should accomplish and suggest a structure.",
    },
    {
      label: "Draft a document outline",
      prompt: "Help me create a structured document outline. Ask me about the topic, audience, and purpose, then suggest sections and key points to cover.",
    },
    {
      label: "Create a new project",
      prompt: "Help me set up a new project. Ask me about the project name, goals, and what tasks I should create to get started. Suggest a project structure based on best practices.",
    },
    {
      label: "Design an agent profile",
      prompt: "Help me design a custom agent profile. Ask me about the domain, key behaviors, tool permissions, and output format I want. Suggest a SKILL.md structure based on existing profiles.",
    },
  ];
}

// ── Debug category ─────────────────────────────────────────────────────

async function buildDebugPrompts(): Promise<SuggestedPrompt[]> {
  const prompts: SuggestedPrompt[] = [];

  const failedTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.status, "failed"))
    .orderBy(desc(tasks.updatedAt))
    .limit(3);

  for (const t of failedTasks) {
    prompts.push({
      label: `Why did "${truncate(t.title, 30)}" fail?`,
      prompt: `The task "${t.title}" (id: ${t.id}) recently failed. Can you investigate what went wrong? Check the execution logs and suggest how to fix it. If you need more context, ask me 1-2 clarifying questions.`,
    });
  }

  const fallbacks: SuggestedPrompt[] = [
    {
      label: "Show all failed tasks this week",
      prompt: "List all tasks that failed in the past 7 days, grouped by project. For each one, show the task name, when it failed, and a brief summary of the error if available.",
    },
    {
      label: "What errors occurred today?",
      prompt: "Check for any errors or failures that occurred today across all projects. Include failed tasks, workflow errors, and budget alerts. Prioritize by severity.",
    },
    {
      label: "Check system health",
      prompt: "Give me a system health check: are there any running tasks stuck for too long, failed schedules, or budget warnings? Highlight anything that needs immediate attention.",
    },
    {
      label: "Review agent execution logs",
      prompt: "Show me the most recent agent execution logs. Are there any patterns of failures, tool denials, or timeout issues? Suggest improvements to prevent recurring problems.",
    },
  ];

  for (const f of fallbacks) {
    if (prompts.length >= 5) break;
    if (!prompts.some((p) => p.label === f.label)) prompts.push(f);
  }

  return prompts.slice(0, 5);
}

// ── Automate category ──────────────────────────────────────────────────

async function buildAutomatePrompts(): Promise<SuggestedPrompt[]> {
  const prompts: SuggestedPrompt[] = [];

  const activeSchedules = await db
    .select({ id: schedules.id, name: schedules.name })
    .from(schedules)
    .where(eq(schedules.status, "active"))
    .orderBy(desc(schedules.updatedAt))
    .limit(2);

  for (const s of activeSchedules) {
    prompts.push({
      label: `Check on "${truncate(s.name, 30)}"`,
      prompt: `What's the status of the schedule "${s.name}" (id: ${s.id})? Show me its firing history, next scheduled run, and any recent errors.`,
    });
  }

  const fallbacks: SuggestedPrompt[] = [
    {
      label: "Set up a daily status report",
      prompt: "Help me set up a daily scheduled task that generates a project status report. Ask me which projects to include, what time to run, and what format the report should be in.",
    },
    {
      label: "Create a recurring workflow",
      prompt: "Help me create a recurring workflow that runs on a schedule. Ask me about the steps, frequency, and what should happen if a step fails.",
    },
    {
      label: "Design an autonomous loop",
      prompt: "Help me set up an autonomous execution loop with stop conditions. Ask me about the task, iteration limit, success criteria, and what triggers should pause or stop the loop.",
    },
    {
      label: "Monitor my scheduled tasks",
      prompt: "Give me an overview of all my active schedules: their frequency, last firing time, next scheduled run, and any that have errors or are overdue.",
    },
  ];

  for (const f of fallbacks) {
    if (prompts.length >= 5) break;
    if (!prompts.some((p) => p.label === f.label)) prompts.push(f);
  }

  return prompts.slice(0, 5);
}

// ── Smart picks category ───────────────────────────────────────────────

async function buildSmartPrompts(): Promise<SuggestedPrompt[]> {
  const prompts: SuggestedPrompt[] = [];

  // Priority 1: Failed tasks
  const failedTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.status, "failed"))
    .orderBy(desc(tasks.updatedAt))
    .limit(1);

  if (failedTasks.length > 0) {
    prompts.push({
      label: `Fix "${truncate(failedTasks[0].title, 30)}"`,
      prompt: `The task "${failedTasks[0].title}" (id: ${failedTasks[0].id}) recently failed. Investigate the root cause and suggest a fix. If you can identify the issue, propose a corrective action.`,
    });
  }

  // Priority 2: Running tasks
  const runningTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.status, "running"))
    .orderBy(desc(tasks.updatedAt))
    .limit(1);

  if (runningTasks.length > 0) {
    prompts.push({
      label: `Monitor "${truncate(runningTasks[0].title, 30)}"`,
      prompt: `Check on the running task "${runningTasks[0].title}" (id: ${runningTasks[0].id}). Show me its progress, any pending tool approvals, and estimated completion.`,
    });
  }

  // Priority 3: Active project status
  const activeProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.status, "active"))
    .orderBy(desc(projects.updatedAt))
    .limit(1);

  if (activeProjects.length > 0) {
    prompts.push({
      label: `Update on ${truncate(activeProjects[0].name)}`,
      prompt: `Give me a quick status update on "${activeProjects[0].name}": open tasks, recent completions, and what needs attention next.`,
    });
  }

  // Fill with cross-category highlights
  const fallbacks: SuggestedPrompt[] = [
    {
      label: "What should I focus on?",
      prompt: "Analyze my workspace and recommend what I should focus on next. Consider task priorities, deadlines, failed items that need attention, and workflow progress. Give me a prioritized action list.",
    },
    {
      label: "Morning standup summary",
      prompt: "Generate a standup summary: what was completed yesterday, what's planned for today, and are there any blockers? Cover all active projects.",
    },
    {
      label: "Review cost & usage",
      prompt: "Give me a summary of my API usage and costs. How many tasks ran this week, what models were used, and what's my remaining budget? Flag any unusual spending patterns.",
    },
    {
      label: "Workspace health check",
      prompt: "Run a comprehensive workspace health check: project status, failed tasks, overdue schedules, budget health, and document processing status. Highlight anything requiring action.",
    },
  ];

  for (const f of fallbacks) {
    if (prompts.length >= 5) break;
    prompts.push(f);
  }

  return prompts.slice(0, 5);
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Generate context-aware prompt categories with sub-prompts.
 * Returns 5 categories, each with up to 5 prompts.
 * DB-driven prompts use real entity names; static fallbacks fill gaps.
 */
export async function getPromptCategories(): Promise<PromptCategory[]> {
  const [explore, debug, automate, smart] = await Promise.all([
    buildExplorePrompts(),
    buildDebugPrompts(),
    buildAutomatePrompts(),
    buildSmartPrompts(),
  ]);

  return [
    { id: "explore", label: "Explore", icon: "Search", prompts: explore },
    { id: "create", label: "Create", icon: "PlusCircle", prompts: buildCreatePrompts() },
    { id: "debug", label: "Debug", icon: "Bug", prompts: debug },
    { id: "automate", label: "Automate", icon: "Zap", prompts: automate },
    { id: "smart", label: "Smart picks", icon: "Sparkles", prompts: smart },
  ];
}
