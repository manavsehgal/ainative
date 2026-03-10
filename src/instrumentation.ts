export async function register() {
  // Only start the scheduler on the server (not during build or edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/schedules/scheduler");
    startScheduler();
  }
}
