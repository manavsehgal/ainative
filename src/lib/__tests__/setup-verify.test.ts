import { describe, it, expect } from "vitest";
import { createTaskSchema } from "@/lib/validators/task";

describe("vitest setup verification", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/ path alias", () => {
    expect(createTaskSchema).toBeDefined();
  });

  it("validates a correct task input", () => {
    const result = createTaskSchema.safeParse({
      title: "Test task",
      priority: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid task input", () => {
    const result = createTaskSchema.safeParse({
      title: "",
      priority: 5,
    });
    expect(result.success).toBe(false);
  });
});
