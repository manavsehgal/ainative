/**
 * Parse human-friendly interval strings into 5-field cron expressions.
 *
 * Supported formats:
 *   - `5m`  → every 5 minutes  → `*​/5 * * * *`
 *   - `2h`  → every 2 hours    → `0 *​/2 * * *`
 *   - `1d`  → daily at 9am     → `0 9 * * *`
 *   - `30s` → not supported (sub-minute precision is not allowed)
 *   - Raw cron expressions (5 fields) are returned as-is after validation
 */

import { CronExpressionParser } from "cron-parser";

const INTERVAL_RE = /^(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|day|days)$/i;

/**
 * Convert a human-friendly interval string or raw cron expression into a
 * validated 5-field cron expression.
 *
 * @returns The cron expression string
 * @throws  If the input cannot be parsed
 */
export function parseInterval(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Interval cannot be empty");

  // Try as human-friendly shorthand first
  const match = trimmed.match(INTERVAL_RE);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase().charAt(0); // m, h, or d

    if (value <= 0) throw new Error("Interval value must be positive");

    switch (unit) {
      case "m":
        if (value > 59) throw new Error("Minute interval must be 1-59");
        return value === 1 ? "* * * * *" : `*/${value} * * * *`;
      case "h":
        if (value > 23) throw new Error("Hour interval must be 1-23");
        return value === 1 ? "0 * * * *" : `0 */${value} * * *`;
      case "d":
        if (value === 1) return "0 9 * * *"; // daily at 9am
        if (value > 31) throw new Error("Day interval must be 1-31");
        return `0 9 */${value} * *`;
      default:
        throw new Error(`Unknown unit: ${unit}`);
    }
  }

  // Try as raw cron expression (5 fields)
  const fields = trimmed.split(/\s+/);
  if (fields.length === 5) {
    // Validate by parsing — cron-parser will throw if invalid
    CronExpressionParser.parse(trimmed);
    return trimmed;
  }

  throw new Error(
    `Cannot parse interval "${trimmed}". Use formats like 5m, 2h, 1d, or a 5-field cron expression.`
  );
}

/**
 * Compute the next fire time from a cron expression.
 *
 * @param cronExpression  A valid 5-field cron expression
 * @param from            Base date to compute from (defaults to now)
 * @returns               The next fire Date
 */
export function computeNextFireTime(cronExpression: string, from?: Date): Date {
  const expr = CronExpressionParser.parse(cronExpression, {
    currentDate: from ?? new Date(),
  });
  return expr.next().toDate();
}

/**
 * Generate a human-readable description of a cron expression.
 */
export function describeCron(cronExpression: string): string {
  const fields = cronExpression.split(/\s+/);
  if (fields.length !== 5) return cronExpression;

  const [minute, hour, dom, , dow] = fields;

  // Common patterns
  if (minute === "*" && hour === "*" && dom === "*" && dow === "*") {
    return "Every minute";
  }
  if (minute.startsWith("*/") && hour === "*" && dom === "*" && dow === "*") {
    const mins = minute.slice(2);
    return `Every ${mins} minutes`;
  }
  if (minute === "0" && hour === "*" && dom === "*" && dow === "*") {
    return "Every hour";
  }
  if (minute === "0" && hour.startsWith("*/") && dom === "*" && dow === "*") {
    const hrs = hour.slice(2);
    return `Every ${hrs} hours`;
  }
  if (minute === "0" && hour === "9" && dom === "*" && dow === "*") {
    return "Daily at 9:00 AM";
  }
  if (minute === "0" && hour === "9" && dom === "*" && dow === "1-5") {
    return "Weekdays at 9:00 AM";
  }

  return cronExpression;
}
