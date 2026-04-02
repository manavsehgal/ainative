import { readFile } from "fs/promises";
import type { ProcessorResult } from "../registry";

/** Parse XLSX/CSV to a text table representation */
export async function processSpreadsheet(filePath: string): Promise<ProcessorResult> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await readFile(filePath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheets: string[] = [];
  workbook.eachSheet((worksheet) => {
    const rows: string[] = [];
    worksheet.eachRow((row) => {
      const values = (row.values as (string | number | null | undefined)[]).slice(1); // ExcelJS is 1-indexed
      rows.push(values.map((v) => (v ?? "").toString()).join(","));
    });
    sheets.push(`--- Sheet: ${worksheet.name} ---\n${rows.join("\n")}`);
  });

  return { extractedText: sheets.join("\n\n") };
}
