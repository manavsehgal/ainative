import type { WorkflowDefinition } from "./types";
import { getWorkflowOptimizationHints } from "./execution-stats";
import { estimateWorkflowCost } from "./cost-estimator";

export type SuggestionType =
  | "document_binding"
  | "budget_estimate"
  | "runtime_recommendation"
  | "pattern_insight";

export interface OptimizationSuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  data: Record<string, unknown>;
  action?: {
    label: string;
    type: string;
    payload: Record<string, unknown>;
  };
}

/**
 * Generate optimization suggestions for a workflow definition.
 * Analyzes document bindings, budget, runtime, and pattern choices
 * against historical execution data.
 *
 * Graceful on errors — each sub-analysis is independent and failures
 * are caught so the remaining suggestions still return.
 */
export async function generateOptimizationSuggestions(
  definition: Partial<WorkflowDefinition>,
  workflowId?: string
): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = [];

  // ── Document Binding Analysis ──────────────────────────────────────
  try {
    const steps = definition.steps ?? [];
    if (steps.length > 0) {
      // Collect all document IDs referenced at the workflow level (global docs)
      const globalDocIds: string[] = [];
      for (const step of steps) {
        if (step.documentIds) {
          for (const docId of step.documentIds) {
            if (!globalDocIds.includes(docId)) {
              globalDocIds.push(docId);
            }
          }
        }
      }

      const stepCount = steps.length;
      const docCount = globalDocIds.length;

      // If many docs across many steps, per-step binding reduces redundant injections
      if (stepCount > 2 && docCount > 3) {
        const totalInjections = docCount * stepCount;
        // Estimate that per-step binding typically needs ~40% of total injections
        const perStepInjections = Math.max(
          stepCount,
          Math.round(totalInjections * 0.4)
        );

        suggestions.push({
          type: "document_binding",
          title: "Reduce document injections with per-step binding",
          description: `${docCount} docs × ${stepCount} steps = ${totalInjections} injections → only ${perStepInjections} needed with per-step binding`,
          data: {
            globalDocCount: docCount,
            stepCount,
            totalInjections,
            perStepInjections,
          },
          action: {
            label: "Enable per-step docs",
            type: "set_per_step_docs",
            payload: { strategy: "per-step" },
          },
        });
      }
    }
  } catch {
    // Silently skip document binding analysis on error
  }

  // ── Budget Estimate ────────────────────────────────────────────────
  try {
    if (workflowId) {
      const costEstimate = await estimateWorkflowCost(workflowId);

      if (costEstimate.steps.length > 0) {
        const perStepBreakdown = costEstimate.steps.map((s) => ({
          name: s.name,
          estimatedCostUsd: s.estimatedCostUsd,
          budgetCapUsd: s.budgetCapUsd,
        }));

        suggestions.push({
          type: "budget_estimate",
          title: `Estimated cost: $${costEstimate.totalEstimatedCostUsd.toFixed(4)}`,
          description: costEstimate.overBudget
            ? `Over budget — total cap is $${costEstimate.totalBudgetCapUsd.toFixed(2)}. ${costEstimate.warnings[0] ?? ""}`
            : `Within budget cap of $${costEstimate.totalBudgetCapUsd.toFixed(2)}`,
          data: {
            totalEstimatedCostUsd: costEstimate.totalEstimatedCostUsd,
            totalBudgetCapUsd: costEstimate.totalBudgetCapUsd,
            overBudget: costEstimate.overBudget,
            perStepBreakdown,
            warnings: costEstimate.warnings,
          },
          action: costEstimate.overBudget
            ? {
                label: "Adjust budget",
                type: "set_budget",
                payload: {
                  suggestedBudgetUsd:
                    Math.round(costEstimate.totalEstimatedCostUsd * 1.3 * 100) / 100,
                },
              }
            : undefined,
        });
      }
    }
  } catch {
    // Silently skip budget analysis on error
  }

  // ── Runtime + Pattern Recommendation ───────────────────────────────
  try {
    const pattern = definition.pattern ?? "sequence";
    const stepCount = definition.steps?.length ?? 0;

    // Count docs across all steps
    let docCount = 0;
    for (const step of definition.steps ?? []) {
      docCount += step.documentIds?.length ?? 0;
    }

    const hints = await getWorkflowOptimizationHints(pattern, stepCount, docCount);

    // Runtime recommendation
    if (hints.runtimeRecommendation) {
      const successPct = hints.similarWorkflowStats
        ? `${Math.round(hints.similarWorkflowStats.successRate * 100)}%`
        : "N/A";

      suggestions.push({
        type: "runtime_recommendation",
        title: `Recommended runtime: ${hints.runtimeRecommendation}`,
        description: `Based on ${hints.similarWorkflowStats?.sampleCount ?? 0} similar runs with ${successPct} success rate`,
        data: {
          runtimeId: hints.runtimeRecommendation,
          similarWorkflowStats: hints.similarWorkflowStats,
        },
        action: {
          label: "Use this runtime",
          type: "set_runtime",
          payload: { runtimeId: hints.runtimeRecommendation },
        },
      });
    }

    // Pattern comparison — suggest alternative if >20% better success rate
    if (hints.patternComparison) {
      const altSuccessPct = Math.round(hints.patternComparison.successRate * 100);
      const currentSuccessPct = hints.similarWorkflowStats
        ? Math.round(hints.similarWorkflowStats.successRate * 100)
        : 0;

      suggestions.push({
        type: "pattern_insight",
        title: `Consider "${hints.patternComparison.pattern}" pattern`,
        description: `${altSuccessPct}% success rate vs ${currentSuccessPct}% for "${pattern}" — a ${altSuccessPct - currentSuccessPct}% improvement`,
        data: {
          currentPattern: pattern,
          suggestedPattern: hints.patternComparison.pattern,
          currentSuccessRate: currentSuccessPct,
          suggestedSuccessRate: altSuccessPct,
        },
        action: {
          label: "Switch pattern",
          type: "change_pattern",
          payload: { pattern: hints.patternComparison.pattern },
        },
      });
    }
  } catch {
    // Silently skip runtime/pattern analysis on error
  }

  return suggestions;
}
