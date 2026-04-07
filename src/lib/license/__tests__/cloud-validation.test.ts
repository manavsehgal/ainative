import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("validateLicenseWithCloud", () => {
  it("returns {valid: false} when cloud is disabled", async () => {
    vi.stubEnv("STAGENT_CLOUD_DISABLED", "true");
    const { validateLicenseWithCloud } = await import("../cloud-validation");
    const result = await validateLicenseWithCloud({ email: "a@b.com" });
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("community");
  });

  it("returns {valid: false} when email is empty", async () => {
    const { validateLicenseWithCloud } = await import("../cloud-validation");
    const result = await validateLicenseWithCloud({ email: "" });
    expect(result.valid).toBe(false);
  });

  it("accepts legacy string-email signature for backward compat", async () => {
    vi.stubEnv("STAGENT_CLOUD_DISABLED", "true");
    const { validateLicenseWithCloud } = await import("../cloud-validation");
    const result = await validateLicenseWithCloud("legacy@example.com");
    expect(result.valid).toBe(false); // cloud disabled, but the call shape is accepted
  });

  it("sends the full tuple in the request body when cloud is enabled", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, tier: "scale", seatStatus: "ok" }),
    });

    global.fetch = mockFetch;

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const { validateLicenseWithCloud } = await import("../cloud-validation");
    const result = await validateLicenseWithCloud({
      email: "a@b.com",
      machineFingerprint: "fp-abc",
      instanceId: "inst-123",
    });

    expect(result.valid).toBe(true);
    expect(result.tier).toBe("scale");
    expect(result.seatStatus).toBe("ok");

    // Verify the body contained the full tuple
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.email).toBe("a@b.com");
    expect(body.machineFingerprint).toBe("fp-abc");
    expect(body.instanceId).toBe("inst-123");
  });

  it("parses seatStatus=over_limit from cloud response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, tier: "solo", seatStatus: "over_limit" }),
    });

    global.fetch = mockFetch;

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const { validateLicenseWithCloud } = await import("../cloud-validation");
    const result = await validateLicenseWithCloud({ email: "a@b.com" });
    expect(result.seatStatus).toBe("over_limit");
    expect(result.tier).toBe("solo");
  });

  it("treats missing seatStatus as undefined (old server graceful degradation)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, tier: "operator" }), // no seatStatus
    });

    global.fetch = mockFetch;

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const { validateLicenseWithCloud } = await import("../cloud-validation");
    const result = await validateLicenseWithCloud({ email: "a@b.com" });
    expect(result.seatStatus).toBeUndefined();
    expect(result.tier).toBe("operator");
  });
});
