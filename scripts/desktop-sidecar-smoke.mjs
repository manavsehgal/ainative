import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tauriRoot = path.join(repoRoot, "src-tauri");
const smokeTimeoutMs = 15_000;

function resolveBundledAppRoot() {
  const resourcesRoot = path.join(
    tauriRoot,
    "target",
    "release",
    "bundle",
    "macos",
    "Stagent.app",
    "Contents",
    "Resources",
  );

  for (const candidate of [path.join(resourcesRoot, "_up_"), resourcesRoot]) {
    if (existsSync(path.join(candidate, "dist", "cli.js"))) {
      return candidate;
    }
  }

  throw new Error(`Could not resolve bundled app resources under ${resourcesRoot}.`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to reserve a loopback port for desktop smoke test."));
        return;
      }

      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

function startIpv6Blocker(port) {
  return new Promise((resolve, reject) => {
    const blocker = net.createServer();
    blocker.once("error", reject);
    blocker.listen({ host: "::", ipv6Only: true, port }, () => {
      resolve(blocker);
    });
  });
}

function waitForHttpOk(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${url} to return HTTP 200.`));
        return;
      }

      const request = http.get(url, (response) => {
        response.resume();

        if (response.statusCode === 200) {
          resolve();
          return;
        }

        setTimeout(poll, 250);
      });

      request.once("error", async () => {
        await sleep(250);
        poll();
      });
    };

    poll();
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  await Promise.race([
    new Promise((resolve) => {
      child.once("exit", resolve);
    }),
    sleep(2_000).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

async function main() {
  const appRoot = resolveBundledAppRoot();
  const port = await reserveLoopbackPort();
  const blocker = await startIpv6Blocker(port);
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "stagent-desktop-smoke-"));
  const cliPath = path.join(appRoot, "dist", "cli.js");
  let output = "";

  const child = spawn(process.execPath, [cliPath, "--no-open", "--port", String(port)], {
    cwd: appRoot,
    env: {
      ...process.env,
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      STAGENT_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHttpOk(`http://127.0.0.1:${port}`, smokeTimeoutMs);
    console.log(`Desktop sidecar smoke passed on http://127.0.0.1:${port}`);
  } catch (error) {
    throw new Error(
      [
        `Desktop sidecar smoke failed while an IPv6 localhost listener already occupied port ${port}.`,
        "This recreates the boot-screen regression where the app waits forever even though 127.0.0.1 remained free.",
        output.trim() ? `Child output:\n${output.trim()}` : "Child output: <empty>",
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
      ].join("\n\n"),
    );
  } finally {
    await stopChild(child);
    await Promise.all([
      fs.rm(dataDir, { recursive: true, force: true }),
      new Promise((resolve, reject) => {
        blocker.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    ]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
