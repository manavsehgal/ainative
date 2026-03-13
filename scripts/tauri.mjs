import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tauriRoot = path.join(repoRoot, "src-tauri");
const mode = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!mode || !["dev", "build", "icon"].includes(mode)) {
  console.error("Usage: node scripts/tauri.mjs <dev|build|icon> [extra args]");
  process.exit(1);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

async function main() {
  if (mode === "icon") {
    await run("cargo", ["tauri", "icon", "../public/icon-512.png", ...extraArgs], {
      cwd: tauriRoot,
    });
    return;
  }

  await run("npm", ["run", "build:cli"], { cwd: repoRoot });
  await run("cargo", ["tauri", mode, ...extraArgs], { cwd: tauriRoot });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
