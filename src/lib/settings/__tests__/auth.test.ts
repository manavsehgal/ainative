import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB and crypto modules
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();
const mockRun = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({ from: mockFrom }),
    insert: () => ({ values: mockValues }),
    update: () => ({ set: mockSet }),
    delete: () => ({ where: vi.fn().mockReturnValue({ run: mockRun }) }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  settings: { key: "key" },
}));

vi.mock("@/lib/utils/crypto", () => ({
  encrypt: vi.fn((v: string) => `encrypted:${v}`),
  decrypt: vi.fn((v: string) => v.replace("encrypted:", "")),
}));

// Build mock chain
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue([]);
mockValues.mockReturnValue({ run: mockRun });
mockSet.mockReturnValue({ where: vi.fn().mockReturnValue({ run: mockRun }) });

describe("auth settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockReturnValue([]);
  });

  it("getAuthSettings returns defaults when no settings exist", async () => {
    const { getAuthSettings } = await import("../auth");
    const result = await getAuthSettings();
    expect(result.method).toBe("api_key");
    expect(result.hasKey).toBe(false);
  });

  it("getAuthSettings detects env key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const { getAuthSettings } = await import("../auth");
    const result = await getAuthSettings();
    expect(result.hasKey).toBe(true);
    expect(result.apiKeySource).toBe("env");
    vi.unstubAllEnvs();
  });

  it("setAuthSettings encrypts and stores API key", async () => {
    const { setAuthSettings } = await import("../auth");
    await setAuthSettings({ method: "api_key", apiKey: "sk-ant-test-key" });
    // Should call insert/update for method, apiKey, and source
    expect(mockValues).toHaveBeenCalled();
  });

  it("getAuthEnv returns undefined for oauth method", async () => {
    // Mock getSetting to return "oauth" for auth.method
    mockWhere.mockImplementation(() => {
      return [{ value: "oauth" }];
    });
    const { getAuthEnv } = await import("../auth");
    const result = await getAuthEnv();
    expect(result).toBeUndefined();
  });
});
