import type { BlueprintVariable } from "./types";

export interface VariableValidationResult {
  errors: Record<string, string>;
}

/**
 * Pure validator for blueprint variable form submissions. Required fields
 * with `null`/`undefined`/empty-string values produce a `<label> is required`
 * error keyed by variable id. Numeric `0` and boolean `false` are NOT
 * considered missing.
 */
export function validateVariables(
  values: Record<string, unknown>,
  defs: BlueprintVariable[]
): VariableValidationResult {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    if (!def.required) continue;
    const value = values[def.id];
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");
    if (isEmpty) {
      errors[def.id] = `${def.label} is required`;
    }
  }
  return { errors };
}
