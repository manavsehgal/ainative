import { db } from "@/lib/db";
import { workflows, tasks, agentLogs, notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeTaskWithRuntime } from "@/lib/agents/runtime";
import type { WorkflowDefinition, WorkflowState, StepState, LoopState } from "./types";
import { createInitialState } from "./types";
import { executeLoop } from "./loop-executor";

/**
 * Execute a workflow by advancing through its steps according to the pattern.
 * Fire-and-forget — call this from the API route and don't await.
 */
export async function executeWorkflow(workflowId: string): Promise<void> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const definition: WorkflowDefinition = JSON.parse(workflow.definition);
  const state = createInitialState(definition);

  await updateWorkflowState(workflowId, state, "active");

  await db.insert(agentLogs).values({
    id: crypto.randomUUID(),
    taskId: null,
    agentType: "workflow-engine",
    event: "workflow_started",
    payload: JSON.stringify({ workflowId, pattern: definition.pattern }),
    timestamp: new Date(),
  });

  // Loop pattern manages its own lifecycle — delegate fully
  if (definition.pattern === "loop") {
    try {
      await executeLoop(workflowId, definition);

      await db.insert(agentLogs).values({
        id: crypto.randomUUID(),
        taskId: null,
        agentType: "workflow-engine",
        event: "workflow_completed",
        payload: JSON.stringify({ workflowId }),
        timestamp: new Date(),
      });
    } catch (error) {
      await db.insert(agentLogs).values({
        id: crypto.randomUUID(),
        taskId: null,
        agentType: "workflow-engine",
        event: "workflow_failed",
        payload: JSON.stringify({
          workflowId,
          error: error instanceof Error ? error.message : String(error),
        }),
        timestamp: new Date(),
      });
    }
    return;
  }

  try {
    switch (definition.pattern) {
      case "sequence":
        await executeSequence(workflowId, definition, state);
        break;
      case "planner-executor":
        await executePlannerExecutor(workflowId, definition, state);
        break;
      case "checkpoint":
        await executeCheckpoint(workflowId, definition, state);
        break;
    }

    state.status = "completed";
    state.completedAt = new Date().toISOString();
    await updateWorkflowState(workflowId, state, "completed");

    await db.insert(agentLogs).values({
      id: crypto.randomUUID(),
      taskId: null,
      agentType: "workflow-engine",
      event: "workflow_completed",
      payload: JSON.stringify({ workflowId }),
      timestamp: new Date(),
    });
  } catch (error) {
    state.status = "failed";
    await updateWorkflowState(workflowId, state, "active");

    await db.insert(agentLogs).values({
      id: crypto.randomUUID(),
      taskId: null,
      agentType: "workflow-engine",
      event: "workflow_failed",
      payload: JSON.stringify({
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      }),
      timestamp: new Date(),
    });
  }
}

/**
 * Sequence pattern: execute steps one after another, passing output forward.
 */
async function executeSequence(
  workflowId: string,
  definition: WorkflowDefinition,
  state: WorkflowState
): Promise<void> {
  let previousOutput = "";

  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    state.currentStepIndex = i;

    // Build prompt with context from previous step
    const contextPrompt = previousOutput
      ? `Previous step output:\n${previousOutput}\n\n---\n\n${step.prompt}`
      : step.prompt;

    const result = await executeStep(workflowId, step.id, step.name, contextPrompt, state, step.agentProfile);

    if (result.status === "failed") {
      throw new Error(`Step "${step.name}" failed: ${result.error}`);
    }

    previousOutput = result.result ?? "";
  }
}

/**
 * Planner-Executor pattern: first step generates a plan, subsequent steps execute it.
 */
