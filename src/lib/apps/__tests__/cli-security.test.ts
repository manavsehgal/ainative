import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { scanForSecrets } from "../cli/pack";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-cli-security-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("scanForSecrets", () => {
  it("returns clean for a safe directory", () => {
    writeFileSync(join(tempDir, "manifest.yaml"), "id: test");
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("detects .env files", () => {
    writeFileSync(join(tempDir, ".env"), "SECRET=value");
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
    expect(result.issues.some((i) => i.includes(".env"))).toBe(true);
  });

  it("detects .env.local files", () => {
    writeFileSync(join(tempDir, ".env.local"), "KEY=value");
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
  });

  it("detects .git directory", () => {
    mkdirSync(join(tempDir, ".git"));
    writeFileSync(join(tempDir, ".git", "HEAD"), "ref: refs/heads/main");
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
    expect(result.issues.some((i) => i.includes(".git"))).toBe(true);
  });

  it("detects .db files", () => {
    writeFileSync(join(tempDir, "data.db"), "binary data");
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
  });

  it("detects Anthropic API keys", () => {
    writeFileSync(
      join(tempDir, "config.yaml"),
      "ANTHROPIC_API_KEY = sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
    );
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
    expect(result.issues.some((i) => i.includes("secret") || i.includes("Secret"))).toBe(true);
  });

  it("detects GitHub PATs", () => {
    writeFileSync(
      join(tempDir, "config.yaml"),
      "token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
    );
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
  });

  it("detects private keys", () => {
    writeFileSync(
      join(tempDir, "key.pem"),
      "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----",
    );
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
  });

  it("detects OPENAI_API_KEY patterns", () => {
    writeFileSync(join(tempDir, "config.txt"), "OPENAI_API_KEY = sk-proj-abc123");
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
  });

  it("skips large files", () => {
    // Create a file > 1MB
    const largeContent = "x".repeat(1024 * 1024 + 1);
    writeFileSync(join(tempDir, "large.txt"), largeContent);
    const result = scanForSecrets(tempDir);
    // Should not crash, and large file is skipped
    expect(result).toBeDefined();
  });

  it("detects node_modules", () => {
    mkdirSync(join(tempDir, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(tempDir, "node_modules", "pkg", "index.js"), "module.exports = {}");
    const result = scanForSecrets(tempDir);
    expect(result.clean).toBe(false);
    expect(result.issues.some((i) => i.includes("node_modules"))).toBe(true);
  });
});
