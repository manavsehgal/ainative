import { describe, it, expect, vi, beforeEach } from "vitest";

interface WorkflowRow {
  id: string;
  name: string;
  definition: string | null;
  projectId: string | null;
}

const { mockWorkflowRows } = vi.hoisted(() => ({
  mockWorkflowRows: { value: [] as WorkflowRow[] },
}));

// Minimal drizzle query builder stub — supports
//   db.select({...}).from(table).where(...)
// by returning a thenable that resolves to mockWorkflowRows.value.
vi.mock("@/lib/db", () => {
  const builder = {
    from() {
      return this;
    },
    where() {
      return this;
    },
    then<TResolve>(resolve: (rows: WorkflowRow[]) => TResolve) {
      return Promise.resolve(mockWorkflowRows.value).then(resolve);
    },
  };
  return {
    db: {
      select: () => builder,
    },
  };
});

// Stub the schema import so drizzle-orm doesn't try to read a real table.
vi.mock("@/lib/db/schema", () => ({
  workflows: { projectId: "projectId" },
  tasks: {},
  agentLogs: {},
  notifications: {},
  documents: {},
  workflowDocumentInputs: {},
}));

// Stub drizzle-orm operators used in workflow-tools.ts — the tests only
// care about the return value of the builder, not the operator objects.
vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: () => ({}),
  desc: () => ({}),
  inArray: () => ({}),
  like: () => ({}),
}));

import { findSimilarWorkflows } from "../workflow-tools";

function setRows(rows: WorkflowRow[]) {
  mockWorkflowRows.value = rows;
}

describe("findSimilarWorkflows", () => {
  beforeEach(() => {
    setRows([]);
  });

  it("returns [] when projectId is null (no cross-project dedup)", async () => {
    setRows([
      {
        id: "wf1",
        name: "Research Customer Feedback",
        definition: JSON.stringify({
          pattern: "sequence",
          steps: [{ id: "s1", name: "Research customer feedback", prompt: "do research" }],
        }),
        projectId: null,
      },
    ]);

    const result = await findSimilarWorkflows(
      null,
      "Research Customer Feedback",
      JSON.stringify({ pattern: "sequence", steps: [] })
    );
    expect(result).toEqual([]);
  });

  it("returns [] when no workflows exist in the project", async () => {
    setRows([]);
    const result = await findSimilarWorkflows(
      "proj_a",
      "Any name",
      JSON.stringify({ pattern: "sequence", steps: [] })
    );
    expect(result).toEqual([]);
  });

  it("matches exact name (case-insensitive) with similarity 1.0", async () => {
    setRows([
      {
        id: "wf1",
        name: "Research Customer Feedback",
        definition: null,
        projectId: "proj_a",
      },
    ]);

    const result = await findSimilarWorkflows(
      "proj_a",
      "research customer feedback",
      JSON.stringify({ pattern: "sequence", steps: [] })
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "wf1",
      similarity: 1,
    });
    expect(result[0].reason).toContain("Same name");
  });

  it("matches on Jaccard similarity over step names + prompts (redesign scenario)", async () => {
    // Simulates the bug scenario: LLM "redesigns" a workflow mid-conversation,
    // using mostly the same vocabulary as the original. The definitions are
    // near-identical (as redesigns typically are in practice) so Jaccard
    // should exceed the 0.7 threshold.
    const sharedSteps = [
      { id: "s1", name: "Research customer cohort", prompt: "Investigate customer research cohort feedback insights" },
      { id: "s2", name: "Interview protocol draft", prompt: "Draft customer interview questions protocol script" },
      { id: "s3", name: "Synthesize findings", prompt: "Summarize customer research findings insights report" },
    ];
    setRows([
      {
        id: "wf1",
        name: "Customer Discovery Pipeline",
        definition: JSON.stringify({ pattern: "sequence", steps: sharedSteps }),
        projectId: "proj_a",
      },
    ]);

    const result = await findSimilarWorkflows(
      "proj_a",
      "Customer Discovery Workflow v2",
      JSON.stringify({ pattern: "sequence", steps: sharedSteps })
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].id).toBe("wf1");
    expect(result[0].similarity).toBeGreaterThanOrEqual(0.7);
  });

  it("does NOT match when names and step text are completely different", async () => {
    setRows([
      {
        id: "wf1",
        name: "Deploy frontend release",
        definition: JSON.stringify({
          pattern: "sequence",
          steps: [{ id: "s1", name: "Deploy staging", prompt: "Push release artifact to staging environment" }],
        }),
        projectId: "proj_a",
      },
    ]);

    const result = await findSimilarWorkflows(
      "proj_a",
      "Customer interview analysis",
      JSON.stringify({
        pattern: "sequence",
        steps: [{ id: "s2", name: "Summarize interviews", prompt: "Pull insights from recent customer interviews" }],
      })
    );

    expect(result).toEqual([]);
  });

  it("caps results at 3 and sorts by similarity descending", async () => {
    // Four rows, all exact-name matches (similarity 1.0). Expect exactly 3 returned.
    setRows(
      Array.from({ length: 4 }).map((_, i) => ({
        id: `wf${i}`,
        name: "Duplicate Workflow",
        definition: null,
        projectId: "proj_a",
      }))
    );

    const result = await findSimilarWorkflows(
      "proj_a",
      "Duplicate Workflow",
      JSON.stringify({ pattern: "sequence", steps: [] })
    );

    expect(result).toHaveLength(3);
    expect(result.every((r) => r.similarity === 1)).toBe(true);
  });

  it("handles malformed definition JSON without crashing", async () => {
    setRows([
      {
        id: "wf1",
        name: "Legit Workflow",
        definition: "not-json-at-all",
        projectId: "proj_a",
      },
    ]);

    // Should not throw — just degrades to name-only comparison.
    const result = await findSimilarWorkflows(
      "proj_a",
      "Legit Workflow",
      "also not json"
    );
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(1); // exact name match
  });
});
