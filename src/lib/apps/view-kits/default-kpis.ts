import type { ViewConfig } from "@/lib/apps/registry";
import type { ColumnSchemaRef } from "./types";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];
type Col = ColumnSchemaRef["columns"][number];

const STREAK_RE = /(^|_)streak($|_)/i;
const ACTIVE_RE = /^active$/i;

/**
 * Synthesizes 1-4 KpiSpecs for a tracker app whose manifest doesn't declare
 * `view.bindings.kpis`. Picks at most one of each kind to avoid duplicate
 * tiles. Apps that want explicit KPIs should declare them in the manifest;
 * Phase 5 (`composed-app-auto-inference-hardening`) tightens the synthesis.
 */
export function defaultTrackerKpis(
  heroTableId: string | undefined,
  columns: Col[]
): KpiSpec[] {
  if (!heroTableId) return [];
  const specs: KpiSpec[] = [];

  // Always: total entries
  specs.push({
    id: "default-total",
    label: "Total entries",
    source: { kind: "tableCount", table: heroTableId },
    format: "int",
  });

  // If an `active` boolean column exists, add an "Active" filtered count.
  const activeCol = columns.find(
    (c) => c.type === "boolean" && ACTIVE_RE.test(c.name)
  );
  if (activeCol) {
    specs.push({
      id: "default-active",
      label: "Active",
      source: { kind: "tableCount", table: heroTableId, where: activeCol.name },
      format: "int",
    });
  }

  // If a *_streak column exists, surface its latest value.
  const streakCol = columns.find((c) => STREAK_RE.test(c.name));
  if (streakCol) {
    specs.push({
      id: "default-streak",
      label: "Current streak",
      source: {
        kind: "tableLatest",
        table: heroTableId,
        column: streakCol.name,
      },
      format: "int",
    });
  }

  return specs.slice(0, 4);
}
