/**
 * Heartbeat prompt builder.
 *
 * Constructs the system prompt and task description for heartbeat evaluations.
 * The agent receives the checklist and must return a structured JSON response
 * indicating whether any items need action.
 */

export interface HeartbeatChecklistItem {
  id: string;
  instruction: string;
  priority: "high" | "medium" | "low";
}

export interface HeartbeatEvaluation {
  action_needed: boolean;
  items: Array<{
    id: string;
    status: "action_needed" | "ok" | "skipped";
    summary: string;
  }>;
}

/**
 * Build the task description for a heartbeat evaluation run.
 */
export function buildHeartbeatPrompt(
  checklist: HeartbeatChecklistItem[],
  scheduleName: string
): string {
  const checklistLines = checklist
    .map(
      (item, i) =>
        `${i + 1}. [${item.priority.toUpperCase()}] (id: "${item.id}") ${item.instruction}`
    )
    .join("\n");

  return `You are performing a heartbeat check for "${scheduleName}".

Evaluate each checklist item below and determine whether any action is needed.

## Checklist

${checklistLines}

## Instructions

For each item, evaluate whether the condition described needs attention RIGHT NOW.
- If the item's condition is satisfied (something needs attention), mark it as "action_needed"
- If everything looks normal, mark it as "ok"
- If you cannot evaluate the item (missing data, access issues), mark it as "skipped"

## Required Response Format

You MUST respond with ONLY a JSON object (no markdown, no explanation outside the JSON):

\`\`\`json
{
  "action_needed": true,
  "items": [
    {"id": "item-id", "status": "action_needed", "summary": "Brief description of what needs attention"},
    {"id": "item-id", "status": "ok", "summary": "Brief description of current state"}
  ]
}
\`\`\`

Set "action_needed" to true if ANY item has status "action_needed". Otherwise set it to false.`;
}

/**
 * Parse a heartbeat evaluation response from the agent.
 *
 * Attempts to extract structured JSON from the agent's response,
 * handling common response formats (raw JSON, markdown code blocks, etc.)
 */
export function parseHeartbeatResponse(
  response: string
): HeartbeatEvaluation | null {
  if (!response?.trim()) return null;

  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(response.trim());
    if (isValidEvaluation(parsed)) return parsed;
  } catch {
    // not raw JSON
  }

  // Try extracting from markdown code blocks
  const codeBlockMatch = response.match(
    /```(?:json)?\s*\n?([\s\S]*?)```/
  );
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (isValidEvaluation(parsed)) return parsed;
    } catch {
      // invalid JSON in code block
    }
  }

  // Try finding a JSON object in the response
  const jsonMatch = response.match(/\{[\s\S]*"action_needed"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (isValidEvaluation(parsed)) return parsed;
    } catch {
      // invalid JSON
    }
  }

  return null;
}

function isValidEvaluation(obj: unknown): obj is HeartbeatEvaluation {
  if (typeof obj !== "object" || obj === null) return false;
  const evaluation = obj as Record<string, unknown>;
  return (
    typeof evaluation.action_needed === "boolean" &&
    Array.isArray(evaluation.items)
  );
}

/**
 * Parse a heartbeat checklist from its JSON string representation.
 */
export function parseChecklist(
  json: string | null
): HeartbeatChecklistItem[] {
  if (!json) return [];
  try {
    const items = JSON.parse(json);
    if (!Array.isArray(items)) return [];
    return items
      .filter(
        (item: unknown): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          "instruction" in item
      )
      .map((item) => ({
        id: String(item.id),
        instruction: String(item.instruction),
        priority: (["high", "medium", "low"].includes(String(item.priority))
          ? String(item.priority)
          : "medium") as "high" | "medium" | "low",
      }));
  } catch {
    return [];
  }
}
