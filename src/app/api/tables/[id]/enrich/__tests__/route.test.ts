import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateEnrichmentWorkflow } = vi.hoisted(() => ({
  mockCreateEnrichmentWorkflow: vi.fn(),
}));

vi.mock("@/lib/tables/enrichment", () => ({
  createEnrichmentWorkflow: mockCreateEnrichmentWorkflow,
}));

import { POST } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/tables/tbl_x/enrich", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "tbl_x" });

describe("POST /api/tables/[id]/enrich", () => {
  beforeEach(() => {
    mockCreateEnrichmentWorkflow.mockReset();
  });

  it("rejects requests with missing required fields (400)", async () => {
    const res = await POST(makeRequest({}) as never, {
      params,
    });
    expect(res.status).toBe(400);
    expect(mockCreateEnrichmentWorkflow).not.toHaveBeenCalled();
  });

  it("returns 202 with workflowId and rowCount on success", async () => {
    mockCreateEnrichmentWorkflow.mockResolvedValueOnce({
      workflowId: "wf_123",
      rowCount: 3,
    });

    const res = await POST(
      makeRequest({
        prompt: "Find LinkedIn for {{row.name}}",
        targetColumn: "linkedin",
      }) as never,
      { params }
    );

    expect(res.status).toBe(202);
    const json = (await res.json()) as { workflowId: string; rowCount: number };
    expect(json.workflowId).toBe("wf_123");
    expect(json.rowCount).toBe(3);
    expect(mockCreateEnrichmentWorkflow).toHaveBeenCalledWith(
      "tbl_x",
      expect.objectContaining({
        prompt: "Find LinkedIn for {{row.name}}",
        targetColumn: "linkedin",
      })
    );
  });

  it("caps batchSize to 200 before delegating", async () => {
    mockCreateEnrichmentWorkflow.mockResolvedValueOnce({
      workflowId: "wf_456",
      rowCount: 200,
    });

    await POST(
      makeRequest({
        prompt: "Enrich {{row.name}}",
        targetColumn: "linkedin",
        batchSize: 5000,
      }) as never,
      { params }
    );

    const callArg = mockCreateEnrichmentWorkflow.mock.calls[0][1] as {
      batchSize: number;
    };
    expect(callArg.batchSize).toBe(200);
  });

  it("rejects batchSize less than 1", async () => {
    const res = await POST(
      makeRequest({
        prompt: "x",
        targetColumn: "linkedin",
        batchSize: 0,
      }) as never,
      { params }
    );
    expect(res.status).toBe(400);
    expect(mockCreateEnrichmentWorkflow).not.toHaveBeenCalled();
  });

  it("returns 404 when the table is missing", async () => {
    mockCreateEnrichmentWorkflow.mockRejectedValueOnce(
      new Error("Table tbl_x not found")
    );

    const res = await POST(
      makeRequest({
        prompt: "x",
        targetColumn: "linkedin",
      }) as never,
      { params }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when the column does not exist on the table", async () => {
    mockCreateEnrichmentWorkflow.mockRejectedValueOnce(
      new Error('Column "ghost" does not exist on table tbl_x')
    );

    const res = await POST(
      makeRequest({
        prompt: "x",
        targetColumn: "ghost",
      }) as never,
      { params }
    );
    expect(res.status).toBe(400);
  });

  it("forwards filter, agentProfile, and projectId to the generator", async () => {
    mockCreateEnrichmentWorkflow.mockResolvedValueOnce({
      workflowId: "wf_789",
      rowCount: 1,
    });

    await POST(
      makeRequest({
        prompt: "x",
        targetColumn: "linkedin",
        filter: { column: "linkedin", operator: "is_empty" },
        agentProfile: "researcher",
        projectId: "proj_1",
      }) as never,
      { params }
    );

    const callArg = mockCreateEnrichmentWorkflow.mock.calls[0][1] as {
      filter: unknown;
      agentProfile: string;
      projectId: string;
    };
    expect(callArg.filter).toEqual({ column: "linkedin", operator: "is_empty" });
    expect(callArg.agentProfile).toBe("researcher");
    expect(callArg.projectId).toBe("proj_1");
  });
});
