/**
 * Natural Language Schedule Parser
 *
 * Converts plain-English scheduling expressions into 5-field cron expressions.
 * Uses regex pattern matching for common expressions (Layer 1).
 *
 * For expressions that don't match any pattern, returns null so the caller
 * can fall back to `parseInterval()` or show a "could not parse" message.
 */

export interface NLParseResult {
  cronExpression: string;
  /** Human-readable description of the schedule */
  description: string;
  /** 1.0 for regex match, 0.7-0.9 for LLM (future) */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Parse a time string into { hour, minute }.
 * Handles: "9am", "3pm", "9:30am", "15:00", "noon", "midnight", "3 pm"
 */
function parseTime(raw: string): { hour: number; minute: number } | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");

  if (s === "noon" || s === "12noon") return { hour: 12, minute: 0 };
  if (s === "midnight" || s === "12midnight") return { hour: 0, minute: 0 };

  // 12h format: 9am, 9:30am, 3pm, 12:45pm
  const match12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = match12[2] ? parseInt(match12[2], 10) : 0;
    const ampm = match12[3];

    if (hour < 1 || hour > 12) return null;
    if (minute < 0 || minute > 59) return null;

    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    return { hour, minute };
  }

  // 24h format: 15:00, 09:30
  const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;
    return { hour, minute };
  }

  return null;
}

function formatTime(hour: number, minute: number): string {
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  const minStr = minute > 0 ? `:${String(minute).padStart(2, "0")}` : "";
  return `${h12}${minStr} ${ampm}`;
}

function parseDayOfWeek(raw: string): number | null {
  const key = raw.trim().toLowerCase();
  return DAY_MAP[key] ?? null;
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

type PatternMatcher = (input: string) => NLParseResult | null;

/**
 * "every <day> at <time>" — e.g., "every Monday at 9am"
 */
const everyDayAtTime: PatternMatcher = (input) => {
  const m = input.match(
    /^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\s+at\s+(.+)$/i
  );
  if (!m) return null;
  const dow = parseDayOfWeek(m[1]);
  if (dow === null) return null;
  const time = parseTime(m[2]);
  if (!time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} * * ${dow}`,
    description: `Every ${DAY_NAMES[dow]} at ${formatTime(time.hour, time.minute)}`,
    confidence: 1.0,
  };
};

/**
 * "daily at <time>" or "every day at <time>"
 */
const dailyAtTime: PatternMatcher = (input) => {
  const m = input.match(/^(?:daily|every\s+day)\s+at\s+(.+)$/i);
  if (!m) return null;
  const time = parseTime(m[1]);
  if (!time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} * * *`,
    description: `Daily at ${formatTime(time.hour, time.minute)}`,
    confidence: 1.0,
  };
};

/**
 * "every N hours/minutes"
 */
const everyNUnits: PatternMatcher = (input) => {
  const m = input.match(
    /^every\s+(\d+)\s+(hours?|minutes?|mins?)$/i
  );
  if (!m) return null;
  const value = parseInt(m[1], 10);
  const unit = m[2].toLowerCase().charAt(0); // 'h' or 'm'
  if (value <= 0) return null;

  if (unit === "h") {
    if (value > 23) return null;
    return {
      cronExpression: `0 */${value} * * *`,
      description: `Every ${value} hour${value > 1 ? "s" : ""}`,
      confidence: 1.0,
    };
  }
  // minutes
  if (value > 59) return null;
  return {
    cronExpression: `*/${value} * * * *`,
    description: `Every ${value} minute${value > 1 ? "s" : ""}`,
    confidence: 1.0,
  };
};

/**
 * "weekdays at <time>" or "every weekday at <time>"
 */
