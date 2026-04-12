import type { Sanitizer } from "./types";
import { keepSanitizer } from "./keep";
import { redactSanitizer } from "./redact";
import { randomizeSanitizer } from "./randomize";
import { shiftSanitizer } from "./shift";
import { fakerSanitizer } from "./faker";
import { deriveSanitizer } from "./derive";
import { hashSanitizer } from "./hash";

export type { Sanitizer, SanitizeContext, SanitizationRule, TableSanitizationConfig, SeedDataConfig } from "./types";

const SANITIZERS: Record<string, Sanitizer> = {
  keep: keepSanitizer,
  redact: redactSanitizer,
  randomize: randomizeSanitizer,
  shift: shiftSanitizer,
  faker: fakerSanitizer,
  derive: deriveSanitizer,
  hash: hashSanitizer,
};

export function getSanitizer(name: string): Sanitizer {
  const sanitizer = SANITIZERS[name];
  if (!sanitizer) {
    throw new Error(`Unknown sanitizer strategy: "${name}". Available: ${Object.keys(SANITIZERS).join(", ")}`);
  }
  return sanitizer;
}

export function listSanitizers(): string[] {
  return Object.keys(SANITIZERS);
}

/** Default strategy for columns not listed in sanitization rules */
export const DEFAULT_STRATEGY = "redact";
