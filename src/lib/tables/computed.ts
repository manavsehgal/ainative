/**
 * Computed column evaluation helper.
 * Enriches row data with evaluated formula values for computed columns.
 */

import { evaluateFormula, hasCyclicDependencies, extractDependencies } from "./formula-engine";
import type { ColumnDef } from "./types";

/**
 * Evaluate computed columns and inject values into row data.
 * Uses a generic to preserve the exact row type from the caller.
 *
 * Works with both server-side rows (data as JSON string) and
 * client-side parsed rows (data as Record).
 */
export function evaluateComputedColumns<T extends { data: string | Record<string, unknown> }>(
  columns: ColumnDef[],
  rows: T[]
): T[] {
  const computedCols = columns.filter(
    (c) => c.dataType === "computed" && c.config?.formula
  );

  if (computedCols.length === 0) return rows;

  // Check for circular dependencies
  const depGraph = computedCols.map((c) => ({
    name: c.name,
    dependencies: c.config?.dependencies ?? extractDependencies(c.config!.formula!),
  }));

  const hasCycles = hasCyclicDependencies(depGraph);

  // Parse all rows for aggregate functions
  const allParsed = rows.map((r) =>
    typeof r.data === "string" ? JSON.parse(r.data) as Record<string, unknown> : r.data
  );

  return rows.map((row) => {
    const data = typeof row.data === "string"
      ? JSON.parse(row.data) as Record<string, unknown>
      : { ...row.data };

    for (const col of computedCols) {
      if (hasCycles) {
        data[col.name] = "#CYCLE";
      } else {
        try {
          data[col.name] = evaluateFormula(col.config!.formula!, data, allParsed);
        } catch {
          data[col.name] = "#ERROR";
        }
      }
    }

    return {
      ...row,
      data: typeof row.data === "string" ? JSON.stringify(data) : data,
    } as T;
  });
}
