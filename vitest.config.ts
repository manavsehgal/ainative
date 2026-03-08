import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      exclude: [
        "src/components/ui/**",
        "src/**/__tests__/**",
        "**/*.d.ts",
        "src/app/layout.tsx",
        "src/app/error.tsx",
        "src/app/global-error.tsx",
      ],
    },
  },
});
