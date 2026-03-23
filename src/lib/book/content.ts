import type { Book, BookChapter, BookPart } from "./types";

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
    ],
  },
  {
    id: "ch-5",
    number: 5,
    title: "Scheduled Intelligence",
    subtitle: "Time-Based Automation and Recurring Intelligence Loops",
    part: PARTS[1],
    readingTime: 11,
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
    ],
  },
  {
    id: "ch-6",
    number: 6,
    title: "Agent Self-Improvement",
    subtitle: "Learning from Execution Logs and Feedback",
    part: PARTS[1],
    readingTime: 13,
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
    ],
  },
  {
    id: "ch-7",
    number: 7,
    title: "Multi-Agent Swarms",
    subtitle: "Parallel Execution, Consensus, and Specialization",
    part: PARTS[2],
    readingTime: 16,
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
    ],
  },
  {
    id: "ch-8",
    number: 8,
    title: "Human-in-the-Loop",
    subtitle: "Permission Systems and Graceful Escalation",
    part: PARTS[2],
    readingTime: 12,
    sections: [
      {
        id: "ch-8-intro",
        title: "The Problem",
        content: [
          {
            type: "text",
            markdown: `Full autonomy is a spectrum, not a switch. Even the most capable AI agents need human oversight for high-stakes decisions. The challenge isn't whether to include humans—it's *where* and *how*.\n\nStagent's permission system implements progressive trust: agents earn broader permissions through demonstrated reliability, while humans retain veto power at configurable checkpoints.`,
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
    ],
  },
];

/** Get the full book object */
export function getBook(): Book {
  return {
    title: "AI Native",
    subtitle: "Building Autonomous Business Systems with AI Agents",
    description:
      "A practical guide to building AI-native applications, from single-agent task execution to fully autonomous business processes. Every pattern is demonstrated with working code from Stagent — a tool that built itself.",
    parts: PARTS,
    chapters: CHAPTERS,
    totalReadingTime: CHAPTERS.reduce((sum, ch) => sum + ch.readingTime, 0),
  };
}

/** Get a chapter by its ID */
export function getChapter(id: string): BookChapter | undefined {
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
