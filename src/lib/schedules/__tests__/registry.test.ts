import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";

// Tests manipulate AINATIVE_DATA_DIR; since the registry caches USER_DIR at
// module-load (mirroring blueprints/registry.ts), tests use vi.resetModules()
// for each case that depends on a fresh data dir. This is the project
// convention — blueprints' own pattern is captured-once.

describe("schedule registry", () => {
  let tmpDir: string;
  let origDataDir: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sched-reg-"));
    origDataDir = process.env.AINATIVE_DATA_DIR;
    process.env.AINATIVE_DATA_DIR = tmpDir;
    vi.resetModules(); // force registry to re-capture USER_DIR
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (origDataDir === undefined) delete process.env.AINATIVE_DATA_DIR;
    else process.env.AINATIVE_DATA_DIR = origDataDir;
  });

  function writeUserSchedule(filename: string, data: Record<string, unknown>) {
    fs.mkdirSync(path.join(tmpDir, "schedules"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "schedules", filename), yaml.dump(data));
  }

  const minimal = {
    id: "daily-summary",
    name: "Daily Summary",
    version: "1.0.0",
    prompt: "Summarize today.",
    type: "scheduled",
    interval: "1d",
  };

  it("returns empty list when user dir doesn't exist", async () => {
    const { listSchedules } = await import("../registry");
    expect(listSchedules()).toEqual([]);
  });

  it("loads a valid user YAML into getSchedule(id)", async () => {
    writeUserSchedule("daily-summary.yaml", minimal);
    const { getSchedule, listSchedules } = await import("../registry");
    const spec = getSchedule("daily-summary");
    expect(spec?.type).toBe("scheduled");
    expect(spec?.name).toBe("Daily Summary");
    expect(listSchedules().length).toBe(1);
  });

  it("skips invalid YAML with a warning; valid siblings still load", async () => {
    writeUserSchedule("good.yaml", minimal);
    fs.writeFileSync(
      path.join(tmpDir, "schedules", "bad.yaml"),
      ":\n  not valid"
    );
    // Another invalid — schema failure (uppercase id fails kebab-case regex)
    writeUserSchedule("schema-bad.yaml", { ...minimal, id: "X", type: "scheduled" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { listSchedules } = await import("../registry");
    const list = listSchedules();
    expect(list.map((s: { id: string }) => s.id)).toEqual(["daily-summary"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reloadSchedules picks up a newly-written file", async () => {
    const { listSchedules, reloadSchedules } = await import("../registry");
    expect(listSchedules()).toEqual([]);
    writeUserSchedule("new.yaml", { ...minimal, id: "new", name: "New" });
    reloadSchedules();
    expect(listSchedules().map((s: { id: string }) => s.id)).toEqual(["new"]);
  });

  it("createScheduleFromYaml writes to user dir and reloads", async () => {
    const { createScheduleFromYaml, getSchedule } = await import("../registry");
    const ret = createScheduleFromYaml(yaml.dump(minimal));
    expect(ret.id).toBe("daily-summary");
    expect(getSchedule("daily-summary")?.name).toBe("Daily Summary");
    expect(
      fs.existsSync(path.join(tmpDir, "schedules", "daily-summary.yaml"))
    ).toBe(true);
  });

  it("createScheduleFromYaml throws on duplicate id", async () => {
    writeUserSchedule("daily-summary.yaml", minimal);
    const { createScheduleFromYaml } = await import("../registry");
    expect(() => createScheduleFromYaml(yaml.dump(minimal))).toThrow(
      /already exists/
    );
  });

  it("deleteSchedule removes the file; getSchedule returns undefined", async () => {
    writeUserSchedule("daily-summary.yaml", minimal);
    const { deleteSchedule, getSchedule } = await import("../registry");
    deleteSchedule("daily-summary");
    expect(getSchedule("daily-summary")).toBeUndefined();
    expect(
      fs.existsSync(path.join(tmpDir, "schedules", "daily-summary.yaml"))
    ).toBe(false);
  });
});
