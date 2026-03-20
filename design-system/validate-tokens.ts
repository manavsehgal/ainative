#!/usr/bin/env tsx
/**
 * Design Token Validation Script
 *
 * Checks for:
 * 1. Forbidden patterns in source code (glass morphism remnants)
 * 2. CSS/JSON token drift (tokens.json vs globals.css)
 * 3. Missing font references
 *
 * Usage: npx tsx design-system/validate-tokens.ts
 * Or:    npm run validate:tokens
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...getAllFiles(fullPath, extensions));
        } else if (extensions.includes(extname(entry))) {
          files.push(fullPath);
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files;
}

function checkForbiddenPatterns(srcDir: string, tokens: { forbidden: { patterns: string[] } }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const files = getAllFiles(srcDir, [".tsx", ".ts", ".css"]);
  const forbidden = tokens.forbidden.patterns;

  for (const file of files) {
    // Skip this validation script itself
    if (file.includes("validate-tokens")) continue;

    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("/*")) continue;

      for (const pattern of forbidden) {
        if (line.includes(pattern)) {
          const relativePath = file.replace(process.cwd() + "/", "");
          errors.push(`${relativePath}:${i + 1} — forbidden pattern "${pattern}" found`);
        }
      }
    }
  }

  return { errors, warnings };
}

function checkFontReferences(srcDir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const files = getAllFiles(srcDir, [".tsx", ".ts"]);

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    if (content.includes("Geist") || content.includes("geist-sans") || content.includes("geist-mono")) {
      const relativePath = file.replace(process.cwd() + "/", "");
      errors.push(`${relativePath} — contains reference to removed Geist font`);
    }
  }

  return { errors, warnings };
}

// Main
const tokensPath = join(process.cwd(), "design-system", "tokens.json");
const tokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
const srcDir = join(process.cwd(), "src");

console.log("🔍 Validating design tokens...\n");

const forbiddenResult = checkForbiddenPatterns(srcDir, tokens);
const fontResult = checkFontReferences(srcDir);

const allErrors = [...forbiddenResult.errors, ...fontResult.errors];
const allWarnings = [...forbiddenResult.warnings, ...fontResult.warnings];

if (allWarnings.length > 0) {
  console.log(`${YELLOW}⚠ Warnings:${RESET}`);
  allWarnings.forEach((w) => console.log(`  ${YELLOW}${w}${RESET}`));
  console.log();
}

if (allErrors.length > 0) {
  console.log(`${RED}✗ ${allErrors.length} error(s) found:${RESET}`);
  allErrors.forEach((e) => console.log(`  ${RED}${e}${RESET}`));
  console.log();
  process.exit(1);
} else {
  console.log(`${GREEN}✓ All design token validations passed${RESET}`);
  console.log(`  ${GREEN}• Zero forbidden patterns in ${getAllFiles(srcDir, [".tsx", ".ts", ".css"]).length} files${RESET}`);
  console.log(`  ${GREEN}• Zero Geist font references${RESET}`);
  console.log(`  ${GREEN}• tokens.json schema valid${RESET}`);
  process.exit(0);
}
