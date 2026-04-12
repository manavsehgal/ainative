import { describe, expect, it } from "vitest";
import { synthesizeBundle, type SynthesizeBundleInput } from "../synthesizer";
import { appBundleSchema } from "../validation";

const MINIMAL_INPUT: SynthesizeBundleInput = {
  manifest: {
    name: "Test App",
    description: "A simple test app for unit tests",
    category: "general",
  },
  tables: [
    {
      name: "Items",
      description: "List of items",
      columns: [
        { name: "name", displayName: "Name", dataType: "text", required: true },
        { name: "status", displayName: "Status", dataType: "select" },
      ],
    },
  ],
};

const FULL_INPUT: SynthesizeBundleInput = {
  manifest: {
    name: "Real Estate Tracker",
    description: "Track properties, tenants, and rental income",
    category: "finance",
    tags: ["real-estate", "rental", "investing"],
    difficulty: "intermediate",
    estimatedSetupMinutes: 10,
    icon: "Building2",
  },
  tables: [
    {
      name: "Properties",
      description: "Portfolio of properties",
      columns: [
        { name: "address", displayName: "Address", dataType: "text", required: true },
        { name: "value", displayName: "Market Value", dataType: "number" },
        { name: "purchased_date", displayName: "Purchase Date", dataType: "date" },
      ],
    },
    {
      name: "Tenants",
      columns: [
        { name: "name", displayName: "Tenant Name", dataType: "text", required: true },
        { name: "email", displayName: "Email", dataType: "email" },
        { name: "active", displayName: "Active", dataType: "boolean" },
      ],
    },
  ],
  schedules: [
    {
      name: "Monthly Rent Review",
      description: "Review rent payments monthly",
      prompt: "Review all active tenants and flag any overdue rent payments",
      cronExpression: "0 9 1 * *",
    },
  ],
  profiles: [
    {
      id: "property-analyst",
      label: "Property Analyst",
      description: "Specializes in real estate analysis",
    },
  ],
  pages: [
    {
      title: "Dashboard",
      description: "Overview of portfolio",
    },
    {
      title: "Properties",
      path: "properties",
      icon: "Building2",
    },
  ],
};

describe("synthesizeBundle", () => {
  it("generates a valid AppBundle from minimal input", () => {
    const bundle = synthesizeBundle(MINIMAL_INPUT);

    // Passes Zod validation
    const parsed = appBundleSchema.safeParse(bundle);
    expect(parsed.success).toBe(true);

    // Basic manifest checks
    expect(bundle.manifest.name).toBe("Test App");
    expect(bundle.manifest.id).toMatch(/^test-app-[a-z0-9]{4}$/);
    expect(bundle.manifest.version).toBe("1.0.0");
    expect(bundle.manifest.trustLevel).toBe("private");
    expect(bundle.manifest.category).toBe("general");
  });

  it("namespaces table keys with app ID", () => {
    const bundle = synthesizeBundle(MINIMAL_INPUT);
    const appId = bundle.manifest.id;

    expect(bundle.tables[0].key).toMatch(new RegExp(`^${appId}--items$`));
  });

  it("assigns column positions sequentially", () => {
    const bundle = synthesizeBundle(MINIMAL_INPUT);
    const columns = bundle.tables[0].columns;

    expect(columns[0].position).toBe(0);
    expect(columns[1].position).toBe(1);
  });

  it("infers permissions from artifacts", () => {
    const bundle = synthesizeBundle(FULL_INPUT);
    const perms = bundle.manifest.permissions;

    expect(perms).toContain("projects:create");
    expect(perms).toContain("tables:create");
    expect(perms).toContain("schedules:create");
    expect(perms).toContain("profiles:link");
  });

  it("generates default overview page when no pages specified", () => {
    const bundle = synthesizeBundle(MINIMAL_INPUT);

    expect(bundle.ui.pages).toHaveLength(1);
    expect(bundle.ui.pages[0].key).toBe("overview");
    expect(bundle.ui.pages[0].widgets.length).toBeGreaterThan(0);
  });

  it("uses LLM-provided pages when specified", () => {
    const bundle = synthesizeBundle(FULL_INPUT);

    expect(bundle.ui.pages).toHaveLength(2);
    expect(bundle.ui.pages[0].title).toBe("Dashboard");
    expect(bundle.ui.pages[1].title).toBe("Properties");
    expect(bundle.ui.pages[1].path).toBe("properties");
  });

  it("handles full input with all fields", () => {
    const bundle = synthesizeBundle(FULL_INPUT);
    const parsed = appBundleSchema.safeParse(bundle);

    expect(parsed.success).toBe(true);
    expect(bundle.tables).toHaveLength(2);
    expect(bundle.schedules).toHaveLength(1);
    expect(bundle.profiles).toHaveLength(1);
    expect(bundle.manifest.difficulty).toBe("intermediate");
    expect(bundle.manifest.icon).toBe("Building2");
  });

  it("namespaces schedules and profiles", () => {
    const bundle = synthesizeBundle(FULL_INPUT);
    const appId = bundle.manifest.id;

    expect(bundle.schedules[0].key).toContain(`${appId}--`);
    expect(bundle.profiles[0].id).toContain(`${appId}--`);
  });

  it("generates unique app IDs on each call", () => {
    const b1 = synthesizeBundle(MINIMAL_INPUT);
    const b2 = synthesizeBundle(MINIMAL_INPUT);

    expect(b1.manifest.id).not.toBe(b2.manifest.id);
  });

  it("includes setup checklist", () => {
    const bundle = synthesizeBundle(MINIMAL_INPUT);

    expect(bundle.setupChecklist.length).toBeGreaterThan(0);
    expect(bundle.setupChecklist[0]).toContain("Test App");
  });

  it("defaults difficulty to beginner when not specified", () => {
    const bundle = synthesizeBundle(MINIMAL_INPUT);
    expect(bundle.manifest.difficulty).toBe("beginner");
  });

  it("defaults estimatedSetupMinutes to 5 when not specified", () => {
    const bundle = synthesizeBundle(MINIMAL_INPUT);
    expect(bundle.manifest.estimatedSetupMinutes).toBe(5);
  });
});
