import { program } from "commander";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(homedir(), ".stagent");
const appDir = join(__dirname, "..");

program
  .name("stagent")
  .description("AI agent task management — local-first")
  .version(
    JSON.parse(readFileSync(join(appDir, "package.json"), "utf-8")).version
  )
  .option("-p, --port <number>", "port to start on", "3000")
  .option("--reset", "delete database and start fresh")
  .option("--no-open", "don't auto-open browser")
  .parse();

const opts = program.opts();

// 1. Data directory setup
for (const dir of [DATA_DIR, join(DATA_DIR, "logs"), join(DATA_DIR, "sessions")]) {
  mkdirSync(dir, { recursive: true });
}

// 2. Handle --reset
const dbPath = join(DATA_DIR, "stagent.db");
if (opts.reset && existsSync(dbPath)) {
  unlinkSync(dbPath);
  // Also remove WAL/SHM files if present
  for (const suffix of ["-wal", "-shm"]) {
    const p = dbPath + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
  console.log("Database reset.");
}

// 3. Database migrations
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);
const migrationsDir = join(appDir, "src", "lib", "db", "migrations");
migrate(db, { migrationsFolder: migrationsDir });
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

// 5. Find local next binary
function findLocalBin(name: string, cwd: string): string {
  const local = join(cwd, "node_modules", ".bin", name);
  if (existsSync(local)) return local;
  // Walk up to find hoisted node_modules
  let dir = dirname(cwd);
  while (dir !== dirname(dir)) {
    const candidate = join(dir, "node_modules", ".bin", name);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return name; // Fallback to PATH
}

async function main() {
  const actualPort = await findAvailablePort(parseInt(opts.port, 10));
  let effectiveCwd = appDir;

  // 6. NPX hoisting workaround
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

  // 7. Spawn Next.js dev server
  const nextBin = findLocalBin("next", effectiveCwd);
  console.log(`Starting Stagent on http://localhost:${actualPort}`);

  const child = spawn(nextBin, ["dev", "--turbopack", "--port", String(actualPort)], {
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
