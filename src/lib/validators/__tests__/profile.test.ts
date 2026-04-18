import { describe, it, expect } from "vitest";
import { ProfileConfigSchema } from "@/lib/validators/profile";

describe("ProfileConfigSchema", () => {
  const validProfile = {
    id: "test-profile",
    name: "Test Profile",
    version: "1.0.0",
    domain: "work",
    tags: ["test", "example"],
  };

  it("accepts minimal valid profile", () => {
    const result = ProfileConfigSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("accepts full valid profile", () => {
    const result = ProfileConfigSchema.safeParse({
      ...validProfile,
      allowedTools: ["Read", "Grep"],
      mcpServers: { myServer: { url: "http://localhost:3000" } },
      canUseToolPolicy: {
        autoApprove: ["Read"],
        autoDeny: ["Bash"],
      },
      hooks: {
        preToolCall: ["echo pre"],
        postToolCall: ["echo post"],
      },
      maxTurns: 20,
      outputFormat: "markdown",
      author: "stagent",
      source: "https://github.com/stagent/profiles",
      tests: [
        {
          task: "Do a thing",
          expectedKeywords: ["thing", "done"],
        },
      ],
      supportedRuntimes: ["claude-code", "openai-codex-app-server"],
      runtimeOverrides: {
        "openai-codex-app-server": {
          instructions: "Use the Codex-specific prompt",
          allowedTools: ["Read"],
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const { id, ...noId } = validProfile;
    const result = ProfileConfigSchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it("rejects empty id", () => {
    const result = ProfileConfigSchema.safeParse({ ...validProfile, id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid version format", () => {
    const result = ProfileConfigSchema.safeParse({
      ...validProfile,
      version: "1.0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid domain", () => {
    const result = ProfileConfigSchema.safeParse({
      ...validProfile,
      domain: "other",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid source URL", () => {
    const result = ProfileConfigSchema.safeParse({
      ...validProfile,
      source: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid domain values", () => {
    for (const domain of ["work", "personal"]) {
      const result = ProfileConfigSchema.safeParse({
        ...validProfile,
        domain,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects negative maxTurns", () => {
    const result = ProfileConfigSchema.safeParse({
      ...validProfile,
      maxTurns: -5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts legacy sourceFormat 'stagent' and normalizes to 'ainative'", () => {
    const result = ProfileConfigSchema.safeParse({
      ...validProfile,
      importMeta: {
        repoUrl: "https://github.com/example/repo",
        repoOwner: "example",
        repoName: "repo",
        branch: "main",
        filePath: "skills/qa/profile.yaml",
        commitSha: "abc123def456",
        contentHash: "sha256hash",
        importedAt: new Date().toISOString(),
        sourceFormat: "stagent",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.importMeta?.sourceFormat).toBe("ainative");
    }
  });
});
