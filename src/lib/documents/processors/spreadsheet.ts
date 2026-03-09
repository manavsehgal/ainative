import { readFile } from "fs/promises";
import type { ProcessorResult } from "../registry";

/** Parse XLSX/CSV to a text table representation */
export async function processSpreadsheet(filePath: string): Promise<ProcessorResult> {
  const XLSX = await import("xlsx");
  const buffer = await readFile(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheets: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  return { extractedText: sheets.join("\n\n") };
}
