import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultDmgPath = path.join(repoRoot, "output", "release", "Stagent.dmg");

const BOOT_LOG_PATH = "/tmp/stagent-boot.log";
const SIDECAR_LOG_PATH = "/tmp/stagent-sidecar.log";
const CRASH_LOG_PATH = "/tmp/stagent-crash.log";
const requiredBootPhases = [
  "port_allocated",
  "sidecar_spawned",
  "sidecar_ready",
  "handoff_started",
  "handoff_navigated",
];
const failureBootPhases = [
  "setup_error",
  "sidecar_spawn_error",
  "timeout",
  "handoff_error",
];
const bootTimeoutMs = 45_000;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(
        `${command} ${args.join(" ")} exited with code ${code}\n${stderr.trim()}`.trim(),
      );
      error.code = code;
      reject(error);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readIfExists(targetPath) {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return "";
  }
}

async function removeIfExists(targetPath) {
  await fs.rm(targetPath, { force: true });
}

async function resolveMountedPath(targetPath) {
  try {
    return await fs.realpath(targetPath);
  } catch {
    return targetPath;
  }
}

function hasBootPhase(log, phase) {
  return log.includes(`phase=${phase}`);
}

async function waitForBootPhases(timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const bootLog = await readIfExists(BOOT_LOG_PATH);

    if (failureBootPhases.some((phase) => hasBootPhase(bootLog, phase))) {
      return {
        bootLog,
        complete: false,
      };
    }

    if (requiredBootPhases.every((phase) => hasBootPhase(bootLog, phase))) {
      return {
        bootLog,
        complete: true,
      };
    }

    await sleep(250);
  }

  return {
    bootLog: await readIfExists(BOOT_LOG_PATH),
    complete: false,
  };
}

async function getMountedProcessIds(mountDirectory) {
  try {
    const { stdout } = await capture("pgrep", ["-f", mountDirectory]);
    return stdout
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))
      .filter((pid) => Number.isInteger(pid) && pid !== process.pid);
  } catch {
    return [];
  }
}

async function killMountedProcesses(mountDirectory) {
  const pids = await getMountedProcessIds(mountDirectory);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Ignore dead processes.
    }
  }

  if (pids.length > 0) {
    await sleep(1_500);
  }

  const remaining = await getMountedProcessIds(mountDirectory);
  for (const pid of remaining) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Ignore dead processes.
    }
  }
}

async function detachDmg(mountDirectory) {
  try {
    await run("hdiutil", ["detach", mountDirectory]);
  } catch {
    await run("hdiutil", ["detach", mountDirectory, "-force"]);
  }
}

async function buildFailure(message) {
  const [bootLog, sidecarLog, crashLog] = await Promise.all([
    readIfExists(BOOT_LOG_PATH),
    readIfExists(SIDECAR_LOG_PATH),
    readIfExists(CRASH_LOG_PATH),
  ]);

  return new Error(
    [
      message,
      `Boot log:\n${bootLog || "<empty>"}`,
      `Sidecar log:\n${sidecarLog || "<empty>"}`,
      `Crash log:\n${crashLog || "<empty>"}`,
    ].join("\n\n"),
  );
}

async function main() {
  const dmgPath = path.resolve(process.argv[2] ?? defaultDmgPath);
  if (!existsSync(dmgPath)) {
    throw new Error(`Missing DMG for mounted smoke test: ${dmgPath}`);
  }

  const mountDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "stagent-mounted-dmg-smoke-"),
  );

  await Promise.all([
    removeIfExists(BOOT_LOG_PATH),
    removeIfExists(SIDECAR_LOG_PATH),
    removeIfExists(CRASH_LOG_PATH),
  ]);

  try {
    await run("hdiutil", [
      "attach",
      dmgPath,
      "-nobrowse",
      "-noautoopen",
      "-mountpoint",
      mountDirectory,
    ]);

    const mountedDirectory = await resolveMountedPath(mountDirectory);
    const appPath = path.join(mountedDirectory, "Stagent.app");
    if (!existsSync(appPath)) {
      throw await buildFailure(`Mounted DMG does not contain ${appPath}.`);
    }

    await run("open", ["-n", appPath]);

    const result = await waitForBootPhases(bootTimeoutMs);
    if (!result.complete) {
      throw await buildFailure(
        `Mounted DMG smoke failed to observe phases ${requiredBootPhases.join(", ")} within ${bootTimeoutMs}ms.`,
      );
    }

    console.log(`Mounted DMG smoke passed for ${dmgPath}`);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

      throw await buildFailure(String(error));
  } finally {
    const mountedDirectory = await resolveMountedPath(mountDirectory);
    await killMountedProcesses(mountedDirectory);
    await detachDmg(mountedDirectory);
    await fs.rm(mountDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
