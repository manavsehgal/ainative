import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const uploadsDir = join(
  process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent"),
  "uploads"
);

export interface DocumentSeed {
  id: string;
  taskId: string;
  projectId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  direction: "input" | "output";
  category: string | null;
  status: "uploaded";
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentDef {
  originalName: string;
  mimeType: string;
  projectIndex: number;
  taskIndex: number;
  direction: "input" | "output";
  category: string | null;
  content: string | (() => Promise<Buffer>);
}

// --- Binary file generators ---

/** Create a minimal valid DOCX (Open XML) using JSZip */
async function createDocx(textContent: string): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const paragraphs = textContent
    .split("\n")
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join("");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`
  );

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(buf);
}

/** Create a minimal valid PPTX using JSZip */
async function createPptx(slides: string[]): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const slideOverrides = slides
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join("");

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slideOverrides}
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  const slideRels = slides
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    )
    .join("");

  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slideRels}
</Relationships>`
  );

  const slideIdList = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
    .join("");

  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>${slideIdList}</p:sldIdLst>
</p:presentation>`
  );

  slides.forEach((text, i) => {
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:t>${escapeXml(text)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );
  });

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(buf);
}

/** Create a valid XLSX using exceljs */
async function createXlsx(csvContent: string): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Sheet1");
  const rows = csvContent.split("\n").map((line: string) => line.split(","));
  for (const row of rows) {
    ws.addRow(row);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Create a minimal valid PDF with text content */
function createPdfSync(textContent: string): Buffer {
  const lines = textContent.split("\n");
  const textOps = lines
    .map(
      (line, i) =>
        `1 0 0 1 50 ${750 - i * 14} Tm (${escapePdf(line)}) Tj`
    )
    .join("\n");

  const stream = `BT\n/F1 10 Tf\n${textOps}\nET`;
  const streamBytes = Buffer.from(stream, "utf-8");

  const objects: string[] = [];
  const offsets: number[] = [];
  let body = "";

  offsets.push(body.length);
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  body += objects[0];

  offsets.push(body.length);
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  body += objects[1];

  offsets.push(body.length);
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );
  body += objects[2];

  offsets.push(body.length);
  objects.push(
    `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  );
  body += objects[3];

  offsets.push(body.length);
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  );
  body += objects[4];

  const header = "%PDF-1.4\n";
  const xrefOffset = header.length + body.length;

  let xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(header.length + offset).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, "utf-8");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapePdf(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// --- Document definitions (18 total: 10 input + 8 output) ---

const DOCUMENTS: DocumentDef[] = [
  // ── P1: Product Launch (input: launch brief, competitor audit) ─────
  {
    originalName: "launch-brief.pdf",
    mimeType: "application/pdf",
    projectIndex: 0,
    taskIndex: 0, // Competitive analysis
    direction: "input",
    category: "brief",
    content: () =>
      Promise.resolve(
        createPdfSync(
          `AI Copilot v2 Launch Brief

Product
AI Copilot v2 — multi-agent orchestration platform for business operations.
52+ agent profiles, 25 workflow patterns, 5 AI runtimes.

Target Audience
Primary: Solo founders running AI-assisted businesses
Secondary: Agency owners managing multi-client AI operations
Tertiary: PE operating partners standardizing portfolio AI

Positioning
Tagline: "Your Business, Run by AI"
Category: AI Agent Orchestration Platform
Differentiator: The missing layer between "run an agent" and "run my business"

Launch Channels
1. Product Hunt (Day 1 — Tuesday)
2. Email sequence (3-touch, Day 0/3/7)
3. LinkedIn thought leadership (5-post series)
4. Twitter/X launch thread
5. Blog: "Why Your Business Needs an AI Operations Layer"

Success Metrics
- 500 signups in first 7 days
- 50 Product Hunt upvotes
- 3 press mentions
- 10% email-to-trial conversion rate

Timeline
Week -2: Copy + landing page
Week -1: A/B tests + social calendar
Week 0: Launch day
Week +1: Follow-up sequence + retargeting`
        )
      ),
  },
  {
    originalName: "competitor-analysis.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    projectIndex: 0,
    taskIndex: 0,
    direction: "input",
    category: "research",
    content: () =>
      createDocx(
        `AI Copilot Competitive Analysis

1. Cursor
Positioning: "The AI Code Editor"
Pricing: $20/mo (Pro), $40/mo (Business)
Strengths: IDE-native, fast autocomplete, good UX
Weaknesses: Code-only, no orchestration, no governance

2. Windsurf (Codeium)
Positioning: "The first agentic IDE"
Pricing: Free tier, $15/mo (Pro)
Strengths: Multi-file editing, strong free tier
Weaknesses: Developer-only, no business operations

3. GitHub Copilot
Positioning: "Your AI pair programmer"
Pricing: $10/mo (Individual), $19/seat (Business)
Strengths: Massive distribution (GitHub), brand trust
Weaknesses: Single-agent, no workflows, limited tools

4. Tabnine
Positioning: "AI that works where you work"
Pricing: $12/mo (Pro), enterprise pricing
Strengths: Privacy-focused, on-prem option
Weaknesses: Autocomplete-only, no agentic capabilities

5. Sourcegraph Cody
Positioning: "AI coding assistant with codebase context"
Pricing: Free tier, $9/seat (Pro)
Strengths: Codebase understanding, search integration
Weaknesses: Read-heavy, limited write operations

Key Gap: None of the 5 address multi-agent orchestration,
governance, or business operations beyond code.
Stagent's positioning as "business operations" is uncontested.`
      ),
  },

  // ── P1: Output documents ──────────────────────────────────────────
  {
    originalName: "launch-campaign-plan.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    projectIndex: 0,
    taskIndex: 1, // Write launch copy
    direction: "output",
    category: "report",
    content: () =>
      createDocx(
        `AI Copilot v2 — Launch Campaign Plan
Generated by GTM Launch Strategist Agent

Executive Summary
Multi-channel launch targeting solo founders and agency owners.
3 headline variants tested, email sequence drafted, social calendar set.

Headline Variants
A: "Your Business, Run by AI" — orchestration-led
B: "Stop Stitching — Start Orchestrating" — pain-led
C: "52 Agents. One Command Center." — scale-led

Email Sequence
Day 0: Launch announcement + quick start
Day 3: Feature deep-dive (workflows + governance)
Day 7: Case study — "How a solo founder runs 3 businesses with Stagent"

Social Calendar
Week 1: LinkedIn series (5 posts, MWF)
Week 1: Twitter launch thread (Day 1)
Week 2: Community engagement + retargeting

Recommendation
A/B test Variant A vs B. Orchestration messaging resonates with ops buyers.
Pain-led converts better on cold traffic. Test with 50/50 split, 7-day window.`
      ),
  },
  {
    originalName: "social-media-calendar.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    projectIndex: 0,
    taskIndex: 5, // Social media calendar task
    direction: "output",
    category: "template",
    content: () =>
      createPptx([
        "AI Copilot v2 — Social Media Launch Calendar",
        "Week 1, Mon: LinkedIn — 'Why your AI agents need a manager' (narrative hook, 1,200 impressions target)",
        "Week 1, Wed: LinkedIn — 'The governance gap in agentic AI' (problem framing, tag 3 industry voices)",
        "Week 1, Fri: LinkedIn — '3 patterns for multi-agent workflows' (tactical, include diagram)",
        "Week 1, Tue: Twitter — Launch thread (8 tweets, product screenshots, founder story)",
        "Week 2, Mon: LinkedIn — 'Local-first AI — why it matters' (contrarian take)",
        "Week 2, Wed: LinkedIn — 'We gave 52 agents one command center' (product reveal)",
        "Week 2, Fri: Community recap + user highlights",
      ]),
  },

  // ── P2: Content Engine (input: keyword research, editorial calendar) ──
  {
    originalName: "seo-keyword-research.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 1,
    taskIndex: 6, // Keyword research
    direction: "input",
    category: "research",
    content: async () =>
      createXlsx(
        `Keyword,Monthly Volume,Difficulty,CPC,SERP Features,Content Gap
AI agent orchestration,2400,38,4.20,Featured Snippet,No comprehensive guide
multi-agent framework,1800,42,3.80,People Also Ask,Comparison missing
AI agent platform,4200,55,6.50,Ads + Featured,Dominated by LangChain
agentic AI tools,3100,35,5.10,People Also Ask,No tools roundup
AI workflow automation,5600,48,7.20,Featured Snippet,Enterprise-focused only
agent governance AI,890,22,3.40,None,Zero coverage
AI operations platform,1200,30,4.80,Ads,SaaS angle missing
multi-runtime AI,340,15,2.90,None,Zero coverage
AI agent scheduling,720,28,3.20,People Also Ask,Cron-focused only
heartbeat monitoring AI,180,12,2.10,None,Zero coverage`
      ),
  },
  {
    originalName: "editorial-calendar.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 1,
    taskIndex: 7, // Write article
    direction: "input",
    category: "template",
    content: async () =>
      createXlsx(
        `Week,Topic,Primary Keyword,Target Words,Status,Author,Publish Date
W14,AI Agent Orchestration Guide,AI agent orchestration,1800,Published,Content Agent,2026-03-28
W15,Multi-Agent Workflows Explained,multi-agent framework,1500,In Progress,Content Agent,2026-04-04
W16,Governance for Agentic AI,agent governance AI,1600,Outlined,Content Agent,2026-04-11
W17,AI Ops for Solo Founders,AI operations platform,1400,Planned,Content Agent,2026-04-18
W18,Heartbeat Scheduling Deep Dive,heartbeat monitoring AI,1200,Planned,Content Agent,2026-04-25
W19,Multi-Runtime Architecture,multi-runtime AI,1800,Planned,Content Agent,2026-05-02
W20,AI Agent Tools Roundup 2026,agentic AI tools,2000,Planned,Content Agent,2026-05-09`
      ),
  },

  // ── P2: Output ────────────────────────────────────────────────────
  {
    originalName: "weekly-content-report.pdf",
    mimeType: "application/pdf",
    projectIndex: 1,
    taskIndex: 7,
    direction: "output",
    category: "report",
    content: () =>
      Promise.resolve(
        createPdfSync(
          `Weekly Content Performance Report — W14
Generated by Content Production Editor Agent

Published This Week
- "AI Agent Orchestration Guide" — 1,920 words, published Mar 28
  Organic sessions: 342 (first 5 days)
  Avg time on page: 4:12
  Backlinks acquired: 2 (DevOps Weekly, AI Newsletter)

SEO Performance
- Target keyword: "AI agent orchestration" — currently position 14
  (expected to reach page 1 within 3 weeks)
- Secondary keywords indexed: 4 of 6

Distribution Metrics
- LinkedIn post: 1,240 impressions, 89 engagements (7.2% rate)
- Newsletter: 28% open rate, 4.2% click-through
- Twitter thread: 3,400 impressions, 42 likes

Next Week
- Topic: "Multi-Agent Workflows Explained"
- Status: Outline approved, draft in progress
- Distribution: LinkedIn + newsletter + Dev.to cross-post`
        )
      ),
  },

  // ── P3: Customer Success (input: feedback export, onboarding playbook) ──
  {
    originalName: "customer-feedback-export.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 2,
    taskIndex: 13, // Churn analysis
    direction: "input",
    category: "data",
    content: async () =>
      createXlsx(
        `Account,Plan,MRR,NPS Score,Last Login,Support Tickets,Health
Acme Corp,Team,$499,72,2026-04-02,1,Green
DataFlow AI,Pro,$149,45,2026-03-28,3,Yellow
ScaleUp HQ,Team,$499,81,2026-04-01,0,Green
BrightPath,Pro,$149,28,2026-03-15,5,Red
CloudBase,Pro,$149,65,2026-04-01,2,Green
NexaPay,Team,$499,38,2026-03-20,4,Yellow
QuickShip,Pro,$149,55,2026-03-30,1,Green
TechStart,Community,$0,22,2026-02-28,6,Red
GreenGrid,Pro,$149,70,2026-04-02,0,Green
Meridian Corp,Team,$499,42,2026-03-25,3,Yellow`
      ),
  },
  {
    originalName: "onboarding-playbook.pdf",
    mimeType: "application/pdf",
    projectIndex: 2,
    taskIndex: 12, // Build onboarding sequence
    direction: "input",
    category: "brief",
    content: () =>
      Promise.resolve(
        createPdfSync(
          `Customer Onboarding Playbook

Day 0: Welcome + Quick Start
- Send welcome email with getting started guide
- Trigger in-app checklist: create project, run first agent, set up workflow
- Segment by plan tier (Community/Pro/Team)

Day 2: Feature Spotlight
- Email: "Your first agent in 5 minutes" walkthrough
- Link to video tutorial (2 min)
- CTA: Run your first workflow

Day 5: Check-In
- Email: "How are things going?"
- Direct reply CTA — route to CS team
- If no project created: trigger CSM outreach

Day 14: Health Check
- Automated assessment: login frequency, feature adoption, support tickets
- Score: Green (active), Yellow (partial), Red (at-risk)
- Red accounts: immediate CSM call + personalized rescue plan

Success Metrics
- Day 7 activation rate: 65% target
- Day 30 retention: 80% target
- NPS at Day 30: 50+ target`
        )
      ),
  },

  // ── P3: Output ────────────────────────────────────────────────────
  {
    originalName: "churn-risk-report.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 2,
    taskIndex: 13,
    direction: "output",
    category: "report",
    content: async () =>
      createXlsx(
        `Account,Risk Score,Primary Signal,Days Since Login,Open Tickets,NPS Trend,Intervention
BrightPath,92,Low usage + high tickets,19,5,Declining (-15),Schedule CSM call — offer training session
TechStart,88,No login in 34 days,34,6,N/A (no response),Executive outreach — potential churn
NexaPay,65,NPS drop + stalled onboarding,14,4,Declining (-8),Feature walkthrough — focus on workflows
DataFlow AI,45,Moderate tickets,6,3,Stable,Monitor — send check-in email
Meridian Corp,40,NPS dip,9,3,Slight decline (-3),Proactive NPS follow-up`
      ),
  },

  // ── P4: TechVenture Partners (input: financials, market sizing) ──
  {
    originalName: "financial-statements.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 3,
    taskIndex: 18, // Financial deep dive
    direction: "input",
    category: "data",
    content: async () =>
      createXlsx(
        `Metric,2024 Q1,2024 Q2,2024 Q3,2024 Q4,2025 Q1,2025 Q2,2025 Q3,2025 Q4,2026 Q1
ARR ($M),3.2,3.8,4.5,5.2,5.8,6.4,7.1,7.8,8.2
MRR ($K),267,317,375,433,483,533,592,650,683
Gross Margin (%),74,75,76,77,78,78,78,78,78
Net Retention (%),108,110,112,115,116,117,118,118,118
Burn Rate ($K/mo),420,410,400,395,390,385,380,380,380
Runway (months),22,20,18,17,16,15,14,14,14
Customer Count,42,51,63,78,89,102,115,128,138
Avg Contract Value ($K),76,75,71,67,65,63,62,61,59`
      ),
  },
  {
    originalName: "market-sizing.pdf",
    mimeType: "application/pdf",
    projectIndex: 3,
    taskIndex: 19, // Market sizing
    direction: "input",
    category: "research",
    content: () =>
      Promise.resolve(
        createPdfSync(
          `Healthcare Scheduling Market Analysis

Total Addressable Market (TAM)
US healthcare scheduling software: $12.4B (2026)
Growing at 18% CAGR driven by:
- Labor shortages forcing efficiency
- Patient no-show costs ($150B annually)
- Telehealth integration demand

Serviceable Addressable Market (SAM)
AI-enabled scheduling, mid-market (10-200 providers): $3.8B
Key requirements: intelligent scheduling, no-show prediction,
multi-provider coordination, EHR integration

Serviceable Obtainable Market (SOM)
Outpatient clinics in top 20 metros: $420M
Why: concentrated provider networks, highest no-show rates,
most receptive to AI (34% have AI budget allocated)

Competitive Landscape
1. Zocdoc — consumer-facing, not AI-native
2. Phreesia — check-in focused, scheduling is secondary
3. QGenda — physician scheduling, not patient-facing
4. Clockwise Health — early stage, limited features

None have true AI-powered scheduling optimization.
Greenfield for an AI-native entrant like HealthSync.`
        )
      ),
  },

  // ── P4: Output ────────────────────────────────────────────────────
  {
    originalName: "due-diligence-memo.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    projectIndex: 3,
    taskIndex: 20, // Write DD memo
    direction: "output",
    category: "report",
    content: () =>
      createDocx(
        `HealthSync Due Diligence Memo
Prepared by Portfolio Due Diligence Analyst Agent

EXECUTIVE SUMMARY
HealthSync is a category-defining AI scheduling platform targeting
mid-market outpatient practices. The company demonstrates strong
product-market fit with 118% net retention and 42% ARR growth.

INVESTMENT THESIS
1. AI-native product with proven 35% no-show reduction
2. Net retention 118% signals expansion revenue
3. Greenfield competitive landscape — no AI-native incumbents
4. $3.8B SAM growing at 24% CAGR

FINANCIAL HIGHLIGHTS
- ARR: $8.2M (42% YoY growth)
- Gross margin: 78%
- Burn rate: $380K/mo
- Runway: 14 months
- LTV/CAC: 4.2x (payback 11 months)

TOP RISKS
1. Customer concentration: top 5 accounts = 62% of ARR
   Mitigant: Logo diversification plan targets 20 new logos in 12 months
2. Single-product risk: scheduling only
   Mitigant: Waitlist management and patient engagement on roadmap
3. Regulatory: HIPAA compliance complexity for new markets
   Mitigant: SOC 2 Type II certified, HIPAA BAA standard

RECOMMENDATION: GO
Invest at current $45M valuation ($5.5x ARR)
Condition: Secure 3 new enterprise logos within 6 months`
      ),
  },
  {
    originalName: "board-deck.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    projectIndex: 3,
    taskIndex: 21, // Board deck
    direction: "output",
    category: "report",
    content: () =>
      createPptx([
        "TechVenture Partners — Q2 Portfolio Review",
        "Portfolio Overview: 4 companies, $28M combined ARR, 38% weighted growth",
        "HealthSync: $8.2M ARR (+42%), 78% GM, 118% NRR — GO recommendation, DD complete",
        "NovaPay: $12.1M ARR (+35%), 72% GM, 112% NRR — stable, watching burn rate",
        "DataBridge: $5.4M ARR (+48%), 68% GM, 125% NRR — fastest growth, needs sales hire",
        "CloudSecure: $2.3M ARR (+28%), 82% GM, 108% NRR — early but promising unit economics",
        "Key Actions: (1) Close HealthSync investment (2) NovaPay CFO search (3) DataBridge Series A prep",
        "Risk Watch: NovaPay burn acceleration, DataBridge single-threaded sales",
      ]),
  },

  // ── P5: GreenLeaf Commerce (input: product catalog) ──────────────
  {
    originalName: "product-catalog.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 4,
    taskIndex: 24, // Scrape listings
    direction: "input",
    category: "data",
    content: async () =>
      createXlsx(
        `SKU,Product Name,Category,Price,Reviews,Rating,Monthly Searches,Listing Score
SKU-1042,Bamboo Kitchen Set,Kitchen,$49.99,342,4.2,2800,52
SKU-1108,Organic Cotton Sheets,Bedding,$89.99,1205,4.6,4200,71
SKU-1215,Recycled Glass Vases,Decor,$34.99,187,4.1,1100,48
SKU-1301,Eco Yoga Mat,Fitness,$59.99,892,4.5,3400,68
SKU-1422,Reusable Beeswax Wraps,Kitchen,$24.99,2341,4.7,5100,82
SKU-1503,Solar Garden Lights,Outdoor,$39.99,567,4.3,2200,61
SKU-1618,Bamboo Toothbrush Set,Personal,$12.99,3102,4.4,6800,75
SKU-1722,Recycled Tote Bags,Accessories,$19.99,1456,4.5,3900,73
SKU-1834,Organic Face Serum,Beauty,$44.99,723,4.1,2600,55
SKU-1901,Compostable Phone Case,Accessories,$29.99,445,3.9,1800,44`
      ),
  },

  // ── P7: Revenue Operations (input: pipeline snapshot) ─────────────
  {
    originalName: "pipeline-snapshot.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 6,
    taskIndex: 36, // Pull pipeline snapshot
    direction: "input",
    category: "data",
    content: async () =>
      createXlsx(
        `Deal Name,Owner,Stage,Amount,Days in Stage,Close Date,Next Step,Risk
Acme Corp Expansion,Sarah K,Negotiation,$180K,3,2026-04-15,Contract review,Low
Atlas Financial,Mike R,Evaluation,$95K,8,2026-04-30,Demo follow-up,Medium
Meridian Corp,Sarah K,Proposal,$220K,12,2026-05-10,VP meeting needed,High
Pinnacle Tech,Jordan L,Evaluation,$65K,15,2026-05-30,Re-qualify,High
DataPulse,Mike R,Discovery,$45K,2,2026-06-15,Discovery call #2,Low
NexaHealth,Jordan L,Proposal,$150K,5,2026-04-25,Pricing discussion,Medium
CloudFirst,Sarah K,Negotiation,$310K,1,2026-04-10,MSA redline,Low
GreenTech Solutions,Mike R,Discovery,$75K,4,2026-06-30,Needs analysis,Low
Summit Partners,Jordan L,Evaluation,$120K,7,2026-05-15,Technical review,Medium
Vertex Labs,Sarah K,Discovery,$55K,1,2026-07-15,Intro meeting,Low`
      ),
  },

  // ── P7: Output ────────────────────────────────────────────────────
  {
    originalName: "weekly-deal-review.pdf",
    mimeType: "application/pdf",
    projectIndex: 6,
    taskIndex: 37, // Score deal risk
    direction: "output",
    category: "report",
    content: () =>
      Promise.resolve(
        createPdfSync(
          `Weekly Deal Review — Revenue Operations
Generated by Revenue Operations Analyst Agent

Pipeline Summary
Active deals: 10 | Total weighted: $2.8M
Net new this week: +3 deals ($175K)
Lost this week: 0 | Won this week: 0

Forecast by Confidence
Committed: $490K (Acme + CloudFirst)
Best case: $865K (+ NexaHealth + Atlas)
Upside: $1.34M (+ Meridian + Summit)

Stalled Deals (Action Required)
1. Meridian Corp ($220K) — 12 days, no activity
   Action: VP-to-VP outreach, Sarah to schedule exec call
2. Pinnacle Tech ($65K) — 15 days, close date pushed 3x
   Action: Re-qualify — may not be a real opportunity
3. Atlas Financial ($95K) — competitor mentioned
   Action: Send competitive battle card, schedule value demo

Rep Coaching Notes
Sarah K: Strong pipeline ($765K), close Acme this week
Mike R: Needs help with Atlas — prep competitive response
Jordan L: Pinnacle stall — coach on qualification criteria

Top 3 Actions This Week
1. Close Acme Corp — contract in redline, push for signature
2. Meridian rescue — exec outreach before deal goes cold
3. Pinnacle qualification — go/no-go decision by Friday`
        )
      ),
  },

  // ── P8: Compliance (output: audit report) ─────────────────────────
  {
    originalName: "compliance-audit-report.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    projectIndex: 7,
    taskIndex: 42, // Gather March logs
    direction: "output",
    category: "report",
    content: () =>
      createDocx(
        `Monthly Compliance Audit Report — March 2026
Generated by Compliance Audit Workflow

EXECUTIVE SUMMARY
Overall posture: GREEN (improving)
Controls satisfied: 14 of 16 (87.5%)
Trend: +1 control vs February (81.25%)

AUDIT SCOPE
Period: March 1-31, 2026
Governed executions: 1,247
Permission requests: 89 (82 approved, 7 denied)
Tool invocations: 3,420

CONTROL EFFECTIVENESS
CC1.1 - Access Control: PASS
CC1.2 - Authentication: PASS
CC2.1 - Risk Assessment: PASS
CC3.1 - Change Management: PASS
CC5.1 - Monitoring: PASS
CC6.1 - Logical Access: PARTIAL (3 Bash auto-approves)
CC7.2 - Incident Response: PARTIAL (budget breach alerts)

GAP ANALYSIS
1. CC6.1 — 3 Bash commands auto-approved that should require review
   Severity: Medium
   Remediation: Update auto-approve policy by April 15

2. CC7.2 — Heartbeat budget exceeded twice without notification
   Severity: Low
   Remediation: Add budget breach alert by April 10

MONTH-OVER-MONTH TREND
January: 75.0% (4 gaps) — YELLOW
February: 81.25% (3 gaps) — YELLOW
March: 87.5% (2 gaps) — GREEN
Target: 93.75% by June (1 gap max)`
      ),
  },
];

/**
 * Write document files to disk and return seed records.
 * Async because DOCX/PPTX generation uses JSZip's async API.
 */
export async function createDocuments(
  projectIds: string[],
  taskIds: string[]
): Promise<DocumentSeed[]> {
  mkdirSync(uploadsDir, { recursive: true });

  const results: DocumentSeed[] = [];

  for (const def of DOCUMENTS) {
    const id = crypto.randomUUID();
    const ext = def.originalName.split(".").pop()!;
    const filename = `${id}.${ext}`;
    const storagePath = join(uploadsDir, filename);

    let buf: Buffer;
    if (typeof def.content === "function") {
      buf = await def.content();
    } else {
      buf = Buffer.from(def.content, "utf-8");
    }
    writeFileSync(storagePath, buf);

    const taskId = taskIds[def.taskIndex];
    const projectId = projectIds[def.projectIndex];

    results.push({
      id,
      taskId,
      projectId,
      filename,
      originalName: def.originalName,
      mimeType: def.mimeType,
      size: buf.length,
      storagePath,
      direction: def.direction,
      category: def.category,
      status: "uploaded" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return results;
}
