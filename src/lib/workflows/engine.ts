import { db } from "@/lib/db";
import { workflows, tasks, agentLogs, notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeTaskWithRuntime } from "@/lib/agents/runtime";
import { classifyTaskProfile } from "@/lib/agents/router";
import type { WorkflowDefinition, WorkflowState, StepState, LoopState } from "./types";
import { createInitialState } from "./types";
import { executeLoop } from "./loop-executor";
import {
  buildParallelSynthesisPrompt,
  getParallelWorkflowStructure,
  PARALLEL_BRANCH_CONCURRENCY_LIMIT,
} from "./parallel";
import {
  buildSwarmRefineryPrompt,
  buildSwarmWorkerPrompt,
  getSwarmWorkflowStructure,
} from "./swarm";
import {
  openLearningSession,
  closeLearningSession,
} from "@/lib/agents/learning-session";
import {
  buildWorkflowDocumentContext,
  buildPoolDocumentContext,
} from "@/lib/documents/context-builder";

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

  // Extract parent task ID for document context propagation to child steps
  const parentTaskId: string | undefined = definition.sourceTaskId ?? undefined;

  await updateWorkflowState(workflowId, state, "active");

  await db.insert(agentLogs).values({
    id: crypto.randomUUID(),
    taskId: null,
    agentType: "workflow-engine",
    event: "workflow_started",
    payload: JSON.stringify({ workflowId, pattern: definition.pattern }),
    timestamp: new Date(),
  });

  // Open a learning session to buffer context proposals during execution.
  // Proposals are collected and presented as a single batch at workflow end.
  openLearningSession(workflowId);

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
    } finally {
      // Close learning session — flush buffered proposals as batch notification
      await closeLearningSession(workflowId).catch((err) => {
        console.error("[workflow-engine] Failed to close learning session:", err);
      });
    }
    return;
  }

  try {
    switch (definition.pattern) {
      case "sequence":
        await executeSequence(workflowId, definition, state, parentTaskId);
        break;
      case "planner-executor":
        await executePlannerExecutor(workflowId, definition, state, parentTaskId);
        break;
      case "checkpoint":
        await executeCheckpoint(workflowId, definition, state, parentTaskId);
        break;
      case "parallel":
        await executeParallel(workflowId, definition, state, parentTaskId);
        break;
      case "swarm":
        await executeSwarm(workflowId, definition, state, parentTaskId);
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
    await updateWorkflowState(workflowId, state, "failed");

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
  } finally {
    // Close learning session — flush buffered proposals as batch notification
    await closeLearningSession(workflowId).catch((err) => {
      console.error("[workflow-engine] Failed to close learning session:", err);
    });
  }
}

/**
 * Sequence pattern: execute steps one after another, passing output forward.
 */
async function executeSequence(
  workflowId: string,
  definition: WorkflowDefinition,
  state: WorkflowState,
  parentTaskId?: string
): Promise<void> {
  let previousOutput = "";

  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    state.currentStepIndex = i;

    // Build prompt with context from previous step
    const contextPrompt = previousOutput
      ? `Previous step output:\n${previousOutput}\n\n---\n\n${step.prompt}`
      : step.prompt;

    const result = await executeStep(
      workflowId,
      step.id,
      step.name,
      contextPrompt,
      state,
      step.assignedAgent,
      step.agentProfile,
      parentTaskId
    );

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
  state: WorkflowState,
  parentTaskId?: string
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
    plannerStep.assignedAgent,
    plannerStep.agentProfile,
    parentTaskId
  );

  if (planResult.status === "failed") {
    throw new Error(`Planner step failed: ${planResult.error}`);
  }

  // Execute remaining steps with plan context
  for (let i = 1; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    state.currentStepIndex = i;

    const contextPrompt = `Plan from planner:\n${planResult.result}\n\n---\n\n${step.prompt}`;
    const result = await executeStep(
      workflowId,
      step.id,
      step.name,
      contextPrompt,
      state,
      step.assignedAgent,
      step.agentProfile,
      parentTaskId
    );

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
  state: WorkflowState,
  parentTaskId?: string
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

    const result = await executeStep(
      workflowId,
      step.id,
      step.name,
      contextPrompt,
      state,
      step.assignedAgent,
      step.agentProfile,
      parentTaskId
    );

    if (result.status === "failed") {
      throw new Error(`Step "${step.name}" failed: ${result.error}`);
    }

    previousOutput = result.result ?? "";
  }
}

