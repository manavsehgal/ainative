import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { discoverWorkspace } from "@/lib/environment/discovery";

/** Create a temporary workspace with mock project structures. */
function createTestWorkspace(): string {
  const base = join(tmpdir(), `stagent-test-${Date.now()}`);
  mkdirSync(base, { recursive: true });
  return base;
}

function mkdirp(path: string) {
  mkdirSync(path, { recursive: true });
}

describe("discoverWorkspace", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTestWorkspace();
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it("discovers projects with .claude/ marker", () => {
    // Create a project with .claude/
    mkdirp(join(workspace, "my-project", ".claude", "skills"));
    writeFileSync(join(workspace, "my-project", "CLAUDE.md"), "# Instructions");

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].folderName).toBe("my-project");
    expect(result.projects[0].markers).toEqual(["claude"]);
    expect(result.projects[0].artifactHints.hasInstructions).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("discovers projects with .codex/ marker", () => {
    mkdirp(join(workspace, "codex-proj", ".codex"));

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["codex"],
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].folderName).toBe("codex-proj");
    expect(result.projects[0].markers).toEqual(["codex"]);
  });

  it("discovers projects with both markers", () => {
    mkdirp(join(workspace, "dual-proj", ".claude"));
    mkdirp(join(workspace, "dual-proj", ".codex"));

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude", "codex"],
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].markers).toEqual(["claude", "codex"]);
  });

  it("ignores folders without markers", () => {
    mkdirp(join(workspace, "no-marker-project", "src"));
    mkdirp(join(workspace, "has-marker", ".claude"));

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].folderName).toBe("has-marker");
  });

  it("respects maxDepth=1 (no recursion into subdirs)", () => {
    // Project at depth 2 — should NOT be found with maxDepth=1
    mkdirp(join(workspace, "group", "nested-proj", ".claude"));

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects).toHaveLength(0);
  });

  it("finds nested projects with maxDepth=2", () => {
    mkdirp(join(workspace, "group", "nested-proj", ".claude"));

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 2,
      markers: ["claude"],
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].folderName).toBe("nested-proj");
  });

  it("skips node_modules and other skip-list directories", () => {
    mkdirp(join(workspace, "node_modules", "some-pkg", ".claude"));
    mkdirp(join(workspace, ".git", "hooks", ".claude"));
    mkdirp(join(workspace, "real-project", ".claude"));

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 2,
      markers: ["claude"],
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].folderName).toBe("real-project");
  });

  it("counts skills in artifact hints", () => {
    const skillsDir = join(workspace, "my-proj", ".claude", "skills");
    mkdirp(skillsDir);
    writeFileSync(join(skillsDir, "skill-a.md"), "# Skill A");
    writeFileSync(join(skillsDir, "skill-b.md"), "# Skill B");

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects[0].artifactHints.skillCount).toBe(2);
    expect(result.projects[0].totalArtifactEstimate).toBeGreaterThanOrEqual(2);
  });

  it("detects MCP server presence", () => {
    mkdirp(join(workspace, "my-proj", ".claude"));
    writeFileSync(
      join(workspace, "my-proj", ".mcp.json"),
      JSON.stringify({ mcpServers: {} })
    );

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects[0].artifactHints.mcpServerCount).toBe(1);
  });

  it("reads git branch from .git/HEAD", () => {
    mkdirp(join(workspace, "git-proj", ".claude"));
    mkdirp(join(workspace, "git-proj", ".git"));
    writeFileSync(
      join(workspace, "git-proj", ".git", "HEAD"),
      "ref: refs/heads/develop\n"
    );

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects[0].gitBranch).toBe("develop");
  });

  it("returns null gitBranch when no .git dir", () => {
    mkdirp(join(workspace, "no-git", ".claude"));

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects[0].gitBranch).toBeNull();
  });

  it("handles empty parent directory", () => {
    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 2,
      markers: ["claude", "codex"],
    });

    expect(result.projects).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("reports durationMs", () => {
    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("sorts projects alphabetically by folder name", () => {
    mkdirp(join(workspace, "zebra-project", ".claude"));
    mkdirp(join(workspace, "alpha-project", ".claude"));
    mkdirp(join(workspace, "middle-project", ".claude"));

    const result = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects.map((p) => p.folderName)).toEqual([
      "alpha-project",
      "middle-project",
      "zebra-project",
    ]);
  });

  it("records errors for unreadable directories without aborting", () => {
    mkdirp(join(workspace, "good-proj", ".claude"));
    // Nonexistent parent still works — errors are accumulated
    const result = discoverWorkspace({
      parentDir: join(workspace, "nonexistent"),
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(result.projects).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("only searches for requested markers", () => {
    mkdirp(join(workspace, "claude-only", ".claude"));
    mkdirp(join(workspace, "codex-only", ".codex"));

    const claudeResult = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["claude"],
    });

    expect(claudeResult.projects).toHaveLength(1);
    expect(claudeResult.projects[0].folderName).toBe("claude-only");

    const codexResult = discoverWorkspace({
      parentDir: workspace,
      maxDepth: 1,
      markers: ["codex"],
    });

    expect(codexResult.projects).toHaveLength(1);
    expect(codexResult.projects[0].folderName).toBe("codex-only");
  });
});
