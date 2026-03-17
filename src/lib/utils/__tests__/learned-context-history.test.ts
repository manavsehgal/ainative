import type { LearnedContextRow } from "@/lib/db/schema";

import {
  buildLearnedContextHistoryEntries,
  buildUnifiedDiff,
  hasMeaningfulDerivedDiff,
} from "../learned-context-history";

function makeRow(
  overrides: Partial<LearnedContextRow> & {
    id: string;
    version: number;
    changeType: LearnedContextRow["changeType"];
  }
): LearnedContextRow {
  return {
    id: overrides.id,
    profileId: overrides.profileId ?? "general",
    version: overrides.version,
    content: overrides.content ?? null,
    diff: overrides.diff ?? null,
    changeType: overrides.changeType,
    sourceTaskId: overrides.sourceTaskId ?? null,
    proposalNotificationId: overrides.proposalNotificationId ?? null,
    proposedAdditions: overrides.proposedAdditions ?? null,
    approvedBy: overrides.approvedBy ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-17T12:00:00.000Z"),
  };
}

describe("buildUnifiedDiff", () => {
  it("treats the first version as all additions", () => {
    expect(buildUnifiedDiff(null, "Alpha\nBeta")).toEqual([
      { kind: "added", value: "Alpha" },
      { kind: "added", value: "Beta" },
    ]);
  });

  it("builds a unified diff for appended content", () => {
    expect(buildUnifiedDiff("Alpha", "Alpha\nBeta")).toEqual([
      { kind: "context", value: "Alpha" },
      { kind: "added", value: "Beta" },
    ]);
  });
});

describe("buildLearnedContextHistoryEntries", () => {
  it("derives rollback diffs from the previous snapshot version", () => {
    const history = [
      makeRow({
        id: "v3",
        version: 3,
        changeType: "rollback",
        content: "Alpha",
        diff: "Rolled back to version 1",
      }),
      makeRow({
        id: "v2",
        version: 2,
        changeType: "approved",
        content: "Alpha\nBeta",
        diff: "Beta",
      }),
      makeRow({
        id: "v1",
        version: 1,
        changeType: "approved",
        content: "Alpha",
        diff: "Alpha",
      }),
    ];

    const entries = buildLearnedContextHistoryEntries(history);
    const rollbackEntry = entries[0];

    expect(rollbackEntry.snapshotContent).toBe("Alpha");
    expect(rollbackEntry.derivedDiff).toEqual({
      previousVersion: 2,
      lines: [
        { kind: "context", value: "Alpha" },
        { kind: "removed", value: "Beta" },
      ],
    });
  });

  it("derives summarization diffs from the previous snapshot version", () => {
    const history = [
      makeRow({
        id: "v3",
        version: 3,
        changeType: "summarization",
        content: "Alpha\nGamma",
        diff: "Summarized from 14 to 11 chars",
      }),
      makeRow({
        id: "v2",
        version: 2,
        changeType: "rejected",
        content: "Alpha\nBeta",
        diff: "Rejected addition",
      }),
      makeRow({
        id: "v1",
        version: 1,
        changeType: "approved",
        content: "Alpha\nBeta",
        diff: "Alpha\nBeta",
      }),
    ];

    const entries = buildLearnedContextHistoryEntries(history);
    const summarizationEntry = entries[0];

    expect(summarizationEntry.derivedDiff).toEqual({
      previousVersion: 1,
      lines: [
        { kind: "context", value: "Alpha" },
        { kind: "removed", value: "Beta" },
        { kind: "added", value: "Gamma" },
      ],
    });
  });

  it("does not create derived diffs for proposal-only rows", () => {
    const history = [
      makeRow({
        id: "proposal",
        version: 2,
        changeType: "proposal",
        diff: "Add retries",
      }),
      makeRow({
        id: "approved",
        version: 1,
        changeType: "approved",
        content: "Validate inputs",
        diff: "Validate inputs",
      }),
    ];

    const entries = buildLearnedContextHistoryEntries(history);

    expect(entries[0].snapshotContent).toBeNull();
    expect(entries[0].derivedDiff).toBeNull();
    expect(entries[1].derivedDiff?.previousVersion).toBeNull();
  });
});

describe("hasMeaningfulDerivedDiff", () => {
  it("detects when a derived diff contains additions or removals", () => {
    expect(
      hasMeaningfulDerivedDiff({
        previousVersion: 1,
        lines: [
          { kind: "context", value: "Alpha" },
          { kind: "added", value: "Beta" },
        ],
      })
    ).toBe(true);
  });

  it("returns false for null or unchanged diffs", () => {
    expect(hasMeaningfulDerivedDiff(null)).toBe(false);
    expect(
      hasMeaningfulDerivedDiff({
        previousVersion: 1,
        lines: [{ kind: "context", value: "Alpha" }],
      })
    ).toBe(false);
  });
});
