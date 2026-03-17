/**
 * E2E test setup — creates a test project and sandbox, tears down after all tests.
 *
 * This file is imported by test files that need a shared project context.
 * It does NOT run as a vitest setupFile — each test suite imports it explicitly.
 */

import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createProject,
  deleteProject,
  isServerReachable,
  isRuntimeAvailable,
} from "./helpers";

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------

export let testProjectId = "";
export let sandboxDir = "";
export let claudeAvailable = false;
export let codexAvailable = false;

// ---------------------------------------------------------------------------
// Sandbox files — minimal TypeScript project for agents to analyze
// ---------------------------------------------------------------------------

const SANDBOX_FILES: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "stagent-e2e-sandbox",
      version: "1.0.0",
      scripts: { build: "tsc" },
      devDependencies: { typescript: "^5.5.0" },
    },
    null,
    2
  ),
  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        outDir: "dist",
        strict: true,
      },
      include: ["src"],
    },
    null,
    2
  ),
  "src/index.ts": `
export interface Task {
  id: number;
  title: string;
  completed: boolean;
}

const tasks: Task[] = [];

export function addTask(title: string): Task {
  // Deliberate bug: ID based on array length → duplicates after deletion
  const task: Task = { id: tasks.length, title, completed: false };
  tasks.push(task);
  return task;
}

export function completeTask(id: number): boolean {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.completed = true;
    return true;
  }
  return false;
}

export function getIncompleteTasks(): Task[] {
  return tasks.filter((t) => !t.completed);
}
`.trimStart(),
  "src/utils.ts": `
export function formatDate(date: Date): string {
  // Deliberate bug: getMonth() is zero-based
  return \`\${date.getFullYear()}-\${date.getMonth()}-\${date.getDate()}\`;
}

export function parseCSV(csv: string): string[][] {
  // Deliberate bug: naive parsing — no quoted field support
  return csv.split("\\n").map((line) => line.split(","));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
`.trimStart(),
};

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------

export async function setupE2E(): Promise<void> {
  // 1. Check server reachability
  const reachable = await isServerReachable();
  if (!reachable) {
    throw new Error(
      "Stagent server is not reachable at the configured URL. " +
        "Start the dev server with `npm run dev` before running E2E tests."
    );
  }

  // 2. Create sandbox directory with test files
  sandboxDir = join(tmpdir(), `stagent-e2e-${Date.now()}`);
  mkdirSync(join(sandboxDir, "src"), { recursive: true });

  for (const [relativePath, content] of Object.entries(SANDBOX_FILES)) {
    const fullPath = join(sandboxDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }

  // 3. Create test project pointing at the sandbox
  const { ok, data } = await createProject({
    name: `E2E Test ${new Date().toISOString().slice(0, 19)}`,
    description: "Automated E2E test project — safe to delete",
    workingDirectory: sandboxDir,
  });
  if (!ok || !data?.id) {
    throw new Error("Failed to create E2E test project");
  }
  testProjectId = data.id;

  // 4. Detect runtime availability
  claudeAvailable = await isRuntimeAvailable("claude-code");
  codexAvailable = await isRuntimeAvailable("openai-codex-app-server");
}

export async function teardownE2E(): Promise<void> {
  // Clean up test project
  if (testProjectId) {
    await deleteProject(testProjectId).catch(() => {});
  }

  // Clean up sandbox directory
  if (sandboxDir && existsSync(sandboxDir)) {
    rmSync(sandboxDir, { recursive: true, force: true });
  }
}