async function executePlannerExecutor(
  workflowId: string,
  definition: WorkflowDefinition,
  state: WorkflowState
): Promise<void> {
  if (definition.steps.length < 2) {
    throw new Error("Planner-Executor requires at least 2 steps (planner + executor)");
  }

  // Step 1: Planner
  const plannerStep = definition.steps[0];
  state.currentStepIndex = 0;
  const planResult = await executeStep(
    workflowId,
    plannerStep.id,
    plannerStep.name,
    plannerStep.prompt,
    state,
    plannerStep.agentProfile
  );

  if (planResult.status === "failed") {
    throw new Error(`Planner step failed: ${planResult.error}`);
  }

  // Execute remaining steps with plan context
  for (let i = 1; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    state.currentStepIndex = i;

    const contextPrompt = `Plan from planner:\n${planResult.result}\n\n---\n\n${step.prompt}`;
    const result = await executeStep(workflowId, step.id, step.name, contextPrompt, state, step.agentProfile);

    if (result.status === "failed") {
      throw new Error(`Executor step "${step.name}" failed: ${result.error}`);
    }
  }
}

/**
 * Checkpoint pattern: execute steps with human approval gates between them.
 */
async function executeCheckpoint(
  workflowId: string,
  definition: WorkflowDefinition,
  state: WorkflowState
): Promise<void> {
  let previousOutput = "";

  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    state.currentStepIndex = i;

    // If step requires approval and we have previous output, wait for approval
    if (step.requiresApproval && i > 0) {
      state.stepStates[i].status = "waiting_approval";
      await updateWorkflowState(workflowId, state, "active");

      const approved = await waitForApproval(workflowId, step.name, previousOutput);
      if (!approved) {
        state.stepStates[i].status = "failed";
        state.stepStates[i].error = "Approval denied by user";
        throw new Error(`Step "${step.name}" was denied approval`);
      }
    }

    const contextPrompt = previousOutput
      ? `Previous step output:\n${previousOutput}\n\n---\n\n${step.prompt}`
      : step.prompt;

    const result = await executeStep(workflowId, step.id, step.name, contextPrompt, state, step.agentProfile);

    if (result.status === "failed") {
      throw new Error(`Step "${step.name}" failed: ${result.error}`);
    }

    previousOutput = result.result ?? "";
  }
}

/**
 * Create and execute a child task, returning its result.
 * Shared by step-based patterns and the loop executor.
 */
