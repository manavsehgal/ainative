/**
 * Duration parser and formatter for workflow step delays.
 *
 * Format: Nm (minutes), Nh (hours), Nd (days), Nw (weeks).
 * Bounds: minimum 1 minute, maximum 30 days.
 * Compound formats (e.g. "3d2h") are not supported.
 *
 * See features/workflow-step-delays.md for the spec.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

const MIN_DURATION_MS = MS_PER_MINUTE;
const MAX_DURATION_MS = 30 * MS_PER_DAY;

const DURATION_PATTERN = /^(\d+)(m|h|d|w)$/;

const UNIT_MS: Record<string, number> = {
  m: MS_PER_MINUTE,
  h: MS_PER_HOUR,
  d: MS_PER_DAY,
  w: MS_PER_WEEK,
};

/**
 * Parse a duration string into milliseconds.
 *
 * @throws if the format is invalid or the value is outside bounds.
 */
export function parseDuration(input: string): number {
  const match = input.match(DURATION_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid duration: "${input}". Use format: 30m, 2h, 3d, 1w`,
    );
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];
  const ms = value * UNIT_MS[unit];

  if (ms < MIN_DURATION_MS) {
    throw new Error(`Duration below minimum: "${input}". Minimum is 1 minute (1m).`);
  }
  if (ms > MAX_DURATION_MS) {
    throw new Error(`Duration above maximum: "${input}". Maximum is 30 days (30d).`);
  }

  return ms;
}

/**
 * Result of checking whether a workflow step is a delay step or a task step.
 * The engine branches on this — delay steps pause the workflow, task steps
 * execute normally.
 */
export type DelayCheck =
  | { type: "task" }
  | { type: "delay"; resumeAt: number };

/**
 * Classify a workflow step as either a delay step or a task step, and compute
 * the resume timestamp for delay steps.
 *
 * Pure function: no I/O, no side effects. The engine calls this inside the
 * sequence executor loop and branches on the result. Invalid duration formats
 * throw — blueprint validation (src/lib/validators/blueprint.ts) should catch
 * these at the workflow-creation boundary, so any invalid duration reaching
 * here is a programming error and must fail loudly.
 *
 * @param step  Workflow step (any object with an optional delayDuration field)
 * @param now   Current epoch timestamp in milliseconds (injected for testability)
 */
export function checkDelayStep(
  step: { delayDuration?: string },
  now: number,
): DelayCheck {
  if (!step.delayDuration) {
    return { type: "task" };
  }
  return {
    type: "delay",
    resumeAt: now + parseDuration(step.delayDuration),
  };
}

/**
 * Format a millisecond duration back into the canonical string form.
 * Prefers the largest unit that divides cleanly; falls back to minutes
 * when no larger unit divides evenly.
 */
export function formatDuration(ms: number): string {
  if (ms >= MS_PER_WEEK && ms % MS_PER_WEEK === 0) {
    return `${ms / MS_PER_WEEK}w`;
  }
  if (ms >= MS_PER_DAY && ms % MS_PER_DAY === 0) {
    return `${ms / MS_PER_DAY}d`;
  }
  if (ms >= MS_PER_HOUR && ms % MS_PER_HOUR === 0) {
    return `${ms / MS_PER_HOUR}h`;
  }
  return `${ms / MS_PER_MINUTE}m`;
}
