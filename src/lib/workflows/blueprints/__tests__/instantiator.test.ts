import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { instantiateBlueprint } from "../instantiator";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

describe("instantiateBlueprint metadata passthrough", () => {
  it("persists _contextRowId from metadata into workflow.definition", async () => {
    // Use an existing builtin blueprint (research-report has at least one variable)
    const result = await instantiateBlueprint(
      "research-report",
      { topic: "ai-native trends", depth: "standard" },
      undefined,
      { _contextRowId: "row-abc-123" }
    );

    const [wf] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, result.workflowId));

    expect(wf).toBeDefined();
    const definition = JSON.parse(wf!.definition);
    expect(definition._contextRowId).toBe("row-abc-123");
  });

  it("omits _contextRowId from definition when metadata not provided", async () => {
    const result = await instantiateBlueprint(
      "research-report",
      { topic: "no-metadata test", depth: "standard" },
      undefined
    );

    const [wf] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, result.workflowId));

    const definition = JSON.parse(wf!.definition);
    expect(definition._contextRowId).toBeUndefined();
  });
});
