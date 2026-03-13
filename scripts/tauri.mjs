import { cpSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tauriRoot = path.join(repoRoot, "src-tauri");
const sourceIconPath = path.join(repoRoot, "public", "icon-512.png");
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

function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}\n${stderr.trim()}`.trim()));
    });
  });
}

function parseMetadataValue(output, key) {
  const pattern = new RegExp(`${key}:\\s+(.+)`);
  const match = output.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function parseAlphaChannel(pixel) {
  if (pixel.toLowerCase() === "none") {
    return 0;
  }

  const match = pixel.match(/\(([^)]+)\)$/);
  if (!match) {
    return 1;
  }

  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length < 4) {
    return 1;
  }

  const alpha = Number.parseFloat(parts.at(-1));
  return Number.isFinite(alpha) ? alpha : 1;
}

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

function syncNextRuntimeNodeModules() {
  const sourceNodeModules = path.join(repoRoot, ".next", "node_modules");
  if (!existsSync(sourceNodeModules)) {
    return;
  }

  const bundledAppRoot = resolveBundledAppRoot();
  const bundledNextDir = path.join(bundledAppRoot, ".next");
  const bundledNodeModules = path.join(bundledNextDir, "node_modules");

  mkdirSync(bundledNextDir, { recursive: true });
  cpSync(sourceNodeModules, bundledNodeModules, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
  });
}

async function validateIconSource() {
  const { stdout } = await capture(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", "-g", "format", sourceIconPath],
    { cwd: repoRoot },
  );

  const width = Number.parseInt(parseMetadataValue(stdout, "pixelWidth") ?? "", 10);
  const height = Number.parseInt(parseMetadataValue(stdout, "pixelHeight") ?? "", 10);
  const format = parseMetadataValue(stdout, "format");

  if (width !== 512 || height !== 512 || format !== "png") {
    throw new Error(
      "public/icon-512.png must stay a 512x512 PNG so Tauri can generate the desktop icon set predictably.",
    );
  }

  try {
    await capture("magick", ["-version"], { cwd: repoRoot });
  } catch (error) {
    console.warn("Skipping icon corner-mask validation because ImageMagick is unavailable.");
    return;
  }

  const { stdout: cornerPixels } = await capture(
    "magick",
    [
      sourceIconPath,
      "-format",
      "tl=%[pixel:p{0,0}] tr=%[pixel:p{511,0}] bl=%[pixel:p{0,511}] br=%[pixel:p{511,511}]",
      "info:",
    ],
    { cwd: repoRoot },
  );

  const pixels = [...cornerPixels.matchAll(/(?:tl|tr|bl|br)=([^\s]+)/g)].map((match) => match[1]);
  const hasTransparentCorner = pixels.some((pixel) => parseAlphaChannel(pixel) < 0.999);

  if (hasTransparentCorner) {
    throw new Error(
      "public/icon-512.png has transparent corners. Keep the source icon square and unmasked so macOS can apply its own rounded mask.",
    );
  }
}

async function main() {
  if (mode === "icon") {
    await validateIconSource();
    await run("cargo", ["tauri", "icon", "../public/icon-512.png", ...extraArgs], {
      cwd: tauriRoot,
    });
    return;
  }

  await run("npm", ["run", "build:cli"], { cwd: repoRoot });

  // For release builds, pre-build Next.js so the bundle includes .next/
  // and the sidecar can use `next start` (fast) instead of `next dev` (slow).
  if (mode === "build") {
    await run("npm", ["run", "build"], { cwd: repoRoot });
  }

  await run("cargo", ["tauri", mode, ...extraArgs], { cwd: tauriRoot });

  if (mode === "build") {
    syncNextRuntimeNodeModules();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