const weekdaysAtTime: PatternMatcher = (input) => {
  const m = input.match(/^(?:every\s+)?weekdays?\s+at\s+(.+)$/i);
  if (!m) return null;
  const time = parseTime(m[1]);
  if (!time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} * * 1-5`,
    description: `Weekdays at ${formatTime(time.hour, time.minute)}`,
    confidence: 1.0,
  };
};

/**
 * "every morning" / "every evening" / "every night"
 */
const timeOfDay: PatternMatcher = (input) => {
  const m = input.match(/^every\s+(morning|evening|night|afternoon)$/i);
  if (!m) return null;
  const period = m[1].toLowerCase();
  switch (period) {
    case "morning":
      return { cronExpression: "0 9 * * *", description: "Every morning at 9 AM", confidence: 1.0 };
    case "afternoon":
      return { cronExpression: "0 14 * * *", description: "Every afternoon at 2 PM", confidence: 1.0 };
    case "evening":
      return { cronExpression: "0 18 * * *", description: "Every evening at 6 PM", confidence: 1.0 };
    case "night":
      return { cronExpression: "0 21 * * *", description: "Every night at 9 PM", confidence: 1.0 };
    default:
      return null;
  }
};

/**
 * Single-word shortcuts: "hourly", "daily", "weekly", "monthly"
 */
const singleWord: PatternMatcher = (input) => {
  switch (input.toLowerCase().trim()) {
    case "hourly":
      return { cronExpression: "0 * * * *", description: "Every hour", confidence: 1.0 };
    case "daily":
      return { cronExpression: "0 9 * * *", description: "Daily at 9 AM", confidence: 1.0 };
    case "weekly":
      return { cronExpression: "0 9 * * 1", description: "Every Monday at 9 AM", confidence: 1.0 };
    case "monthly":
      return { cronExpression: "0 9 1 * *", description: "First of every month at 9 AM", confidence: 1.0 };
    default:
      return null;
  }
};

/**
 * "twice a day"
 */
const twiceADay: PatternMatcher = (input) => {
  if (/^twice\s+a\s+day$/i.test(input)) {
    return {
      cronExpression: "0 9,17 * * *",
      description: "Twice a day at 9 AM and 5 PM",
      confidence: 1.0,
    };
  }
  return null;
};

/**
 * "first of every month" or "first of the month"
 */
const firstOfMonth: PatternMatcher = (input) => {
  const m = input.match(
    /^(?:the\s+)?first\s+(?:of\s+)?(?:every|the|each)\s+month(?:\s+at\s+(.+))?$/i
  );
  if (!m) return null;
  const time = m[1] ? parseTime(m[1]) : { hour: 9, minute: 0 };
  if (!time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} 1 * *`,
    description: `First of every month at ${formatTime(time.hour, time.minute)}`,
    confidence: 1.0,
  };
};

/**
 * "at <time>" (daily implied)
 */
const atTime: PatternMatcher = (input) => {
  const m = input.match(/^at\s+(.+)$/i);
  if (!m) return null;
  const time = parseTime(m[1]);
  if (!time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} * * *`,
    description: `Daily at ${formatTime(time.hour, time.minute)}`,
    confidence: 0.9, // slightly lower — "at 9am" is implicitly daily
  };
};

/**
 * "every hour" / "every minute"
 */
const everySingularUnit: PatternMatcher = (input) => {
  if (/^every\s+hour$/i.test(input)) {
    return { cronExpression: "0 * * * *", description: "Every hour", confidence: 1.0 };
  }
  if (/^every\s+minute$/i.test(input)) {
    return { cronExpression: "* * * * *", description: "Every minute", confidence: 1.0 };
  }
  return null;
};

/**
 * "weekdays at <time>" without "every" prefix already handled above,
 * but also handle "on weekdays at <time>"
 */
const onWeekdaysAtTime: PatternMatcher = (input) => {
  const m = input.match(/^on\s+weekdays?\s+at\s+(.+)$/i);
  if (!m) return null;
  const time = parseTime(m[1]);
  if (!time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} * * 1-5`,
    description: `Weekdays at ${formatTime(time.hour, time.minute)}`,
    confidence: 1.0,
  };
};

/**
 * "every weekday at <time>" (without "s")
 * Already covered by weekdaysAtTime but "every weekday at 9am" uses singular
 */

/**
 * "on <day> at <time>" — e.g., "on Sunday at 8pm"
 */
const onDayAtTime: PatternMatcher = (input) => {
  const m = input.match(
    /^on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\s+at\s+(.+)$/i
  );
  if (!m) return null;
  const dow = parseDayOfWeek(m[1]);
  if (dow === null) return null;
  const time = parseTime(m[2]);
  if (!time) return null;
  return {
    cronExpression: `${time.minute} ${time.hour} * * ${dow}`,
    description: `Every ${DAY_NAMES[dow]} at ${formatTime(time.hour, time.minute)}`,
    confidence: 1.0,
  };
};

// ---------------------------------------------------------------------------
// Ordered pattern list — first match wins
// ---------------------------------------------------------------------------

const PATTERNS: PatternMatcher[] = [
  everyDayAtTime,
  dailyAtTime,
  weekdaysAtTime,
  onWeekdaysAtTime,
  onDayAtTime,
  everyNUnits,
  timeOfDay,
  singleWord,
  twiceADay,
  firstOfMonth,
  everySingularUnit,
  atTime,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a natural language scheduling expression into a cron expression.
 *
 * Returns null if no pattern matches. The caller should fall back to
 * `parseInterval()` for shorthand formats (5m, 2h, 1d) or raw cron,
 * or show a "could not parse" message.
 *
 * @example
 * parseNaturalLanguage("every Monday at 9am")
 * // { cronExpression: "0 9 * * 1", description: "Every Monday at 9 AM", confidence: 1.0 }
 */
export function parseNaturalLanguage(input: string): NLParseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const pattern of PATTERNS) {
    const result = pattern(trimmed);
    if (result) return result;
  }

  // TODO: Layer 2 — LLM Fallback
  // For ambiguous expressions like "every other Tuesday", "the third Wednesday
  // of each month", etc., we could send the expression to an LLM for parsing.
  // Return null for now — these need LLM inference.

  return null;
}
