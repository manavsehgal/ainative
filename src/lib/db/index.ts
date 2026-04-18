import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { join } from "path";
import { mkdirSync } from "fs";
import { getAinativeDataDir } from "@/lib/utils/ainative-paths";
import { bootstrapStagentDatabase } from "./bootstrap";

const dataDir = getAinativeDataDir();
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, "stagent.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Bootstrap creates tables with IF NOT EXISTS + adds columns.
// Drizzle migrations (DROP TABLE, CREATE INDEX, etc.) run separately
// at server startup in instrumentation-node.ts to avoid SQLITE_BUSY
// conflicts during next build.
bootstrapStagentDatabase(sqlite);

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Lazy seed: table templates (idempotent — checks before inserting)
import("@/lib/data/seed-data/table-templates").then(({ seedTableTemplates }) => {
  seedTableTemplates().catch(() => {
    // Template seeding is non-critical — log and continue
    console.warn("[db] table template seeding failed");
  });
});