/**
 * Parallel pattern: execute branch steps concurrently, then run a synthesis step.
 */
async function executeParallel(
  workflowId: string,
  definition: WorkflowDefinition,
  state: WorkflowState,
  parentTaskId?: string
): Promise<void> {
  const structure = getParallelWorkflowStructure(definition);
  if (!structure) {
    throw new Error(
      "Parallel workflows require branch steps and exactly one synthesis step"
    );
  }

  const { branchSteps, synthesisStep } = structure;
  const synthesisIndex = definition.steps.findIndex(
    (step) => step.id === synthesisStep.id
  );

  if (synthesisIndex === -1) {
    throw new Error(`Synthesis step "${synthesisStep.id}" not found`);
  }

  let stateWriteQueue = Promise.resolve();
  const commitState = (
    mutate: (draft: WorkflowState) => void,
    status: "draft" | "active" | "paused" | "completed" = "active"
  ) => {
    stateWriteQueue = stateWriteQueue.then(async () => {
      mutate(state);
      await updateWorkflowState(workflowId, state, status);
    });
    return stateWriteQueue;
  };

  await commitState((draft) => {
    draft.currentStepIndex = 0;
    const joinState = draft.stepStates[synthesisIndex];
    joinState.status = "waiting_dependencies";
    joinState.error = undefined;
    joinState.result = undefined;
  });

  const branchResults = await mapWithConcurrency(
    branchSteps,
    PARALLEL_BRANCH_CONCURRENCY_LIMIT,
    async (step) => {
      const stepIndex = definition.steps.findIndex(
        (candidate) => candidate.id === step.id
      );
      if (stepIndex === -1) {
        throw new Error(`Parallel branch "${step.id}" not found`);
      }

      const startedAt = new Date().toISOString();
      await commitState((draft) => {
        const stepState = draft.stepStates[stepIndex];
        stepState.status = "running";
        stepState.startedAt = startedAt;
        stepState.completedAt = undefined;
        stepState.error = undefined;
        stepState.result = undefined;
      });

      const result = await executeChildTask(
        workflowId,
        step.name,
        step.prompt,
        step.assignedAgent,
        step.agentProfile,
        parentTaskId,
        step.id
      );

      const completedAt = new Date().toISOString();
      await commitState((draft) => {
        const stepState = draft.stepStates[stepIndex];
        stepState.taskId = result.taskId;
        stepState.completedAt = completedAt;

        if (result.status === "completed") {
          stepState.status = "completed";
          stepState.result = result.result ?? "";
        } else {
          stepState.status = "failed";
          stepState.error =
            result.error ?? "Task did not complete successfully";
        }
      });

      return { step, result };
    }
  );

  await stateWriteQueue;

  const failedBranches = branchResults.filter(
    (branch) => branch.result.status !== "completed"
  );

  if (failedBranches.length > 0) {
    const failureSummary = failedBranches
      .map(
        (branch) =>
          `${branch.step.name}: ${
            branch.result.error ?? "Task did not complete successfully"
          }`
      )
      .join("; ");

    await commitState((draft) => {
      const joinState = draft.stepStates[synthesisIndex];
      joinState.status = "failed";
      joinState.error = `Blocked by failed branches: ${failureSummary}`;
    });
    await stateWriteQueue;

    throw new Error(`Parallel branches failed: ${failureSummary}`);
  }

  const synthesisStartedAt = new Date().toISOString();
  await commitState((draft) => {
    draft.currentStepIndex = synthesisIndex;
    const joinState = draft.stepStates[synthesisIndex];
    joinState.status = "running";
    joinState.startedAt = synthesisStartedAt;
    joinState.completedAt = undefined;
    joinState.error = undefined;
    joinState.result = undefined;
  });

  const synthesisPrompt = buildParallelSynthesisPrompt({
    branchOutputs: branchResults.map((branch) => ({
      stepName: branch.step.name,
      result: branch.result.result ?? "",
    })),
    synthesisPrompt: synthesisStep.prompt,
  });

  const synthesisResult = await executeChildTask(
    workflowId,
    synthesisStep.name,
    synthesisPrompt,
    synthesisStep.assignedAgent,
    synthesisStep.agentProfile,
    parentTaskId,
    synthesisStep.id
  );

  await commitState((draft) => {
    const joinState = draft.stepStates[synthesisIndex];
    joinState.taskId = synthesisResult.taskId;
    joinState.completedAt = new Date().toISOString();

    if (synthesisResult.status === "completed") {
      joinState.status = "completed";
      joinState.result = synthesisResult.result ?? "";
    } else {
      joinState.status = "failed";
      joinState.error =
        synthesisResult.error ?? "Task did not complete successfully";
    }
  });
  await stateWriteQueue;

  if (synthesisResult.status !== "completed") {
    throw new Error(
      `Synthesis step "${synthesisStep.name}" failed: ${
        synthesisResult.error ?? "Task did not complete successfully"
      }`
    );
  }
}

