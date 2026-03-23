import { defineConfig } from "drizzle-kit";
import { homedir } from "os";
import { join } from "path";

const dataDir = process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent");

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: join(dataDir, "stagent.db"),
  },
});
