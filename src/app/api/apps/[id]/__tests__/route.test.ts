import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/apps/registry", () => ({
  deleteAppCascade: vi.fn(),
  getApp: vi.fn(),
}));

import { DELETE } from "../route";
import { deleteAppCascade } from "@/lib/apps/registry";

function makeRequest(): Request {
  return new Request("http://localhost/api/apps/x", { method: "DELETE" });
}

describe("DELETE /api/apps/[id]", () => {
  beforeEach(() => {
    vi.mocked(deleteAppCascade).mockReset();
  });

  it("returns 200 with cascade result when both halves succeed", async () => {
    vi.mocked(deleteAppCascade).mockResolvedValue({
      filesRemoved: true,
      projectRemoved: true,
    });
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "wealth-tracker" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      filesRemoved: true,
      projectRemoved: true,
    });
    expect(deleteAppCascade).toHaveBeenCalledWith("wealth-tracker");
  });

  it("returns 200 when only the dir was removed (split-manifest case)", async () => {
    vi.mocked(deleteAppCascade).mockResolvedValue({
      filesRemoved: true,
      projectRemoved: false,
    });
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "habit-loop" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.filesRemoved).toBe(true);
    expect(body.projectRemoved).toBe(false);
  });

  it("returns 200 when only the DB project was removed (orphaned-dir case)", async () => {
    vi.mocked(deleteAppCascade).mockResolvedValue({
      filesRemoved: false,
      projectRemoved: true,
    });
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "orphan" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.filesRemoved).toBe(false);
    expect(body.projectRemoved).toBe(true);
  });

  it("returns 404 when both halves report nothing removed", async () => {
    vi.mocked(deleteAppCascade).mockResolvedValue({
      filesRemoved: false,
      projectRemoved: false,
    });
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "ghost" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "App not found" });
  });

  it("returns 500 with a sanitized message when the cascade throws", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(deleteAppCascade).mockRejectedValue(
      new Error("ENOENT /Users/alice/.ainative/apps/broken/manifest.yaml")
    );
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "broken" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to delete app");
    expect(body.error).not.toMatch(/\/Users\//);
    // Diagnostic detail still goes to the server log.
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("returns 400 when the id is empty (defensive)", async () => {
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: "" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "App id is required" });
    expect(deleteAppCascade).not.toHaveBeenCalled();
  });
});
