import { describe, expect, it } from "vitest";
import { scanForPii } from "../pii-scanner";

describe("PII scanner", () => {
  it("detects SSN patterns as errors", () => {
    const result = scanForPii({
      users: [{ ssn: "123-45-6789", name: "Test" }],
    });
    expect(result.clean).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].pattern).toBe("ssn");
    expect(result.findings[0].severity).toBe("error");
  });

  it("detects real email domains as errors", () => {
    const result = scanForPii({
      contacts: [{ email: "john@gmail.com" }],
    });
    expect(result.clean).toBe(false);
    expect(result.findings[0].pattern).toBe("real_email");
  });

  it("allows example.com emails", () => {
    const result = scanForPii({
      contacts: [{ email: "user@example.com" }],
    });
    expect(result.clean).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects credit card numbers as errors", () => {
    const result = scanForPii({
      payments: [{ card: "4111111111111111" }], // Visa test number (passes Luhn)
    });
    expect(result.clean).toBe(false);
    expect(result.findings[0].pattern).toBe("credit_card");
  });

  it("detects phone numbers as warnings", () => {
    const result = scanForPii({
      contacts: [{ phone: "+1-555-123-4567" }],
    });
    // Phone is a warning, not an error
    expect(result.clean).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe("warning");
  });

  it("detects public IP addresses as warnings", () => {
    const result = scanForPii({
      logs: [{ ip: "8.8.8.8" }],
    });
    expect(result.findings.some((f) => f.pattern === "ip_address")).toBe(true);
  });

  it("ignores private IP ranges", () => {
    const result = scanForPii({
      logs: [{ ip: "192.168.1.1" }, { ip: "10.0.0.1" }],
    });
    expect(result.findings.filter((f) => f.pattern === "ip_address")).toHaveLength(0);
  });

  it("detects street addresses as warnings", () => {
    const result = scanForPii({
      offices: [{ address: "123 Main St" }],
    });
    expect(result.findings.some((f) => f.pattern === "street_address")).toBe(true);
  });

  it("returns clean=true when no PII found", () => {
    const result = scanForPii({
      products: [
        { name: "Widget A", price: 29.99, category: "tools" },
        { name: "Widget B", price: 49.99, category: "hardware" },
      ],
    });
    expect(result.clean).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("skips null values and _sample column", () => {
    const result = scanForPii({
      data: [{ value: null, _sample: true, name: "test" }],
    });
    expect(result.findings).toHaveLength(0);
  });
});
