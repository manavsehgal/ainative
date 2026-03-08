import { defineConfig } from "drizzle-kit";
import { homedir } from "os";
import { join } from "path";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: join(homedir(), ".stagent", "stagent.db"),
  },
});
