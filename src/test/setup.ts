import "@testing-library/jest-dom/vitest";
import { mkdtempSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

if (!process.env.STAGENT_DATA_DIR) {
  const tempDataDir = mkdtempSync(join(tmpdir(), "stagent-vitest-"));
  mkdirSync(tempDataDir, { recursive: true });
  process.env.STAGENT_DATA_DIR = tempDataDir;
}
