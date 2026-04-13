export async function registerNodeInstrumentation() {
  try {
    // Instance bootstrap — creates local branch, handles dev-mode gates, consent flow.
    // Runs BEFORE other startup so instance config is available downstream.
    // Safe in the canonical stagent dev repo thanks to STAGENT_DEV_MODE=true
    // in .env.local plus the .git/stagent-dev-mode sentinel file.
    const { ensureInstance } = await import("@/lib/instance/bootstrap");
    const instanceResult = await ensureInstance();
    if (instanceResult.skipped) {
      console.log(`[instance] bootstrap skipped: ${instanceResult.skipped}`);
    } else {
      for (const step of instanceResult.steps) {
        if (step.status === "failed") {
          console.error(`[instance] ${step.step} failed: ${step.reason}`);
        }
      }
    }

    // Instance upgrade poller — hourly `git fetch` to detect upstream commits.
    // Skipped in dev mode; lightweight; uses advisory lock to prevent overlap.
    const { startUpgradePoller } = await import("@/lib/instance/upgrade-poller");
    startUpgradePoller();

    const { startScheduler } = await import("@/lib/schedules/scheduler");
    startScheduler();

    const { startChannelPoller } = await import("@/lib/channels/poller");
    startChannelPoller();

    const { startAutoBackup } = await import("@/lib/snapshots/auto-backup");
    startAutoBackup();

    // History retention cleanup — prunes old agent_logs and usage_ledger
    startHistoryCleanup();

    // Telemetry batch flush (opt-in, every 5 minutes)
    const { startTelemetryFlush } = await import("@/lib/telemetry/queue");
    startTelemetryFlush();
  } catch (err) {
    console.error("Instrumentation startup failed:", err);
  }
}

async function startHistoryCleanup() {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
  const RETENTION_DAYS = 365;

  async function cleanup() {
    const { db } = await import("@/lib/db");
    const { agentLogs, usageLedger } = await import("@/lib/db/schema");
    const { lt } = await import("drizzle-orm");

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    db.delete(agentLogs).where(lt(agentLogs.timestamp, cutoff)).run();
    db.delete(usageLedger).where(lt(usageLedger.startedAt, cutoff)).run();
  }

  cleanup().catch(() => {});
  setInterval(() => cleanup().catch(() => {}), CLEANUP_INTERVAL);
}
