import { db } from "@/lib/db";
import { workflows, agentLogs } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { WorkflowDefinition, WorkflowState, StepState } from "./types";

export interface TimelineEvent {
  timestamp: string;
  event: string;
  severity: "success" | "warning" | "error";
  details: string;
  stepId?: string;
}

export interface FixSuggestion {
  tier: "quick" | "better" | "best";
  title: string;
  description: string;
  action?: string;
}

export interface DebugAnalysis {
  rootCause: {
    type: "budget_exceeded" | "timeout" | "transient" | "unknown";
    summary: string;
  };
  timeline: TimelineEvent[];
  suggestions: FixSuggestion[];
  stepErrors: Array<{
    stepId: string;
    stepName: string;
    error: string;
  }>;
}

function classifyRootCause(errors: string[]): DebugAnalysis["rootCause"] {
  const combined = errors.join(" ");

  if (/budget|Budget|maximum budget/i.test(combined)) {
    return {
      type: "budget_exceeded",
      summary: "The workflow exceeded its allocated budget before completing all steps.",
    };
  }

  if (/timeout|max turns|Turn limit/i.test(combined)) {
    return {
      type: "timeout",
      summary: "The workflow ran out of turns or hit a timeout before completing.",
    };
  }

  if (/connection|rate limit|ECONNREFUSED/i.test(combined)) {
    return {
      type: "transient",
      summary: "A transient network or rate-limit error interrupted the workflow.",
    };
  }

  return {
    type: "unknown",
    summary: errors.length > 0
      ? `Workflow failed: ${errors[0].slice(0, 200)}`
      : "The workflow failed for an unknown reason.",
  };
}

function buildSuggestions(type: DebugAnalysis["rootCause"]["type"]): FixSuggestion[] {
  switch (type) {
    case "budget_exceeded":
      return [
        {
          tier: "quick",
          title: "Raise budget to $10",
          description: "Increase the per-step or workflow budget cap to allow the agent more room to finish.",
          action: "raise_budget",
        },
        {
          tier: "better",
          title: "Reduce document context per step",
          description: "Attach fewer or smaller documents to each step so the agent consumes less budget on context.",
          action: "reduce_docs",
        },
        {
          tier: "best",
          title: "Split into smaller workflows",
          description: "Break the workflow into focused sub-workflows that each stay within budget.",
          action: "restructure",
        },
      ];
    case "timeout":
      return [
        {
          tier: "quick",
          title: "Increase max turns to 100",
          description: "Give the agent more turns to complete complex reasoning chains.",
        },
        {
          tier: "better",
          title: "Simplify step prompts",
          description: "Reduce prompt complexity so the agent can finish in fewer turns.",
        },
        {
          tier: "best",
          title: "Break complex steps into sub-steps",
          description: "Decompose multi-part steps so each one is tractable within the turn limit.",
        },
      ];
    case "transient":
      return [
        {
          tier: "quick",
          title: "Retry the workflow",
          description: "The error was likely temporary. Re-running may succeed without changes.",
        },
        {
          tier: "better",
          title: "Switch to a different runtime",
          description: "Use an alternative agent runtime that may have better availability.",
        },
        {
          tier: "best",
          title: "Add retry logic to step definitions",
          description: "Configure automatic retries on transient failures for resilient execution.",
        },
      ];
    default:
      return [
        {
          tier: "quick",
          title: "Check agent logs for details",
          description: "Review the full agent log output for the failed step to understand the error.",
        },
        {
          tier: "better",
          title: "Simplify workflow",
          description: "Reduce the number of steps or prompt complexity to isolate the failure.",
        },
        {
          tier: "best",
          title: "Contact support",
          description: "If the issue persists, reach out with the workflow ID and debug timeline.",
        },
      ];
  }
}

function mapEventSeverity(event: string): TimelineEvent["severity"] {
  if (event.includes("failed") || event.includes("error")) return "error";
  if (event.includes("completed") || event.includes("success")) return "success";
  return "warning";
}

export async function analyzeWorkflowFailure(workflowId: string): Promise<DebugAnalysis> {
  // 1. Fetch workflow and parse state
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const definition: WorkflowDefinition & { _state?: WorkflowState } = JSON.parse(
    workflow.definition
  );
  const state = definition._state;

  // 2. Query agent_logs for this workflow
  const logs = await db
    .select()
    .from(agentLogs)
    .where(sql`${agentLogs.payload} LIKE ${"%" + workflowId + "%"}`)
    .orderBy(agentLogs.timestamp);

  // 3. Build timeline from agent_logs
  const timeline: TimelineEvent[] = logs.map((log) => {
    let details = "";
    try {
      const payload = JSON.parse(log.payload ?? "{}");
      details = payload.error || payload.result?.slice(0, 200) || payload.stepName || log.event;
    } catch {
      details = log.event;
    }

    let stepId: string | undefined;
    try {
      const payload = JSON.parse(log.payload ?? "{}");
      stepId = payload.stepId;
    } catch {
      // ignore
    }

    return {
      timestamp: log.timestamp instanceof Date
        ? log.timestamp.toISOString()
        : new Date(log.timestamp).toISOString(),
      event: log.event,
      severity: mapEventSeverity(log.event),
      details,
      stepId,
    };
  });

  // 4. Extract step errors from _state
  const stepErrors: DebugAnalysis["stepErrors"] = [];
  const errorMessages: string[] = [];

  if (state?.stepStates) {
    for (const ss of state.stepStates) {
      if (ss.status === "failed" && ss.error) {
        const stepDef = definition.steps.find((s) => s.id === ss.stepId);
        stepErrors.push({
          stepId: ss.stepId,
          stepName: stepDef?.name ?? ss.stepId,
          error: ss.error,
        });
        errorMessages.push(ss.error);
      }
    }
  }

  // Also gather errors from logs if no step errors found
  if (errorMessages.length === 0) {
    for (const log of logs) {
      try {
        const payload = JSON.parse(log.payload ?? "{}");
        if (payload.error) {
          errorMessages.push(payload.error);
        }
      } catch {
        // ignore
      }
    }
  }

  // 5. Classify root cause
  const rootCause = classifyRootCause(errorMessages);

  // 6. Generate suggestions
  const suggestions = buildSuggestions(rootCause.type);

  return {
    rootCause,
    timeline,
    suggestions,
    stepErrors,
  };
}
