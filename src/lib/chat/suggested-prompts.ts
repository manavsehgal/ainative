import { db } from "@/lib/db";
import { projects, tasks, workflows, schedules } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export interface SuggestedPrompt {
  label: string;
  prompt: string;
  category: "explore" | "create" | "analyze" | "debug";
}

/** Default prompts when no project context is available */
const DEFAULTS: SuggestedPrompt[] = [
  {
    label: "What projects am I working on?",
    prompt: "Give me an overview of my active projects, their status, and recent activity.",
    category: "explore",
  },
  {
    label: "Create a new task",
    prompt: "Help me create a new task. Ask me about the title, description, and priority.",
    category: "create",
  },
  {
    label: "Show failed tasks",
    prompt: "List any tasks that have failed recently and suggest what might have gone wrong.",
    category: "debug",
  },
  {
    label: "Summarize today's activity",
    prompt: "Summarize what was accomplished today across all projects.",
    category: "analyze",
  },
];

/**
 * Generate context-aware suggested prompts based on current DB state.
 * Returns 4 prompts: a mix of defaults and data-driven suggestions.
 */
export async function getSuggestedPrompts(): Promise<SuggestedPrompt[]> {
  const prompts: SuggestedPrompt[] = [];

  // Check for failed tasks
  const failedTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.status, "failed"))
    .orderBy(desc(tasks.updatedAt))
    .limit(1);

  if (failedTasks.length > 0) {
    prompts.push({
      label: `Why did "${failedTasks[0].title}" fail?`,
      prompt: `The task "${failedTasks[0].title}" (id: ${failedTasks[0].id}) failed. Explain what might have gone wrong and suggest how to fix it.`,
      category: "debug",
    });
  }

  // Check for active projects
  const activeProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.status, "active"))
    .orderBy(desc(projects.updatedAt))
    .limit(3);

  if (activeProjects.length > 0) {
    const project = activeProjects[0];
    prompts.push({
      label: `Status of ${project.name}`,
      prompt: `Give me a detailed status update on the "${project.name}" project, including task progress and any blockers.`,
      category: "explore",
    });
  }

  // Check for running tasks
  const runningTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.status, "running"))
    .limit(1);

  if (runningTasks.length > 0) {
    prompts.push({
      label: `Check on "${runningTasks[0].title}"`,
      prompt: `What's the current status of the running task "${runningTasks[0].title}" (id: ${runningTasks[0].id})?`,
      category: "explore",
    });
  }

  // Fill remaining slots with defaults (avoid duplicating categories)
  const usedCategories = new Set(prompts.map((p) => p.category));
  for (const d of DEFAULTS) {
    if (prompts.length >= 4) break;
    if (!usedCategories.has(d.category)) {
      prompts.push(d);
      usedCategories.add(d.category);
    }
  }

  // If still under 4, add remaining defaults
  for (const d of DEFAULTS) {
    if (prompts.length >= 4) break;
    if (!prompts.some((p) => p.prompt === d.prompt)) {
      prompts.push(d);
    }
  }

  return prompts.slice(0, 4);
}
