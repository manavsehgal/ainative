import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parseSkillDir } from "../skill";

describe("parseSkillDir", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ainative-skill-test-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("parses a well-formed skill directory", () => {
    const dir = join(root, "greeter");
    mkdirSync(dir);
    writeFileSync(
      join(dir, "SKILL.md"),
      "---\nname: Greeter\ndescription: Says hello\n---\nBody.\n"
    );

    const artifact = parseSkillDir(dir, "claude-code", "user", root);

    expect(artifact).not.toBeNull();
    expect(artifact!.name).toBe("greeter");
    expect(artifact!.metadata.description).toBe("Says hello");
  });

  it("rejects a hidden dot-prefixed directory", () => {
    const dir = join(root, ".system");
    mkdirSync(dir);
    writeFileSync(
      join(dir, "SKILL.md"),
      "---\nname: System\ndescription: Hidden\n---\n"
    );

    const artifact = parseSkillDir(dir, "claude-code", "user", root);

    expect(artifact).toBeNull();
  });

  it("rejects .DS_Store and similar hidden filesystem noise", () => {
    const dir = join(root, ".DS_Store");
    mkdirSync(dir);

    const artifact = parseSkillDir(dir, "claude-code", "user", root);

    expect(artifact).toBeNull();
  });
});
