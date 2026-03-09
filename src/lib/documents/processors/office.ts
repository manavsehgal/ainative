import { readFile } from "fs/promises";
import type { ProcessorResult } from "../registry";

/** Extract text from DOCX files using mammoth */
export async function processDocx(filePath: string): Promise<ProcessorResult> {
  const mammoth = await import("mammoth");
  const buffer = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return { extractedText: result.value };
}

/** Extract text from PPTX files by parsing the XML slide contents */
export async function processPptx(filePath: string): Promise<ProcessorResult> {
  const JSZip = (await import("jszip")).default;
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);

  const slideTexts: string[] = [];
  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort();

  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async("text");
    // Extract text between <a:t> tags
    const texts = xml.match(/<a:t>([^<]*)<\/a:t>/g);
    if (texts) {
      const slideText = texts
        .map((t) => t.replace(/<\/?a:t>/g, ""))
        .join(" ");
      slideTexts.push(slideText);
    }
  }

  return { extractedText: slideTexts.join("\n\n") };
}