/**
 * Swarm pattern: run a mayor planning step, execute worker steps in parallel,
 * then merge the results through a refinery step.
 */
async function executeSwarm(
  workflowId: string,
  definition: WorkflowDefinition,
  state: WorkflowState,
  parentTaskId?: string
): Promise<void> {
  const structure = getSwarmWorkflowStructure(definition);
  if (!structure) {
    throw new Error(
      "Swarm workflows require a mayor step, 2-5 worker steps, and a refinery step"
    );
  }

  const { mayorStep, workerSteps, refineryStep, workerConcurrencyLimit } =
    structure;
  const refineryIndex = definition.steps.findIndex(
    (step) => step.id === refineryStep.id
  );

  if (refineryIndex === -1) {
    throw new Error(`Refinery step "${refineryStep.id}" not found`);
  }

  const mayorResult = await executeStep(
    workflowId,
    mayorStep.id,
    mayorStep.name,
    mayorStep.prompt,
    state,
    mayorStep.assignedAgent,
    mayorStep.agentProfile,
    parentTaskId
  );

  if (mayorResult.status === "failed") {
    throw new Error(`Mayor step "${mayorStep.name}" failed: ${mayorResult.error}`);
  }

  let stateWriteQueue = Promise.resolve();
  const commitState = (
    mutate: (draft: WorkflowState) => void,
    status: "draft" | "active" | "paused" | "completed" = "active"
  ) => {
    stateWriteQueue = stateWriteQueue.then(async () => {
      mutate(state);
      await updateWorkflowState(workflowId, state, status);
    });
    return stateWriteQueue;
  };

  await commitState((draft) => {
    draft.currentStepIndex = 1;
    const refineryState = draft.stepStates[refineryIndex];
    refineryState.status = "waiting_dependencies";
    refineryState.error = undefined;
    refineryState.result = undefined;
    refineryState.startedAt = undefined;
    refineryState.completedAt = undefined;
  });

  const workerResults = await mapWithConcurrency(
    workerSteps,
    workerConcurrencyLimit,
    async (step) => {
      const stepIndex = definition.steps.findIndex(
        (candidate) => candidate.id === step.id
      );
      if (stepIndex === -1) {
        throw new Error(`Swarm worker "${step.id}" not found`);
      }

      const workerPrompt = buildSwarmWorkerPrompt({
        mayorName: mayorStep.name,
        mayorResult: mayorResult.result ?? "",
        workerName: step.name,
        workerPrompt: step.prompt,
      });

      const startedAt = new Date().toISOString();
      await commitState((draft) => {
        const stepState = draft.stepStates[stepIndex];
        stepState.status = "running";
        stepState.startedAt = startedAt;
        stepState.completedAt = undefined;
        stepState.error = undefined;
        stepState.result = undefined;
      });

      const result = await executeChildTask(
        workflowId,
        step.name,
        workerPrompt,
        step.assignedAgent,
        step.agentProfile,
        parentTaskId,
        step.id
      );

      const completedAt = new Date().toISOString();
      await commitState((draft) => {
        const stepState = draft.stepStates[stepIndex];
        stepState.taskId = result.taskId;
        stepState.completedAt = completedAt;

        if (result.status === "completed") {
          stepState.status = "completed";
          stepState.result = result.result ?? "";
        } else {
          stepState.status = "failed";
          stepState.error =
            result.error ?? "Task did not complete successfully";
        }
      });

      return { step, result };
    }
  );

  await stateWriteQueue;

  const failedWorkers = workerResults.filter(
    (worker) => worker.result.status !== "completed"
  );
  if (failedWorkers.length > 0) {
    const failureSummary = summarizeFailedWorkers(failedWorkers);

    await commitState((draft) => {
      const refineryState = draft.stepStates[refineryIndex];
      refineryState.status = "failed";
      refineryState.error = `Blocked by failed workers: ${failureSummary}`;
    });
    await stateWriteQueue;

    throw new Error(`Swarm workers failed: ${failureSummary}`);
  }

  await runSwarmRefinery({
    workflowId,
    state,
    mayorStep,
    mayorResult: mayorResult.result ?? "",
    refineryStep,
    refineryIndex,
    workerOutputs: workerResults.map((worker) => ({
      stepName: worker.step.name,
      result: worker.result.result ?? "",
    })),
    parentTaskId,
  });
}

