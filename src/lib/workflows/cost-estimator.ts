import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildPoolDocumentContext } from "@/lib/documents/context-builder";
import { getSetting } from "@/lib/settings/helpers";
import { WORKFLOW_STEP_MAX_BUDGET_USD } from "@/lib/constants/task-status";
import type { WorkflowDefinition, WorkflowStep } from "./types";

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Approximate cost per 1M input tokens by provider tier (conservative estimates) */
const COST_PER_MILLION_INPUT_TOKENS: Record<string, number> = {
  fast: 0.25,     // Haiku / GPT-mini tier
  balanced: 3.0,  // Sonnet / GPT-4.1 tier
  best: 15.0,     // Opus / GPT-5.4 tier
  default: 3.0,   // Conservative middle estimate
};

export interface StepCostEstimate {
  stepId: string;
  name: string;
  estimatedInputTokens: number;
  estimatedCostUsd: number;
  budgetCapUsd: number;
}

export interface WorkflowCostEstimate {
  steps: StepCostEstimate[];
  totalEstimatedCostUsd: number;
  totalBudgetCapUsd: number;
  overBudget: boolean;
  warnings: string[];
}

/**
 * Resolve the effective budget cap for a workflow step.
 *
 * Precedence (highest wins):
 *   1. step.budgetUsd (per-step override)
 *   2. User setting: budget_max_cost_per_task
 *   3. WORKFLOW_STEP_MAX_BUDGET_USD ($5)
 *   4. DEFAULT_MAX_BUDGET_USD ($2)
 */
export async function resolveStepBudget(step?: WorkflowStep): Promise<number> {
  // Per-step override
  if (step?.budgetUsd && step.budgetUsd > 0) {
    return step.budgetUsd;
  }

  // User setting
  const userBudget = await getSetting("budget_max_cost_per_task");
  if (userBudget) {
    const parsed = parseFloat(userBudget);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Workflow step constant (was dead code — now wired)
  return WORKFLOW_STEP_MAX_BUDGET_USD;
}

/**
 * Pre-flight cost estimation for a workflow.
 * Calculates expected token usage and cost per step based on document context size.
 * Returns advisory estimate — does NOT block execution.
 */
export async function estimateWorkflowCost(
  workflowId: string
): Promise<WorkflowCostEstimate> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (!workflow) {
    return {
      steps: [],
      totalEstimatedCostUsd: 0,
      totalBudgetCapUsd: 0,
      overBudget: false,
      warnings: ["Workflow not found"],
    };
  }

  const definition: WorkflowDefinition = JSON.parse(workflow.definition);
  const steps = definition.steps;
  const warnings: string[] = [];

  const stepEstimates: StepCostEstimate[] = [];
  let totalCost = 0;
  let totalBudget = 0;

  for (const step of steps) {
    // Get document context that would be injected for this step
    const poolContext = await buildPoolDocumentContext(workflowId, step.id);
    const promptTokens = estimateTokens(step.prompt);
    const docTokens = poolContext ? estimateTokens(poolContext) : 0;
    const totalInputTokens = promptTokens + docTokens;

    // Estimate cost using balanced tier (conservative)
    const costPerToken = COST_PER_MILLION_INPUT_TOKENS.default / 1_000_000;
    // Input + estimated output (~50% of input)
    const estimatedCost = totalInputTokens * costPerToken * 1.5;

    const budgetCap = await resolveStepBudget(step);

    stepEstimates.push({
      stepId: step.id,
      name: step.name,
      estimatedInputTokens: totalInputTokens,
      estimatedCostUsd: Math.round(estimatedCost * 10000) / 10000,
      budgetCapUsd: budgetCap,
    });

    totalCost += estimatedCost;
    totalBudget += budgetCap;

    if (estimatedCost > budgetCap * 0.8) {
      warnings.push(
        `Step "${step.name}" estimated at $${estimatedCost.toFixed(4)} — close to or over the $${budgetCap} cap`
      );
    }
  }

  const overBudget = totalCost > totalBudget;
  if (overBudget) {
    warnings.push(
      `Total estimated cost $${totalCost.toFixed(4)} exceeds combined budget cap $${totalBudget.toFixed(2)}`
    );
  }

  return {
    steps: stepEstimates,
    totalEstimatedCostUsd: Math.round(totalCost * 10000) / 10000,
    totalBudgetCapUsd: totalBudget,
    overBudget,
    warnings,
  };
}
