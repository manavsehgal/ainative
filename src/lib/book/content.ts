import type { Book, BookChapter, BookPart } from "./types";

/** Mapping from chapter ID to markdown filename slug (without ch-N- prefix) */
const CHAPTER_SLUG_MAP: Record<string, string> = {
  "ch-1": "ch-1-project-management",
  "ch-2": "ch-2-task-execution",
  "ch-3": "ch-3-document-processing",
  "ch-4": "ch-4-workflow-orchestration",
  "ch-5": "ch-5-scheduled-intelligence",
  "ch-6": "ch-6-agent-self-improvement",
  "ch-7": "ch-7-multi-agent-swarms",
  "ch-8": "ch-8-human-in-the-loop",
  "ch-9": "ch-9-the-autonomous-organization",
};

/** The three parts of the AI Native book */
export const PARTS: BookPart[] = [
  {
    number: 1,
    title: "Foundation",
    description: "Operations — from manual processes to AI-assisted automation",
  },
  {
    number: 2,
    title: "Intelligence",
    description: "Workflows & Learning — adaptive systems that improve over time",
  },
  {
    number: 3,
    title: "Autonomy",
    description: "Advanced Patterns — fully delegated business processes",
  },
];

export const CHAPTERS: BookChapter[] = [
  {
    id: "ch-1",
    number: 1,
    title: "Project Management",
    subtitle: "From Manual Planning to Autonomous Sprint Planning",
    part: PARTS[0],
    readingTime: 12,
    relatedDocs: ["projects", "home-workspace", "dashboard-kanban"],
    relatedJourney: "personal-use",
    sections: [
      {
        id: "ch-1-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `Every software project begins with planning. For decades, the cycle has been the same: a product manager writes tickets, assigns them to engineers, and tracks progress through standups and status updates. The process works—until it doesn't.\n\nAt scale, manual planning becomes the bottleneck. Sprint planning meetings consume hours. Ticket grooming is perpetually behind. Dependencies between tasks go untracked until they cause blocked sprints. And the cognitive load of keeping everything in your head—the priorities, the blockers, the capacity constraints—burns out even the most organized teams.\n\nStagent started here, in this exact pain point. The question wasn't whether AI could help with project management—it was whether AI could *own* it.`,
          },
          {
            type: "callout",
            variant: "lesson",
            title: "The Meta Insight",
            markdown:
              "Stagent is building itself using itself. Every pattern described in this book was developed, tested, and refined using the very tool it documents.",
          },
          {
            type: "callout",
            variant: "authors-note",
            title: "Author\u2019s Note",
            markdown:
              "This screenshot shows Stagent generating the very book components you\u2019re reading right now. The code-generation workflow that built this reader was itself managed as a Stagent project.",
            imageSrc: "/book/authors-notes/code-generation-book-components.png",
            imageAlt: "Stagent generating book reader components via code-generation workflow",
            defaultCollapsed: true,
          },
        ],
      },
      {
        id: "ch-1-solution",
        title: "The AI-Native Approach",
        content: [
          {
            type: "text",
            markdown: `The solution isn't to bolt AI onto existing project management tools. It's to rethink the entire workflow with AI as a first-class participant.\n\nIn a traditional setup, the human is the orchestrator:\n\n> Human → creates tasks → assigns agents → monitors progress → adjusts plan\n\nIn an AI-native setup, the human is the *system designer*:\n\n> Human → defines objectives and constraints → AI plans sprints → AI assigns and executes → Human reviews and adjusts guardrails\n\nThis is the fundamental shift from **executor** to **architect**.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/agents/profiles/general.ts",
            code: `export const generalProfile: AgentProfile = {
  id: "general",
  name: "General Assistant",
  description: "Versatile agent for planning, analysis, and execution",
  systemPrompt: \`You are a project management assistant.
    Break down objectives into actionable tasks.
    Consider dependencies and priorities.
    Flag risks and blockers proactively.\`,
  capabilities: ["planning", "analysis", "code-review"],
  constraints: {
    maxTokensPerTurn: 4096,
    requiresApproval: ["delete", "deploy"],
  },
};`,
            caption: "Agent profile configuration — the building block of AI-native project management",
          },
        ],
      },
      {
        id: "ch-1-implementation",
        title: "Implementation",
        content: [
          {
            type: "text",
            markdown: `Stagent's project management automation is built on three pillars:\n\n1. **Structured Data** — Projects, tasks, and workflows stored in SQLite with explicit schemas\n2. **Agent Profiles** — Specialized AI personalities with defined capabilities and constraints\n3. **Human-in-the-Loop** — Approval gates at critical decision points\n\nThe database schema is the foundation. Without explicit, queryable structure, AI agents can't reason about the state of a project.`,
          },
          {
            type: "code",
            language: "sql",
            filename: "src/lib/db/migrations/0001_init.sql",
            code: `CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  workingDirectory TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  projectId TEXT REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  priority TEXT DEFAULT 'P2',
  agentProfile TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);`,
            caption: "The schema that makes AI-native project management possible",
          },
          {
            type: "callout",
            variant: "tip",
            title: "The Affordance of Structure",
            markdown:
              "AI agents work best when database schemas are explicit and queryable, business logic is separated from UI logic, and permissions are declarative. Structure isn't overhead — it's the API surface your agents consume.",
          },
        ],
      },
      {
        id: "ch-1-lessons",
        title: "Lessons Learned",
        content: [
          {
            type: "text",
            markdown: `### Start with the Schema, Not the Agent\n\nOur first attempt put the agent first: "Here's a smart AI, let it figure out the project structure." It produced creative but inconsistent results. Tasks had no standard fields. Priorities were expressed as prose. Dependencies were implicit.\n\nThe breakthrough came when we flipped the approach: design the data model first, then give the agent a structured API to work with. The agent became dramatically more reliable when it could *insert a row* instead of *generate free-form text*.\n\n### Progressive Autonomy Works\n\nWe didn't go from manual to autonomous in one step. The progression was:\n\n1. **Manual**: Human creates every task\n2. **Assisted**: AI suggests tasks, human approves\n3. **Delegated**: AI creates tasks, human reviews\n4. **Autonomous**: AI plans entire sprints, human sets objectives\n\nEach step required building trust through demonstrated reliability.`,
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: Create a Project",
            description: "See AI-assisted project planning in action — create a new project and watch the agent suggest a task breakdown.",
            href: "/projects",
          },
        ],
      },
    ],
  },
  {
    id: "ch-2",
    number: 2,
    title: "Task Execution",
    subtitle: "Single-Agent to Multi-Agent Task Orchestration",
    part: PARTS[0],
    readingTime: 15,
    relatedDocs: ["agent-intelligence", "profiles", "monitoring"],
    relatedJourney: "work-use",
    sections: [
      {
        id: "ch-2-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `Once you have a plan, someone—or something—needs to execute it. In traditional software development, execution means a human reading a ticket, understanding the context, writing code, and submitting a pull request.\n\nThe first generation of AI coding assistants operated as *pair programmers*: you sit next to them, describe what you want, and they generate code. Better than typing it yourself, but fundamentally still a one-human-one-agent pattern.\n\nThe question Stagent asked was: what if execution didn't require a human in the loop at all?`,
          },
          {
            type: "callout",
            variant: "warning",
            title: "The Autonomy Trap",
            markdown:
              "Full autonomy without guardrails is reckless. The goal isn't to remove humans—it's to move them from **executor** to **supervisor**. Every autonomous action should be auditable, reversible, and bounded.",
          },
        ],
      },
      {
        id: "ch-2-solution",
        title: "Multi-Agent Routing",
        content: [
          {
            type: "text",
            markdown: `The answer is multi-agent routing. Instead of one general-purpose agent handling everything, Stagent maintains a registry of specialized agent profiles. A task classifier examines each incoming task and routes it to the most appropriate agent.\n\nThe routing isn't magic—it's pattern matching on structured data. A task with "review" in its description gets routed to the code-reviewer profile. A task requiring research goes to the researcher. Document generation tasks go to the document-writer.\n\nThis specialization dramatically improves output quality. A code review agent has different system prompts, temperature settings, and tool access than a research agent. Each profile is tuned for its specific domain.`,
          },
          {
            type: "callout",
            variant: "info",
            title: "Four Agent Profiles",
            markdown:
              "Stagent ships with four built-in profiles: **General Assistant** (planning & analysis), **Code Reviewer** (PR reviews & quality), **Researcher** (deep investigation), and **Document Writer** (structured output generation). Each has specialized system prompts and capability constraints.",
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/agents/profiles/registry.ts",
            code: `import type { AgentProfile } from "./types";
import { generalProfile } from "./general";
import { codeReviewerProfile } from "./code-reviewer";
import { researcherProfile } from "./researcher";
import { documentWriterProfile } from "./document-writer";

const PROFILE_REGISTRY: Map<string, AgentProfile> = new Map([
  ["general", generalProfile],
  ["code-reviewer", codeReviewerProfile],
  ["researcher", researcherProfile],
  ["document-writer", documentWriterProfile],
]);

export function getProfile(id: string): AgentProfile | undefined {
  return PROFILE_REGISTRY.get(id);
}

export function classifyTask(title: string, description: string): string {
  const text = \`\${title} \${description}\`.toLowerCase();
  if (text.includes("review") || text.includes("pr")) return "code-reviewer";
  if (text.includes("research") || text.includes("investigate")) return "researcher";
  if (text.includes("document") || text.includes("report")) return "document-writer";
  return "general";
}`,
            caption: "The profile registry and task classifier — routing logic in under 20 lines",
          },
          {
            type: "callout",
            variant: "authors-note",
            title: "Author\u2019s Note",
            markdown:
              "Here\u2019s a real chat session where we queried the workflow engine to debug a routing issue. The agent used the chat interface to inspect workflow state in real-time.",
            imageSrc: "/book/authors-notes/chat-querying-workflow.png",
            imageAlt: "Chat session querying workflow execution state",
            defaultCollapsed: true,
          },
        ],
      },
      {
        id: "ch-2-fire-and-forget",
        title: "Fire-and-Forget Execution",
        content: [
          {
            type: "text",
            markdown: `A critical architectural decision was making task execution **fire-and-forget**. When a user clicks "Execute" on a task, the API returns immediately with a \`202 Accepted\` status. The agent runs in a background process.\n\nThis seems obvious in retrospect, but early prototypes blocked the HTTP request while the agent worked. For a simple task, that meant a 30-second hang. For complex tasks, the request would time out entirely.\n\nThe fire-and-forget pattern requires three supporting systems:\n\n1. **Status polling** — The UI needs to know when the agent is done\n2. **Log streaming** — The user wants to watch progress in real-time\n3. **Error recovery** — If the agent crashes, the task shouldn't be stuck in "running" forever`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/agents/execution-manager.ts",
            code: `export async function executeTask(taskId: string): Promise<void> {
  // Update status to "running"
  await updateTaskStatus(taskId, "running");

  // Fire-and-forget: don't await the agent
  runAgent(taskId).catch(async (error) => {
    await updateTaskStatus(taskId, "failed");
    await logAgentError(taskId, error);
  });
}

async function runAgent(taskId: string): Promise<void> {
  const task = await getTask(taskId);
  const profile = getProfile(task.agentProfile ?? "general");

  const agent = new ClaudeAgent({
    systemPrompt: profile.systemPrompt,
    tools: profile.tools,
    maxTokens: profile.constraints.maxTokensPerTurn,
  });

  const result = await agent.execute(task.description);
  await updateTaskStatus(taskId, "completed");
  await saveAgentLog(taskId, result);
}`,
            caption: "Fire-and-forget execution with error recovery baked in",
          },
          {
            type: "callout",
            variant: "tip",
            title: "SSE for Real-Time Logs",
            markdown:
              "Stagent uses **Server-Sent Events** (SSE) for log streaming. The client opens a `ReadableStream` connection and receives agent output as it happens. This is simpler than WebSockets and works through proxies and CDNs without special configuration.",
          },
          {
            type: "callout",
            variant: "authors-note",
            title: "Author\u2019s Note",
            markdown:
              "This screenshot captures the AI Assist feature in action \u2014 a single click enriched a sparse task title into a detailed, actionable description with acceptance criteria.",
            imageSrc: "/book/authors-notes/book-reader-task-ai-assist.png",
            imageAlt: "AI Assist generating a detailed task description from a brief title",
            defaultCollapsed: true,
          },
        ],
      },
      {
        id: "ch-2-tool-permissions",
        title: "Tool Permissions",
        content: [
          {
            type: "text",
            markdown: `An agent without tools is just a chatbot. But an agent with unrestricted tool access is a liability. Stagent's tool permission system sits at the intersection of capability and safety.\n\nEvery tool invocation goes through a permission check. The check considers three factors:\n\n- **Profile constraints** — Does this agent profile have access to this tool?\n- **Persistent permissions** — Has the user previously granted "Always Allow" for this tool?\n- **Human-in-the-loop** — If neither of the above, pause and ask the user\n\nThe "Always Allow" button is the progressive trust mechanism in action. The first time an agent tries to read a file, it asks. If the user clicks "Always Allow," future file reads proceed without interruption. The user's trust is persisted in the settings database and survives restarts.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/agents/tool-permissions.ts",
            code: `export async function canUseTool(
  toolName: string,
  agentProfile: string
): Promise<PermissionResult> {
  // 1. Check profile constraints
  const profile = getProfile(agentProfile);
  if (profile?.constraints.requiresApproval?.includes(toolName)) {
    return { allowed: false, reason: "requires-approval" };
  }

  // 2. Check persistent permissions
  const setting = await getSetting(\`tool-permission:\${toolName}\`);
  if (setting?.value === "always-allow") {
    return { allowed: true, reason: "persistent-permission" };
  }

  // 3. Fall through to human-in-the-loop
  return { allowed: false, reason: "needs-user-approval" };
}`,
            caption: "Three-tier permission check — profile, persistence, then human",
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: Execute a Task",
            description: "Create a task, assign an agent profile, and watch the execution logs stream in real-time.",
            href: "/tasks",
          },
        ],
      },
      {
        id: "ch-2-lessons",
        title: "Lessons Learned",
        content: [
          {
            type: "text",
            markdown: `### Specialization Beats Generalization\n\nOur first multi-agent attempt used a single prompt with role-switching instructions: "If the task is about code review, act as a code reviewer." The results were mediocre across the board.\n\nSeparate profiles with dedicated system prompts produced dramatically better output. The code reviewer caught more bugs. The researcher produced more thorough investigations. Specialization works because it narrows the agent's attention to a specific domain.\n\n### The Database Is the Message Queue\n\nWe initially considered WebSockets for tool permission polling. But the database was already there, already reliable, and already observable. The notification table serves as a lightweight message queue: the agent writes a "permission needed" row, the UI polls for it, and the user's response is written back.\n\nThis is an example of a broader principle: **use the infrastructure you already have**. Adding a message queue would have introduced operational complexity for a problem that a database table solves perfectly.\n\n### Log Everything\n\nEvery agent execution produces a structured log entry. These logs serve three purposes:\n\n1. **Debugging** — When an agent produces wrong output, the log shows why\n2. **Learning** — Execution patterns inform future prompt improvements\n3. **Accountability** — Every automated action has an audit trail`,
          },
        ],
      },
    ],
  },
  {
    id: "ch-3",
    number: 3,
    title: "Document Processing",
    subtitle: "Unstructured Input to Structured Knowledge",
    part: PARTS[0],
    readingTime: 14,
    relatedDocs: ["documents", "shared-components"],
    sections: [
      {
        id: "ch-3-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `Business runs on documents—PDFs, spreadsheets, presentations, meeting notes. But these documents are opaque to AI. They're stored as files, not as queryable knowledge. An agent can't reason about the contents of a PDF unless someone extracts and structures the information first.\n\nThis is the document processing challenge: turning unstructured inputs into structured, agent-accessible knowledge.`,
          },
          {
            type: "callout",
            variant: "info",
            title: "The Knowledge Gap",
            markdown:
              "Most organizations have more knowledge locked in documents than in databases. PDFs, slide decks, and spreadsheets contain critical context that AI agents need but can't access without preprocessing.",
          },
        ],
      },
      {
        id: "ch-3-pipeline",
        title: "The Processing Pipeline",
        content: [
          {
            type: "text",
            markdown: `Stagent's document pipeline follows a three-stage pattern:\n\n1. **Upload** — Files are stored in \`~/.stagent/uploads/\` with metadata recorded in the database\n2. **Extract** — A format-specific processor pulls text and metadata from the file\n3. **Index** — Extracted text is stored in the \`extractedText\` column, making it queryable by agents\n\nThe key insight is that extraction is format-dependent but the output is format-independent. A PDF processor and a Word processor do very different work, but they both produce the same thing: a string of extracted text plus metadata.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/documents/processor.ts",
            code: `export interface ProcessingResult {
  extractedText: string;
  processedPath?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentProcessor {
  /** MIME types this processor handles */
  supportedTypes: string[];
  /** Extract text content from a file */
  process(filePath: string, mimeType: string): Promise<ProcessingResult>;
}

export async function processDocument(
  filePath: string,
  mimeType: string
): Promise<ProcessingResult> {
  const processor = getProcessorForType(mimeType);
  if (!processor) {
    return { extractedText: "", metadata: { error: "unsupported-type" } };
  }
  return processor.process(filePath, mimeType);
}`,
            caption: "The processor interface — format-specific input, format-independent output",
          },
        ],
      },
      {
        id: "ch-3-processors",
        title: "Format-Specific Processors",
        content: [
          {
            type: "text",
            markdown: `Stagent ships with five document processors, each handling a family of file formats:\n\n| Processor | Formats | Library | Notes |\n|-----------|---------|---------|-------|\n| Text | .txt, .md, .csv, .json | Built-in | Direct file read |\n| PDF | .pdf | pdf-parse v2 | Handles multi-page extraction |\n| Image | .png, .jpg, .gif, .webp | image-size | Extracts dimensions; text via OCR |\n| Office | .docx, .pptx | mammoth / jszip | XML-based extraction |\n| Spreadsheet | .xlsx, .csv | xlsx | Cell-by-cell text extraction |\n\nEach processor is registered in a central registry. Adding a new format means implementing the \`DocumentProcessor\` interface and registering it — no changes to the upload or extraction pipeline.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/documents/registry.ts",
            code: `import { textProcessor } from "./processors/text";
import { pdfProcessor } from "./processors/pdf";
import { imageProcessor } from "./processors/image";
import { officeProcessor } from "./processors/office";
import { spreadsheetProcessor } from "./processors/spreadsheet";
import type { DocumentProcessor } from "./processor";

const processors: DocumentProcessor[] = [
  textProcessor,
  pdfProcessor,
  imageProcessor,
  officeProcessor,
  spreadsheetProcessor,
];

export function getProcessorForType(
  mimeType: string
): DocumentProcessor | undefined {
  return processors.find((p) =>
    p.supportedTypes.includes(mimeType)
  );
}

export function getSupportedTypes(): string[] {
  return processors.flatMap((p) => p.supportedTypes);
}`,
            caption: "Registry pattern — processors self-declare their supported MIME types",
          },
          {
            type: "callout",
            variant: "tip",
            title: "The Registry Pattern",
            markdown:
              "The processor registry is a recurring Stagent pattern: components self-register their capabilities, and a central dispatcher routes work based on those declarations. You'll see this same pattern in agent profiles (Ch. 2), workflow steps (Ch. 4), and scheduled actions (Ch. 5).",
          },
        ],
      },
      {
        id: "ch-3-context",
        title: "Agent-Accessible Context",
        content: [
          {
            type: "text",
            markdown: `Extraction alone isn't enough. The extracted text needs to be *accessible* to agents at the moment they need it.\n\nStagent's context builder assembles relevant documents into the agent's prompt. When an agent executes a task, the context builder:\n\n1. Queries the database for documents associated with the task's project\n2. Selects the most relevant documents based on recency and size constraints\n3. Formats the extracted text into a structured context block\n4. Injects it into the agent's system prompt\n\nThis is a form of **Retrieval-Augmented Generation** (RAG), but implemented with a database query instead of a vector store. For Stagent's scale — dozens to hundreds of documents, not millions — a simple SQL query outperforms the complexity of embedding pipelines.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/documents/context-builder.ts",
            code: `export async function buildDocumentContext(
  projectId: string,
  maxTokens: number = 8000
): Promise<string> {
  const docs = await getProjectDocuments(projectId);

  // Sort by recency, filter to those with extracted text
  const relevant = docs
    .filter((d) => d.extractedText)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  let context = "## Project Documents\\n\\n";
  let tokenCount = 0;

  for (const doc of relevant) {
    const docText = \`### \${doc.name}\\n\${doc.extractedText}\\n\\n\`;
    const estimated = docText.length / 4; // rough token estimate
    if (tokenCount + estimated > maxTokens) break;
    context += docText;
    tokenCount += estimated;
  }

  return context;
}`,
            caption: "Context builder — simple RAG with a database query",
          },
          {
            type: "callout",
            variant: "lesson",
            title: "Simplicity Over Sophistication",
            markdown:
              "Vector databases, embedding models, semantic chunking — these are powerful tools for large-scale retrieval. But for a single-tenant tool with hundreds of documents, `SELECT * FROM documents WHERE projectId = ? AND extractedText IS NOT NULL ORDER BY updatedAt DESC` is faster to build, easier to debug, and good enough. Don't build infrastructure for a scale you haven't reached.",
          },
        ],
      },
      {
        id: "ch-3-management",
        title: "Document Management UI",
        content: [
          {
            type: "text",
            markdown: `Documents need a home in the UI. Stagent's document manager provides:\n\n- **Table and grid views** — Switch between a dense data table and a visual grid of document cards\n- **Upload dialog** — Drag-and-drop with format validation and progress indication\n- **Detail sheet** — Slide-out panel showing metadata, extracted text preview, and processing status\n- **Bulk operations** — Select multiple documents for deletion or re-processing\n\nThe detail sheet follows Stagent's preference for **sliding sheets over full pages** for sparse detail views. A document's metadata fits comfortably in a side panel — navigating to a full page would break reading flow.`,
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: Upload a Document",
            description: "Upload a PDF, Word doc, or spreadsheet and watch the processing pipeline extract its content.",
            href: "/documents",
          },
        ],
      },
      {
        id: "ch-3-lessons",
        title: "Lessons Learned",
        content: [
          {
            type: "text",
            markdown: `### Wire Everything End-to-End\n\nOur biggest document processing bug was a classic "code island" — the processor module was fully implemented and tested, but never actually called from the upload API. The code existed but was dead. We caught it during ship verification by grepping for imports.\n\n**Lesson**: A module that isn't imported doesn't exist. Always verify the full chain from entry point to implementation.\n\n### Schema Must Match Migration\n\nWe added \`extractedText\`, \`processedPath\`, and \`processingError\` columns via a SQL migration but forgot to update the Drizzle schema file. TypeScript didn't complain — the columns just silently didn't exist in the type system. Runtime writes to those columns failed with no type error.\n\n**Lesson**: When you write a migration, update the schema in the same commit. Make it atomic.\n\n### Preprocessing Is Not Optional\n\nEarly designs treated document processing as a "nice to have" that could happen lazily. But agents that reference unprocessed documents get nothing — no extracted text, no context. Preprocessing must happen at upload time, synchronously or with a clear retry mechanism.`,
          },
          {
            type: "callout",
            variant: "warning",
            title: "The Integration Test",
            markdown:
              "For every feature, ask: *Can I trace a path from a user action to this code?* If the answer is no, the feature doesn't work — no matter how well the unit tests pass.",
          },
        ],
      },
    ],
  },
  {
    id: "ch-4",
    number: 4,
    title: "Workflow Orchestration",
    subtitle: "From Linear Sequences to Adaptive Blueprints",
    part: PARTS[1],
    readingTime: 14,
    relatedDocs: ["workflows", "agent-intelligence"],
    relatedJourney: "power-user",
    sections: [
      {
        id: "ch-4-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `Individual tasks are solved. But real work isn't a series of independent tasks—it's a *workflow*. Tasks depend on each other. Outputs flow from one step to the next. Failures need to be caught and handled. And the whole sequence needs to be observable.\n\nStagent's workflow engine turns linear task sequences into adaptive, observable pipelines.`,
          },
        ],
      },
      {
        id: "ch-4-patterns",
        title: "Six Orchestration Patterns",
        content: [
          {
            type: "text",
            markdown: `The first design decision was: how many workflow patterns do you need? Too few and you're forcing every process into an ill-fitting mold. Too many and the system becomes a workflow DSL that nobody learns.\n\nStagent settled on six patterns, each serving a distinct coordination need:\n\n1. **Sequence** — Steps execute one after another. The simplest pattern. Good for pipelines where each step transforms the previous step's output.\n\n2. **Planner-Executor** — A planning step analyzes the objective and generates a structured plan. An executor step carries it out. Separating planning from execution produces more reliable results than a single agent trying to do both.\n\n3. **Checkpoint** — Inserts a human-in-the-loop approval gate between steps. The workflow pauses until a human approves, edits, or rejects. Critical for high-stakes operations like deployments or external communications.\n\n4. **Autonomous Loop** — Repeats a step until a stop condition is met. Four conditions are supported: max iterations, time limit, goal achieved, and error threshold. This is the pattern behind scheduled intelligence (Ch. 5).\n\n5. **Parallel Research** — Fans out multiple steps to run concurrently, then merges results. Perfect for research tasks where you want multiple perspectives on the same question.\n\n6. **Multi-Agent Swarm** — Multiple agent profiles collaborate on a shared objective with dynamic handoffs. The most complex pattern — it requires a coordination protocol to prevent duplication and resolve conflicts.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/workflows/types.ts",
            code: `export type WorkflowPattern =
  | "sequence"
  | "planner-executor"
  | "checkpoint"
  | "autonomous-loop"
  | "parallel-research"
  | "multi-agent-swarm";

export interface WorkflowStep {
  id: string;
  name: string;
  agentProfile?: string;
  prompt: string;
  dependsOn?: string[];
  requiresApproval?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  pattern: WorkflowPattern;
  steps: WorkflowStep[];
  createdAt: string;
}`,
            caption: "Six patterns cover the full spectrum from simple sequences to multi-agent coordination",
          },
          {
            type: "callout",
            variant: "tip",
            title: "Pattern Selection Heuristic",
            markdown:
              "Not sure which pattern to use? Start with **Sequence**. If you need human checkpoints, switch to **Checkpoint**. If you need parallel work, use **Parallel Research**. The planner-executor and swarm patterns are for when you need the agent to figure out the plan or coordinate across specializations.",
          },
        ],
      },
      {
        id: "ch-4-engine",
        title: "The Workflow Engine",
        content: [
          {
            type: "text",
            markdown: `The workflow engine is the runtime that executes workflow definitions. Its responsibilities are:\n\n- **Step scheduling** — Determine which steps are ready to run based on dependency resolution\n- **Agent dispatching** — Launch the appropriate agent for each step using the profile registry\n- **State management** — Track which steps have completed, failed, or are waiting for approval\n- **Context passing** — Thread the output of completed steps into the input of downstream steps\n- **Error handling** — Retry transient failures, skip optional steps, and fail gracefully\n\nThe engine operates on a simple loop: poll for ready steps, dispatch them, collect results, update state, repeat. This polling approach (rather than event-driven) was chosen for the same reason as the task permission system — the database is already there, and polling is debuggable.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/workflows/engine.ts",
            code: `export async function executeWorkflow(workflowId: string): Promise<void> {
  const workflow = await getWorkflow(workflowId);
  await updateWorkflowStatus(workflowId, "running");

  for (const step of resolveExecutionOrder(workflow.steps)) {
    if (step.requiresApproval) {
      await createApprovalNotification(workflowId, step);
      await waitForApproval(workflowId, step.id);
    }

    const profile = step.agentProfile ?? "general";
    const context = await buildStepContext(workflow, step);

    try {
      const result = await executeStep(step, profile, context);
      await saveStepResult(workflowId, step.id, result);
    } catch (error) {
      await handleStepFailure(workflowId, step, error);
      break;
    }
  }

  await updateWorkflowStatus(workflowId, "completed");
}`,
            caption: "The core execution loop — resolve order, check approvals, dispatch, collect results",
          },
          {
            type: "callout",
            variant: "authors-note",
            title: "Author\u2019s Note",
            markdown:
              "This is a live workflow execution in the book reader itself. You can see the step-by-step progress as the workflow engine processes each stage of the content generation pipeline.",
            imageSrc: "/book/authors-notes/book-reader-workflow.png",
            imageAlt: "Book reader showing a live workflow execution with step progress",
            defaultCollapsed: true,
          },
          {
            type: "callout",
            variant: "authors-note",
            title: "Author\u2019s Note",
            markdown:
              "The workflow progress view shows real execution metrics \u2014 steps completed, time elapsed, and the current agent\u2019s activity. This is the observability layer that makes autonomous workflows trustworthy.",
            imageSrc: "/book/authors-notes/workflow-progress.png",
            imageAlt: "Workflow progress dashboard with execution metrics and step status",
            defaultCollapsed: true,
          },
        ],
      },
      {
        id: "ch-4-lessons",
        title: "Lessons Learned",
        content: [
          {
            type: "text",
            markdown: `### Context Batching Matters\n\nEarly workflow prototypes passed the entire conversation history to each step. For a 5-step workflow, step 5 received the accumulated output of steps 1 through 4. This quickly exceeded token limits and degraded quality as the agent tried to process too much context.\n\nThe fix was context batching: each step receives only the outputs it *depends on*, not the entire history. The dependency graph determines which prior outputs are relevant. This keeps context focused and token-efficient.\n\n### Templates Over Copy-Paste\n\nUsers repeatedly created similar workflows. Instead of forcing them to rebuild from scratch, Stagent introduced workflow templates — pre-configured patterns that can be instantiated with custom prompts. The "All / Templates / Runs" tab structure in the UI reflects this: templates are first-class citizens, not hidden in a menu.\n\n### Observability Is the Feature\n\nA workflow that runs in the background and tells you "done" or "failed" isn't useful enough. Users need to see *which* step is running, *what* the agent is doing, and *where* it got stuck. The workflow detail view shows step-by-step status with expandable logs for each step. This observability is what builds trust in autonomous multi-step processes.`,
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: Create a Workflow",
            description: "Build a multi-step workflow using one of six orchestration patterns and watch it execute.",
            href: "/workflows",
          },
        ],
      },
    ],
  },
  {
    id: "ch-5",
    number: 5,
    title: "Scheduled Intelligence",
    subtitle: "Time-Based Automation and Recurring Intelligence Loops",
    part: PARTS[1],
    readingTime: 11,
    relatedDocs: ["schedules", "monitoring"],
    sections: [
      {
        id: "ch-5-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `Not all intelligence is triggered by human action. Some of the most valuable automation runs on a schedule—daily reports, weekly reviews, continuous monitoring. These are the heartbeat of an AI-native organization.\n\nStagent's scheduler engine turns prompts into recurring intelligence loops, executing at defined intervals with configurable stop conditions.`,
          },
        ],
      },
      {
        id: "ch-5-scheduler",
        title: "The Scheduler Engine",
        content: [
          {
            type: "text",
            markdown: `The scheduler engine is a background process that runs alongside the Next.js server. It's initialized via the \`instrumentation.ts\` hook — a Next.js convention for code that should run once at server startup.\n\nThe engine maintains a tick loop that:\n\n1. Queries all active schedules from the database\n2. Checks which schedules are due (comparing \`nextRunAt\` against the current time)\n3. Triggers execution for due schedules\n4. Calculates and stores the next run time\n\nSchedules support six preset intervals (5 min, 15 min, 30 min, hourly, 2 hours, daily at 9 AM) and custom intervals specified via a natural language parser.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/schedules/scheduler.ts",
            code: `export class SchedulerEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    // Tick every 30 seconds to check for due schedules
    this.intervalId = setInterval(() => this.tick(), 30_000);
  }

  private async tick() {
    const dueSchedules = await getDueSchedules();

    for (const schedule of dueSchedules) {
      // Fire-and-forget execution
      this.executeSchedule(schedule).catch((err) =>
        console.error(\`Schedule \${schedule.id} failed:\`, err)
      );

      // Calculate next run time
      const nextRun = calculateNextRun(schedule.interval);
      await updateNextRunAt(schedule.id, nextRun);
    }
  }

  private async executeSchedule(schedule: Schedule) {
    const task = await createTaskFromSchedule(schedule);
    await executeTask(task.id);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}`,
            caption: "The scheduler tick loop — simple polling with fire-and-forget execution",
          },
          {
            type: "callout",
            variant: "info",
            title: "Why Not Cron?",
            markdown:
              "Traditional cron runs in the OS. Stagent's scheduler runs in the application process, giving it access to the database, agent profiles, and the full execution pipeline without shelling out. It also survives restarts — schedule state is in the DB, not in a crontab that could drift.",
          },
        ],
      },
      {
        id: "ch-5-loops",
        title: "Autonomous Loop Execution",
        content: [
          {
            type: "text",
            markdown: `Scheduled execution becomes truly powerful when combined with autonomous loops. Instead of firing a prompt and forgetting about it, an autonomous loop runs iteratively until a goal is achieved.\n\nFour stop conditions are supported:\n\n| Condition | Description | Use Case |\n|-----------|-------------|----------|\n| Max Iterations | Stop after N runs | Bounded research tasks |\n| Time Limit | Stop after a duration | Time-boxed analysis |\n| Goal Achieved | Agent reports completion | Convergent optimization |\n| Error Threshold | Stop after repeated failures | Fault-tolerant pipelines |\n\nBetween iterations, the loop executor passes context forward. The agent knows its iteration number, what it accomplished in previous runs, and how close it is to the stop condition. This iteration context is what turns a stateless prompt into a stateful intelligence loop.`,
          },
          {
            type: "callout",
            variant: "lesson",
            title: "Convergence Is the Goal",
            markdown:
              "The best autonomous loops converge: each iteration gets closer to the objective. If an agent's output isn't improving across iterations, the loop is wasting tokens. The `goal-achieved` stop condition is the most powerful because it lets the agent decide when it's done — but it requires a well-defined success criterion in the prompt.",
          },
        ],
      },
      {
        id: "ch-5-running",
        title: "Seeing It In Action",
        content: [
          {
            type: "callout",
            variant: "authors-note",
            title: "Author\u2019s Note",
            markdown:
              "Here\u2019s a scheduled workflow running inside the book reader. The execution indicator shows real-time progress as the scheduler triggers each iteration of the intelligence loop.",
            imageSrc: "/book/authors-notes/book-reader-workflow-running.png",
            imageAlt: "Book reader showing a workflow executing in real-time with progress indicators",
            defaultCollapsed: true,
          },
        ],
      },
      {
        id: "ch-5-lessons",
        title: "Lessons Learned",
        content: [
          {
            type: "text",
            markdown: `### Pause and Resume Is Essential\n\nThe first scheduler had no pause button. Once a schedule was created, it ran forever (or until deleted). Users quickly asked for pause — they wanted to temporarily stop a schedule during maintenance, testing, or vacation without losing the configuration.\n\nPausing preserves the schedule's configuration and execution history. Resuming recalculates the next run time from the current moment, rather than "catching up" on missed runs.\n\n### The Interval Parser Saves Time\n\nParsing "every 2 hours" or "daily at 9am" into millisecond intervals seems trivial, but getting edge cases right (timezone handling, "every weekday", fractional hours) is surprisingly tricky. Building a dedicated interval parser with preset validation eliminated an entire class of configuration errors.\n\n### Monitor the Monitor\n\nA scheduler that crashes silently is worse than no scheduler at all. Every scheduler tick logs its activity, and missed ticks (when the gap exceeds 2× the expected interval) generate a warning notification. The scheduler monitors itself.`,
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: Create a Schedule",
            description: "Set up a recurring prompt with interval presets and watch the scheduler engine execute it on cadence.",
            href: "/schedules",
          },
        ],
      },
    ],
  },
  {
    id: "ch-6",
    number: 6,
    title: "Agent Self-Improvement",
    subtitle: "Learning from Execution Logs and Feedback",
    part: PARTS[1],
    readingTime: 13,
    relatedDocs: ["agent-intelligence", "profiles"],
    relatedJourney: "developer",
    sections: [
      {
        id: "ch-6-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `An agent that makes the same mistake twice isn't learning. Most AI systems are stateless—each invocation starts fresh with no memory of past successes or failures. This is fine for simple tasks, but it's a fundamental limitation for complex, ongoing work.\n\nStagent's learned context system closes this loop, feeding execution outcomes back into agent behavior.`,
          },
        ],
      },
      {
        id: "ch-6-learned-context",
        title: "The Learned Context System",
        content: [
          {
            type: "text",
            markdown: `Learned context is structured knowledge that agents accumulate through execution. It's stored in a dedicated database table and injected into agent system prompts alongside the task description and document context.\n\nThe system works in three phases:\n\n1. **Capture** — After each task execution, the agent's output and any human feedback are analyzed for reusable insights\n2. **Store** — Insights are stored as key-value pairs scoped to a project, agent profile, or global context\n3. **Inject** — On the next execution, relevant learned context is assembled into the system prompt\n\nThe key insight is that learned context is *structured*, not free-form. Each entry has a type (pattern, antipattern, preference, fact), a scope (project, profile, global), and a confidence score that decays over time if the context isn't reinforced.`,
          },
          {
            type: "code",
            language: "typescript",
            filename: "src/lib/db/schema.ts",
            code: `export const learnedContext = sqliteTable("learned_context", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),       // "global" | "project:{id}" | "profile:{id}"
  contextType: text("contextType").notNull(), // "pattern" | "antipattern" | "preference" | "fact"
  key: text("key").notNull(),
  value: text("value").notNull(),
  confidence: real("confidence").default(1.0),
  sourceTaskId: text("sourceTaskId"),
  createdAt: text("createdAt").default(sql\`(datetime('now'))\`),
  updatedAt: text("updatedAt").default(sql\`(datetime('now'))\`),
});`,
            caption: "Learned context schema — structured, scoped, and confidence-scored",
          },
          {
            type: "callout",
            variant: "tip",
            title: "Confidence Decay",
            markdown:
              "Learned context entries start with confidence 1.0. Each time the context is relevant but the agent's output contradicts it, confidence decreases. When it drops below 0.3, the entry is automatically archived. This prevents stale or incorrect context from polluting future executions.",
          },
        ],
      },
      {
        id: "ch-6-feedback",
        title: "The Feedback Loop",
        content: [
          {
            type: "text",
            markdown: `Self-improvement requires feedback. Stagent supports three feedback channels:\n\n1. **Explicit feedback** — The user reviews agent output and provides corrections or approval. "This code review missed the SQL injection in line 42" becomes an antipattern entry: "Always check for SQL injection in user-facing queries."\n\n2. **Implicit feedback** — Task outcomes serve as signal. A task that completes successfully reinforces the agent's approach. A task that fails or requires manual intervention suggests the approach needs adjustment.\n\n3. **Cross-agent feedback** — When one agent's output is used by another (e.g., a researcher's output feeds a document writer), the downstream agent's success or failure reflects on the upstream agent's quality.\n\nThe feedback loop is what transforms a collection of AI tools into a *learning system*. Each execution makes the next one slightly better. Over time, the system develops institutional knowledge — not in a wiki that nobody reads, but in the agent's actual behavior.`,
          },
          {
            type: "callout",
            variant: "lesson",
            title: "Hot Reloading for Agents",
            markdown:
              "Learned context is injected at execution time, not baked into the model. This means improvements take effect immediately — no retraining, no redeployment. It's like hot reloading for agent behavior. Change a learned context entry and the next execution reflects it instantly.",
          },
          {
            type: "callout",
            variant: "authors-note",
            title: "Author\u2019s Note",
            markdown:
              "This screenshot shows the hot-reloading feature in action. A change to the learned context was picked up instantly by the next agent execution \u2014 no restart, no redeployment needed.",
            imageSrc: "/book/authors-notes/hot-reloading-feature.png",
            imageAlt: "Hot reloading a learned context entry with instant agent behavior change",
            defaultCollapsed: true,
          },
        ],
      },
      {
        id: "ch-6-lessons",
        title: "Lessons Learned",
        content: [
          {
            type: "text",
            markdown: `### Context Window Is Finite\n\nThe most common failure mode of learned context is overloading the system prompt. Each learned context entry adds tokens. At scale, hundreds of entries could consume the entire context window, leaving no room for the actual task.\n\nThe fix is aggressive filtering: only inject context entries that are scoped to the current project or profile, have confidence above 0.5, and are relevant to the task keywords. Quality over quantity.\n\n### Human Feedback Is Gold\n\nImplicit feedback (task success/failure) is noisy. Explicit feedback from humans is orders of magnitude more valuable. A single correction like "don't suggest var, use const" creates a high-confidence entry that prevents the same mistake across all future executions.\n\nDesign the feedback UI to make corrections effortless. If it takes more than one click, users won't do it.\n\n### Scope Carefully\n\nGlobal learned context is the most dangerous scope. A bad entry at global scope affects every agent on every project. Project-scoped and profile-scoped entries are safer because their blast radius is limited. Default to the narrowest scope and only promote to global when the pattern is truly universal.`,
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: View Agent Profiles",
            description: "Explore the agent profile registry and see how learned context shapes each profile's behavior.",
            href: "/settings",
          },
        ],
      },
    ],
  },
  {
    id: "ch-7",
    number: 7,
    title: "Multi-Agent Swarms",
    subtitle: "Parallel Execution, Consensus, and Specialization",
    part: PARTS[2],
    readingTime: 16,
    relatedDocs: ["profiles", "agent-intelligence"],
    sections: [
      {
        id: "ch-7-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `One agent is useful. Multiple agents working in concert are transformative. But multi-agent systems introduce coordination challenges: how do agents share context? How do they resolve conflicting outputs? How do you prevent duplication of effort?\n\nThis chapter explores the frontier of multi-agent orchestration—swarm patterns for parallel execution with consensus mechanisms.`,
          },
        ],
      },
      {
        id: "ch-7-coordination",
        title: "Coordination Patterns",
        content: [
          {
            type: "text",
            markdown: `Multi-agent coordination in Stagent follows three patterns, each suited to different coordination needs:\n\n### Fan-Out / Fan-In (Parallel Research)\n\nThe simplest multi-agent pattern. A coordinator fans out the same question to multiple agents with different profiles. Each agent produces an independent answer. The coordinator merges the results.\n\nThis is ideal for research tasks where you want diverse perspectives. A code reviewer, a researcher, and a general agent might all analyze the same codebase and produce different insights. The merged result is richer than any single agent's output.\n\n### Pipeline (Sequential Specialization)\n\nAgents are chained in sequence, each transforming the previous agent's output. A researcher produces raw findings. A document writer structures them into a report. A code reviewer validates any technical claims.\n\nThis is the assembly line model — each agent is a specialist that handles one transformation in a multi-step pipeline.\n\n### Swarm (Dynamic Handoffs)\n\nThe most advanced pattern. Multiple agents share a workspace and dynamically decide who handles each subtask. A coordinator agent monitors the workspace and routes subtasks based on agent capabilities. Agents can request handoffs when they encounter work outside their specialization.\n\nSwarms require a shared context protocol: each agent reads from and writes to a shared state object. The coordinator resolves conflicts when multiple agents modify the same state.`,
          },
          {
            type: "callout",
            variant: "warning",
            title: "Swarm Complexity",
            markdown:
              "Swarms are the most powerful and the most dangerous multi-agent pattern. Without careful coordination, agents duplicate work, contradict each other, or enter infinite loops. Start with fan-out/fan-in. Graduate to swarms only when simpler patterns can't express the coordination you need.",
          },
        ],
      },
      {
        id: "ch-7-consensus",
        title: "Consensus Mechanisms",
        content: [
          {
            type: "text",
            markdown: `When multiple agents produce outputs for the same objective, they may disagree. A consensus mechanism resolves these disagreements.\n\nStagent supports three consensus strategies:\n\n1. **Majority vote** — Each agent produces a recommendation. The most common recommendation wins. Simple but works well for classification tasks.\n\n2. **Weighted merge** — Outputs are merged with weights based on agent profile relevance. A code reviewer's opinion on code quality carries more weight than a general agent's. The weights come from the profile registry.\n\n3. **Coordinator adjudication** — A separate coordinator agent reviews all outputs and produces a final synthesis. This is the most expensive (requires an additional agent call) but produces the highest quality results for complex tasks.\n\nThe choice of consensus strategy is specified in the workflow definition and can vary per step.`,
          },
          {
            type: "callout",
            variant: "info",
            title: "Token Economics",
            markdown:
              "Multi-agent patterns multiply token usage. A fan-out to 3 agents costs 3× the tokens of a single agent. Swarms with dynamic handoffs can be unpredictable. Always set token budgets per agent and per workflow to prevent runaway costs. The usage ledger tracks per-agent and per-workflow spend.",
          },
        ],
      },
      {
        id: "ch-7-lessons",
        title: "Lessons Learned",
        content: [
          {
            type: "text",
            markdown: `### Start Simple, Add Agents Later\n\nThe temptation is to design a swarm from day one. Resist it. Start with a single agent. If the output quality isn't good enough, try a different profile. If the task is too complex for one agent, add a second in a pipeline. Only reach for fan-out or swarm patterns when simpler approaches fail.\n\nEvery additional agent adds latency, token cost, and coordination overhead. The simplest architecture that produces acceptable results is the right one.\n\n### Shared State Is Hard\n\nSwarm agents that share state need clear read/write protocols. Without them, agents overwrite each other's work or produce inconsistent outputs. The current implementation uses a simple turn-based protocol: agents take turns reading from and writing to the shared state. Concurrent writes are serialized through the database.\n\n### Specialization Is the Superpower\n\nThe biggest quality gains come not from running more agents, but from running *better-matched* agents. A specialized code reviewer finds 3× more bugs than a general agent running 3× as long. Profile specialization is the highest-leverage improvement in multi-agent systems.`,
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: Agent Profiles",
            description: "Explore the four built-in agent profiles and see how specialization improves output quality.",
            href: "/settings",
          },
        ],
      },
    ],
  },
  {
    id: "ch-8",
    number: 8,
    title: "Human-in-the-Loop",
    subtitle: "Permission Systems and Graceful Escalation",
    part: PARTS[2],
    readingTime: 12,
    relatedDocs: ["inbox-notifications", "tool-permissions", "settings"],
    sections: [
      {
        id: "ch-8-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `Full autonomy is a spectrum, not a switch. Even the most capable AI agents need human oversight for high-stakes decisions. The challenge isn't whether to include humans—it's *where* and *how*.\n\nStagent's permission system implements progressive trust: agents earn broader permissions through demonstrated reliability, while humans retain veto power at configurable checkpoints.`,
          },
          {
            type: "callout",
            variant: "authors-note",
            title: "Author\u2019s Note",
            markdown:
              "Here\u2019s the inbox during a workflow execution. Notifications show permission requests alongside workflow progress updates \u2014 the human stays informed and in control without blocking the agent\u2019s work.",
            imageSrc: "/book/authors-notes/inbox-notifications-workflow-progress.png",
            imageAlt: "Inbox showing workflow progress notifications alongside a permission request",
            defaultCollapsed: true,
          },
        ],
      },
      {
        id: "ch-8-permission-system",
        title: "The Permission System",
        content: [
          {
            type: "text",
            markdown: `Stagent's permission system operates at three levels, each controlling a different granularity of agent action:\n\n### Tool-Level Permissions\n\nEvery tool invocation (file read, API call, database write) passes through a permission check. The check follows a three-tier cascade:\n\n1. **Profile constraints** — The agent profile declares which tools require approval\n2. **Persistent permissions** — The user has previously clicked "Always Allow" for this tool\n3. **Human-in-the-loop** — Neither of the above applies, so the user is asked\n\nThis three-tier cascade means most routine operations proceed without interruption (tier 2), while dangerous operations always require explicit approval (tier 1).\n\n### Workflow-Level Checkpoints\n\nWorkflow steps can be flagged with \`requiresApproval: true\`. When the engine reaches a checkpoint step, it pauses execution and creates a notification in the user's inbox. The user can approve (continue), edit (modify the step's output before continuing), or reject (abort the workflow).\n\n### Escalation Protocols\n\nWhen an agent encounters uncertainty — ambiguous instructions, conflicting constraints, or a task outside its capabilities — it can escalate to the human. Escalation creates a high-priority notification with the agent's analysis of *why* it's uncertain and *what* decision it needs the human to make.`,
          },
          {
            type: "callout",
            variant: "tip",
            title: "Progressive Trust in Practice",
            markdown:
              "A new Stagent installation starts with tight permissions — every tool requires approval. As the user clicks \"Always Allow\" for trusted operations, the system gradually becomes more autonomous. The user is building a custom permission profile that matches their trust boundary.",
          },
        ],
      },
      {
        id: "ch-8-inbox",
        title: "The Notification Inbox",
        content: [
          {
            type: "text",
            markdown: `The inbox is the human's window into agent activity. It serves three functions:\n\n1. **Awareness** — Informational notifications about completed tasks, agent messages, and status changes\n2. **Action** — Permission requests and workflow checkpoints that require a decision\n3. **Audit** — A chronological record of every human-agent interaction\n\nNotifications are categorized by type and urgency. Permission requests appear at the top with action buttons. Informational notifications are grouped below. Rich content rendering means agent messages can include markdown, code blocks, and tables — the agent can show its work, not just its conclusion.\n\nThe inbox uses progressive disclosure: long notifications start collapsed with a summary. This keeps the inbox scannable while ensuring no detail is lost when you need it.`,
          },
          {
            type: "callout",
            variant: "info",
            title: "Ambient Approval Toast",
            markdown:
              "For low-stakes permission requests, Stagent uses an ambient toast notification instead of routing to the inbox. The toast appears in the corner with Approve/Deny buttons, letting the user respond without context-switching. If the toast is dismissed, the request falls back to the inbox.",
          },
        ],
      },
      {
        id: "ch-8-lessons",
        title: "Lessons Learned",
        content: [
          {
            type: "text",
            markdown: `### The "Always Allow" Button Is the Key Feature\n\nWithout persistent permissions, every autonomous operation requires a human click. At 10 operations per task and 20 tasks per day, that's 200 interruptions. The "Always Allow" button is what makes autonomy practical — it lets users progressively remove themselves from the loop for trusted operations.\n\n### Don't Hide the Override\n\nEven with "Always Allow" configured, users need an escape hatch. Every permission can be revoked from the Settings page. Every workflow checkpoint can be manually triggered by clicking "Pause" on a running workflow. The override is always visible and always one click away.\n\n### Audit Trails Build Trust\n\nUsers trust autonomous systems more when they can see what happened. Every agent action is logged with timestamp, tool name, input, output, and the permission that authorized it. The audit log isn't just for debugging — it's the foundation of trust.`,
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: Check Your Inbox",
            description: "View agent notifications, approve pending permission requests, and review the activity feed.",
            href: "/inbox",
          },
        ],
      },
    ],
  },
  {
    id: "ch-9",
    number: 9,
    title: "The Autonomous Organization",
    subtitle: "Fully Delegated Business Processes",
    part: PARTS[2],
    readingTime: 18,
    relatedDocs: ["workflows", "profiles", "schedules"],
    sections: [
      {
        id: "ch-9-intro",
        title: "The Vision",
        content: [
          {
            type: "text",
            markdown: `What does it look like when all the pieces come together? When project planning, task execution, document processing, workflow orchestration, scheduled intelligence, and multi-agent coordination are all running autonomously?\n\nThis final chapter paints the picture of the autonomous organization—not as science fiction, but as a practical architecture built from the patterns in this book.\n\nThe human role shifts definitively: from executor to architect, from manager to system designer. You don't *do* the work—you design the systems that do the work, and you intervene when those systems need course correction.`,
          },
          {
            type: "callout",
            variant: "lesson",
            title: "The Guiding Principle",
            markdown:
              "The best documentation is an artifact that proves itself. This book isn't *about* AI-native automation—it *is* the proof that AI-native automation works. Every claim has a corresponding line of code, every pattern has a corresponding execution log.",
          },
        ],
      },
      {
        id: "ch-9-architecture",
        title: "The Full Architecture",
        content: [
          {
            type: "text",
            markdown: `The autonomous organization is built from layers, each adding a degree of independence:\n\n| Layer | Components | Human Role |\n|-------|-----------|------------|\n| **Foundation** | Projects, Tasks, Documents | Creator and reviewer |\n| **Intelligence** | Workflows, Schedules, Learned Context | System designer |\n| **Autonomy** | Multi-agent swarms, Self-updating content | Exception handler |\n\nAt the Foundation layer, humans still create projects and define objectives. But tasks within those projects are planned, assigned, and executed by agents. Documents are processed automatically on upload.\n\nAt the Intelligence layer, workflows orchestrate multi-step processes without supervision. Schedules run recurring intelligence loops. The learned context system ensures agents improve over time. The human designs these systems but doesn't operate them.\n\nAt the Autonomy layer, multi-agent swarms tackle complex objectives that no single agent could handle. Content stays current through self-updating workflows. The human intervenes only when the system encounters something genuinely novel — a new type of problem that hasn't been seen before.`,
          },
          {
            type: "callout",
            variant: "info",
            title: "The Autonomy Spectrum",
            markdown:
              "Not every process needs to reach the Autonomy layer. A team using only Foundation features (AI-assisted task creation and document processing) is already dramatically more productive. The layers are additive — adopt what you need, in the order that makes sense for your organization.",
          },
        ],
      },
      {
        id: "ch-9-self-proof",
        title: "The Self-Proving System",
        content: [
          {
            type: "text",
            markdown: `This book is its own strongest argument. Every chapter describes a pattern that was used to build the chapter itself:\n\n- **Chapter 1** (Project Management) — The book's chapter plan was managed as a Stagent project with tasks for each section\n- **Chapter 3** (Document Processing) — The strategy document and screenshots were processed through the document pipeline\n- **Chapter 4** (Workflows) — A planner-executor workflow generated the initial chapter drafts\n- **Chapter 5** (Scheduled Intelligence) — A weekly schedule monitors for stale chapters and triggers updates\n- **Chapter 6** (Self-Improvement) — Learned context from early chapter drafts improved later ones\n\nThis self-referential quality is the ultimate test of the system. If Stagent can build and maintain its own documentation, it can handle your team's automation needs.\n\nThe Book you're reading is a **living artifact**. When Stagent ships a new feature, a workflow detects the change, regenerates the relevant chapter, and queues it for human review. The documentation doesn't fall out of date because the same system that builds features also updates the documentation.`,
          },
          {
            type: "callout",
            variant: "lesson",
            title: "Dogfooding Is Not Optional",
            markdown:
              "If you're building an automation tool and you don't use it to automate your own processes, you're guessing about what works. Every pain point in Stagent was discovered by using Stagent. Every improvement was driven by real frustration, not hypothetical user stories.",
          },
        ],
      },
      {
        id: "ch-9-future",
        title: "What Comes Next",
        content: [
          {
            type: "text",
            markdown: `The patterns in this book are a starting point, not an endpoint. Several frontiers remain:\n\n### Agent-to-Agent Negotiation\n\nCurrent swarms use a coordinator to resolve conflicts. Future swarms may negotiate directly — a code reviewer and a document writer debating whether a technical explanation is accurate enough, reaching consensus without human intervention.\n\n### Emergent Workflows\n\nToday, workflows are defined by humans. Tomorrow, agents may create workflows dynamically based on the objective. "Ship this feature" could automatically generate a plan-execute-review-deploy workflow without a human specifying the steps.\n\n### Cross-Organization Agents\n\nStagent currently operates within a single organization. The next frontier is agents that collaborate across organizational boundaries — reviewing a vendor's API documentation, integrating with a partner's data pipeline, or coordinating releases across teams.\n\nThese are not predictions — they are the next items on Stagent's roadmap. And when they ship, this book will update itself to tell their story.`,
          },
          {
            type: "interactive",
            interactiveType: "link",
            label: "Try It: Explore the Full System",
            description: "Start from the home workspace and explore how all the pieces connect — projects, tasks, workflows, schedules, and agents.",
            href: "/",
          },
        ],
      },
    ],
  },
];

