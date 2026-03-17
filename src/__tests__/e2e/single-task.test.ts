/**
 * E2E: Single task execution across profiles and runtimes.
 *
 * Tests that individual tasks execute and produce results via both
 * Claude Code and Codex runtimes with different agent profiles.
 */

import {
  setupE2E,
  teardownE2E,
  testProjectId,
  claudeAvailable,
  codexAvailable,
} from "./setup";
import {
  createTask,
  executeTask,
  pollTaskUntilDone,
  updateTask,
} from "./helpers";

beforeAll(async () => {
  await setupE2E();
});

afterAll(async () => {
  await teardownE2E();
});

// ---------------------------------------------------------------------------
// Claude Code runtime
// ---------------------------------------------------------------------------

describe("Single Task — Claude Code", () => {
  beforeAll(() => {
    if (!claudeAvailable) {
      console.warn("Skipping Claude Code tests — runtime not available");
    }
  });

  it.skipIf(!claudeAvailable)(
    "general profile describes code",
    async () => {
      const { ok, data: task } = await createTask({
        title: "Describe the TypeScript code in src/",
        description:
          "Read the TypeScript files in the project and describe what the code does.",
        projectId: testProjectId,
        agentProfile: "general",
      });
      expect(ok).toBe(true);

      // Queue → execute
      await updateTask(task!.id, { status: "queued" });
      const exec = await executeTask(task!.id);
      expect(exec.status).toBe(202);

      // Poll until done
      const result = await pollTaskUntilDone(task!.id);
      expect(result.status).toBe("completed");
      expect(result.result).toBeTruthy();
      expect(result.result!.length).toBeGreaterThan(50);
    }
  );

  it.skipIf(!claudeAvailable)(
    "code-reviewer profile finds bugs",
    async () => {
      const { ok, data: task } = await createTask({
        title: "Review code for bugs",
        description:
          "Review all TypeScript files in the project. Find bugs and report them with severity levels.",
        projectId: testProjectId,
        agentProfile: "code-reviewer",
      });
      expect(ok).toBe(true);

      await updateTask(task!.id, { status: "queued" });
      const exec = await executeTask(task!.id);
      expect(exec.status).toBe(202);

      const result = await pollTaskUntilDone(task!.id);
      expect(result.status).toBe("completed");
      expect(result.result).toBeTruthy();
      // Code reviewer should find at least some issues
      expect(result.result!.length).toBeGreaterThan(100);
    }
  );

  it.skipIf(!claudeAvailable)(
    "document-writer profile generates overview",
    async () => {
      const { ok, data: task } = await createTask({
        title: "Write a technical overview document",
        description:
          "Generate a technical overview of this project including structure, modules, and dependencies.",
        projectId: testProjectId,
        agentProfile: "document-writer",
      });
      expect(ok).toBe(true);

      await updateTask(task!.id, { status: "queued" });
      const exec = await executeTask(task!.id);
      expect(exec.status).toBe(202);

      const result = await pollTaskUntilDone(task!.id);
      expect(result.status).toBe("completed");
      expect(result.result).toBeTruthy();
    }
  );
});

// ---------------------------------------------------------------------------
// Codex runtime
// ---------------------------------------------------------------------------

describe("Single Task — Codex", () => {
  beforeAll(() => {
    if (!codexAvailable) {
      console.warn("Skipping Codex tests — runtime not available");
    }
  });

  it.skipIf(!codexAvailable)(
    "general profile describes code via Codex",
    async () => {
      const { ok, data: task } = await createTask({
        title: "Describe the TypeScript code in src/",
        description:
          "Read the TypeScript files in the project and describe what the code does.",
        projectId: testProjectId,
        assignedAgent: "codex",
        agentProfile: "general",
      });
      expect(ok).toBe(true);

      await updateTask(task!.id, { status: "queued" });
      const exec = await executeTask(task!.id);
      expect(exec.status).toBe(202);

      const result = await pollTaskUntilDone(task!.id);
      expect(result.status).toBe("completed");
      expect(result.result).toBeTruthy();
      expect(result.result!.length).toBeGreaterThan(50);
    }
  );

  it.skipIf(!codexAvailable)(
    "code-reviewer profile finds bugs via Codex",
    async () => {
      const { ok, data: task } = await createTask({
        title: "Review code for bugs",
        description:
          "Review all TypeScript files in the project. Find bugs and report them with severity levels.",
        projectId: testProjectId,
        assignedAgent: "codex",
        agentProfile: "code-reviewer",
      });
      expect(ok).toBe(true);

      await updateTask(task!.id, { status: "queued" });
      const exec = await executeTask(task!.id);
      expect(exec.status).toBe(202);

      const result = await pollTaskUntilDone(task!.id);
      expect(result.status).toBe("completed");
      expect(result.result).toBeTruthy();
    }
  );
});
