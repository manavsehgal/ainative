import { defineConfig } from "drizzle-kit";
import { homedir } from "os";
import { join } from "path";

const dataDir = process.env.AINATIVE_DATA_DIR || join(homedir(), ".ainative");

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: join(dataDir, "ainative.db"),
  },
});
