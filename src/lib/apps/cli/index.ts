/**
 * CLI `app` subcommand group registration.
 *
 * Registers all `stagent app <subcommand>` handlers with Commander.
 * Each handler wraps existing service functions with CLI-friendly
 * output formatting and error handling.
 */

import type { Command } from "commander";
import { resolve } from "path";

export function registerAppCommands(program: Command) {
  const app = program
    .command("app")
    .description("Manage Stagent apps — create, validate, install, and more");

  // ── Creator commands ─────────────────────────────────────────────

  app
    .command("init")
    .description("Scaffold a new .sap app directory")
    .argument("[name]", "App name", "my-app")
    .option("-d, --dir <path>", "Output directory", process.cwd())
    .option("-c, --category <cat>", "App category", "general")
    .option("--id <id>", "App ID (auto-generated from name if omitted)")
    .action(async (name: string, opts: { dir: string; category: string; id?: string }) => {
      const { initSapDirectory } = await import("./init");
      const sapDir = initSapDirectory(opts.dir, {
        name,
        id: opts.id,
        category: opts.category,
      });
      console.log(`Created ${sapDir}`);
      console.log("Next steps:");
      console.log("  1. Edit manifest.yaml");
      console.log("  2. Add tables in templates/");
      console.log("  3. Run: stagent app validate " + sapDir);
    });

  app
    .command("validate")
    .description("Validate a .sap directory")
    .argument("[dir]", "Path to .sap directory", ".")
    .action(async (dir: string) => {
      const { validateSapDirectory } = await import("./validate");
      const result = validateSapDirectory(resolve(dir));

      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          console.log(`⚠ ${w}`);
        }
      }

      if (result.valid) {
        console.log(`\n✓ Valid .sap directory (${result.warnings.length} warnings)`);
        process.exit(0);
      } else {
        for (const e of result.errors) {
          console.error(`✗ ${e}`);
        }
        console.error(`\n✗ Validation failed (${result.errors.length} errors)`);
        process.exit(1);
      }
    });

  app
    .command("pack")
    .description("Create a distributable .sap tarball")
    .argument("[dir]", "Path to .sap directory", ".")
    .option("-o, --out <path>", "Output directory", process.cwd())
    .action(async (dir: string, opts: { out: string }) => {
      const { packSapDirectory } = await import("./pack");
      try {
        const result = await packSapDirectory(resolve(dir), opts.out);
        console.log(`Packed ${result.fileCount} files → ${result.tarballPath}`);
        console.log(`Size: ${(result.sizeBytes / 1024).toFixed(1)} KB`);
        console.log(`SHA-256: ${result.checksum}`);
      } catch (e) {
        console.error(e instanceof Error ? e.message : "Pack failed");
        process.exit(1);
      }
    });

  // ── User commands ────────────────────────────────────────────────

  app
    .command("install")
    .description("Install an app from a local .sap directory or app ID")
    .argument("<source>", "Path to .sap directory, or app ID for builtins")
    .action(async (source: string) => {
      const resolvedPath = resolve(source);
      const { existsSync } = await import("fs");

      if (existsSync(resolvedPath)) {
        // Local .sap directory
        const { sapToBundle } = await import("../sap-converter");
        const { installApp } = await import("../service");
        const bundle = await sapToBundle(resolvedPath);
        const instance = await installApp(bundle.manifest.id, undefined, bundle);
        console.log(`Installed "${instance.name}" (${instance.appId}) — status: ${instance.status}`);
      } else {
        // Try as builtin/marketplace app ID
        const { installApp } = await import("../service");
        try {
          const instance = await installApp(source);
          console.log(`Installed "${instance.name}" (${instance.appId}) — status: ${instance.status}`);
        } catch (e) {
          console.error(e instanceof Error ? e.message : `App "${source}" not found`);
          process.exit(1);
        }
      }
    });

  app
    .command("list")
    .description("List installed apps")
    .action(async () => {
      const { listInstalledAppInstances } = await import("../service");
      const instances = listInstalledAppInstances();

      if (instances.length === 0) {
        console.log("No apps installed.");
        return;
      }

      // Table header
      console.log(
        padRight("ID", 24) +
          padRight("Status", 14) +
          padRight("Version", 10) +
          "Installed",
      );
      console.log("-".repeat(68));

      for (const inst of instances) {
        console.log(
          padRight(inst.appId, 24) +
            padRight(inst.status, 14) +
            padRight(inst.version, 10) +
            formatDate(inst.installedAt),
        );
      }
    });

  app
    .command("browse")
    .description("Browse available apps in the catalog")
    .option("-c, --category <cat>", "Filter by category")
    .action(async (opts: { category?: string }) => {
      const { listAppCatalog } = await import("../service");
      const apps = listAppCatalog({ category: opts.category });

      if (apps.length === 0) {
        console.log("No apps found.");
        return;
      }

      console.log(
        padRight("ID", 24) +
          padRight("Category", 14) +
          padRight("Difficulty", 14) +
          padRight("Tables", 8) +
          "Installed",
      );
      console.log("-".repeat(72));

      for (const app of apps) {
        console.log(
          padRight(app.appId, 24) +
            padRight(app.category, 14) +
            padRight(app.difficulty, 14) +
            padRight(String(app.tableCount), 8) +
            (app.installed ? "yes" : "no"),
        );
      }
    });

  app
    .command("enable")
    .description("Enable a disabled app")
    .argument("<app-id>", "App ID to enable")
    .action(async (appId: string) => {
      const { setAppInstanceStatus } = await import("../service");
      try {
        const inst = setAppInstanceStatus(appId, "ready");
        console.log(`Enabled "${inst.name}" (${inst.appId})`);
      } catch (e) {
        console.error(e instanceof Error ? e.message : "Enable failed");
        process.exit(1);
      }
    });

  app
    .command("disable")
    .description("Disable an installed app")
    .argument("<app-id>", "App ID to disable")
    .action(async (appId: string) => {
      const { setAppInstanceStatus } = await import("../service");
      try {
        const inst = setAppInstanceStatus(appId, "disabled");
        console.log(`Disabled "${inst.name}" (${inst.appId})`);
      } catch (e) {
        console.error(e instanceof Error ? e.message : "Disable failed");
        process.exit(1);
      }
    });

  app
    .command("uninstall")
    .description("Uninstall an app")
    .argument("<app-id>", "App ID to uninstall")
    .action(async (appId: string) => {
      const { uninstallApp } = await import("../service");
      try {
        uninstallApp(appId);
        console.log(`Uninstalled "${appId}"`);
      } catch (e) {
        console.error(e instanceof Error ? e.message : "Uninstall failed");
        process.exit(1);
      }
    });

  return app;
}

// ── Helpers ──────────────────────────────────────────────────────────

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len - 1) + " " : str + " ".repeat(len - str.length);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
