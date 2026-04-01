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
  direction: "input";
  status: "uploaded";
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentDef {
  originalName: string;
  mimeType: string;
  projectIndex: number;
  taskIndex: number;
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

// --- Document definitions ---

const DOCUMENTS: DocumentDef[] = [
  // Project 1 — Investment Portfolio
  {
    originalName: "portfolio-holdings.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 0,
    taskIndex: 0,
    content: async () =>
      createXlsx(
          `Ticker,Shares,Avg Cost,Current Price,Market Value,Sector
NVDA,45,285.50,890.25,40061.25,Technology
AAPL,120,142.30,178.50,21420.00,Technology
MSFT,65,310.00,415.80,27027.00,Technology
GOOGL,80,125.40,172.30,13784.00,Technology
AMZN,55,128.50,185.60,10208.00,Consumer
JNJ,90,158.20,155.80,14022.00,Healthcare
UNH,25,485.00,528.40,13210.00,Healthcare
JPM,70,142.80,198.50,13895.00,Finance
V,50,235.60,282.40,14120.00,Finance
XOM,85,98.40,108.20,9197.00,Energy
PG,60,148.50,165.20,9912.00,Consumer
LLY,15,580.00,782.50,11737.50,Healthcare
HD,35,325.00,348.90,12211.50,Consumer
MA,40,368.50,462.80,18512.00,Finance
CVX,55,152.30,158.40,8712.00,Energy`
      ),
  },
  {
    originalName: "semiconductor-research.pdf",
    mimeType: "application/pdf",
    projectIndex: 0,
    taskIndex: 1,
    content: () =>
      Promise.resolve(
        createPdfSync(
          `Semiconductor Industry ETF Analysis

Market Overview
The semiconductor sector has seen exceptional growth driven by AI
infrastructure demand, automotive chip adoption, and cloud computing.
Total addressable market projected at $1.2T by 2030.

SOXX - iShares Semiconductor ETF
Expense Ratio: 0.35%, Holdings: 30, 5-Year Return: +142%
Top 5: NVDA 9.8%, AVGO 8.2%, AMD 7.1%, QCOM 5.5%, TXN 5.2%

SMH - VanEck Semiconductor ETF
Expense Ratio: 0.35%, Holdings: 25, 5-Year Return: +158%
Top 5: NVDA 14.2%, TSM 12.8%, AVGO 6.5%, AMD 5.1%, ASML 4.8%

PSI - Invesco Dynamic Semiconductors ETF
Expense Ratio: 0.56%, Holdings: 30, 5-Year Return: +98%

Recommendation: SMH for concentrated AI exposure, SOXX for diversification.`
        )
      ),
  },

  // Project 2 — Landing Page
  {
    originalName: "competitor-audit.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    projectIndex: 1,
    taskIndex: 5,
    content: () =>
      createDocx(
        `Competitor Landing Page Audit

1. Notion (notion.so)
Hero: "Your wiki, docs, & projects. Together."
Strengths: Clean design, interactive demo, strong social proof (10M+ users)
Weaknesses: Hero is text-heavy, no personalization
CTA: "Get Notion free" - low commitment

2. Linear (linear.app)
Hero: "Linear is a purpose-built tool for planning and building products"
Strengths: Dark theme feels premium, keyboard shortcut demo, speed-focused
Weaknesses: Appeals mainly to developers, narrow audience
CTA: "Start building" - action-oriented

3. Vercel (vercel.com)
Hero: "Develop. Preview. Ship." - three-word framework
Strengths: Live deployment demo, framework logos, dark/light toggle
Weaknesses: Very technical, assumes Next.js knowledge
CTA: "Start Deploying" - verb-first

4. Stripe (stripe.com)
Hero: "Financial infrastructure for the internet"
Strengths: Animated code snippets, multiple audience entry points, trust badges
Weaknesses: Dense page, high cognitive load
CTA: "Start now" with "Contact sales" secondary

Key Patterns:
- All use social proof above the fold
- 2 of 4 feature interactive demos
- Average CTA count: 3 per page

Opportunity: Dynamic hero based on referral source. None of the 4 do this.`
      ),
  },
  {
    originalName: "design-brief.pdf",
    mimeType: "application/pdf",
    projectIndex: 1,
    taskIndex: 6,
    content: () =>
      Promise.resolve(
        createPdfSync(
          `Landing Page Design Brief

Brand Voice
Tone: Confident, not arrogant. Technical, but accessible.
Personality: The smart colleague who explains things clearly
Avoid: Jargon-heavy copy, exclamation marks, hyperbole

Target Audience - Primary: Engineering Managers
Age 30-45, managing 5-20 person teams
Pain points: sprint planning overhead, context switching, tool fatigue

Target Audience - Secondary: Individual Developers
Age 25-35, working in fast-paced startups
Pain points: slow tooling, too many tabs, broken workflows

Messaging Pillars
1. Speed - "Build faster"
2. Intelligence - AI that understands your codebase
3. Simplicity - One tool, not ten

Visual Direction
- OKLCH color system, primary hue 250 (blue-indigo)
- Monospace code snippets for technical credibility
- Subtle animations on scroll

Conversion Goals
Primary: Sign up for free trial
Secondary: Book a demo (enterprise)
Tertiary: Newsletter subscription`
        )
      ),
  },

  // Project 3 — Lead Generation
  {
    originalName: "prospect-list.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 2,
    taskIndex: 10,
    content: async () =>
      createXlsx(
          `Name,Title,Company,Industry,Size,LinkedIn URL,Email,Status
Sarah Chen,VP Engineering,Acme Corp,SaaS,500-1000,linkedin.com/in/sarachen,s.chen@acmecorp.com,Qualified
Marcus Johnson,Director of Engineering,Acme Corp,SaaS,500-1000,linkedin.com/in/marcusjohnson,m.johnson@acmecorp.com,Qualified
Rachel Kim,VP Product,Acme Corp,SaaS,500-1000,linkedin.com/in/rachelkim,r.kim@acmecorp.com,Qualified
David Park,CTO,TechStart Inc,DevTools,50-200,linkedin.com/in/davidpark,d.park@techstart.io,Qualified
Lisa Wang,VP Engineering,TechStart Inc,DevTools,50-200,linkedin.com/in/lisawang,l.wang@techstart.io,Qualified
James Miller,VP Product,CloudBase,Infrastructure,200-500,linkedin.com/in/jamesmiller,j.miller@cloudbase.dev,Contacted
Maria Garcia,Director of Engineering,DataFlow AI,AI/ML,100-200,linkedin.com/in/mariagarcia,m.garcia@dataflow.ai,Qualified
Tom Anderson,VP Engineering,ScaleUp HQ,FinTech,500-1000,linkedin.com/in/tomanderson,t.anderson@scaleuphq.com,Qualified
Nina Patel,CTO,QuickShip,Logistics,200-500,linkedin.com/in/ninapatel,n.patel@quickship.co,Researching
Alex Turner,Director of Engineering,BrightPath,EdTech,100-200,linkedin.com/in/alexturner,a.turner@brightpath.edu,Qualified
Sophie Reed,VP Product,GreenGrid,CleanTech,50-200,linkedin.com/in/sophiereed,s.reed@greengrid.io,Researching
Chris Wong,VP Engineering,NexaPay,FinTech,200-500,linkedin.com/in/chriswong,c.wong@nexapay.com,Qualified`
      ),
  },
  {
    originalName: "outreach-templates.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    projectIndex: 2,
    taskIndex: 12,
    content: () =>
      createDocx(
        `Personalized Outreach Email Templates

Template 1: Pain Point Hook
Subject: {Company}'s engineering velocity - quick question

Hi {FirstName},

I noticed {Company} recently {recent_event}. Congrats!

When teams scale past {team_size} engineers, we often see sprint planning eat up 20%+ of leadership time. Is that something you're running into?

We built something that cuts that overhead in half using AI-powered task routing. Would love 15 minutes to show you how {similar_company} uses it.

Best, [Sender]


Template 2: Social Proof
Subject: How {similar_company} ships 2x faster

Hi {FirstName},

{similar_company}'s VP of Eng shared something interesting - their team went from 2-week sprints to continuous delivery. Deployment frequency up 180%.

I think {Company} could see similar results given your {tech_stack} setup. Worth a quick chat?

Cheers, [Sender]


Template 3: Breakup / Last Touch
Subject: Closing the loop

Hi {FirstName},

I've reached out a couple times and totally get it if the timing isn't right.

If engineering velocity is ever a priority for {Company}, here's what we do: [one-liner + link].

No hard feelings. The door's always open.

All the best, [Sender]`
      ),
  },

  // Project 4 — Business Trip
  {
    originalName: "trip-itinerary.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    projectIndex: 3,
    taskIndex: 17,
    content: () =>
      createDocx(
        `NYC Business Trip Itinerary - March 15-18, 2025

Day 1 - Saturday, March 15
7:00 AM  Depart SFO - United UA 456, Gate B12 (TSA Pre)
3:30 PM  Arrive JFK Terminal 7 - Uber to hotel (~45 min)
4:30 PM  Hotel check-in - The Manhattan Club, 200 W 56th St
6:00 PM  Conference keynote - Javits Center, Hall 1A
8:00 PM  Team dinner - Carbone, 181 Thompson St

Day 2 - Sunday, March 16
8:30 AM  Breakfast meeting - The Smith (J. Rivera, Acme Corp)
10:00 AM Partner meeting #1 - Acme Corp HQ, 350 5th Ave
12:00 PM Lunch - Le Bernardin, 155 W 51st St
2:00 PM  Client meeting - DataFlow AI, 85 Broad St
4:30 PM  Partner meeting #2 - ScaleUp HQ, 28 W 23rd St
7:00 PM  Networking event - Rooftop at The Standard

Day 3 - Monday, March 17
9:00 AM  Workshop - Javits Center, Room 204
12:00 PM Working lunch - Hotel lobby cafe
2:00 PM  Team standup (Zoom)
3:00 PM  Hotel checkout
6:00 PM  Depart JFK - United UA 891, Terminal 7
9:15 PM  Arrive SFO

Travel Budget:
Flights: $660 | Hotel: $867 | Meals: $225
Ground transport: $200 | Misc: $100
Total: $2,052 (Pre-approved #EXP-2025-0342)`
      ),
  },
  {
    originalName: "expense-report.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 3,
    taskIndex: 19,
    content: async () =>
      createXlsx(
          `Date,Category,Vendor,Amount,Description,Receipt
2025-03-15,Airfare,United Airlines,342.00,SFO to JFK Economy Plus UA 456,receipt-001.pdf
2025-03-15,Ground Transport,Uber,62.50,JFK to Manhattan Club hotel,receipt-002.pdf
2025-03-15,Meals,Carbone Restaurant,89.00,Team dinner (4 people split),receipt-003.pdf
2025-03-16,Meals,The Smith NYC,28.50,Breakfast meeting with J. Rivera,receipt-004.pdf
2025-03-16,Ground Transport,Uber,18.75,Hotel to Acme Corp,receipt-005.pdf
2025-03-16,Meals,Le Bernardin,65.00,Working lunch,receipt-006.pdf
2025-03-16,Ground Transport,Uber,32.40,Acme to DataFlow AI,receipt-007.pdf
2025-03-16,Ground Transport,Lyft,24.80,DataFlow to ScaleUp HQ,receipt-008.pdf
2025-03-16,Meals,Rooftop at The Standard,42.00,Networking event,receipt-009.pdf
2025-03-17,Meals,Hotel Lobby Cafe,18.50,Working lunch,receipt-010.pdf
2025-03-17,Ground Transport,Uber,58.20,Manhattan Club to JFK,receipt-011.pdf
2025-03-17,Conference,TechConf 2025,299.00,Conference registration,receipt-012.pdf
2025-03-15,Hotel,The Manhattan Club,289.00,Night 1 Standard King,receipt-013.pdf
2025-03-16,Hotel,The Manhattan Club,289.00,Night 2 Standard King,receipt-014.pdf
2025-03-17,Hotel,The Manhattan Club,289.00,Night 3 Standard King,receipt-015.pdf
2025-03-15,Meals,Starbucks JFK,8.40,Coffee at terminal,receipt-016.pdf
2025-03-16,Miscellaneous,CVS Pharmacy,12.80,Phone charger,receipt-017.pdf
2025-03-17,Miscellaneous,Hotel Concierge,15.00,Luggage storage tip,receipt-018.pdf`
      ),
  },

  // Project 5 — Tax Filing
  {
    originalName: "tax-documents-checklist.pdf",
    mimeType: "application/pdf",
    projectIndex: 4,
    taskIndex: 20,
    content: () =>
      Promise.resolve(
        createPdfSync(
          `2025 Tax Documents Checklist

INCOME DOCUMENTS
[X] W-2 - TechCorp Inc (primary employer)
    Gross wages: $185,000 | Federal withholding: $37,200
    State withholding: $12,580 | Received: Jan 28

[X] 1099-INT - Chase Bank (savings interest)
    Interest income: $1,240 | Received: Feb 2

[X] 1099-DIV - Fidelity Investments
    Ordinary dividends: $3,850 | Qualified: $2,910

[X] 1099-B - Charles Schwab (stock sales)
    Proceeds: $42,800 | Cost basis: $38,200 | Net gain: $4,600

[ ] 1099-NEC - Freelance Client (PENDING)
    Expected: ~$8,500

DEDUCTION DOCUMENTS
[X] 1098 - Wells Fargo (mortgage interest)
    Interest paid: $18,400 | Property tax: $6,200

[X] Charitable donations - receipts compiled
    Cash: $2,400 | Goodwill (FMV): $800

[ ] Home office measurements - pending calculation

[X] State estimated tax payments
    Q1-Q4: $3,200 each | Total: $12,800

STATUS: 7 of 8 documents collected (87.5%)`
        )
      ),
  },
  {
    originalName: "deductible-expenses.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    projectIndex: 4,
    taskIndex: 21,
    content: async () =>
      createXlsx(
          `Date,Category,Description,Amount,Deductible,Notes
2025-01-05,Home Office,Internet service (pro-rata),45.00,Yes,8.3% of total
2025-01-05,Home Office,Electricity (pro-rata),32.00,Yes,8.3% of total
2025-01-12,Professional Dev,Udemy - Advanced TypeScript,29.99,Yes,Job-related
2025-01-15,Software,GitHub Pro subscription,7.00,Yes,Monthly
2025-01-15,Software,Figma Professional,15.00,Yes,Monthly
2025-01-20,Charitable,SF Food Bank donation,200.00,Yes,Receipt #4521
2025-02-01,Home Office,Ergonomic desk chair,485.00,Partial,May depreciate
2025-02-05,Home Office,Internet service (pro-rata),45.00,Yes,Monthly
2025-02-05,Home Office,Electricity (pro-rata),28.00,Yes,Lower winter bill
2025-02-10,Professional Dev,AWS SA exam fee,300.00,Yes,Certification
2025-02-14,Charitable,American Red Cross,150.00,Yes,Confirmation email
2025-02-15,Software,GitHub Pro subscription,7.00,Yes,Monthly
2025-02-15,Software,Figma Professional,15.00,Yes,Monthly
2025-03-01,Health,HSA contribution,500.00,Yes,Monthly
2025-03-05,Home Office,Internet service (pro-rata),45.00,Yes,Monthly
2025-03-05,Home Office,Electricity (pro-rata),35.00,Yes,Monthly
2025-03-10,Professional Dev,O'Reilly Safari,49.00,Yes,Annual
2025-03-12,Charitable,Local animal shelter,100.00,Yes,Receipt #782
2025-03-15,Software,GitHub Pro subscription,7.00,Yes,Monthly
2025-03-15,Software,Figma Professional,15.00,Yes,Monthly
2025-03-15,Equipment,External monitor (4K),650.00,Partial,Section 179
2025-03-20,Professional Dev,React Conference,350.00,Yes,Job-related
2025-04-01,Health,HSA contribution,500.00,Yes,Monthly
2025-04-05,Home Office,Internet (pro-rata),45.00,Yes,Monthly
2025-04-05,Home Office,Electricity (pro-rata),38.00,Yes,Spring cycle`
      ),
  },

  // Extra office docs for variety

  // Campaign pitch deck for lead gen
  {
    originalName: "campaign-pitch-deck.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    projectIndex: 2,
    taskIndex: 13,
    content: () =>
      createPptx([
        "Lead Generation Campaign - Q2 2025",
        "Target Market: VP/Director-level at B2B SaaS companies (50-1000 employees)",
        "Campaign Strategy: 3-touch email sequence over 14 days, segmented by company size and role",
        "Prospect Pipeline: 15 qualified leads across 8 companies",
        "Email Templates: Pain Point Hook (cold), Social Proof (warm), Breakup (last touch)",
        "Success Metrics: 40% open rate target, 8% reply rate, 3 meetings booked per week",
        "Timeline: Week 1 first touch, Week 2 follow-ups, Week 3 breakup + new prospects",
        "Budget: $0 organic outreach + $500/mo email tooling",
      ]),
  },

  // Quarterly performance summary for portfolio project
  {
    originalName: "q1-performance-summary.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    projectIndex: 0,
    taskIndex: 3,
    content: () =>
      createPptx([
        "Q1 2025 Portfolio Performance Summary",
        "Portfolio Value: $238,419 (+12.4% YTD vs S&P 500 +8.2%)",
        "Top Performers: NVDA +34%, LLY +22%, MA +18%",
        "Underperformers: JNJ -1.5%, CVX +3.8%, XOM +2.1%",
        "Sector Allocation: Tech 42%, Healthcare 18%, Finance 15%, Consumer 12%, Energy 8%, Cash 5%",
        "Risk Assessment: Tech concentration at 42% exceeds 35% target",
        "Dividend Income: $1,842 Q1 ($7,368 annualized, 3.1% yield)",
        "Action Items: Trim NVDA by 20 shares, Add UNH +10, Initiate SCHD position",
      ]),
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
      direction: "input" as const,
      status: "uploaded" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return results;
}
