---
title: "Document Processing"
subtitle: "Unstructured Input to Structured Knowledge"
chapter: 3
part: 1
readingTime: 14
relatedDocs: [documents, shared-components]
---

# Document Processing

## The Problem

Every business runs on documents. Contracts, invoices, meeting notes, research papers, design specs, customer feedback surveys -- the knowledge that drives decisions lives not in tidy database rows but in PDFs, Word documents, spreadsheets, and plain text files scattered across file systems and cloud drives.

For human workers, this is manageable. We open a PDF, read it, and extract what we need. But for AI agents, these formats are opaque walls. An agent asked to summarize a project's requirements cannot read the Word document sitting in a shared drive. A task-execution agent cannot reference last quarter's financial report if it is locked inside an Excel file. The knowledge is there. The agent simply cannot see it.

This is the fundamental bottleneck of enterprise AI adoption. Organizations pour resources into fine-tuning models and crafting elaborate prompts, while ignoring the simpler problem: their agents are blind to 90% of the organization's knowledge.

> [!info]
> **The Knowledge Gap**
> Most organizations have more knowledge locked in documents than in databases. The first step toward AI-native operations is not better models or smarter prompts -- it is making existing knowledge accessible to agents in a format they can reason over.

I had experienced this firsthand building Stagent's earlier sprints. The task execution engine was powerful -- agents could read databases, call APIs, write code. But the moment a user attached a PDF to a task, the agent hit a wall. It could see the file path. It could not read the content. The gap between "the file exists" and "the agent understands the file" was where productivity went to die.

The industry has responded with increasingly complex solutions. LangChain's document loaders provide a framework for ingesting dozens of formats. Unstructured.io offers a hosted API for parsing everything from HTML to images. Vector databases like Pinecone and Weaviate power RAG (Retrieval-Augmented Generation) pipelines that index chunks of text for semantic search. These are impressive tools. They are also, for most applications, more infrastructure than you need.

Stagent's document processing pipeline takes a different path: a simple, format-agnostic extraction layer that converts unstructured input into plain text and stores it alongside the original file in SQLite. No vector embeddings. No external services. No complex chunking strategies. Just text that agents can read.

## The Processing Pipeline

The architecture follows a three-stage pattern that should look familiar to anyone who has built an ETL pipeline: **Upload**, **Extract**, **Index**. The twist is that "index" here means "write the extracted text back to the same database row" -- because when your entire knowledge base fits in a single SQLite database, you do not need a separate search index.

The pipeline starts with the processor orchestrator. This module coordinates the entire extraction flow: it looks up the right format handler, runs it against the uploaded file, and persists the results (or the error) back to the database.

<!-- filename: src/lib/documents/processor.ts -->
```typescript
export async function processDocument(documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) return;

  // Mark as processing
  await db
    .update(documents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  const processor = getProcessor(doc.mimeType);

  if (!processor) {
    await db
      .update(documents)
      .set({
        status: "ready",
        extractedText: null,
        processingError: `No processor for MIME type: ${doc.mimeType}`,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
    return;
  }

  try {
    const result = await processor(doc.storagePath);
    await db
      .update(documents)
      .set({
        status: "ready",
        extractedText: result.extractedText,
        processedPath: result.processedPath ?? null,
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await db
      .update(documents)
      .set({
        status: "error",
        processingError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
  }
}
```
*The processor orchestrator -- fire-and-forget with error capture in the database*

There are several design choices worth highlighting. First, the function takes a `documentId`, not a file path. The database is the single source of truth -- the processor fetches the file path, MIME type, and everything else it needs from the document record. Second, the function never throws. Every failure mode -- missing document, unsupported type, processor crash -- is captured as a status update or error message in the database. This is the "fire-and-forget" pattern we use throughout Stagent: the caller kicks off processing and moves on, while the UI polls the document status to show progress.

This pattern is a manifestation of what our book strategy calls **The Affordance of Structure**. By storing processing state in the database rather than in memory or log files, we make the pipeline observable to both humans (via the UI) and agents (via database queries). An agent can check whether a document has been processed before attempting to use it. The structure affords intelligence.

