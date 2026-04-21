import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listStarters, parseStarter } from "../starters";

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ainative-starters-test-"));
}

const VALID_STARTER = `
id: weekly-portfolio-check-in
name: Weekly portfolio check-in
description: Summarize portfolio performance and surface watchlist candidates.
persona: individual-investor
icon: trending-up
starterPrompt: |
  Build me a weekly portfolio check-in app.
preview:
  profiles: 1
  blueprints: 1
  tables: 1
  schedules: 1
`;

describe("parseStarter", () => {
  it("parses a valid starter YAML", () => {
    const s = parseStarter(VALID_STARTER);
    expect(s).not.toBeNull();
    expect(s?.id).toBe("weekly-portfolio-check-in");
    expect(s?.name).toBe("Weekly portfolio check-in");
    expect(s?.icon).toBe("trending-up");
    expect(s?.starterPrompt.trim()).toContain("Build me");
    expect(s?.preview.profiles).toBe(1);
    expect(s?.preview.schedules).toBe(1);
  });

  it("returns null when id is missing", () => {
    expect(parseStarter("name: No ID\n")).toBeNull();
  });

  it("returns null when starterPrompt is missing", () => {
    expect(parseStarter("id: a\nname: A\n")).toBeNull();
  });

  it("returns null on broken YAML", () => {
    expect(parseStarter("::: broken yaml :::")).toBeNull();
  });

  it("defaults preview fields to 0 when omitted", () => {
    const s = parseStarter("id: a\nname: A\nstarterPrompt: do stuff\n");
    expect(s?.preview).toEqual({ profiles: 0, blueprints: 0, tables: 0, schedules: 0 });
  });
});

describe("listStarters", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmp(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it("returns empty array when dir does not exist", () => {
    expect(listStarters(path.join(tmp, "nope"))).toEqual([]);
  });

  it("returns empty array when dir has no YAML files", () => {
    fs.writeFileSync(path.join(tmp, "README.md"), "hi");
    expect(listStarters(tmp)).toEqual([]);
  });

  it("lists YAMLs alphabetically by id", () => {
    fs.writeFileSync(path.join(tmp, "b.yaml"), "id: b-starter\nname: B\nstarterPrompt: b\n");
    fs.writeFileSync(path.join(tmp, "a.yaml"), "id: a-starter\nname: A\nstarterPrompt: a\n");
    const ids = listStarters(tmp).map((s) => s.id);
    expect(ids).toEqual(["a-starter", "b-starter"]);
  });

  it("skips files that fail to parse", () => {
    fs.writeFileSync(path.join(tmp, "broken.yaml"), "::: invalid :::");
    fs.writeFileSync(path.join(tmp, "good.yaml"), "id: good\nname: Good\nstarterPrompt: do\n");
    const ids = listStarters(tmp).map((s) => s.id);
    expect(ids).toEqual(["good"]);
  });

  it("accepts both .yaml and .yml extensions", () => {
    fs.writeFileSync(path.join(tmp, "a.yml"), "id: a\nname: A\nstarterPrompt: a\n");
    fs.writeFileSync(path.join(tmp, "b.yaml"), "id: b\nname: B\nstarterPrompt: b\n");
    expect(listStarters(tmp)).toHaveLength(2);
  });
});
