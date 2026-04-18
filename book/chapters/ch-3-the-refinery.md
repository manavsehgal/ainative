---
title: "The Refinery"
subtitle: "From Intent to Structured Work"
chapter: 3
part: 2
readingTime: 15
lastGeneratedBy: "2026-04-18T17:10:00.000Z"
relatedDocs: ["projects", "documents", "home-workspace"]
relatedJourney: "personal-use"
---

## The Intake Problem

Every factory has a front door. Raw materials arrive — steel coils, chemical feedstock, plastic pellets — and before anything useful can happen, someone has to inspect them, sort them, and transform them into a form the machines downstream can actually consume. Skip this step and the entire line jams.

Software organizations have the same problem, though we rarely name it. Work arrives as intent: a Slack message from the CEO ("we need to support SAML SSO by Q3"), a PDF spec from a partner, a screenshot of a competitor's feature, a rambling email thread with twelve participants and no clear ask. Before any of this becomes a task that an agent — or a human — can execute, it must be refined. The vague must become precise. The unstructured must become structured. The implicit must become explicit.

We call this the intake problem, and it is one of the most underappreciated bottlenecks in AI-native development. It does not matter how fast your agents can write code or how clever your workflow orchestration is. If the input to your system is garbage, the output will be too. The machine that builds machines needs clean fuel.

> [!case-study]
> **8090's Refinery Station**
> In George Miller's *Furiosa*, the Citadel's refinery is not glamorous. It is hot, dirty, and relentless — the place where crude oil becomes the fuel that powers everything else. The refinery does not build war rigs or grow crops. It transforms raw material into something the rest of the system can consume. This is the metaphor we keep returning to when we think about document intake. The refinery's job is not to be impressive. Its job is to be reliable — to ensure that no matter what arrives at the gate, something usable comes out the other side. Our intake pipeline aspires to exactly this quality: format-agnostic, fault-tolerant, and invisible when working correctly.

This is where the machine that builds machines begins its work — not with code generation or task execution, but with the quieter, less dramatic act of understanding what someone actually wants.

## Document Processing Pipeline

The first challenge is format diversity. Work does not arrive in a uniform format. In a single day, a `ainative-business` user might upload a PDF requirements document, paste a screenshot of a UI mockup, attach a Word document from legal review, drag in a spreadsheet of test cases, or simply type a paragraph of plain text. Each format encodes information differently, and an AI agent that cannot consume all of them is an AI agent that forces humans to do manual translation work — exactly the bottleneck we are trying to eliminate.

`ainative-business`'s document processing pipeline handles this through a processor registry pattern. Each file format gets a dedicated processor that knows how to extract meaningful text content. The registry dispatches automatically based on MIME type and file extension, so the upload path is identical regardless of what the user sends.

```typescript
// Building with ainative: Document intake pipeline
const formData = new FormData();
formData.append("file", pdfFile);
formData.append("projectId", "proj-8f3a-4b2c");

const doc = await fetch("/api/uploads", {
  method: "POST",
  body: formData,
}).then((r) => r.json());
// Processor auto-detects format, extracts text, stores in documents table
// Context builder injects extracted content into future agent prompts
```

Behind this simple API call, a chain of operations fires. The upload handler saves the raw file to `~/.`ainative-business`/uploads/`, then passes it to the processor registry. The registry inspects the MIME type and dispatches to the appropriate processor. Each processor does one thing well:

- **Text processor**: Handles `.txt`, `.md`, `.csv`, `.json`, and other plain-text formats. Reads the file directly. No transformation needed, but it normalizes line endings and encoding.
- **PDF processor**: Uses `pdf-parse` v2 to extract text layer content. PDFs are deceptively complex — some are text-backed, some are scanned images, some are a mix. The processor extracts what it can and records confidence metadata.
- **Image processor**: Uses `image-size` to extract dimensions and metadata. For screenshots and mockups, the real content extraction happens downstream when the image is passed to a multimodal agent as visual context.
- **Office processor**: Uses `mammoth` for Word documents and `jszip` for general Office XML formats. Strips formatting, extracts paragraph text, preserves heading structure.
- **Spreadsheet processor**: Uses `xlsx` to parse Excel and CSV files. Converts structured data into a text representation that preserves row-column relationships while remaining readable by a language model.