export async function executeChildTask(
  workflowId: string,
  name: string,
  prompt: string,
  agentProfile?: string
): Promise<{ taskId: string; status: string; result?: string; error?: string }> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  const taskId = crypto.randomUUID();
  await db.insert(tasks).values({
    id: taskId,
    projectId: workflow?.projectId ?? null,
    title: `[Workflow] ${name}`,
    description: prompt,
    status: "queued",
    priority: 1,
    agentProfile: agentProfile ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db
    .update(tasks)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  try {
    await executeTaskWithRuntime(taskId);
  } catch {
    // Runtime adapter handles its own error logging
  }

  const [completedTask] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (completedTask?.status === "completed") {
    return { taskId, status: "completed", result: completedTask.result ?? "" };
  }
  return {
    taskId,
    status: "failed",
    error: completedTask?.result ?? "Task did not complete successfully",
  };
}

/**
 * Execute a single workflow step by creating a task and waiting for completion.
 */
async function executeStep(
  workflowId: string,
  stepId: string,
  stepName: string,
  prompt: string,
  state: WorkflowState,
  agentProfile?: string
): Promise<StepState> {
  const stepState = state.stepStates.find((s) => s.stepId === stepId);
  if (!stepState) throw new Error(`Step ${stepId} not found in state`);

  stepState.status = "running";
  stepState.startedAt = new Date().toISOString();
  await updateWorkflowState(workflowId, state, "active");

  const result = await executeChildTask(workflowId, stepName, prompt, agentProfile);

  stepState.taskId = result.taskId;
  if (result.status === "completed") {
    stepState.status = "completed";
    stepState.result = result.result ?? "";
    stepState.completedAt = new Date().toISOString();
  } else {
    stepState.status = "failed";
    stepState.error = result.error ?? "Task did not complete successfully";
  }

  await updateWorkflowState(workflowId, state, "active");
  return stepState;
}

/**
 * Wait for human approval via the notifications system.
 */
async function waitForApproval(
  workflowId: string,
  stepName: string,
  previousOutput: string
): Promise<boolean> {
  const notificationId = crypto.randomUUID();

  await db.insert(notifications).values({
    id: notificationId,
    taskId: null,
    type: "permission_required",
    title: `Workflow checkpoint: ${stepName}`,
    body: `Previous step output:\n${previousOutput.slice(0, 500)}`,
    toolName: "WorkflowCheckpoint",
    toolInput: JSON.stringify({ workflowId, stepName }),
    createdAt: new Date(),
  });

  // Poll for response with 5-minute timeout for human approval
  const deadline = Date.now() + 5 * 60 * 1000;
  const pollInterval = 2000;

  while (Date.now() < deadline) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));

    if (notification?.response) {
      try {
        const parsed = JSON.parse(notification.response);
        return parsed.behavior === "allow";
      } catch {
        return false;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return false; // Timeout — treat as denied
}

/**
 * Update workflow state in the database.
 */
export async function updateWorkflowState(
  workflowId: string,
  state: WorkflowState,
  status: "draft" | "active" | "paused" | "completed"
): Promise<void> {
  // Store state in the definition field as a combined object
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (!workflow) return;

  const definition = JSON.parse(workflow.definition);
  const combined = { ...definition, _state: state };

  await db
    .update(workflows)
    .set({
      definition: JSON.stringify(combined),
      status,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflowId));
}

/**
 * Get the current state of a workflow.
 */
export function parseWorkflowState(
  definitionJson: string
): { definition: WorkflowDefinition; state: WorkflowState | null; loopState: LoopState | null } {
  const parsed = JSON.parse(definitionJson);
  const { _state, _loopState, ...definition } = parsed;
  return { definition, state: _state ?? null, loopState: _loopState ?? null };
}

/**
 * Retry a failed step in a workflow.
 */
export async function retryWorkflowStep(
  workflowId: string,
  stepId: string
): Promise<void> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const { definition, state } = parseWorkflowState(workflow.definition);
  if (!state) throw new Error("Workflow has no execution state");

  const stepIndex = state.stepStates.findIndex((s) => s.stepId === stepId);
  if (stepIndex === -1) throw new Error(`Step ${stepId} not found`);

  const stepState = state.stepStates[stepIndex];
  if (stepState.status !== "failed") {
    throw new Error(`Step ${stepId} is not in failed state`);
  }

  // Reset step state
  stepState.status = "pending";
  stepState.error = undefined;
  stepState.taskId = undefined;
  state.status = "running";
  state.currentStepIndex = stepIndex;
  await updateWorkflowState(workflowId, state, "active");

  // Re-execute from this step
  const step = definition.steps[stepIndex];
  const result = await executeStep(workflowId, step.id, step.name, step.prompt, state, step.agentProfile);

  if (result.status === "completed") {
    // Continue with remaining steps if this was a sequence
    if (definition.pattern === "sequence") {
      let previousOutput = result.result ?? "";
      for (let i = stepIndex + 1; i < definition.steps.length; i++) {
        const nextStep = definition.steps[i];
        state.currentStepIndex = i;
        const contextPrompt = `Previous step output:\n${previousOutput}\n\n---\n\n${nextStep.prompt}`;
        const nextResult = await executeStep(workflowId, nextStep.id, nextStep.name, contextPrompt, state, nextStep.agentProfile);
        if (nextResult.status === "failed") break;
        previousOutput = nextResult.result ?? "";
      }
    }

    const allCompleted = state.stepStates.every((s) => s.status === "completed");
    state.status = allCompleted ? "completed" : "failed";
    state.completedAt = allCompleted ? new Date().toISOString() : undefined;
    await updateWorkflowState(workflowId, state, allCompleted ? "completed" : "active");
  }
}
