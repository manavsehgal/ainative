const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Formats a timestamp with relative time for recent items
 * and a full date for older ones.
 */
export function formatTimestamp(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins}m ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours}h ago`;
  }
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return `${days}d ago`;
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Formats a timestamp as HH:MM:SS for log entries.
 */
export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Compact date-time for space-constrained surfaces (kanban cards, bento cells).
 * Today: "14:23" | This week: "Mon 14:23" | This year: "Apr 12, 14:23" | Older: "Apr 12, 2025"
 */
export function formatCompactDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const time = d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

  if (d.toDateString() === now.toDateString()) return time;

  if (diff > 0 && diff < 7 * DAY) {
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    return `${weekday} ${time}`;
  }

  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (d.getFullYear() === now.getFullYear()) return `${monthDay}, ${time}`;

  return `${monthDay}, ${d.getFullYear()}`;
}