The key design decision was making this pipeline format-agnostic at the API layer. The caller never needs to know which processor will handle their file. They upload, and the system figures it out. This is not just a convenience — it is a reliability requirement. The moment you ask users to categorize their uploads or choose a processing mode, you have introduced a failure point. Users will choose wrong. The system should not need them to choose at all.

> [!case-study]
> **Stripe's CLAUDE.md — Structured Context as Code**
> Stripe's engineering team made headlines in early 2026 when their use of `CLAUDE.md` files became public. These are not documentation in the traditional sense. They are structured context files — rule files that tell AI agents how to behave within a specific codebase. Stripe's `CLAUDE.md` includes coding conventions, forbidden patterns, testing requirements, and architectural constraints. The insight is profound: the best way to give an agent context is not to describe your codebase in prose, but to encode your rules in a format the agent can consume directly. We adopted this pattern in `ainative-business` itself — our own `CLAUDE.md` is a machine-readable context file that agents reference during every task execution. The document is not written for humans to read during onboarding. It is written for agents to read during execution.

Each processor writes its output to the `extractedText` column in the documents table. If processing fails — a corrupted PDF, an encrypted spreadsheet, an image format we do not support — the error lands in `processingError` rather than crashing the upload. The raw file is always preserved. We can reprocess later when processors improve, and users never lose their original content.

## Context Injection

Extracted text sitting in a database column is useful but inert. The real value comes when that content reaches an agent at the right moment — when the agent working on a task receives the relevant documents as context without the user having to manually copy-paste or point to files.

This is the job of the context builder. When a task executes, the context builder queries all documents associated with the task's project. It assembles a structured context block that includes extracted text, document metadata (filename, upload date, processing status), and the project's working directory. This block is injected into the agent's system prompt alongside the task instructions.

The design is deliberately simple. We do not do semantic search over document embeddings. We do not build a RAG pipeline with vector similarity and reranking. We inject all relevant documents for the project, in full, into the agent's context window. With modern models supporting 200K+ token context windows, and most project document sets fitting comfortably under 50K tokens, the brute-force approach works remarkably well and eliminates an entire class of retrieval errors.

This is a deliberate architectural choice that reflects a broader principle: prefer simple, reliable mechanisms over clever, fragile ones. Semantic search introduces failure modes — relevant documents ranked low, irrelevant documents ranked high, embedding drift as document content changes. Full context injection has exactly one failure mode: the context window overflows. And that failure is obvious, predictable, and easy to handle with truncation strategies.

> [!case-study]
> **Ramp's Screenshot-Based Verification**
> Ramp's engineering team uses an approach they call "screenshot-based verification" — agents take screenshots of their own work and compare them against expected visual outcomes. This is context injection taken to the extreme: the agent does not just receive text documents, it receives visual evidence of the current state. The Ramp team reported that this technique caught UI regressions that text-based testing missed entirely. We found a similar dynamic in `ainative-business`'s image processing pipeline. When a user uploads a screenshot of a desired UI, the multimodal agent receives it as visual context during implementation tasks. The agent does not just read about what to build — it sees what to build. The gap between intent and understanding narrows dramatically.

## Project Decomposition

The final stage of the refinery is decomposition: turning a sentence of intent into a structured set of executable tasks. This is where the raw material — now processed, extracted, and contextualized — becomes the work product that flows downstream to the forge.

In `ainative-business`, a project is a container. It has a name, a description, a status, and a working directory. Tasks belong to projects. Documents belong to projects. When a user creates a project and uploads supporting documents, they have assembled the raw materials. The next step is breaking the project's objective into tasks.

This decomposition can happen manually — the user creates tasks one by one through the UI. But the AI-native path is more interesting. The user describes what they want in natural language, and an agent with the project's full context proposes a task breakdown. The agent considers the project description, all uploaded documents, the codebase structure (via the working directory), and any existing tasks. It proposes new tasks with titles, descriptions, priorities, and dependency relationships.

