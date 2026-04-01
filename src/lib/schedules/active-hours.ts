/**
 * Active hours windowing for heartbeat schedules.
 *
 * Determines whether a heartbeat should fire based on the configured
 * active hours window and timezone.
 */

interface ActiveHoursResult {
  /** Whether the current time is within the active window */
  isActive: boolean;
  /** If not active, the next Date when the window opens (in UTC) */
  nextActiveAt: Date | null;
}

/**
 * Check if the current time falls within an active hours window.
 *
 * @param start  Start hour (0-23) in the target timezone
 * @param end    End hour (0-23) in the target timezone
 * @param tz     IANA timezone string (e.g. "America/New_York")
 * @param now    Optional reference time (defaults to current time)
 */
export function checkActiveHours(
  start: number | null,
  end: number | null,
  tz: string | null,
  now?: Date
): ActiveHoursResult {
  // No active hours configured — always active
  if (start === null || end === null) {
    return { isActive: true, nextActiveAt: null };
  }

  const refTime = now ?? new Date();
  const timezone = tz || "UTC";

  // Get the current hour in the target timezone
  let currentHour: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    currentHour = parseInt(formatter.format(refTime), 10);
    // Intl returns 24 for midnight in some locales
    if (currentHour === 24) currentHour = 0;
  } catch {
    // Invalid timezone — fall back to always active
    console.warn(`[active-hours] Invalid timezone "${timezone}", defaulting to always active`);
    return { isActive: true, nextActiveAt: null };
  }

  const isActive = start <= end
    ? currentHour >= start && currentHour < end       // e.g. 9-17
    : currentHour >= start || currentHour < end;      // e.g. 22-6 (overnight)

  if (isActive) {
    return { isActive: true, nextActiveAt: null };
  }

  // Compute next active time
  const nextActiveAt = computeNextActiveTime(start, timezone, refTime);
  return { isActive: false, nextActiveAt };
}

/**
 * Compute the next time the active window opens.
 */
function computeNextActiveTime(
  startHour: number,
  timezone: string,
  refTime: Date
): Date {
  // Get the current date components in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(refTime);

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const currentHour = get("hour") === 24 ? 0 : get("hour");

  // If we haven't reached startHour today, next active is today at startHour
  // Otherwise, next active is tomorrow at startHour
  const targetDay = currentHour < startHour ? day : day + 1;

  // Construct the target time in the timezone, then convert to UTC
  // Use a simple approach: create a Date string and parse
  const targetStr = `${year}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}T${String(startHour).padStart(2, "0")}:00:00`;

  // Use Intl to figure out the UTC offset at that time
  try {
    // Approximate: shift by the difference between timezone and UTC
    const utcDate = new Date(targetStr + "Z");
    const tzOffset = getTimezoneOffsetMs(timezone, utcDate);
    return new Date(utcDate.getTime() - tzOffset);
  } catch {
    // Fallback: return next hour
    return new Date(refTime.getTime() + 3600_000);
  }
}

/**
 * Get the offset in ms between a timezone and UTC at a given moment.
 */
function getTimezoneOffsetMs(timezone: string, refDate: Date): number {
  const utcStr = refDate.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = refDate.toLocaleString("en-US", { timeZone: timezone });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
}