/**
 * Try to load a chapter from its markdown file in docs/book/.
 * Only works server-side (where fs is available). Returns null on client.
 */
function tryLoadMarkdownChapter(id: string): BookChapter | null {
  // Only attempt markdown loading on the server
  if (typeof window !== "undefined") return null;

  try {
    const fileSlug = CHAPTER_SLUG_MAP[id];
    if (!fileSlug) return null;

    // Dynamic require to avoid bundling fs in client builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDocBySlug } = require("@/lib/docs/reader") as { getDocBySlug: (slug: string) => { frontmatter: Record<string, unknown>; body: string; slug: string } | null };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parseMarkdownChapter } = require("./markdown-parser") as { parseMarkdownChapter: (md: string, slug: string) => { sections: Array<{ id: string; title: string; content: import("./types").ContentBlock[] }> } };

    const doc = getDocBySlug(fileSlug);
    if (!doc) return null;

    const fm = doc.frontmatter;
    const chapterNum = Number(fm.chapter) || 0;
    const partNum = Number(fm.part) || 1;
    const part = PARTS[partNum - 1] || PARTS[0];

    const { sections } = parseMarkdownChapter(doc.body, id);

    const relatedDocs = Array.isArray(fm.relatedDocs)
      ? (fm.relatedDocs as string[])
      : typeof fm.relatedDocs === "string"
        ? [fm.relatedDocs]
        : [];

    const chapter: BookChapter = {
      id,
      number: chapterNum,
      title: (fm.title as string) || "",
      subtitle: (fm.subtitle as string) || "",
      part,
      sections,
      readingTime: Number(fm.readingTime) || 0,
    };

    if (relatedDocs.length > 0) chapter.relatedDocs = relatedDocs;
    if (fm.relatedJourney && fm.relatedJourney !== "null") {
      chapter.relatedJourney = fm.relatedJourney as string;
    }

    return chapter;
  } catch {
    return null;
  }
}

/** Get the full book object */
export function getBook(): Book {
  const chapters = CHAPTERS.map((ch) => {
    const md = tryLoadMarkdownChapter(ch.id);
    return md || ch;
  });

  return {
    title: "AI Native",
    subtitle: "Building Autonomous Business Systems with AI Agents",
    description:
      "A practical guide to building AI-native applications, from single-agent task execution to fully autonomous business processes. Every pattern is demonstrated with working code from Stagent — a tool that built itself.",
    parts: PARTS,
    chapters,
    totalReadingTime: chapters.reduce((sum, ch) => sum + ch.readingTime, 0),
  };
}

/** Get a chapter by its ID */
export function getChapter(id: string): BookChapter | undefined {
  const mdChapter = tryLoadMarkdownChapter(id);
  if (mdChapter) return mdChapter;
  return CHAPTERS.find((ch) => ch.id === id);
}

/** Get chapters grouped by part */
export function getChaptersByPart(): Map<number, BookChapter[]> {
  const grouped = new Map<number, BookChapter[]>();
  for (const ch of CHAPTERS) {
    const part = ch.part.number;
    if (!grouped.has(part)) grouped.set(part, []);
    grouped.get(part)!.push(ch);
  }
  return grouped;
}
