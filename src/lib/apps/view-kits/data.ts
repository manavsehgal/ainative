import "server-only";
import { unstable_cache } from "next/cache";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { humanizeCron } from "@/lib/apps/registry";
import type { AppDetail } from "@/lib/apps/registry";
import type { ResolvedBindings } from "./resolve";
import type { RuntimeState } from "./types";

/**
 * Server-only loader: assembles a `RuntimeState` for the kit's `buildModel`
 * step. Phase 1.1 keeps this minimal — task count + schedule cadence — so the
 * placeholder kit and Phase 2's Workflow Hub fallback both have something to
 * render. Future phases extend `RuntimeState` (recent runs, KPI source rows,
 * timeline events) without changing the public function signature.
 */
async function loadRuntimeStateUncached(
  app: AppDetail,
  _bindings: ResolvedBindings
): Promise<RuntimeState> {
  let recentTaskCount: number | undefined;
  try {
    const rows = await db
      .select({ value: count() })
      .from(tasks)
      .where(eq(tasks.projectId, app.id));
    recentTaskCount = rows[0]?.value ?? 0;
  } catch {
    // App may not have a backing project yet; leave count undefined.
    recentTaskCount = undefined;
  }

  const firstCron = app.manifest.schedules[0]?.cron;
  const scheduleCadence = firstCron ? humanizeCron(firstCron) : null;

  return {
    app,
    recentTaskCount,
    scheduleCadence,
  };
}

/**
 * Cached entry point. Cache key includes the app id; Phase 1.1 uses a 30s
 * revalidate per spec. The `ainative-apps-changed` event consumed by
 * `useApps()` will be promoted to a tag-based bust in a later phase if
 * needed; for now the short revalidate is enough to keep the surface
 * responsive without hammering the DB.
 */
export function loadRuntimeState(
  app: AppDetail,
  bindings: ResolvedBindings
): Promise<RuntimeState> {
  const cached = unstable_cache(
    () => loadRuntimeStateUncached(app, bindings),
    ["app-runtime", app.id],
    { revalidate: 30, tags: [`app-runtime:${app.id}`] }
  );
  return cached();
}
