/**
 * Extensible document processor registry.
 * Maps MIME types to processor functions for text extraction.
 */

export interface ProcessorResult {
  extractedText: string;
  processedPath?: string;
}

export type Processor = (filePath: string) => Promise<ProcessorResult>;

const registry = new Map<string, Processor>();

export function registerProcessor(mimeType: string, processor: Processor): void {
  registry.set(mimeType, processor);
}

export function getProcessor(mimeType: string): Processor | undefined {
  return registry.get(mimeType);
}

export function hasProcessor(mimeType: string): boolean {
  return registry.has(mimeType);
}
