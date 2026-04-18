import "@testing-library/jest-dom/vitest";
import { mkdtempSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock ResizeObserver for cmdk
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView for cmdk
HTMLElement.prototype.scrollIntoView = () => {};

if (!process.env.AINATIVE_DATA_DIR) {
  const tempDataDir = mkdtempSync(join(tmpdir(), "ainative-vitest-"));
  mkdirSync(tempDataDir, { recursive: true });
  process.env.AINATIVE_DATA_DIR = tempDataDir;
}
