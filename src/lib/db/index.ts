import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { join } from "path";
import { mkdirSync } from "fs";
import { getStagentDataDir } from "@/lib/utils/stagent-paths";
import { bootstrapStagentDatabase } from "./bootstrap";

const dataDir = getStagentDataDir();
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, "stagent.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
bootstrapStagentDatabase(sqlite);

export const db = drizzle(sqlite, { schema });

// Lazy seed: table templates (idempotent — checks before inserting)
import("@/lib/data/seed-data/table-templates").then(({ seedTableTemplates }) => {
  seedTableTemplates().catch(() => {
    // Template seeding is non-critical — log and continue
    console.warn("[db] table template seeding failed");
  });
});
