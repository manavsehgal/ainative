import type { ColumnDataType } from "@/lib/constants/table-status";

/** Icons for column data types (lucide icon names) */
export const columnTypeIcons: Record<ColumnDataType, string> = {
  text: "Type",
  number: "Hash",
  date: "Calendar",
  boolean: "CheckSquare",
  select: "List",
  url: "Link",
  email: "Mail",
  relation: "GitBranch",
  computed: "Sparkles",
};

/** Format row count for display */
export function formatRowCount(count: number): string {
  if (count === 0) return "Empty";
  if (count === 1) return "1 row";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k rows`;
  return `${count} rows`;
}

/** Format column count for display */
export function formatColumnCount(count: number): string {
  if (count === 0) return "No columns";
  if (count === 1) return "1 column";
  return `${count} columns`;
}
