/**
 * `stagent app pack` — create a distributable .sap tarball.
 *
 * Steps:
 * 1. Run validate (fail on errors)
 * 2. Security scan (reject forbidden paths and secrets)
 * 3. Create gzipped tarball
 */

import { createReadStream, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import * as tar from "tar";
import { createHash } from "crypto";
import { validateSapDirectory } from "./validate";
import * as yaml from "js-yaml";

// ── Security scanner ─────────────────────────────────────────────────

const FORBIDDEN_PATHS = [
  ".env",
  ".git",
  "node_modules",
  ".DS_Store",
];

const FORBIDDEN_EXTENSIONS = [
  ".db",
  ".sqlite",
  ".log",
];

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /ANTHROPIC_API_KEY\s*=/,
  /OPENAI_API_KEY\s*=/,
  /ghp_[a-zA-Z0-9]{36}/,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  /password\s*[:=]\s*["'][^"']+["']/i,
];

export interface SecurityScanResult {
  clean: boolean;
  issues: string[];
}

function collectFiles(dir: string, base = ""): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectFiles(join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

export function scanForSecrets(dir: string): SecurityScanResult {
  const issues: string[] = [];
  const files = collectFiles(dir);

  for (const file of files) {
    const parts = file.split("/");

    // Check forbidden paths
    for (const part of parts) {
      if (FORBIDDEN_PATHS.some((fp) => part === fp || part.startsWith(`${fp}.`))) {
        issues.push(`Forbidden path: ${file}`);
      }
    }

    // Check forbidden extensions
    if (FORBIDDEN_EXTENSIONS.some((ext) => file.endsWith(ext))) {
      issues.push(`Forbidden file type: ${file}`);
    }

    // Scan text files for secrets
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.size > 1024 * 1024) continue; // Skip files > 1MB
    if (file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".gif")) continue;

    try {
      const content = readFileSync(fullPath, "utf-8");
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          issues.push(`Potential secret in ${file}: matches ${pattern.source.slice(0, 30)}...`);
        }
      }
    } catch {
      // Binary file or read error — skip
    }
  }

  return { clean: issues.length === 0, issues };
}

// ── Packing ──────────────────────────────────────────────────────────

export interface PackResult {
  tarballPath: string;
  checksumPath: string;
  checksum: string;
  fileCount: number;
  sizeBytes: number;
}

export async function packSapDirectory(
  dir: string,
  outDir?: string,
): Promise<PackResult> {
  // 1. Validate
  const validation = validateSapDirectory(dir);
  if (!validation.valid) {
    throw new Error(
      `Validation failed:\n${validation.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  // 2. Security scan
  const security = scanForSecrets(dir);
  if (!security.clean) {
    throw new Error(
      `Security scan failed:\n${security.issues.map((i) => `  - ${i}`).join("\n")}`,
    );
  }

  // 3. Read manifest for naming
  const manifest = yaml.load(
    readFileSync(join(dir, "manifest.yaml"), "utf-8"),
  ) as { id: string; version: string };

  const tarballName = `${manifest.id}-${manifest.version}.sap.tar.gz`;
  const outputDir = outDir ?? process.cwd();
  const tarballPath = join(outputDir, tarballName);
  const checksumPath = join(outputDir, `${manifest.id}-${manifest.version}.sap.sha256`);

  // 4. Create tarball
  const files = collectFiles(dir);
  await tar.create(
    { gzip: true, file: tarballPath, cwd: dir },
    files,
  );

  // 5. Calculate checksum
  const hash = createHash("sha256");
  const stream = createReadStream(tarballPath);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  const checksum = hash.digest("hex");

  // Write checksum file
  const stat = statSync(tarballPath);
  const checksumContent = `${checksum}  ${tarballName}\n`;
  writeFileSync(checksumPath, checksumContent);

  return {
    tarballPath,
    checksumPath,
    checksum,
    fileCount: files.length,
    sizeBytes: stat.size,
  };
}
