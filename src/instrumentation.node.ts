/**
 * Node.js-only instrumentation startup.
 * Imported dynamically from instrumentation.ts with a bundler-ignore comment
 * so the Edge runtime never analyzes this module's dependency tree.
 */
export async function registerNode() {
  // License manager — initialize from DB (creates default row if needed)
  const { licenseManager } = await import("@/lib/license/manager");
  licenseManager.initialize();
  licenseManager.startValidationTimer();

  const { startScheduler } = await import("@/lib/schedules/scheduler");
  startScheduler();

  const { startChannelPoller } = await import("@/lib/channels/poller");
  startChannelPoller();

  const { startAutoBackup } = await import("@/lib/snapshots/auto-backup");
  startAutoBackup();

  // History retention cleanup — prunes old agent_logs and usage_ledger
  // based on tier retention limit (Community: 30 days)
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  async function cleanup() {
    const retentionDays = licenseManager.getLimit("historyRetentionDays");
    if (!Number.isFinite(retentionDays)) return; // Unlimited retention

    const { db } = await import("@/lib/db");
    const { agentLogs, usageLedger } = await import("@/lib/db/schema");
    const { lt } = await import("drizzle-orm");

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    db.delete(agentLogs).where(lt(agentLogs.timestamp, cutoff)).run();
    db.delete(usageLedger).where(lt(usageLedger.startedAt, cutoff)).run();
  }

  cleanup().catch(() => {});
  setInterval(() => cleanup().catch(() => {}), CLEANUP_INTERVAL);

  // Telemetry batch flush (opt-in, every 5 minutes)
  const { startTelemetryFlush } = await import("@/lib/telemetry/queue");
  startTelemetryFlush();
}
