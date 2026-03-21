---
title: Document Preprocessing
status: completed
priority: P2
milestone: post-mvp
dependencies:
  - file-attachment-data-layer
---

# Document Preprocessing

## Description

Async processing pipeline to extract text and convert file formats for Claude API compatibility. When files are uploaded, they are processed in the background to extract searchable text and prepare content for agent consumption. Supports images, PDFs, plain text, Office documents, and spreadsheets.

**Claude API native support (4.5/4.6):** images (JPEG/PNG/GIF/WebP, 5MB), PDFs (32MB, 100 pages), plain text. Office formats (docx/pptx/xlsx) require text extraction.

## User Story

As a user, I want my uploaded documents to be automatically processed so that agents can read and understand their contents, regardless of the file format.

## Technical Approach

### Schema Extension

- Documents table gains columns: `extractedText`, `processedPath`, `processingError`
- Status transitions: `uploaded → processing → ready → failed`

### Processing Pipeline

- Upload API triggers async processing (fire-and-forget pattern matching task execution)
- Extensible registry pattern: `Map<string, Processor>` keyed by MIME type
- Processing errors captured in DB `processingError` column, never thrown

### Processors

| Processor | Formats | Package | Approach |
|-----------|---------|---------|----------|
| Image | JPEG, PNG, GIF, WebP | `image-size` | Validate format, extract dimensions metadata |
| PDF | PDF | `pdf-parse` | Extract text content |
| Text | .txt, .md, .json, .yaml, .ts, .js, .css, .html | built-in | Read file directly as text |
| Office | .docx, .pptx | `mammoth` (docx), XML parse (pptx) | Extract text content |
| Spreadsheet | .xlsx, .csv | `xlsx` | Parse to text table representation |

### Architecture

```
Upload API → save file → create document record (status: uploaded)
         → fire-and-forget: processDocument(docId)
              → registry.getProcessor(mimeType)
              → processor.extract(filePath) → extractedText
              → update document record (status: ready)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/documents/processor.ts` | Pipeline orchestrator |
| `src/lib/documents/registry.ts` | Processor registry (Map<mimeType, Processor>) |
| `src/lib/documents/processors/image.ts` | Image validation and dimension extraction |
| `src/lib/documents/processors/pdf.ts` | PDF text extraction via pdf-parse |
| `src/lib/documents/processors/text.ts` | Plain text/code file reader |
| `src/lib/documents/processors/office.ts` | DOCX/PPTX text extraction |
| `src/lib/documents/processors/spreadsheet.ts` | XLSX/CSV to text table |

## Acceptance Criteria

- [ ] Documents table has `extractedText`, `processedPath`, `processingError` columns
- [ ] Upload API triggers async processing (fire-and-forget pattern)
- [ ] Status transitions: uploaded → processing → ready/failed
- [ ] Image processor validates format and extracts dimensions
- [ ] PDF processor extracts text via `pdf-parse`
- [ ] Text processor reads .txt, .md, .json, .yaml, .ts, .js, .css, .html directly
- [ ] Office processor extracts text from .docx (mammoth) and .pptx (XML parse)
- [ ] Spreadsheet processor parses .xlsx/.csv to text representation
- [ ] Extensible registry pattern: `Map<string, Processor>` keyed by MIME type
- [ ] Processing errors captured in DB, not thrown

## Scope Boundaries

**Included:**
- Text extraction from supported formats
- Image dimension metadata extraction
- Async fire-and-forget processing
- Error capture per document

**Excluded:**
- OCR for scanned images/PDFs
- Video/audio processing
- Cloud-based conversion services
- Real-time processing progress UI