function summarizeFailedWorkers(
  failedWorkers: Array<{
    step: { name: string };
    result: { error?: string };
  }>
): string {
  return failedWorkers
    .map(
      (worker) =>
        `${worker.step.name}: ${
          worker.result.error ?? "Task did not complete successfully"
        }`
    )
    .join("; ");
}

async function runSwarmRefinery(input: {
  workflowId: string;
  state: WorkflowState;
  mayorStep: { name: string };
  mayorResult: string;
  refineryStep: {
    id: string;
    name: string;
    prompt: string;
    assignedAgent?: string;
    agentProfile?: string;
  };
  refineryIndex: number;
  workerOutputs: Array<{ stepName: string; result: string }>;
  parentTaskId?: string;
}): Promise<void> {
  const {
    workflowId,
    state,
    mayorStep,
    mayorResult,
    refineryStep,
    refineryIndex,
    workerOutputs,
    parentTaskId,
  } = input;

  state.currentStepIndex = refineryIndex;
  const refineryState = state.stepStates[refineryIndex];
  refineryState.status = "running";
  refineryState.startedAt = new Date().toISOString();
  refineryState.completedAt = undefined;
  refineryState.error = undefined;
  refineryState.result = undefined;
  await updateWorkflowState(workflowId, state, "active");

  const refineryPrompt = buildSwarmRefineryPrompt({
    mayorName: mayorStep.name,
    mayorResult,
    workerOutputs,
    refineryPrompt: refineryStep.prompt,
  });

  const refineryResult = await executeChildTask(
    workflowId,
    refineryStep.name,
    refineryPrompt,
    refineryStep.assignedAgent,
    refineryStep.agentProfile,
    parentTaskId,
    refineryStep.id
  );

  refineryState.taskId = refineryResult.taskId;
  refineryState.completedAt = new Date().toISOString();

  if (refineryResult.status === "completed") {
    refineryState.status = "completed";
    refineryState.result = refineryResult.result ?? "";
  } else {
    refineryState.status = "failed";
    refineryState.error =
      refineryResult.error ?? "Task did not complete successfully";
  }

  await updateWorkflowState(workflowId, state, "active");

  if (refineryResult.status !== "completed") {
    throw new Error(
      `Refinery step "${refineryStep.name}" failed: ${
        refineryResult.error ?? "Task did not complete successfully"
      }`
    );
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
  assignedAgent?: string,
  agentProfile?: string,
  parentTaskId?: string,
  stepId?: string
): Promise<{ taskId: string; status: string; result?: string; error?: string }> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  // Resolve "auto" profile via multi-agent router
  const resolvedProfile =
    !agentProfile || agentProfile === "auto"
      ? classifyTaskProfile(name, prompt, assignedAgent)
      : agentProfile;

  // Inject parent task's document context into step prompt so file attachments
  // from the original task are visible to every workflow child step
  let enrichedPrompt = prompt;
  if (parentTaskId) {
    const docContext = await buildWorkflowDocumentContext(parentTaskId);
    if (docContext) {
      enrichedPrompt = `${docContext}\n\n${enrichedPrompt}`;
    }
  }

  // Inject pool document context from workflow_document_inputs junction table
  const poolContext = await buildPoolDocumentContext(workflowId, stepId);
  if (poolContext) {
    enrichedPrompt = `${poolContext}\n\n${enrichedPrompt}`;
  }

  const taskId = crypto.randomUUID();
  await db.insert(tasks).values({
    id: taskId,
    projectId: workflow?.projectId ?? null,
    workflowId,
    scheduleId: null,
    title: `[Workflow] ${name}`,
    description: enrichedPrompt,
    status: "queued",
    priority: 1,
    assignedAgent: assignedAgent ?? null,
    agentProfile: resolvedProfile ?? null,
    workflowRunNumber: workflow?.runNumber ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db
    .update(tasks)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  try {
    await executeTaskWithRuntime(taskId);
  } catch (err) {
    console.error(`[workflow-engine] Runtime execution failed for task ${taskId}:`, err);
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
  assignedAgent?: string,
  agentProfile?: string,
  parentTaskId?: string
): Promise<StepState> {
  const stepState = state.stepStates.find((s) => s.stepId === stepId);
  if (!stepState) throw new Error(`Step ${stepId} not found in state`);

  stepState.status = "running";
  stepState.startedAt = new Date().toISOString();
  await updateWorkflowState(workflowId, state, "active");

  const result = await executeChildTask(
    workflowId,
    stepName,
    prompt,
    assignedAgent,
    agentProfile,
    parentTaskId,
    stepId
  );

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

  // Timeout — mark the notification as denied so it clears from pending list
  await db
    .update(notifications)
    .set({
      response: JSON.stringify({ behavior: "deny", message: "Timed out waiting for approval" }),
      respondedAt: new Date(),
      read: true,
    })
    .where(eq(notifications.id, notificationId));

  return false; // Timeout — treat as denied
}


/**
 * Update workflow state in the database.
 */
export async function updateWorkflowState(
  workflowId: string,
  state: WorkflowState,
  status: "draft" | "active" | "paused" | "completed" | "failed"
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

  if (workflow.status === "active") {
    throw new Error("Cannot retry a step while the workflow is active");
  }

  if (definition.pattern === "swarm") {
    await retrySwarmStep(workflowId, definition, state, stepIndex);
    return;
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
  const result = await executeStep(
    workflowId,
    step.id,
    step.name,
    step.prompt,
    state,
    step.assignedAgent,
    step.agentProfile
  );

  if (result.status === "completed") {
    // Continue with remaining steps if this was a sequence
    if (definition.pattern === "sequence") {
      let previousOutput = result.result ?? "";
      for (let i = stepIndex + 1; i < definition.steps.length; i++) {
        const nextStep = definition.steps[i];
        state.currentStepIndex = i;
        const contextPrompt = `Previous step output:\n${previousOutput}\n\n---\n\n${nextStep.prompt}`;
        const nextResult = await executeStep(
          workflowId,
          nextStep.id,
          nextStep.name,
          contextPrompt,
          state,
          nextStep.assignedAgent,
          nextStep.agentProfile
        );
        if (nextResult.status === "failed") break;
        previousOutput = nextResult.result ?? "";
      }
    }

    const allCompleted = state.stepStates.every((s) => s.status === "completed");
    state.status = allCompleted ? "completed" : "failed";
    state.completedAt = allCompleted ? new Date().toISOString() : undefined;
    await updateWorkflowState(workflowId, state, allCompleted ? "completed" : "failed");
  }
}

function resetStepState(stepState: StepState): void {
  stepState.status = "pending";
  stepState.error = undefined;
  stepState.result = undefined;
  stepState.taskId = undefined;
  stepState.startedAt = undefined;
  stepState.completedAt = undefined;
}

async function retrySwarmStep(
  workflowId: string,
  definition: WorkflowDefinition,
  state: WorkflowState,
  stepIndex: number
): Promise<void> {
  const structure = getSwarmWorkflowStructure(definition);
  if (!structure) {
    throw new Error(
      "Swarm workflows require a mayor step, 2-5 worker steps, and a refinery step"
    );
  }

  const { mayorStep, workerSteps, refineryStep } = structure;
  const refineryIndex = definition.steps.length - 1;
  const mayorState = state.stepStates[0];
  const refineryState = state.stepStates[refineryIndex];
  const targetStep = definition.steps[stepIndex];
  const targetState = state.stepStates[stepIndex];

  if (stepIndex === 0) {
    for (const currentStepState of state.stepStates) {
      resetStepState(currentStepState);
    }

    state.status = "running";
    state.currentStepIndex = 0;
    state.completedAt = undefined;
    await updateWorkflowState(workflowId, state, "active");
    await executeSwarm(workflowId, definition, state);
    return;
  }

  if (mayorState.status !== "completed" || !mayorState.result) {
    throw new Error("Swarm mayor output must complete before retrying downstream steps");
  }

  if (stepIndex === refineryIndex) {
    const incompleteWorkers = workerSteps.filter((_, workerIndex) => {
      const workerState = state.stepStates[workerIndex + 1];
      return workerState.status !== "completed" || !workerState.result;
    });

    if (incompleteWorkers.length > 0) {
      throw new Error("All swarm workers must complete before retrying the refinery");
    }

    resetStepState(refineryState);
    state.status = "running";
    state.currentStepIndex = refineryIndex;
    state.completedAt = undefined;
    await updateWorkflowState(workflowId, state, "active");

    await runSwarmRefinery({
      workflowId,
      state,
      mayorStep,
      mayorResult: mayorState.result,
      refineryStep,
      refineryIndex,
      workerOutputs: workerSteps.map((worker, workerIndex) => ({
        stepName: worker.name,
        result: state.stepStates[workerIndex + 1].result ?? "",
      })),
    });

    state.status = "completed";
    state.completedAt = new Date().toISOString();
    await updateWorkflowState(workflowId, state, "completed");
    return;
  }

  resetStepState(targetState);
  resetStepState(refineryState);
  refineryState.status = "waiting_dependencies";
  state.status = "running";
  state.currentStepIndex = stepIndex;
  state.completedAt = undefined;
  await updateWorkflowState(workflowId, state, "active");

  const retriedWorker = await executeStep(
    workflowId,
    targetStep.id,
    targetStep.name,
    buildSwarmWorkerPrompt({
      mayorName: mayorStep.name,
      mayorResult: mayorState.result,
      workerName: targetStep.name,
      workerPrompt: targetStep.prompt,
    }),
    state,
    targetStep.assignedAgent,
    targetStep.agentProfile
  );

  if (retriedWorker.status !== "completed") {
    state.status = "failed";
    await updateWorkflowState(workflowId, state, "failed");
    throw new Error(
      `Swarm worker "${targetStep.name}" failed: ${
        retriedWorker.error ?? "Task did not complete successfully"
      }`
    );
  }

  const failedWorkers = workerSteps
    .map((worker, workerIndex) => ({
      step: worker,
      result: state.stepStates[workerIndex + 1],
    }))
    .filter((worker) => worker.result.status !== "completed");

  if (failedWorkers.length > 0) {
    refineryState.status = "failed";
    refineryState.error = `Blocked by failed workers: ${summarizeFailedWorkers(
      failedWorkers.map((worker) => ({
        step: worker.step,
        result: { error: worker.result.error },
      }))
    )}`;
    state.status = "failed";
    await updateWorkflowState(workflowId, state, "failed");
    return;
  }

  await runSwarmRefinery({
    workflowId,
    state,
    mayorStep,
    mayorResult: mayorState.result,
    refineryStep,
    refineryIndex,
    workerOutputs: workerSteps.map((worker, workerIndex) => ({
      stepName: worker.name,
      result: state.stepStates[workerIndex + 1].result ?? "",
    })),
  });

  state.status = "completed";
  state.completedAt = new Date().toISOString();
  await updateWorkflowState(workflowId, state, "completed");
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<TResult>
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    })
  );

  return results;
}