```typescript
// Building with ainative: Project creation with document context
const project = await fetch("/api/projects", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "SAML SSO Integration",
    description: "Add SAML SSO support for enterprise customers per partner spec",
    status: "active",
    workingDirectory: "/Users/dev/myapp",
  }),
}).then((r) => r.json());

// Upload the partner spec — processor extracts text automatically
const specForm = new FormData();
specForm.append("file", partnerSpecPdf);
specForm.append("projectId", project.id);
await fetch("/api/uploads", { method: "POST", body: specForm });

// Agent decomposes the project into tasks using full document context
const tasks = await fetch("/api/tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Decompose SAML SSO requirements into implementation tasks",
    projectId: project.id,
    assignedAgent: "claude-code",
    agentProfile: "project-manager",
    priority: 1,
  }),
}).then((r) => r.json());
```

The project manager profile is critical here. It is configured with read-only filesystem access — `Read`, `Grep`, `Glob` — so it can explore the codebase without modifying it. Its behavioral instructions in `SKILL.md` tell it to produce structured task breakdowns with acceptance criteria, dependency chains, and effort estimates. The profile's `tests` array verifies that decomposition outputs contain the expected structural elements.

This is the refinery's complete cycle: raw intent enters as a project description and a pile of documents. The processor pipeline extracts usable text. The context builder assembles it into agent-consumable context. And the decomposition agent transforms it into structured, executable tasks. What enters as "we need SAML by Q3" exits as a dependency graph of specific implementation tasks, each tagged with priority, profile, and acceptance criteria.

The machine that builds machines starts here — not with spectacular feats of code generation, but with the patient, reliable work of turning human intent into structured work.

## ainative Today

The refinery pipeline is fully operational in `ainative-business`'s current release. Here is what works today:

**Processor Registry**: Five format-specific processors (text, PDF, image, office, spreadsheet) dispatch automatically via MIME type detection. The registry lives in `src/lib/documents/registry.ts` with individual processors under `src/lib/documents/processors/`. Adding a new format requires implementing a single `DocumentProcessor` interface and registering it.

**Working Directory Binding**: Every project has an optional `workingDirectory` column. When an agent executes a task, it resolves its current working directory from the project's path, falling back to `process.cwd()`. This means the agent operates in the actual codebase the project targets — reading real files, understanding real directory structures.

**Document Manager UI**: The `/documents` route provides table and grid views for all uploaded documents. Users can filter by project, view processing status, inspect extracted text in a detail sheet, upload new documents via a dialog, and bulk-delete. The interface surfaces processing errors clearly so users know when a document needs attention.

**Context Builder Integration**: The context builder in `src/lib/documents/context-builder.ts` assembles document context for agent execution. It queries documents by project, formats extracted text with metadata headers, and produces a structured context block ready for prompt injection.

**Preprocessing Columns**: The documents table includes `extractedText`, `processedPath`, and `processingError` columns. These separate the concerns of raw storage, processed output, and error tracking — making it trivial to monitor pipeline health and reprocess failed documents.

## Roadmap Vision

The refinery handles files today, but work intent arrives through many more channels. The roadmap vision extends the intake pipeline to meet intent wherever it originates:

**Slack/Email/Ticket Ingestion**: Auto-intake from communication channels. A tagged Slack message becomes a project with context. An email thread becomes a document. A Jira or Linear ticket syncs bidirectionally. The refinery expands its front door from "file upload" to "anything that represents work intent."

**Semantic Chunking**: As project document sets grow beyond what fits in a single context window, we will add intelligent chunking that segments documents by topic and injects only the chunks relevant to the current task. This is the graduated path from brute-force injection to selective retrieval — but we will only add it when the simpler approach demonstrably breaks.

**Auto-Decomposition Triggers**: Today, decomposition requires explicit action — someone creates a task with a project-manager profile. In the future, uploading a requirements document to a project could automatically trigger decomposition, producing a proposed task graph that the user reviews and approves.

**Cross-Project Context**: Documents uploaded to one project sometimes contain information relevant to another. A company-wide style guide, an API specification shared across services, a compliance document that affects every project. Cross-project document linking would let the context builder pull from a shared document library, not just the current project.

The refinery's job is never done. As long as humans express intent in messy, unstructured, human ways — and they always will — there will be refinement work to do. The measure of success is not eliminating mess but handling it gracefully, reliably, and invisibly. The best refinery is the one nobody thinks about because it just works.
