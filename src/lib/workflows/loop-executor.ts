import { db } from "@/lib/db";
import { workflows, agentLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeChildTask, updateWorkflowState } from "./engine";
import type { WorkflowDefinition, LoopState, IterationState, LoopStopReason } from "./types";
import { createInitialLoopState } from "./types";

/**
 * Execute the loop pattern — autonomous iteration with stop conditions.
 * Each iteration creates a child task, passes previous output as context,
 * and checks for completion signals, time budgets, and pause requests.
 */
export async function executeLoop(
  workflowId: string,
  definition: WorkflowDefinition
): Promise<void> {
  if (!definition.loopConfig) {
    throw new Error("Loop pattern requires loopConfig");
  }
  if (!definition.steps.length) {
    throw new Error("Loop pattern requires at least one step (the loop prompt)");
  }

  const {
    maxIterations,
    timeBudgetMs,
    assignedAgent,
    agentProfile,
    completionSignals,
  } = definition.loopConfig;
  const loopPrompt = definition.steps[0].prompt;

  // Restore existing state (resume) or create fresh
  const loopState = await restoreOrCreateLoopState(workflowId);
  loopState.status = "running";
  await updateLoopState(workflowId, loopState, "active");

  const startTime = new Date(loopState.startedAt).getTime();
  let previousOutput = "";

  // If resuming, grab the last completed iteration's result
  if (loopState.iterations.length > 0) {
    const lastCompleted = [...loopState.iterations]
      .reverse()
      .find((i) => i.status === "completed");
    if (lastCompleted?.result) {
      previousOutput = lastCompleted.result;
    }
  }

  try {
    while (loopState.currentIteration < maxIterations) {
      // Check pause: re-fetch workflow status from DB
      const [workflow] = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId));

      if (workflow?.status === "paused") {
        loopState.status = "paused";
        loopState.stopReason = "human_pause";
        await updateLoopState(workflowId, loopState, "paused");
        return;
      }

      if (workflow?.status === "completed" || workflow?.status === "draft") {
        loopState.status = "completed";
        loopState.stopReason = "human_cancel";
        await updateLoopState(workflowId, loopState, workflow.status as "completed" | "draft");
        return;
      }

      // Check time budget
      if (timeBudgetMs) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeBudgetMs) {
          await finalizeLoop(workflowId, loopState, "time_budget");
          return;
        }
      }

      const iterationNum = loopState.currentIteration + 1;

      // Build iteration prompt
      const prompt = buildIterationPrompt(
        loopPrompt,
        previousOutput,
        iterationNum,
        maxIterations
      );

      // Create iteration state
      const iterationState: IterationState = {
        iteration: iterationNum,
        taskId: "",
        status: "running",
        startedAt: new Date().toISOString(),
      };
      loopState.iterations.push(iterationState);
      await updateLoopState(workflowId, loopState, "active");

      await db.insert(agentLogs).values({
        id: crypto.randomUUID(),
        taskId: null,
        agentType: "loop-executor",
        event: "loop_iteration_started",
        payload: JSON.stringify({
          workflowId,
          iteration: iterationNum,
          maxIterations,
        }),
        timestamp: new Date(),
      });

      // Execute child task
      const result = await executeChildTask(
        workflowId,
        `Loop Iteration ${iterationNum}`,
        prompt,
        assignedAgent ?? definition.steps[0].assignedAgent,
        agentProfile ?? definition.steps[0].agentProfile
      );

      // Update iteration state
      const iterStartTime = new Date(iterationState.startedAt!).getTime();
      iterationState.taskId = result.taskId;
      iterationState.completedAt = new Date().toISOString();
      iterationState.durationMs = Date.now() - iterStartTime;

      if (result.status === "completed") {
        iterationState.status = "completed";
        iterationState.result = result.result;
        previousOutput = result.result ?? "";
      } else {
        iterationState.status = "failed";
        iterationState.error = result.error;
        await finalizeLoop(workflowId, loopState, "error");
        return;
      }

      loopState.currentIteration = iterationNum;
      await updateLoopState(workflowId, loopState, "active");

      // Check completion signal
      if (
        result.result &&
        detectCompletionSignal(result.result, completionSignals)
      ) {
        await finalizeLoop(workflowId, loopState, "agent_signaled");
        return;
      }
    }

    // Exhausted max iterations
    await finalizeLoop(workflowId, loopState, "max_iterations");
  } catch (error) {
    loopState.status = "failed";
    loopState.stopReason = "error";
    loopState.completedAt = new Date().toISOString();
    loopState.totalDurationMs =
      Date.now() - new Date(loopState.startedAt).getTime();
    await updateLoopState(workflowId, loopState, "active");
    throw error;
  }
}

/**
 * Build the prompt for a single iteration, including previous output context.
 */
export function buildIterationPrompt(
  template: string,
  previousOutput: string,
  iteration: number,
  maxIterations: number
): string {
  const parts: string[] = [];

  parts.push(`Iteration ${iteration} of ${maxIterations}.`);

  if (previousOutput) {
    parts.push(`\nPrevious iteration output:\n${previousOutput}`);
  }

  parts.push(`\n---\n\n${template}`);
  parts.push(
    `\nWhen you are fully satisfied with the result, include "LOOP_COMPLETE" in your response.`
  );

  return parts.join("");
}

/**
 * Check if the output contains a completion signal.
 * Case-insensitive substring match against the signal list.
 */
export function detectCompletionSignal(
  output: string,
  signals?: string[]
): boolean {
  const effectiveSignals = signals?.length ? signals : ["LOOP_COMPLETE"];
  const lowerOutput = output.toLowerCase();
  return effectiveSignals.some((signal) =>
    lowerOutput.includes(signal.toLowerCase())
  );
}

/**
 * Store loop state in the workflow definition JSON alongside _state.
 */
export async function updateLoopState(
  workflowId: string,
  loopState: LoopState,
  workflowStatus: "draft" | "active" | "paused" | "completed"
): Promise<void> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (!workflow) return;

  const parsed = JSON.parse(workflow.definition);
  const combined = { ...parsed, _loopState: loopState };

  await db
    .update(workflows)
    .set({
      definition: JSON.stringify(combined),
      status: workflowStatus,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflowId));
}

/**
 * Restore existing loop state from DB or create a fresh one.
 */
async function restoreOrCreateLoopState(
  workflowId: string
): Promise<LoopState> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (workflow) {
    const parsed = JSON.parse(workflow.definition);
    if (parsed._loopState) {
      return parsed._loopState as LoopState;
    }
  }

  return createInitialLoopState();
}

/**
 * Finalize a loop with a stop reason and mark the workflow as completed.
 */
async function finalizeLoop(
  workflowId: string,
  loopState: LoopState,
  stopReason: LoopStopReason
): Promise<void> {
  loopState.status = "completed";
  loopState.stopReason = stopReason;
  loopState.completedAt = new Date().toISOString();
  loopState.totalDurationMs =
    Date.now() - new Date(loopState.startedAt).getTime();
  await updateLoopState(workflowId, loopState, "completed");
}
