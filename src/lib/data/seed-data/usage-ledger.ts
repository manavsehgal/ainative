import type { ScheduleSeed } from "./schedules";
import type { TaskSeed } from "./tasks";
import type { WorkflowSeed } from "./workflows";
import type { UsageLedgerWriteInput } from "@/lib/usage/ledger";

export function createUsageLedgerSeeds(input: {
  tasks: TaskSeed[];
  workflows: WorkflowSeed[];
  schedules: ScheduleSeed[];
}): UsageLedgerWriteInput[] {
  const completedTasks = input.tasks.filter((task) => task.status === "completed");
  const runningTask = input.tasks.find((task) => task.status === "running");
  const failedTask = input.tasks.find((task) => task.status === "failed");
  const [workflow] = input.workflows;
  const [schedule] = input.schedules;

  const now = Date.now();
  const HOUR = 3_600_000;

  return [
    {
      taskId: completedTasks[0]?.id ?? null,
      projectId: completedTasks[0]?.projectId ?? null,
      activityType: "task_run",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      status: "completed",
      inputTokens: 2_400,
      outputTokens: 1_200,
      totalTokens: 3_600,
      startedAt: new Date(now - 48 * HOUR),
      finishedAt: new Date(now - 48 * HOUR + 120_000),
    },
    {
      taskId: completedTasks[1]?.id ?? null,
      projectId: completedTasks[1]?.projectId ?? null,
      activityType: "task_run",
      runtimeId: "openai-codex-app-server",
      providerId: "openai",
      modelId: "codex-mini-latest",
      status: "completed",
      inputTokens: 1_900,
      outputTokens: 850,
      totalTokens: 2_750,
      startedAt: new Date(now - 30 * HOUR),
      finishedAt: new Date(now - 30 * HOUR + 90_000),
    },
    {
      taskId: failedTask?.id ?? null,
      projectId: failedTask?.projectId ?? null,
      activityType: "task_run",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      status: "failed",
      inputTokens: 900,
      outputTokens: 0,
      totalTokens: 900,
      startedAt: new Date(now - 18 * HOUR),
      finishedAt: new Date(now - 18 * HOUR + 45_000),
    },
    {
      taskId: runningTask?.id ?? null,
      projectId: runningTask?.projectId ?? null,
      workflowId: workflow?.id ?? null,
      activityType: "workflow_step",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      status: "completed",
      inputTokens: 3_200,
      outputTokens: 1_650,
      totalTokens: 4_850,
      startedAt: new Date(now - 12 * HOUR),
      finishedAt: new Date(now - 12 * HOUR + 150_000),
    },
    {
      taskId: completedTasks[2]?.id ?? null,
      projectId: completedTasks[2]?.projectId ?? null,
      scheduleId: schedule?.id ?? null,
      activityType: "scheduled_firing",
      runtimeId: "openai-codex-app-server",
      providerId: "openai",
      modelId: "codex-mini-latest",
      status: "completed",
      inputTokens: 2_700,
      outputTokens: 1_100,
      totalTokens: 3_800,
      startedAt: new Date(now - 8 * HOUR),
      finishedAt: new Date(now - 8 * HOUR + 80_000),
    },
    {
      activityType: "task_assist",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      status: "completed",
      inputTokens: 750,
      outputTokens: 320,
      totalTokens: 1_070,
      startedAt: new Date(now - 6 * HOUR),
      finishedAt: new Date(now - 6 * HOUR + 20_000),
    },
    {
      activityType: "task_assist",
      runtimeId: "openai-codex-app-server",
      providerId: "openai",
      modelId: "codex-mini-latest",
      status: "completed",
      inputTokens: 680,
      outputTokens: 290,
      totalTokens: 970,
      startedAt: new Date(now - 4 * HOUR),
      finishedAt: new Date(now - 4 * HOUR + 20_000),
    },
    {
      activityType: "profile_test",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      status: "completed",
      inputTokens: 1_100,
      outputTokens: 540,
      totalTokens: 1_640,
      startedAt: new Date(now - 2 * HOUR),
      finishedAt: new Date(now - 2 * HOUR + 35_000),
    },
  ];
}
