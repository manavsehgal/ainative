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
 * Expand a cron expression's minute field into the concrete set of minute
 * values (0-59) it fires on.
 *
 * Used by the schedule auto-stagger logic to detect collisions between
 * existing schedules and a newly requested cron. Only the minute field is
 * expanded — collisions across hour/day/month boundaries are intentionally
 * out of scope (a `*​/30 * * * *` schedule and a `*​/30 9 * * *` schedule are
 * treated as overlapping at minute :00 even though they only collide once
 * a day, because that single collision is still a starvation risk).
 *
 * Supported minute syntax: `*`, `*​/N`, comma lists (`5,15,45`), ranges
 * (`10-30`), single values, and `step ranges` (`0-30/5`).
 */
export function expandCronMinutes(cronExpression: string): number[] {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Invalid cron expression (need 5 fields): ${cronExpression}`);
  }
  return expandMinuteField(fields[0]);
}

function expandMinuteField(field: string): number[] {
  const result = new Set<number>();
  for (const part of field.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Handle step syntax: */N, M/N, or A-B/N
    let stepBase = trimmed;
    let step = 1;
    const stepIdx = trimmed.indexOf("/");
    if (stepIdx >= 0) {
      stepBase = trimmed.slice(0, stepIdx);
      step = parseInt(trimmed.slice(stepIdx + 1), 10);
      if (!Number.isFinite(step) || step <= 0) {
        throw new Error(`Invalid step in cron minute field: ${trimmed}`);
      }
    }

    let from: number;
    let to: number;
    if (stepBase === "*") {
      from = 0;
      to = 59;
    } else if (stepBase.includes("-")) {
      const [a, b] = stepBase.split("-").map((n) => parseInt(n, 10));
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        throw new Error(`Invalid range in cron minute field: ${trimmed}`);
      }
      from = a;
      to = b;
    } else {
      const single = parseInt(stepBase, 10);
      if (!Number.isFinite(single)) {
        throw new Error(`Invalid value in cron minute field: ${trimmed}`);
      }
      // Bare integer with no step: just that one minute.
      // Bare integer with /N: from value to 59 by step (cron semantics).
      from = single;
      to = stepIdx >= 0 ? 59 : single;
    }

    for (let m = from; m <= to && m < 60; m += step) {
      if (m >= 0) result.add(m);
    }
  }
  return [...result].sort((a, b) => a - b);
}

const MIN_GAP_MINUTES = 5;

export interface StaggerResult {
  cronExpression: string;
  offsetApplied: number;
  collided: boolean;
}

/**
 * Compute a non-colliding cron expression for a new schedule by offsetting
 * its minute field if any of its fire minutes are within MIN_GAP_MINUTES of
 * an already-occupied minute.
 *
 * Strategy:
 *   1. Expand both the requested cron and all existing schedule crons into
 *      minute sets.
 *   2. Detect the "interval period" of the request (e.g. 30 for `*​/30`),
 *      which bounds the offset search space.
 *   3. Walk offsets [0..interval-1] looking for the smallest one that puts
 *      all requested fire minutes ≥ MIN_GAP_MINUTES away from every
 *      occupied minute.
 *   4. Apply the offset by rewriting the minute field. For `*​/N` patterns
 *      we rewrite to a comma list `(0+off, N+off, 2N+off, ...)`. For lists
 *      we shift each element by the offset (mod 60).
 *
 * Returns the original cron when no offset is needed or when no
 * collision-free offset exists in the search space (caller can decide
 * whether to warn).
 */
export function computeStaggeredCron(
  requestedCron: string,
  existingCrons: string[]
): StaggerResult {
  const requestedMinutes = expandCronMinutes(requestedCron);
  if (requestedMinutes.length === 0) {
    return { cronExpression: requestedCron, offsetApplied: 0, collided: false };
  }

  const occupied = new Set<number>();
  for (const cron of existingCrons) {
    try {
      for (const m of expandCronMinutes(cron)) occupied.add(m);
    } catch {
      // Skip cron expressions we cannot parse — better to allow the user's
      // schedule than to block creation on a bad neighbor.
    }
  }

  if (!hasCollision(requestedMinutes, occupied)) {
    return { cronExpression: requestedCron, offsetApplied: 0, collided: false };
  }

  // Determine the interval period bounds offset search.
  // For `*​/N * * * *` the period is N. For arbitrary lists fall back to 60.
  const period = detectMinutePeriod(requestedCron) ?? 60;

  for (let offset = 1; offset < period; offset++) {
    const shifted = requestedMinutes.map((m) => (m + offset) % 60);
    if (!hasCollision(shifted, occupied)) {
      return {
        cronExpression: applyMinuteOffset(requestedCron, offset),
        offsetApplied: offset,
        collided: true,
      };
    }
  }

  // No collision-free offset found in search space — return original and let
  // the caller log a warning. The queue drain still prevents starvation.
  return { cronExpression: requestedCron, offsetApplied: 0, collided: true };
}

function hasCollision(minutes: number[], occupied: Set<number>): boolean {
  if (occupied.size === 0) return false;
  for (const m of minutes) {
    for (let delta = -MIN_GAP_MINUTES + 1; delta < MIN_GAP_MINUTES; delta++) {
      const candidate = (m + delta + 60) % 60;
      if (occupied.has(candidate)) return true;
    }
  }
  return false;
}

/**
 * Detect the minute period of a cron expression. Returns the step value for
 * `*​/N` patterns, the gap for evenly-spaced lists like `0,30`, or null when
 * the pattern is irregular.
 */
function detectMinutePeriod(cronExpression: string): number | null {
  const minuteField = cronExpression.trim().split(/\s+/)[0];
  const stepMatch = minuteField.match(/^\*\/(\d+)$/);
  if (stepMatch) return parseInt(stepMatch[1], 10);

  const minutes = expandCronMinutes(cronExpression);
  if (minutes.length < 2) return null;
  const gap = minutes[1] - minutes[0];
  for (let i = 2; i < minutes.length; i++) {
    if (minutes[i] - minutes[i - 1] !== gap) return null;
  }
  return gap;
}

/**
 * Rewrite the minute field of a cron expression by shifting all minutes by
 * the given offset. Replaces `*​/N` shorthand with an explicit comma list so
 * the offset is visible to users inspecting the cron.
 */
function applyMinuteOffset(cronExpression: string, offset: number): string {
  const fields = cronExpression.trim().split(/\s+/);
  const minutes = expandCronMinutes(cronExpression);
  const shifted = minutes
    .map((m) => (m + offset) % 60)
    .sort((a, b) => a - b);
  fields[0] = shifted.join(",");
  return fields.join(" ");
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
