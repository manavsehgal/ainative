/**
 * Shared utilities for environment parsers.
 */

import { createHash } from "crypto";
import { readFileSync, statSync, type Stats } from "fs";

const MAX_HASH_BYTES = 10240; // 10KB
const MAX_PREVIEW_CHARS = 500;

/** SHA-256 of the first 10KB of content. */
export function computeHash(content: string): string {
  const truncated = content.slice(0, MAX_HASH_BYTES);
  return createHash("sha256").update(truncated).digest("hex");
}

/** First 500 chars, trimmed. */
export function safePreview(content: string): string {
  return content.slice(0, MAX_PREVIEW_CHARS).trim();
}

/** Safe stat — returns null instead of throwing. */
export function safeStat(path: string): Stats | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

/** Safe file read — returns null instead of throwing. */
export function safeReadFile(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/** Check if a file is likely binary by checking for null bytes in first 512 bytes. */
export function isBinaryFile(path: string): boolean {
  try {
    const fd = require("fs").openSync(path, "r");
    const buf = Buffer.alloc(512);
    const bytesRead = require("fs").readSync(fd, buf, 0, 512, 0);
    require("fs").closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return true; // Treat unreadable files as binary
  }
}
