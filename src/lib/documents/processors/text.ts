import { readFile } from "fs/promises";
import type { ProcessorResult } from "../registry";

/** Read plain text, markdown, code, and config files directly */
export async function processText(filePath: string): Promise<ProcessorResult> {
  const content = await readFile(filePath, "utf-8");
  return { extractedText: content };
}
