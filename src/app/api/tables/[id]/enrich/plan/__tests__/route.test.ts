import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPreviewEnrichmentPlan } = vi.hoisted(() => ({
  mockPreviewEnrichmentPlan: vi.fn(),
}));

vi.mock("@/lib/tables/enrichment", () => ({
  previewEnrichmentPlan: mockPreviewEnrichmentPlan,
}));

import { POST } from "../route";

function makeRequest(body: unknown, options?: { rawBody?: string }): Request {
  return new Request("http://test/api/tables/tbl_x/enrich/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: options?.rawBody ?? JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "tbl_x" });

const samplePreview = {
  promptMode: "auto" as const,
  strategy: "single-pass-lookup" as const,
  agentProfile: "sales-researcher",
  reasoning: "stub",
  steps: [
    {
      id: "final",
      name: "Lookup value",
      purpose: "Determine the final typed value for this row",
      prompt: "Determine the best value...\nRESPONSE FORMAT (strict):",
      agentProfile: "sales-researcher",
    },
  ],
  targetContract: {
    columnName: "linkedin_url",
    columnLabel: "LinkedIn URL",
    dataType: "url" as const,
  },
  eligibleRowCount: 0,
  sampleBindings: [],
};

describe("POST /api/tables/[id]/enrich/plan", () => {
  beforeEach(() => {
    mockPreviewEnrichmentPlan.mockReset();
  });

  it("returns 400 with field error when targetColumn is missing", async () => {
    const res = await POST(makeRequest({}) as never, { params });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: Array<{ path: string }> };
    expect(json.error.some((issue) => issue.path === "targetColumn")).toBe(true);
    expect(mockPreviewEnrichmentPlan).not.toHaveBeenCalled();
  });

  it("returns 400 when custom mode is requested without a prompt", async () => {
    const res = await POST(
      makeRequest({
        targetColumn: "linkedin_url",
        promptMode: "custom",
      }) as never,
      { params }
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: Array<{ path: string; message: string }> };
    expect(
      json.error.some(
        (issue) => issue.path === "prompt" && /Custom enrichment requires a prompt/.test(issue.message)
      )
    ).toBe(true);
    expect(mockPreviewEnrichmentPlan).not.toHaveBeenCalled();
  });

  it("returns 400 with parser error when the body is not valid JSON", async () => {
    const res = await POST(makeRequest({}, { rawBody: "{not json" }) as never, {
      params,
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/Invalid JSON body/);
    expect(mockPreviewEnrichmentPlan).not.toHaveBeenCalled();
  });

  it("returns 200 with the preview on the happy path", async () => {
    mockPreviewEnrichmentPlan.mockResolvedValueOnce(samplePreview);

    const res = await POST(
      makeRequest({
        targetColumn: "linkedin_url",
        promptMode: "auto",
      }) as never,
      { params }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof samplePreview;
    expect(json.strategy).toBe("single-pass-lookup");
    expect(mockPreviewEnrichmentPlan).toHaveBeenCalledWith(
      "tbl_x",
      expect.objectContaining({
        targetColumn: "linkedin_url",
        promptMode: "auto",
      })
    );
  });

  it("caps batchSize to 200 before delegating to the planner", async () => {
    mockPreviewEnrichmentPlan.mockResolvedValueOnce(samplePreview);

    await POST(
      makeRequest({
        targetColumn: "linkedin_url",
        promptMode: "auto",
        batchSize: 5000,
      }) as never,
      { params }
    );

    const callArg = mockPreviewEnrichmentPlan.mock.calls[0][1] as {
      batchSize: number;
    };
    expect(callArg.batchSize).toBe(200);
  });

  it("rejects batchSize less than 1 with a 400", async () => {
    const res = await POST(
      makeRequest({
        targetColumn: "linkedin_url",
        promptMode: "auto",
        batchSize: 0,
      }) as never,
      { params }
    );

    expect(res.status).toBe(400);
    expect(mockPreviewEnrichmentPlan).not.toHaveBeenCalled();
  });

  it("returns 404 when the table is missing", async () => {
    mockPreviewEnrichmentPlan.mockRejectedValueOnce(new Error("Table tbl_x not found"));

    const res = await POST(
      makeRequest({
        targetColumn: "linkedin_url",
        promptMode: "auto",
      }) as never,
      { params }
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when the planner reports an unsupported column type", async () => {
    mockPreviewEnrichmentPlan.mockRejectedValueOnce(
      new Error('Column "Due" uses unsupported data type "date" for enrichment')
    );

    const res = await POST(
      makeRequest({
        targetColumn: "due",
        promptMode: "auto",
      }) as never,
      { params }
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when the column does not exist on the table", async () => {
    mockPreviewEnrichmentPlan.mockRejectedValueOnce(
      new Error('Column "ghost" does not exist on table tbl_x')
    );

    const res = await POST(
      makeRequest({
        targetColumn: "ghost",
        promptMode: "auto",
      }) as never,
      { params }
    );

    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected errors and does not leak the cause", async () => {
    mockPreviewEnrichmentPlan.mockRejectedValueOnce(new Error("connection refused"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(
      makeRequest({
        targetColumn: "linkedin_url",
        promptMode: "auto",
      }) as never,
      { params }
    );

    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Failed to build enrichment plan");
    expect(json.error).not.toMatch(/connection refused/);
    consoleSpy.mockRestore();
  });

  it("forwards filter, prompt, and agentProfileOverride to the planner", async () => {
    mockPreviewEnrichmentPlan.mockResolvedValueOnce(samplePreview);

    await POST(
      makeRequest({
        targetColumn: "linkedin_url",
        promptMode: "auto",
        prompt: "prefer company profile",
        filter: { column: "linkedin_url", operator: "is_empty" },
        agentProfileOverride: "researcher",
      }) as never,
      { params }
    );

    const callArg = mockPreviewEnrichmentPlan.mock.calls[0][1] as {
      filter: unknown;
      prompt: string;
      agentProfileOverride: string;
    };
    expect(callArg.filter).toEqual({ column: "linkedin_url", operator: "is_empty" });
    expect(callArg.prompt).toBe("prefer company profile");
    expect(callArg.agentProfileOverride).toBe("researcher");
  });
});
