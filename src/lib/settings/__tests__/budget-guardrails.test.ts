import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-budget-guardrails-"));
  vi.resetModules();
  vi.stubEnv("STAGENT_DATA_DIR", tempDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
});

async function loadModules() {
  const { db } = await import("@/lib/db");
  const schema = await import("@/lib/db/schema");
  const ledger = await import("@/lib/usage/ledger");
  const budgets = await import("../budget-guardrails");

  return { db, ...schema, ...ledger, ...budgets };
}

describe("budget guardrails", () => {
  it("emits one warning notification per window after a cap crosses 80%", async () => {
    const {
      db,
      notifications,
      recordUsageLedgerEntry,
      setBudgetPolicy,
      enforceBudgetGuardrails,
    } = await loadModules();

    await setBudgetPolicy({
      overall: {
        dailySpendCapUsd: 0.012,
        monthlySpendCapUsd: null,
      },
      runtimes: {
        "claude-code": {
          dailySpendCapUsd: null,
          monthlySpendCapUsd: null,
          dailyTokenCap: null,
          monthlyTokenCap: null,
        },
        "openai-codex-app-server": {
          dailySpendCapUsd: null,
          monthlySpendCapUsd: null,
          dailyTokenCap: null,
          monthlyTokenCap: null,
        },
      },
    });

    const now = new Date();
    await recordUsageLedgerEntry({
      activityType: "task_run",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      inputTokens: 1_000,
      outputTokens: 500,
      totalTokens: 1_500,
      status: "completed",
      startedAt: new Date(now.getTime() - 60_000),
      finishedAt: now,
    });

    await enforceBudgetGuardrails({
      runtimeId: "claude-code",
      activityType: "task_assist",
    });
    await enforceBudgetGuardrails({
      runtimeId: "claude-code",
      activityType: "task_assist",
    });

    const rows = await db.select().from(notifications);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("budget_alert");
    expect(rows[0]?.title).toContain("Overall daily spend");
  });

  it("blocks new runtime activity, records a zero-cost ledger row, and fails queued tasks when requested", async () => {
    const {
      db,
      notifications,
      tasks,
      usageLedger,
      recordUsageLedgerEntry,
      setBudgetPolicy,
      enforceTaskBudgetGuardrails,
      BudgetLimitExceededError,
    } = await loadModules();

    const taskId = crypto.randomUUID();
    const now = new Date();

    await db.insert(tasks).values({
      id: taskId,
      projectId: null,
      workflowId: null,
      scheduleId: null,
      title: "Budget blocked task",
      description: "Should not start",
      status: "queued",
      assignedAgent: "claude-code",
      agentProfile: "general",
      priority: 1,
      result: null,
      sessionId: null,
      resumeCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await setBudgetPolicy({
      overall: {
        dailySpendCapUsd: null,
        monthlySpendCapUsd: null,
      },
      runtimes: {
        "claude-code": {
          dailySpendCapUsd: null,
          monthlySpendCapUsd: null,
          dailyTokenCap: 100,
          monthlyTokenCap: null,
        },
        "openai-codex-app-server": {
          dailySpendCapUsd: null,
          monthlySpendCapUsd: null,
          dailyTokenCap: null,
          monthlyTokenCap: null,
        },
      },
    });

    await recordUsageLedgerEntry({
      taskId,
      activityType: "task_run",
      runtimeId: "claude-code",
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      inputTokens: 80,
      outputTokens: 40,
      totalTokens: 120,
      status: "completed",
      startedAt: new Date(now.getTime() - 60_000),
      finishedAt: new Date(now.getTime() - 30_000),
    });

    await expect(
      enforceTaskBudgetGuardrails(taskId, { failTaskOnBlock: true })
    ).rejects.toBeInstanceOf(BudgetLimitExceededError);

    const [task] = await db.select().from(tasks);
    expect(task?.status).toBe("failed");
    expect(task?.result).toContain("token usage");

    const ledgerRows = await db.select().from(usageLedger);
    const blockedRow = ledgerRows.find((row) => row.status === "blocked");
    expect(blockedRow).toEqual(
      expect.objectContaining({
        taskId,
        runtimeId: "claude-code",
        providerId: "anthropic",
        status: "blocked",
        costMicros: 0,
        pricingVersion: "budget-guardrail",
      })
    );

    const budgetNotifications = await db.select().from(notifications);
    expect(budgetNotifications.at(-1)?.title).toContain("blocked");
    expect(budgetNotifications.at(-1)?.body).toContain("Resets");
  });
});
