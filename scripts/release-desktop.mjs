import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const bundleRoot = path.join(repoRoot, "src-tauri", "target", "release", "bundle");
const volumeIconSourcePath = path.join(repoRoot, "src-tauri", "icons", "icon.icns");
const macosAppPath = path.join(bundleRoot, "macos", "Stagent.app");
const releaseOutputDirectory = path.join(repoRoot, "output", "release");

const stableDmgName = "Stagent.dmg";
const stableZipName = "Stagent.app.zip";
const defaultRepo = "manavsehgal/stagent";

function parseArgs(argv) {
  const options = {
    repo: defaultRepo,
    skipBuild: false,
    skipUpload: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--skip-build") {
      options.skipBuild = true;
      continue;
    }

    if (argument === "--skip-upload") {
      options.skipUpload = true;
      continue;
    }

    if (argument === "--repo") {
      options.repo = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--repo=")) {
      options.repo = argument.slice("--repo=".length);
      continue;
    }

    if (argument === "--tag") {
      options.tag = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--tag=")) {
      options.tag = argument.slice("--tag=".length);
      continue;
    }

    if (argument === "--title") {
      options.title = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--title=")) {
      options.title = argument.slice("--title=".length);
      continue;
    }

    if (argument === "--target") {
      options.target = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--target=")) {
      options.target = argument.slice("--target=".length);
      continue;
    }

    if (argument === "--notes") {
      options.notes = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--notes=")) {
      options.notes = argument.slice("--notes=".length);
      continue;
    }

    if (argument === "--notes-file") {
      options.notesFile = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--notes-file=")) {
      options.notesFile = argument.slice("--notes-file=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

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

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureReleaseOutputDirectory() {
  await fs.rm(releaseOutputDirectory, { recursive: true, force: true });
  await fs.mkdir(releaseOutputDirectory, { recursive: true });
}

async function normalizeArtifacts() {
  if (!(await exists(macosAppPath))) {
    throw new Error(`Missing app bundle: ${macosAppPath}`);
  }

  await ensureReleaseOutputDirectory();

  const stableDmgPath = path.join(releaseOutputDirectory, stableDmgName);
  const stableZipPath = path.join(releaseOutputDirectory, stableZipName);

  await buildStableDmg(stableDmgPath);
  await fs.rm(stableZipPath, { force: true });
  await run("ditto", [
    "-c",
    "-k",
    "--sequesterRsrc",
    "--keepParent",
    macosAppPath,
    stableZipPath,
  ]);

  return {
    stableDmgPath,
    stableZipPath,
  };
}

async function buildStableDmg(stableDmgPath) {
  const dmgStagingDirectory = path.join(releaseOutputDirectory, "dmg-root");
  const dmgMountDirectory = path.join(releaseOutputDirectory, "dmg-mount");
  const tempReadWriteDmgPath = path.join(releaseOutputDirectory, "Stagent-rw.dmg");
  const stagedAppPath = path.join(dmgStagingDirectory, "Stagent.app");
  const applicationsAliasPath = path.join(dmgStagingDirectory, "Applications");
  const mountedVolumeIconPath = path.join(dmgMountDirectory, ".VolumeIcon.icns");

  await fs.rm(dmgStagingDirectory, { recursive: true, force: true });
  await fs.rm(dmgMountDirectory, { recursive: true, force: true });
  await fs.rm(tempReadWriteDmgPath, { force: true });
  await fs.mkdir(dmgStagingDirectory, { recursive: true });
  await run("ditto", [macosAppPath, stagedAppPath]);
  await fs.symlink("/Applications", applicationsAliasPath);
  await fs.rm(stableDmgPath, { force: true });

  if (!(await exists(volumeIconSourcePath))) {
    throw new Error(`Missing volume icon source: ${volumeIconSourcePath}`);
  }

  await run("hdiutil", [
    "create",
    "-fs",
    "HFS+",
    "-volname",
    "Stagent",
    "-srcfolder",
    dmgStagingDirectory,
    "-ov",
    "-format",
    "UDRW",
    tempReadWriteDmgPath,
  ]);

  await fs.mkdir(dmgMountDirectory, { recursive: true });

  let volumeAttached = false;
  try {
    await run("hdiutil", [
      "attach",
      tempReadWriteDmgPath,
      "-mountpoint",
      dmgMountDirectory,
      "-nobrowse",
      "-noautoopen",
    ]);
    volumeAttached = true;

    await fs.copyFile(volumeIconSourcePath, mountedVolumeIconPath);
    await run("SetFile", ["-c", "icnC", "-t", "icns", mountedVolumeIconPath]);
    await run("SetFile", ["-a", "V", mountedVolumeIconPath]);
    await run("SetFile", ["-a", "C", dmgMountDirectory]);
  } finally {
    if (volumeAttached) {
      try {
        await run("hdiutil", ["detach", dmgMountDirectory]);
      } catch (error) {
        await run("hdiutil", ["detach", dmgMountDirectory, "-force"]);
      }
    }
  }

  await run("hdiutil", [
    "convert",
    tempReadWriteDmgPath,
    "-ov",
    "-format",
    "UDZO",
    "-o",
    stableDmgPath,
  ]);

  await fs.rm(tempReadWriteDmgPath, { force: true });
  await fs.rm(dmgMountDirectory, { recursive: true, force: true });
  await fs.rm(dmgStagingDirectory, { recursive: true, force: true });
}

async function verifyDmg(dmgPath) {
  await run("hdiutil", ["verify", dmgPath]);
}

async function getPackageVersion() {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  if (!packageJson.version) {
    throw new Error("package.json is missing a version");
  }
  return packageJson.version;
}

async function getRelease(tag, repo) {
  try {
    const { stdout } = await capture("gh", [
      "release",
      "view",
      tag,
      "--repo",
      repo,
      "--json",
      "assets,url",
    ]);
    return JSON.parse(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/release not found|HTTP 404/i.test(message)) {
      return null;
    }
    throw error;
  }
}

async function deleteStaleAssets(tag, repo, assets) {
  const staleAssets = assets.filter(({ name }) => {
    if (name === stableDmgName || name === stableZipName) {
      return false;
    }

    return /^Stagent.*\.dmg$/u.test(name) || /^Stagent.*\.app\.zip$/u.test(name);
  });

  for (const asset of staleAssets) {
    await run("gh", ["release", "delete-asset", tag, asset.name, "--repo", repo, "--yes"]);
  }
}

async function createOrUpdateRelease({ repo, tag, title, target, notes, notesFile }) {
  const existingRelease = await getRelease(tag, repo);

  if (existingRelease) {
    await deleteStaleAssets(tag, repo, existingRelease.assets ?? []);

    const editArgs = ["release", "edit", tag, "--repo", repo, "--title", title, "--latest"];
    if (notesFile) {
      editArgs.push("--notes-file", notesFile);
    } else if (notes) {
      editArgs.push("--notes", notes);
    }

    await run("gh", editArgs);
    return;
  }

  const createArgs = [
    "release",
    "create",
    tag,
    "--repo",
    repo,
    "--title",
    title,
    "--generate-notes",
    "--latest",
  ];

  if (target) {
    createArgs.push("--target", target);
  }

  if (notesFile) {
    createArgs.push("--notes-file", notesFile);
  } else if (notes) {
    createArgs.push("--notes", notes);
  }

  await run("gh", createArgs);
}

async function uploadAssets({ repo, tag, stableDmgPath, stableZipPath }) {
  await run("gh", [
    "release",
    "upload",
    tag,
    stableDmgPath,
    stableZipPath,
    "--repo",
    repo,
    "--clobber",
  ]);
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("Desktop releases must be built on macOS.");
  }

  const options = parseArgs(process.argv.slice(2));
  const version = await getPackageVersion();
  const tag = options.tag ?? `desktop-v${version}`;
  const title = options.title ?? `Stagent Desktop ${version}`;

  if (options.notes && options.notesFile) {
    throw new Error("Use either --notes or --notes-file, not both.");
  }

  if (!options.skipBuild) {
    await run("npm", ["run", "desktop:icon"]);
    await run("npm", ["run", "desktop:build"]);
  }

  const { stableDmgPath, stableZipPath } = await normalizeArtifacts();
  await verifyDmg(stableDmgPath);

  if (!options.skipUpload) {
    await createOrUpdateRelease({
      repo: options.repo,
      tag,
      title,
      target: options.target,
      notes: options.notes,
      notesFile: options.notesFile,
    });

    await uploadAssets({
      repo: options.repo,
      tag,
      stableDmgPath,
      stableZipPath,
    });
  }

  const stableDmgUrl = `https://github.com/${options.repo}/releases/latest/download/${stableDmgName}`;
  const stableZipUrl = `https://github.com/${options.repo}/releases/latest/download/${stableZipName}`;

  console.log("");
  console.log("Desktop release ready.");
  console.log(`Tag: ${tag}`);
  console.log(`DMG: ${stableDmgPath}`);
  console.log(`ZIP: ${stableZipPath}`);
  console.log(`Stable DMG URL: ${stableDmgUrl}`);
  console.log(`Stable ZIP URL: ${stableZipUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
