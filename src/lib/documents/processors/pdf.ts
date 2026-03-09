import { readFile } from "fs/promises";
import type { ProcessorResult } from "../registry";

/** Extract text from PDF files using pdf-parse v2 */
export async function processPdf(filePath: string): Promise<ProcessorResult> {
  const { PDFParse } = await import("pdf-parse");
  const buffer = await readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return { extractedText: result.text };
}