## Format-Specific Processors

The registry sits at the heart of the extraction layer. It maps MIME types to processor functions using a simple `Map`, with each processor responsible for a single concern: given a file path, return extracted text.

| Processor | Formats | Library | Output |
|-----------|---------|---------|--------|
| Text | .txt, .md, .json, .ts, .py, .html, .css, .yaml | Node fs | Raw file content |
| PDF | .pdf | pdf-parse v2 | Extracted text pages |
| Image | .png, .jpeg, .gif, .webp | image-size | Dimensions and metadata |
| Office | .docx, .pptx | mammoth, jszip | Structured text extraction |
| Spreadsheet | .xlsx, .csv | xlsx | Row/column text representation |

<!-- filename: src/lib/documents/registry.ts -->
```typescript
export interface ProcessorResult {
  extractedText: string;
  processedPath?: string;
}

export type Processor = (filePath: string) => Promise<ProcessorResult>;

const registry = new Map<string, Processor>();

export function registerProcessor(
  mimeType: string,
  processor: Processor
): void {
  registry.set(mimeType, processor);
}

export function getProcessor(
  mimeType: string
): Processor | undefined {
  return registry.get(mimeType);
}
```
*Registry pattern -- processors self-declare their supported MIME types*

The `ProcessorResult` interface is deliberately minimal: a string of extracted text and an optional processed file path. No metadata schemas, no structured output formats, no abstract syntax trees. Every document, regardless of its source format, becomes a flat string. This might seem reductive -- and it is. That is the point.

When I first designed this system, I was tempted to build rich typed outputs for each format. PDFs would return page-level segments with bounding boxes. Spreadsheets would return typed cell grids. Office documents would preserve heading hierarchies. This is what LangChain's document loaders do, and it is powerful for building search indices or citation systems.

But Stagent's agents do not need bounding boxes. They need text they can reason over. The flat-string design means every processor has an identical contract, every consumer can handle every format identically, and adding a new processor is a single function that returns `{ extractedText: string }`. The simplicity compounds.

> [!tip]
> **The Registry Pattern**
> Self-registration is a recurring pattern in Stagent. Agent profiles register their capabilities. Workflow steps register their handlers. Document processors register their MIME types. The pattern keeps the system extensible without requiring a central manifest -- adding a new capability means adding a new module that registers itself at import time.

In the processor module, registration happens imperatively at module load time. Text-based formats (plain text, Markdown, JSON, JavaScript, TypeScript, Python, HTML, CSS, YAML) all route to the same `processText` handler -- they are already readable as strings. PDF, image, office, and spreadsheet formats each get their own specialized handlers. This means adding support for a new format -- say, EPUB or RTF -- requires writing one function and adding one `registerProcessor` call. No configuration files, no plugin manifests, no factory patterns.

## Agent-Accessible Context

Extracting text is only half the job. The extracted content must flow into the agent's context window at execution time, formatted in a way that helps rather than hinders reasoning. This is where the context builder comes in.

The context builder takes a task ID, queries all input documents attached to that task, and assembles them into a formatted string that gets injected into the agent's prompt. It handles edge cases that trip up naive implementations: images get path references (since agents can use the Read tool to view them directly), in-progress documents get status notes, large documents get truncated with a pointer to the full content.

