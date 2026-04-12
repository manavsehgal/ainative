import { NextResponse } from "next/server";
import { basename, join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import Database from "better-sqlite3";
import { getLaunchCwd } from "@/lib/environment/workspace-context";
import { isDevMode, isPrivateInstance } from "@/lib/instance/detect";
import { bootstrapStagentDatabase } from "@/lib/db/bootstrap";

/**
 * POST /api/workspace/fix-data-dir
 *
 * Fixes a data-dir mismatch for domain clones by:
 * 1. Deriving the correct STAGENT_DATA_DIR from the folder name
 * 2. Writing it to .env.local (alongside STAGENT_CLOUD_DISABLED=true)
 * 3. Creating the data dir + bootstrapping an empty database there
 *
 * Requires a dev server restart to take effect.
 */
export async function POST() {
  const cwd = getLaunchCwd();

  // Guard: main repo doesn't need fixing
  if (isDevMode(cwd)) {
    return NextResponse.json(
      { error: "Main dev repo does not need a data-dir fix" },
      { status: 400 }
    );
  }

  // Guard: already isolated
  if (isPrivateInstance()) {
    return NextResponse.json(
      { error: "STAGENT_DATA_DIR is already set to a non-default path" },
      { status: 400 }
    );
  }

  const folderName = basename(cwd);
  const home = homedir();
  // stagent-wealth → ~/.stagent-wealth, stagent-growth → ~/.stagent-growth
  const dataDir = join(home, `.${folderName}`);
  const displayDataDir = `~/.${folderName}`;

  // --- 1. Update .env.local ---
  const envLocalPath = join(cwd, ".env.local");
  let envContent = "";
  if (existsSync(envLocalPath)) {
    envContent = readFileSync(envLocalPath, "utf-8");
  }

  // Replace or append STAGENT_DATA_DIR
  if (/^STAGENT_DATA_DIR=.*/m.test(envContent)) {
    envContent = envContent.replace(
      /^STAGENT_DATA_DIR=.*/m,
      `STAGENT_DATA_DIR=${dataDir}`
    );
  } else {
    envContent = envContent.trimEnd() + `\nSTAGENT_DATA_DIR=${dataDir}\n`;
  }

  // Ensure STAGENT_CLOUD_DISABLED=true is present
  if (!/^STAGENT_CLOUD_DISABLED=true/m.test(envContent)) {
    envContent = envContent.trimEnd() + `\nSTAGENT_CLOUD_DISABLED=true\n`;
  }

  writeFileSync(envLocalPath, envContent, "utf-8");

  // --- 2. Create data dir + bootstrap DB ---
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "stagent.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  bootstrapStagentDatabase(sqlite);
  sqlite.close();

  return NextResponse.json({
    success: true,
    dataDir: displayDataDir,
    envLocalPath,
    needsRestart: true,
  });
}
