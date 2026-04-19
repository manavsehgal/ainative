import { describe, it, expect, vi, beforeEach } from "vitest";
import { scheduleSpecTools } from "../schedule-spec-tools";
import type { ToolContext } from "../helpers";

vi.mock("@/lib/schedules/registry", () => ({
  listSchedules: vi.fn(() => [
    {
      id: "daily-digest",
      name: "Daily Digest",
      type: "scheduled",
      interval: "1d",
    },
  ]),
  createScheduleFromYaml: vi.fn((_yaml: string) => ({
    id: "from-yaml",
    name: "From YAML",
    type: "scheduled",
    cronExpression: "0 9 * * *",
  })),
  reloadSchedules: vi.fn(() => undefined),
}));

describe("schedule-spec chat tools", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = {};
    vi.clearAllMocks();
  });

  // ── list_schedule_specs ──────────────────────────────────────────────

  it("list_schedule_specs returns ok with array from listSchedules", async () => {
    const { listSchedules } = await import("@/lib/schedules/registry");
    const tools = scheduleSpecTools(ctx);
    const tool = tools.find((t) => t.name === "list_schedule_specs");
    expect(tool).toBeTruthy();

    const result = await tool!.handler({});
    expect(listSchedules).toHaveBeenCalledTimes(1);
    expect(result.content?.[0]?.text).toMatch(/"id":\s*"daily-digest"/);
    expect(result.content?.[0]?.text).toMatch(/"type":\s*"scheduled"/);
    expect(result.isError).toBeUndefined();
  });

  it("list_schedule_specs returns err when listSchedules throws", async () => {
    const { listSchedules } = await import("@/lib/schedules/registry");
    vi.mocked(listSchedules).mockImplementationOnce(() => {
      throw new Error("disk error");
    });

    const tools = scheduleSpecTools(ctx);
    const tool = tools.find((t) => t.name === "list_schedule_specs");
    const result = await tool!.handler({});
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/disk error/);
  });

  // ── install_schedule_from_yaml ──────────────────────────────────────

  it("install_schedule_from_yaml calls createScheduleFromYaml and returns ok", async () => {
    const { createScheduleFromYaml } = await import("@/lib/schedules/registry");
    const tools = scheduleSpecTools(ctx);
    const tool = tools.find((t) => t.name === "install_schedule_from_yaml");
    expect(tool).toBeTruthy();

    const sampleYaml =
      "id: from-yaml\nname: From YAML\ntype: scheduled\ncronExpression: '0 9 * * *'\nversion: '0.1.0'\nprompt: Run daily\n";
    const result = await tool!.handler({ yaml: sampleYaml });
    expect(createScheduleFromYaml).toHaveBeenCalledWith(sampleYaml);
    expect(result.content?.[0]?.text).toMatch(/"id":\s*"from-yaml"/);
    expect(result.isError).toBeUndefined();
  });

  it("install_schedule_from_yaml returns err when createScheduleFromYaml throws", async () => {
    const { createScheduleFromYaml } = await import("@/lib/schedules/registry");
    vi.mocked(createScheduleFromYaml).mockImplementationOnce(() => {
      throw new Error('Schedule "from-yaml" already exists');
    });

    const tools = scheduleSpecTools(ctx);
    const tool = tools.find((t) => t.name === "install_schedule_from_yaml");
    const result = await tool!.handler({ yaml: "any: yaml" });
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/already exists/);
  });

  // ── reload_schedules ────────────────────────────────────────────────

  it("reload_schedules calls reloadSchedules then listSchedules and returns count", async () => {
    const { reloadSchedules, listSchedules } = await import(
      "@/lib/schedules/registry"
    );
    const tools = scheduleSpecTools(ctx);
    const tool = tools.find((t) => t.name === "reload_schedules");
    expect(tool).toBeTruthy();

    const result = await tool!.handler({});
    expect(reloadSchedules).toHaveBeenCalledTimes(1);
    expect(listSchedules).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(result.content?.[0]?.text ?? "{}");
    expect(parsed).toHaveProperty("loaded", 1);
    expect(result.isError).toBeUndefined();
  });

  it("reload_schedules returns err when reloadSchedules throws", async () => {
    const { reloadSchedules } = await import("@/lib/schedules/registry");
    vi.mocked(reloadSchedules).mockImplementationOnce(() => {
      throw new Error("reload failed");
    });

    const tools = scheduleSpecTools(ctx);
    const tool = tools.find((t) => t.name === "reload_schedules");
    const result = await tool!.handler({});
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/reload failed/);
  });
});