<!-- filename: src/lib/documents/context-builder.ts -->
```typescript
const MAX_INLINE_TEXT = 10_000;

function formatDocument(doc: DocumentRow, index: number): string {
  const header = `[Document ${index + 1}: ${doc.originalName}]`;
  const pathLine = `Path: ${doc.storagePath}`;

  const isImage = doc.mimeType.startsWith("image/");
  if (isImage) {
    const meta = doc.extractedText ? `\n${doc.extractedText}` : "";
    return `${header}\n${pathLine}\nType: ${doc.mimeType} (use Read tool to view)${meta}`;
  }

  if (doc.status === "processing") {
    return `${header}\n${pathLine}\nStatus: still processing — content not yet available`;
  }

  if (doc.extractedText) {
    if (doc.extractedText.length < MAX_INLINE_TEXT) {
      return `${header}\n${pathLine}\nContent:\n<document>\n${doc.extractedText}\n</document>`;
    }
    const truncated = doc.extractedText.slice(0, MAX_INLINE_TEXT);
    return `${header}\n${pathLine}\nContent (truncated to ${MAX_INLINE_TEXT} chars):\n<document>\n${truncated}\n</document>`;
  }

  return `${header}\n${pathLine}\nType: ${doc.mimeType} (use Read tool to access)`;
}

export async function buildDocumentContext(
  taskId: string
): Promise<string | null> {
  const docs = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.taskId, taskId), eq(documents.direction, "input"))
    );

  if (docs.length === 0) return null;

  const sections = docs.map((doc, i) => formatDocument(doc, i));
  return [
    "--- Attached Documents ---",
    "",
    ...sections,
    "",
    "--- End Attached Documents ---",
  ].join("\n");
}
```
*Context builder -- format documents for agent consumption with graceful truncation*

This is Stagent's version of RAG, and it is worth pausing to explain why it looks nothing like the RAG pipelines you see in tutorials. A typical RAG system chunks documents into overlapping segments, computes vector embeddings for each chunk, stores them in a vector database, and at query time retrieves the top-k most semantically similar chunks to inject into the prompt. It is elegant and powerful for large-scale knowledge bases.

Stagent does none of that. It queries documents by task ID (a foreign key lookup), sorts them, and concatenates the text. The "retrieval" is a SQL `WHERE` clause. The "augmentation" is string concatenation. The "generation" happens when the agent reads the prompt.

This is not laziness. It is a deliberate architectural choice driven by the scale of the problem. A typical Stagent task has between zero and ten attached documents. The total text rarely exceeds 50,000 characters. At this scale, semantic search adds latency and complexity without meaningful improvement in relevance -- the agent will read all the documents anyway. The 10,000-character inline limit and the truncation fallback are safety valves, not optimization strategies.

> [!lesson]
> **Simplicity Over Sophistication**
> At the scale of a single project's documents, a SQL query provides better retrieval than a vector database. You lose semantic similarity ranking but gain debuggability, zero additional infrastructure, and sub-millisecond response times. Start with the simplest retrieval that works and add complexity only when scale demands it. Most teams reach for vector databases before they have exhausted what a well-indexed relational query can do.

The industry's infatuation with vector databases has created a blind spot. I have watched teams spend weeks setting up Pinecone clusters and embedding pipelines for applications that serve hundreds of documents. The embedding computation alone costs more than the entire Stagent hosting budget. When I tell other developers that Stagent's RAG is just a SQL query, the reaction is usually disbelief followed by "wait, that actually works?"

It works because the problem is smaller than we think. Most AI applications do not need to search across millions of documents. They need to give an agent access to the five or ten documents relevant to the current task. For that, a foreign key is all the retrieval you need.

This connects to the **Feedback Loops as Intelligence** theme. When an agent processes a document and produces output, that output can itself become a document -- feeding back into the system for future tasks. The context builder does not distinguish between human-uploaded documents and agent-generated ones. They are all rows in the same table, all queryable by the same SQL, all injectable into the same context window. The loop closes naturally because the data model is uniform.

## Document Management UI

The processing pipeline is invisible to users. What they see is the document management interface: a page at `/documents` that presents their files in either a dense table view or a visual grid view. Both views surface the processing status -- uploaded, processing, ready, error -- so users can track extraction progress at a glance.

The upload dialog supports drag-and-drop and multi-file batch uploads. Behind the scenes, files land in `~/.stagent/uploads/`, get a database record with their original name and MIME type, and immediately trigger the processing pipeline. The user drops a PDF and watches the status flip from "uploaded" to "processing" to "ready" in seconds.

