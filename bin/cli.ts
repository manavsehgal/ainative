import { program } from "commander";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  cpSync,
  unlinkSync,
} from "fs";
import { spawn } from "child_process";
import { createServer } from "net";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getStagentDataDir, getStagentDbPath } from "../src/lib/utils/stagent-paths";
import {
  bootstrapStagentDatabase,
  hasLegacyStagentTables,
  hasMigrationHistory,
  markAllMigrationsApplied,
} from "../src/lib/db/bootstrap";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..");
const DATA_DIR = getStagentDataDir();
const dbPath = getStagentDbPath();
const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf-8"));
const HELP_TEXT = `
Data:
  Directory        ${DATA_DIR}
  Database         ${dbPath}
  Sessions         ${join(DATA_DIR, "sessions")}
  Logs             ${join(DATA_DIR, "logs")}

Environment variables:
  STAGENT_DATA_DIR Custom data directory for the desktop sidecar and web app
  ANTHROPIC_API_KEY Claude runtime access
  OPENAI_API_KEY   OpenAI Codex runtime access

Examples:
  node dist/cli.js --port 3210 --no-open
  STAGENT_DATA_DIR=/tmp/stagent-desktop node dist/cli.js --reset
`;

program
  .name("stagent")
  .description("Internal bootstrap sidecar for Stagent Desktop")
  .version(pkg.version)
  .addHelpText("after", HELP_TEXT)
  .option("-p, --port <number>", "port to start on", "3000")
  .option("--reset", "delete the local database before starting")
  .option("--no-open", "don't auto-open browser")
  .parse();

const opts = program.opts();
const requestedPort = Number.parseInt(opts.port, 10);

if (Number.isNaN(requestedPort) || requestedPort <= 0) {
  program.error(`Invalid port: ${opts.port}`);
}

// 1. Data directory setup
for (const dir of [DATA_DIR, join(DATA_DIR, "logs"), join(DATA_DIR, "sessions")]) {
  mkdirSync(dir, { recursive: true });
}

// 2. Handle --reset
if (opts.reset) {
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
    // Also remove WAL/SHM files if present.
    for (const suffix of ["-wal", "-shm"]) {
      const filePath = dbPath + suffix;
      if (existsSync(filePath)) unlinkSync(filePath);
    }
    console.log("Database reset.");
  } else {
    console.log("No database found to reset.");
  }
}

// 3. Database migrations
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const migrationsDir = join(appDir, "src", "lib", "db", "migrations");
const db = drizzle(sqlite);
const needsLegacyRecovery =
  hasLegacyStagentTables(sqlite) && !hasMigrationHistory(sqlite);

if (needsLegacyRecovery) {
  bootstrapStagentDatabase(sqlite);
  markAllMigrationsApplied(sqlite, migrationsDir);
  console.log("Recovered legacy database schema.");
} else {
  migrate(db, { migrationsFolder: migrationsDir });
  bootstrapStagentDatabase(sqlite);
}

sqlite.close();
console.log("Database ready.");

// 4. Port allocation
function findAvailablePort(preferred: number): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(preferred, () => {
      server.close(() => resolve(preferred));
    });
    server.on("error", () => {
      resolve(findAvailablePort(preferred + 1));
    });
  });
}

function findClosestPath(cwd: string, segments: string[]): string | null {
  let dir = cwd;

  while (true) {
    const candidate = join(dir, ...segments);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

function resolveNextEntrypoint(cwd: string): string {
  const nextEntrypoint = findClosestPath(cwd, ["node_modules", "next", "dist", "bin", "next"]);
  if (nextEntrypoint) {
    return nextEntrypoint;
  }

  throw new Error(
    `Could not resolve Next.js CLI entrypoint from ${cwd}. Expected node_modules/next/dist/bin/next.`,
  );
}

async function main() {
  const actualPort = await findAvailablePort(requestedPort);
  let effectiveCwd = appDir;

  // 6. Workspace hoisting workaround for Next.js dependencies
  const localNm = join(appDir, "node_modules");
  if (!existsSync(join(localNm, "next", "package.json"))) {
    let searchDir = dirname(appDir);
    while (searchDir !== dirname(searchDir)) {
      const candidate = join(searchDir, "node_modules", "next", "package.json");
      if (existsSync(candidate)) {
        const hoistedRoot = searchDir;
        for (const name of ["src", "public"]) {
          const dest = join(hoistedRoot, name);
          const src = join(appDir, name);
          if (!existsSync(dest) && existsSync(src)) {
            cpSync(src, dest, { recursive: true });
          }
        }
        for (const name of [
          "next.config.mjs",
          "tsconfig.json",
          "postcss.config.mjs",
          "package.json",
          "components.json",
          "drizzle.config.ts",
        ]) {
          const dest = join(hoistedRoot, name);
          const src = join(appDir, name);
          if (!existsSync(dest) && existsSync(src)) {
            writeFileSync(dest, readFileSync(src));
          }
        }
        effectiveCwd = hoistedRoot;
        break;
      }
      searchDir = dirname(searchDir);
    }
  }

  // 7. Spawn Next.js server (production if pre-built, dev otherwise)
  const nextEntrypoint = resolveNextEntrypoint(effectiveCwd);
  const isPrebuilt = existsSync(join(effectiveCwd, ".next", "BUILD_ID"));
  const nextArgs = isPrebuilt
    ? ["start", "--port", String(actualPort)]
    : ["dev", "--turbopack", "--port", String(actualPort)];

  console.log(`Stagent ${pkg.version}`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log(`Mode: ${isPrebuilt ? "production" : "development"}`);
  console.log(`Next entry: ${nextEntrypoint}`);
  console.log(`Starting Stagent on http://localhost:${actualPort}`);

  const child = spawn(process.execPath, [nextEntrypoint, ...nextArgs], {
    cwd: effectiveCwd,
    stdio: "inherit",
    env: {
      ...process.env,
      STAGENT_DATA_DIR: DATA_DIR,
      PORT: String(actualPort),
    },
  });

  // 8. Auto-open browser
  if (opts.open !== false) {
    setTimeout(async () => {
      try {
        const open = (await import("open")).default;
        await open(`http://localhost:${actualPort}`);
      } catch {
        // Silently fail — user can open manually
      }
    }, 3000);
  }

  // 9. Graceful shutdown
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error("Failed to start Stagent:", err);
  process.exit(1);
});
