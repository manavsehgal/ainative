export interface MemoryExtractionResult {
  category: "fact" | "preference" | "pattern" | "outcome";
  content: string;
  tags: string[];
  confidence: number; // 0-1 scale (converted to 0-1000 for DB)
}
