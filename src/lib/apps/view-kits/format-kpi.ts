export type KpiFormat = "int" | "currency" | "percent" | "duration" | "relative";

export type KpiPrimitive = number | string | null | undefined;

/**
 * Formats a raw KPI value into a display string. Pure helper used by both
 * the KPIStrip primitive and any debug surface. Returns "—" for
 * null/undefined, passes strings through unchanged, and dispatches numbers
 * per `format`.
 *
 * Why em-dash for null: design system convention for "no value yet" —
 * softer than "0" and avoids miscommunicating an empty signal as a real
 * zero.
 */
export function formatKpi(value: KpiPrimitive, format: KpiFormat): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  switch (format) {
    case "int":
      return new Intl.NumberFormat("en-US").format(Math.round(value));
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case "percent":
      return `${Math.round(value * 100)}%`;
    case "duration":
      return formatDuration(value);
    case "relative":
      return formatRelative(value);
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const remSec = Math.round(seconds - minutes * 60);
    return remSec === 0 ? `${minutes}m` : `${minutes}m ${remSec}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes - hours * 60;
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}

function formatRelative(epochMs: number): string {
  const diffMs = epochMs - Date.now();
  const absDays = Math.abs(diffMs) / 86_400_000;
  const absHours = Math.abs(diffMs) / 3_600_000;
  const absMin = Math.abs(diffMs) / 60_000;
  const future = diffMs > 0;
  let unit: string;
  if (absDays >= 1) unit = `${Math.round(absDays)}d`;
  else if (absHours >= 1) unit = `${Math.round(absHours)}h`;
  else unit = `${Math.max(1, Math.round(absMin))}m`;
  return future ? `in ${unit}` : `${unit} ago`;
}
