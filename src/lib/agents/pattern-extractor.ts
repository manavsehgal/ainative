import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { tasks, agentLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getActiveLearnedContext,
  proposeContextAddition,
} from "./learned-context";

export interface PatternEntry {
  title: string;
  description: string;
  category: "error_resolution" | "best_practice" | "shortcut" | "preference";
}

export interface PatternProposal {
  patterns: PatternEntry[];
}

const PATTERN_TOOL: Anthropic.Messages.Tool = {
  name: "propose_learned_patterns",
  description:
    "Propose patterns learned from this task execution that should be remembered for future tasks with this profile.",
  input_schema: {
    type: "object" as const,
    properties: {
      patterns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short pattern name (2-6 words)",
            },
            description: {
              type: "string",
              description:
                "Concise description of the pattern or lesson (1-2 sentences)",
            },
            category: {
              type: "string",
              enum: [
                "error_resolution",
                "best_practice",
                "shortcut",
                "preference",
              ],
            },
          },
          required: ["title", "description", "category"],
        },
        description:
          "Patterns worth remembering. Return empty array if nothing notable.",
      },
    },
    required: ["patterns"],
  },
};

/**
 * Analyze a completed task for patterns worth learning.
 * Makes a focused Claude API call, then proposes additions if patterns found.
 * Returns the notification ID if a proposal was created, null otherwise.
 */
export async function analyzeForLearnedPatterns(
  taskId: string,
  profileId: string
): Promise<string | null> {
  // Gather task data
  const [task] = await db
    .select({
      title: tasks.title,
      description: tasks.description,
      result: tasks.result,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!task) return null;

  // Get recent agent logs for this task (last 20)
  const logs = await db
    .select({ event: agentLogs.event, payload: agentLogs.payload })
    .from(agentLogs)
    .where(eq(agentLogs.taskId, taskId))
    .orderBy(desc(agentLogs.timestamp))
    .limit(20);

  const currentContext = getActiveLearnedContext(profileId);

  // Build a compact representation of logs
  const logSummary = logs
    .map((log) => {
      const payload = log.payload
        ? JSON.stringify(JSON.parse(log.payload)).slice(0, 200)
        : "";
      return `[${log.event}] ${payload}`;
    })
    .join("\n");

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools: [PATTERN_TOOL],
    tool_choice: { type: "tool", name: "propose_learned_patterns" },
    messages: [
      {
        role: "user",
        content: `Analyze this completed task for patterns worth learning for the "${profileId}" agent profile.

## Task
Title: ${task.title}
Description: ${(task.description ?? "").slice(0, 500)}

## Result (truncated)
${(task.result ?? "No result").slice(0, 1500)}

## Recent Agent Logs
${logSummary.slice(0, 2000)}

## Currently Learned Context
${currentContext ?? "(none yet)"}

Extract ONLY genuinely useful patterns — things that would help this profile avoid mistakes or work more efficiently on similar future tasks. If this task was routine with nothing notable, return an empty patterns array. Do NOT repeat patterns already in the learned context.`,
      },
    ],
  });

  // Extract the tool use result
  const toolBlock = response.content.find(
    (block) => block.type === "tool_use" && block.name === "propose_learned_patterns"
  );

  if (!toolBlock || toolBlock.type !== "tool_use") return null;

  const proposal = toolBlock.input as PatternProposal;
  if (!proposal.patterns || proposal.patterns.length === 0) return null;

  // Format patterns as text for the proposal
  const formattedAdditions = proposal.patterns
    .map(
      (p) =>
        `### ${p.title} [${p.category}]\n${p.description}`
    )
    .join("\n\n");

  return proposeContextAddition(profileId, taskId, formattedAdditions);
}
