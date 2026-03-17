import type { LearnedContextRow } from "@/lib/db/schema";

export type LearnedContextSnapshotType =
  | "approved"
  | "rollback"
  | "summarization";

export type LearnedContextDiffKind = "context" | "added" | "removed";

export interface LearnedContextDiffLine {
  kind: LearnedContextDiffKind;
  value: string;
}

export interface LearnedContextDerivedDiff {
  previousVersion: number | null;
  lines: LearnedContextDiffLine[];
}

export interface LearnedContextHistoryEntry {
  row: LearnedContextRow;
  snapshotContent: string | null;
  derivedDiff: LearnedContextDerivedDiff | null;
}

const SNAPSHOT_CHANGE_TYPES = new Set<LearnedContextSnapshotType>([
  "approved",
  "rollback",
  "summarization",
]);

export function isSnapshotVersion(
  row: LearnedContextRow
): row is LearnedContextRow & {
  changeType: LearnedContextSnapshotType;
  content: string;
} {
  return (
    SNAPSHOT_CHANGE_TYPES.has(row.changeType as LearnedContextSnapshotType) &&
    typeof row.content === "string"
  );
}

function normalizeLines(content: string | null): string[] {
  if (!content) return [];
  return content.replace(/\r\n/g, "\n").split("\n");
}

function buildLcsTable(previous: string[], next: string[]): number[][] {
  const table = Array.from({ length: previous.length + 1 }, () =>
    Array(next.length + 1).fill(0)
  );

  for (let i = previous.length - 1; i >= 0; i -= 1) {
    for (let j = next.length - 1; j >= 0; j -= 1) {
      if (previous[i] === next[j]) {
        table[i][j] = table[i + 1][j + 1] + 1;
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
  }

  return table;
}

export function buildUnifiedDiff(
  previousContent: string | null,
  nextContent: string
): LearnedContextDiffLine[] {
  const previousLines = normalizeLines(previousContent);
  const nextLines = normalizeLines(nextContent);

  if (previousLines.length === 0) {
    return nextLines.map((value) => ({ kind: "added", value }));
  }

  const table = buildLcsTable(previousLines, nextLines);
  const lines: LearnedContextDiffLine[] = [];

  let i = 0;
  let j = 0;

  while (i < previousLines.length && j < nextLines.length) {
    if (previousLines[i] === nextLines[j]) {
      lines.push({ kind: "context", value: previousLines[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (table[i + 1][j] >= table[i][j + 1]) {
      lines.push({ kind: "removed", value: previousLines[i] });
      i += 1;
      continue;
    }

    lines.push({ kind: "added", value: nextLines[j] });
    j += 1;
  }

  while (i < previousLines.length) {
    lines.push({ kind: "removed", value: previousLines[i] });
    i += 1;
  }

  while (j < nextLines.length) {
    lines.push({ kind: "added", value: nextLines[j] });
    j += 1;
  }

  return lines;
}

export function hasMeaningfulDerivedDiff(
  diff: LearnedContextDerivedDiff | null
): boolean {
  return Boolean(
    diff?.lines.some((line) => line.kind === "added" || line.kind === "removed")
  );
}

export function buildLearnedContextHistoryEntries(
  history: LearnedContextRow[]
): LearnedContextHistoryEntry[] {
  const derivedDiffById = new Map<string, LearnedContextDerivedDiff>();
  let previousSnapshot: (LearnedContextRow & {
    changeType: LearnedContextSnapshotType;
    content: string;
  }) | null = null;

  const ascending = [...history].sort((a, b) => a.version - b.version);

  for (const row of ascending) {
    if (!isSnapshotVersion(row)) continue;

    derivedDiffById.set(row.id, {
      previousVersion: previousSnapshot?.version ?? null,
      lines: buildUnifiedDiff(previousSnapshot?.content ?? null, row.content),
    });

    previousSnapshot = row;
  }

  return history.map((row) => ({
    row,
    snapshotContent: isSnapshotVersion(row) ? row.content : null,
    derivedDiff: derivedDiffById.get(row.id) ?? null,
  }));
}
