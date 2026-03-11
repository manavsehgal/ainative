/**
 * Template resolution for blueprint prompt templates.
 *
 * Supports:
 * - {{variable}} — simple substitution
 * - {{#if variable}}...{{/if}} — conditional blocks
 */

/**
 * Resolve all template expressions in a string.
 */
export function resolveTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  let result = template;

  // Process {{#if variable}}...{{/if}} blocks first
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, varName: string, content: string) => {
      const value = variables[varName];
      return isTruthy(value) ? content : "";
    }
  );

  // Then substitute {{variable}} references
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    const value = variables[varName];
    if (value === undefined || value === null) return "";
    return String(value);
  });

  // Clean up multiple consecutive blank lines left by removed conditionals
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * Evaluate a condition string (a template expression like "{{variable}}").
 * Returns true if the resolved value is truthy.
 */
export function evaluateCondition(
  condition: string,
  variables: Record<string, unknown>
): boolean {
  // Strip template syntax to get the variable name
  const varName = condition.replace(/\{\{|\}\}/g, "").trim();
  return isTruthy(variables[varName]);
}

function isTruthy(value: unknown): boolean {
  if (value === undefined || value === null || value === "" || value === false) {
    return false;
  }
  return true;
}
