import { readFile } from "fs/promises";
import type { ProcessorResult } from "../registry";

const SUPPORTED_FORMATS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

/** Extract image dimensions metadata — agents use the file path to view images */
export async function processImage(filePath: string): Promise<ProcessorResult> {
  const { imageSize } = await import("image-size");
  const buffer = await readFile(filePath);
  const dimensions = imageSize(new Uint8Array(buffer));

  if (dimensions.type && !SUPPORTED_FORMATS.has(dimensions.type)) {
    throw new Error(`Unsupported image format: ${dimensions.type}`);
  }

  const meta = [
    `Image: ${dimensions.width}x${dimensions.height}`,
    `Format: ${dimensions.type}`,
  ].join("\n");
  return { extractedText: meta };
}
