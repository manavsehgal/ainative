import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getStagentScreenshotsDir } from "@/lib/utils/stagent-paths";
import type { ScreenshotAttachment } from "@/lib/chat/types";

const MAX_BASE64_BYTES = 20 * 1024 * 1024; // 20MB
const THUMBNAIL_WIDTH = 800;

/** Tool names that produce screenshots */
export const SCREENSHOT_TOOL_NAMES = new Set([
  "mcp__chrome-devtools__take_screenshot",
  "mcp__playwright__browser_take_screenshot",
]);

interface PersistOptions {
  conversationId?: string;
  messageId?: string;
  taskId?: string;
  projectId?: string;
  toolName: string;
}

/**
 * Persist a base64-encoded screenshot to disk and the documents table.
 * Returns attachment metadata for SSE/metadata, or null on any failure.
 * Never throws — all errors are caught and logged.
 */
export async function persistScreenshot(
  base64Data: string,
  opts: PersistOptions
): Promise<ScreenshotAttachment | null> {
  const screenshotsDir = getStagentScreenshotsDir();
  const id = randomUUID();
  const originalPath = join(screenshotsDir, `${id}.png`);
  let thumbnailPath: string | null = null;

  try {
    // Validate size
    if (base64Data.length > MAX_BASE64_BYTES) {
      console.warn(
        `[screenshots] Rejecting oversized screenshot (${(base64Data.length / 1024 / 1024).toFixed(1)}MB) from ${opts.toolName}`
      );
      return null;
    }

    // Decode
    const buffer = Buffer.from(base64Data, "base64");

    // Extract dimensions
    const { imageSize } = await import("image-size");
    const dimensions = imageSize(new Uint8Array(buffer));
    const width = dimensions.width ?? 0;
    const height = dimensions.height ?? 0;

    // Ensure directory exists
    mkdirSync(screenshotsDir, { recursive: true });

    // Write original
    writeFileSync(originalPath, buffer);

    // Generate thumbnail (optional — sharp may not be available)
    thumbnailPath = join(screenshotsDir, `${id}_thumb.png`);
    try {
      const sharp = (await import("sharp")).default;
      await sharp(buffer)
        .resize(THUMBNAIL_WIDTH, undefined, { withoutEnlargement: true })
        .png({ quality: 80 })
        .toFile(thumbnailPath);
    } catch {
      // sharp unavailable or failed — serve original as thumbnail
      thumbnailPath = null;
    }

    // Insert document record
    const now = new Date();
    await db.insert(documents).values({
      id,
      taskId: opts.taskId ?? null,
      projectId: opts.projectId ?? null,
      conversationId: opts.conversationId ?? null,
      messageId: opts.messageId ?? null,
      filename: `${id}.png`,
      originalName: `screenshot-${id.slice(0, 8)}.png`,
      mimeType: "image/png",
      size: buffer.length,
      storagePath: originalPath,
      processedPath: thumbnailPath,
      version: 1,
      direction: "output",
      category: "screenshot",
      status: "ready",
      source: "screenshot",
      extractedText: `Image: ${width}x${height}\nFormat: png`,
      createdAt: now,
      updatedAt: now,
    });

    const thumbnailUrl = `/api/documents/${id}/file?inline=1&thumb=1`;
    const originalUrl = `/api/documents/${id}/file?inline=1`;

    return { documentId: id, thumbnailUrl, originalUrl, width, height };
  } catch (err) {
    console.error("[screenshots] Failed to persist screenshot:", err);
    // Cleanup orphan files
    try { unlinkSync(originalPath); } catch { /* ignore */ }
    if (thumbnailPath) {
      try { unlinkSync(thumbnailPath); } catch { /* ignore */ }
    }
    return null;
  }
}