A sliding detail sheet shows individual document metadata: file size, MIME type, processing status, extraction preview, and the associated project or task. Bulk operations -- select multiple documents, delete them in one action -- keep the library manageable as it grows.

The UI follows Stagent's "Calm Ops" design system: opaque surfaces, border-centric elevation, and status chips that communicate state without demanding attention. A document in "processing" state gets a subtle animated indicator. An error state surfaces the processing error message inline, not in a modal that interrupts workflow.

[Try: Upload a Document](/documents)

## The Integration Story

What makes this pipeline meaningful is not any individual piece -- the processor, the registry, the context builder, or the UI are each straightforward. It is the integration between them that transforms document processing from a feature into a capability.

Here is the full path: a user drags a PDF into the upload dialog. The upload API writes the file to disk, creates a database record, and calls `processDocument(id)` fire-and-forget. The processor looks up the PDF handler, extracts text via pdf-parse, and writes it back to the database row. Later, when the user creates a task and attaches this document, the execution engine calls `buildDocumentContext(taskId)`. The context builder queries the document, finds the extracted text, formats it between `<document>` tags, and injects it into the agent's prompt. The agent reads the contract, summarizes the key terms, and writes its analysis as a task output.

Every step is a database operation. Every state transition is observable. Every failure is recoverable. The user can re-upload a failed document. The agent can check if extraction is complete before proceeding. The system self-heals because the database is the single source of truth.

This end-to-end traceability is what separates production AI from demo AI. In a demo, you paste text into a prompt and get a response. In production, you need to handle corrupt PDFs, unsupported formats, files that are too large, extraction that takes longer than expected, and agents that need to wait for processing to complete. The three-stage pipeline -- Upload, Extract, Index -- gives you a state machine with clear transitions and clear error handling at every stage.

## Lessons Learned

Building Stagent's document processing taught three lessons that apply to any AI-native system.

**Wire Everything End-to-End.** During Sprint 6, I built the processor, the registry, and the context builder as three separate modules. Each one had tests. Each one worked in isolation. But when I went to ship, none of them were wired together. The upload API did not call the processor. The execution engine did not call the context builder. I had built "code islands" -- fully implemented modules that were never imported by the code that needed them. The fix took an hour, but the lesson was permanent: a feature is not done when the code works. It is done when you can trace a path from user action to visible result through every layer of the stack.

**Schema Must Match Migration.** The documents table gained preprocessing columns (extractedText, processedPath, processingError) via a SQL migration file. But the Drizzle ORM schema was never updated to include these columns. The TypeScript types did not know the columns existed. The processor code that tried to write to those columns would have failed at runtime with inscrutable errors. The lesson: when you add columns via migration, update the schema in the same commit. ORM types are not just developer convenience -- they are your compile-time safety net.

**Preprocessing Is Not Optional.** My first implementation stored documents but skipped extraction. The plan was to add preprocessing "later." But without extracted text, documents were invisible to agents -- they could see file names but not content. Users uploaded documents expecting agents to understand them, and nothing happened. The feature was technically complete (you could upload and view documents) but functionally useless (agents could not read them). Preprocessing is not a nice-to-have optimization. It is the bridge between "the file exists" and "the agent can use it."

> [!warning]
> **The Integration Test**
> For every feature, ask: Can I trace a path from the user's action to the agent's response? If any link in the chain is missing -- the API does not call the processor, the processor does not write to the database, the context builder does not query the right table -- the feature is broken even if every module passes its unit tests.

These lessons reflect a broader truth about building AI-native applications. The interesting problems are rarely in the AI layer itself. They are in the plumbing: how data flows from user input through processing pipelines into agent context and back out as visible results. Get the plumbing right, and the AI layer almost works by itself. Get it wrong, and no amount of prompt engineering will save you.

The document processing pipeline is Stagent's simplest subsystem by line count. It is also the one that unlocked the most capability -- because it turned the application's biggest blind spot into its richest source of context. Every feature built after Sprint 6 could assume that agents had access to document content. That assumption, backed by a three-stage pipeline and a SQL query, changed what was possible.
