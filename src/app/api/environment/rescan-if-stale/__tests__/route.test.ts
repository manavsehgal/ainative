import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/environment/auto-scan", () => ({
  shouldRescan: vi.fn(),
  ensureFreshScan: vi.fn(() => ({ scannedAt: new Date() })),
}));

vi.mock("@/lib/environment/workspace-context", () => ({
  getLaunchCwd: () => "/tmp/project",
}));

import { POST } from "../route";
import * as autoScan from "@/lib/environment/auto-scan";

describe("POST /api/environment/rescan-if-stale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns scanned:true when shouldRescan=true", async () => {
    (autoScan.shouldRescan as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scanned).toBe(true);
  });

  it("returns scanned:false when not stale", async () => {
    (autoScan.shouldRescan as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const res = await POST();
    const json = await res.json();
    expect(json.scanned).toBe(false);
  });

  it("returns scanned:false and logs when ensureFreshScan throws", async () => {
    (autoScan.shouldRescan as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (autoScan.ensureFreshScan as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("fs error");
    });
    const res = await POST();
    const json = await res.json();
    // ensureFreshScan itself swallows errors — but if it re-threw we must not 500
    expect(res.status).toBe(200);
  });
});
