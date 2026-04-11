import type { AppBundle } from "./types";

export const BUILTIN_APP_BUNDLES: AppBundle[] = [
  {
    manifest: {
      id: "wealth-manager",
      name: "Wealth Manager",
      version: "1.0.0",
      description:
        "Track a portfolio with positions, transactions, watchlists, and AI-assisted review rituals.",
      category: "finance",
      tags: ["portfolio", "investing", "tax", "watchlist"],
      difficulty: "intermediate",
      estimatedSetupMinutes: 5,
      icon: "TrendingUp",
      trustLevel: "official",
      permissions: [
        "projects:create",
        "tables:create",
        "tables:seed",
        "schedules:create",
        "profiles:link",
        "blueprints:link",
      ],
      sidebarLabel: "Wealth",
    },
    setupChecklist: [
      "Review the sample portfolio and clear it once you are ready to import your own holdings.",
      "Connect your real positions by importing a CSV into the Positions and Transactions tables.",
      "Unpause the daily review schedule after you confirm your portfolio structure.",
    ],
    profiles: [
      {
        id: "wealth-manager",
        label: "Wealth Manager",
        description: "Portfolio analysis and tax-aware planning profile.",
      },
      {
        id: "financial-analyst",
        label: "Financial Analyst",
        description: "General-purpose financial reporting and metric analysis.",
      },
    ],
    blueprints: [
      {
        id: "investment-research",
        label: "Investment Research",
        description: "Research a position, thesis, or asset allocation question.",
      },
      {
        id: "financial-reporting",
        label: "Financial Reporting",
        description: "Compile an investor-style review for a reporting period.",
      },
    ],
    tables: [
      {
        key: "positions",
        name: "Positions",
        description: "Core holdings and target allocation data.",
        columns: [
          { name: "symbol", displayName: "Symbol", dataType: "text", position: 0, required: true },
          { name: "name", displayName: "Name", dataType: "text", position: 1 },
          { name: "sector", displayName: "Sector", dataType: "text", position: 2 },
          { name: "shares", displayName: "Shares", dataType: "number", position: 3 },
          { name: "costBasis", displayName: "Cost Basis", dataType: "number", position: 4 },
          { name: "targetAllocation", displayName: "Target Allocation", dataType: "number", position: 5 },
          { name: "_sample", displayName: "Sample", dataType: "boolean", position: 6 },
        ],
        sampleRows: [
          { symbol: "AAPL", name: "Apple Inc.", sector: "Large-Cap Tech", shares: 40, costBasis: 173.4, targetAllocation: 8, _sample: true },
          { symbol: "MSFT", name: "Microsoft Corp.", sector: "Large-Cap Tech", shares: 28, costBasis: 401.2, targetAllocation: 7, _sample: true },
          { symbol: "VTI", name: "Vanguard Total Stock Market", sector: "Index ETF", shares: 120, costBasis: 224.8, targetAllocation: 18, _sample: true },
        ],
      },
      {
        key: "transactions",
        name: "Transactions",
        description: "Historical buys, sells, and dividend events.",
        columns: [
          { name: "date", displayName: "Date", dataType: "date", position: 0, required: true },
          { name: "symbol", displayName: "Symbol", dataType: "text", position: 1, required: true },
          { name: "action", displayName: "Action", dataType: "select", position: 2, config: { options: ["BUY", "SELL", "DIVIDEND"] } },
          { name: "shares", displayName: "Shares", dataType: "number", position: 3 },
          { name: "amount", displayName: "Amount", dataType: "number", position: 4 },
          { name: "notes", displayName: "Notes", dataType: "text", position: 5 },
          { name: "_sample", displayName: "Sample", dataType: "boolean", position: 6 },
        ],
        sampleRows: [
          { date: "2026-03-14", symbol: "AAPL", action: "BUY", shares: 10, amount: 1742, notes: "Added on pullback", _sample: true },
          { date: "2026-03-28", symbol: "MSFT", action: "BUY", shares: 8, amount: 3240, notes: "Trimmed cash allocation", _sample: true },
          { date: "2026-04-04", symbol: "VTI", action: "DIVIDEND", shares: 0, amount: 138, notes: "Quarterly dividend", _sample: true },
        ],
      },
      {
        key: "watchlist",
        name: "Watchlist",
        description: "Potential positions and triggers for review.",
        columns: [
          { name: "symbol", displayName: "Symbol", dataType: "text", position: 0, required: true },
          { name: "theme", displayName: "Theme", dataType: "text", position: 1 },
          { name: "targetPrice", displayName: "Target Price", dataType: "number", position: 2 },
          { name: "conviction", displayName: "Conviction", dataType: "select", position: 3, config: { options: ["High", "Medium", "Low"] } },
          { name: "nextReview", displayName: "Next Review", dataType: "date", position: 4 },
          { name: "_sample", displayName: "Sample", dataType: "boolean", position: 5 },
        ],
        sampleRows: [
          { symbol: "NVDA", theme: "AI infrastructure", targetPrice: 920, conviction: "High", nextReview: "2026-04-18", _sample: true },
          { symbol: "COST", theme: "Defensive compounder", targetPrice: 745, conviction: "Medium", nextReview: "2026-04-21", _sample: true },
        ],
      },
    ],
    schedules: [
      {
        key: "daily-review",
        name: "Daily Portfolio Review",
        description: "Paused by default until you are ready for AI-generated review notes.",
        prompt:
          "Review the portfolio tables, summarize allocation drift, and highlight any positions or watchlist items that need attention.",
        cronExpression: "0 16 * * 1-5",
        agentProfile: "wealth-manager",
      },
    ],
    ui: {
      pages: [
        {
          key: "overview",
          title: "Overview",
          description: "Monitor holdings, sample data status, and daily review readiness.",
          icon: "LayoutDashboard",
          path: "",
          widgets: [
            {
              type: "hero",
              eyebrow: "Verified app",
              title: "Portfolio operations, without custom code.",
              description:
                "This app instance is deterministic: tables, schedules, and views are provisioned directly by Stagent and can be customized after install.",
            },
            {
              type: "stats",
              title: "Workspace coverage",
              metrics: [
                { key: "positions", label: "Positions", tableKey: "positions", aggregation: "rowCount" },
                { key: "transactions", label: "Transactions", tableKey: "transactions", aggregation: "rowCount" },
                { key: "sample-positions", label: "Sample rows", tableKey: "positions", aggregation: "sampleCount" },
              ],
            },
            {
              type: "actions",
              title: "Next actions",
              actions: [
                {
                  key: "open-project",
                  label: "Open project",
                  description: "See the linked project and its broader operating context.",
                  action: { type: "openProject" },
                },
                {
                  key: "positions-table",
                  label: "Review positions",
                  description: "Open the Positions table with the seeded sample portfolio.",
                  variant: "outline",
                  action: { type: "openTable", tableKey: "positions" },
                },
                {
                  key: "clear-sample-data",
                  label: "Clear sample data",
                  description: "Delete seeded rows once you are ready for real portfolio data.",
                  variant: "secondary",
                  action: { type: "clearSampleData" },
                },
              ],
            },
            {
              type: "linkedAssets",
              title: "Included intelligence",
              showBlueprints: true,
              showProfiles: true,
            },
            {
              type: "scheduleList",
              title: "Automation",
              description: "Schedules are installed paused so you control when monitoring starts.",
            },
          ],
        },
        {
          key: "positions",
          title: "Positions",
          description: "Current holdings and allocation targets.",
          icon: "Briefcase",
          path: "positions",
          widgets: [
            {
              type: "table",
              title: "Positions table",
              description: "A preview of the live table installed for this app instance.",
              tableKey: "positions",
              columns: ["symbol", "name", "sector", "shares", "costBasis", "targetAllocation"],
              limit: 8,
            },
          ],
        },
        {
          key: "transactions",
          title: "Transactions",
          description: "Recent activity and commentary.",
          icon: "ArrowLeftRight",
          path: "transactions",
          widgets: [
            {
              type: "table",
              title: "Transactions table",
              description: "Seeded activity to help you validate the workflow before using real data.",
              tableKey: "transactions",
              columns: ["date", "symbol", "action", "shares", "amount", "notes"],
              limit: 8,
            },
          ],
        },
        {
          key: "watchlist",
          title: "Watchlist",
          description: "Research targets and conviction tracking.",
          icon: "Eye",
          path: "watchlist",
          widgets: [
            {
              type: "table",
              title: "Watchlist table",
              description: "Potential entries and next review dates.",
              tableKey: "watchlist",
              columns: ["symbol", "theme", "targetPrice", "conviction", "nextReview"],
              limit: 8,
            },
          ],
        },
      ],
    },
  },
  {
    manifest: {
      id: "growth-module",
      name: "Growth Module",
      version: "1.0.0",
      description:
        "Stand up a lightweight revenue operations workspace with leads, accounts, opportunities, and review rituals.",
      category: "sales",
      tags: ["pipeline", "crm", "revenue", "prospecting"],
      difficulty: "intermediate",
      estimatedSetupMinutes: 6,
      icon: "Rocket",
      trustLevel: "official",
      permissions: [
        "projects:create",
        "tables:create",
        "tables:seed",
        "schedules:create",
        "profiles:link",
        "blueprints:link",
      ],
      sidebarLabel: "Growth",
    },
    setupChecklist: [
      "Review the seeded contacts, accounts, and opportunities so the data model feels right.",
      "Import your own CRM export when the sample pipeline matches your workflow.",
      "Unpause the pipeline review schedule once your opportunities are live.",
    ],
    profiles: [
      {
        id: "sales-researcher",
        label: "Sales Researcher",
        description: "Prospecting and lead qualification support.",
      },
      {
        id: "marketing-strategist",
        label: "Marketing Strategist",
        description: "Campaign and content planning for demand generation.",
      },
      {
        id: "operations-coordinator",
        label: "Operations Coordinator",
        description: "Operational follow-through and pipeline hygiene.",
      },
    ],
    blueprints: [
      {
        id: "lead-research-pipeline",
        label: "Lead Research Pipeline",
        description: "Research, qualify, and prep outreach for new targets.",
      },
      {
        id: "content-marketing-pipeline",
        label: "Content Marketing Pipeline",
        description: "Build campaigns that support revenue motion.",
      },
      {
        id: "business-daily-briefing",
        label: "Business Daily Briefing",
        description: "Generate a recurring revenue and market context digest.",
      },
    ],
    tables: [
      {
        key: "contacts",
        name: "Contacts",
        description: "Prospects and champions in the revenue pipeline.",
        columns: [
          { name: "name", displayName: "Name", dataType: "text", position: 0, required: true },
          { name: "role", displayName: "Role", dataType: "text", position: 1 },
          { name: "company", displayName: "Company", dataType: "text", position: 2 },
          { name: "status", displayName: "Status", dataType: "select", position: 3, config: { options: ["Research", "Qualified", "Meeting", "Dormant"] } },
          { name: "nextStep", displayName: "Next Step", dataType: "text", position: 4 },
          { name: "_sample", displayName: "Sample", dataType: "boolean", position: 5 },
        ],
        sampleRows: [
          { name: "Morgan Lee", role: "VP Revenue", company: "Northwind AI", status: "Qualified", nextStep: "Send tailored deck", _sample: true },
          { name: "Priya Shah", role: "Growth Lead", company: "Beacon Cloud", status: "Meeting", nextStep: "Prep pilot success metrics", _sample: true },
          { name: "Luis Romero", role: "Ops Manager", company: "Verve Logistics", status: "Research", nextStep: "Research current stack", _sample: true },
        ],
      },
      {
        key: "accounts",
        name: "Accounts",
        description: "Target companies and account posture.",
        columns: [
          { name: "company", displayName: "Company", dataType: "text", position: 0, required: true },
          { name: "segment", displayName: "Segment", dataType: "select", position: 1, config: { options: ["SMB", "Mid-Market", "Enterprise"] } },
          { name: "owner", displayName: "Owner", dataType: "text", position: 2 },
          { name: "health", displayName: "Health", dataType: "select", position: 3, config: { options: ["Green", "Yellow", "Red"] } },
          { name: "nextReview", displayName: "Next Review", dataType: "date", position: 4 },
          { name: "_sample", displayName: "Sample", dataType: "boolean", position: 5 },
        ],
        sampleRows: [
          { company: "Northwind AI", segment: "Mid-Market", owner: "Avery", health: "Green", nextReview: "2026-04-16", _sample: true },
          { company: "Beacon Cloud", segment: "Enterprise", owner: "Jordan", health: "Yellow", nextReview: "2026-04-17", _sample: true },
        ],
      },
      {
        key: "opportunities",
        name: "Opportunities",
        description: "Pipeline entries and expected value.",
        columns: [
          { name: "name", displayName: "Opportunity", dataType: "text", position: 0, required: true },
          { name: "account", displayName: "Account", dataType: "text", position: 1, required: true },
          { name: "stage", displayName: "Stage", dataType: "select", position: 2, config: { options: ["Discovery", "Proposal", "Pilot", "Negotiation"] } },
          { name: "amount", displayName: "Amount", dataType: "number", position: 3 },
          { name: "closeDate", displayName: "Close Date", dataType: "date", position: 4 },
          { name: "_sample", displayName: "Sample", dataType: "boolean", position: 5 },
        ],
        sampleRows: [
          { name: "Northwind expansion", account: "Northwind AI", stage: "Proposal", amount: 48000, closeDate: "2026-05-03", _sample: true },
          { name: "Beacon pilot", account: "Beacon Cloud", stage: "Pilot", amount: 72000, closeDate: "2026-05-14", _sample: true },
        ],
      },
    ],
    schedules: [
      {
        key: "pipeline-review",
        name: "Weekly Pipeline Review",
        description: "Summarize opportunity movement, risk, and next steps.",
        prompt:
          "Review the growth module tables, summarize pipeline movement, flag stalled opportunities, and recommend the next operator actions.",
        cronExpression: "0 9 * * 1",
        agentProfile: "operations-coordinator",
      },
    ],
    ui: {
      pages: [
        {
          key: "overview",
          title: "Overview",
          description: "See seeded CRM coverage and the actions needed to personalize it.",
          icon: "LayoutDashboard",
          path: "",
          widgets: [
            {
              type: "hero",
              eyebrow: "Verified app",
              title: "A deterministic revenue workspace.",
              description:
                "Install creates project-bound tables and paused schedules. You can validate the structure immediately and customize it later through normal Stagent workflows.",
            },
            {
              type: "stats",
              title: "Installed assets",
              metrics: [
                { key: "contacts", label: "Contacts", tableKey: "contacts", aggregation: "rowCount" },
                { key: "accounts", label: "Accounts", tableKey: "accounts", aggregation: "rowCount" },
                { key: "opps", label: "Opportunities", tableKey: "opportunities", aggregation: "rowCount" },
              ],
            },
            {
              type: "actions",
              title: "Get started",
              actions: [
                {
                  key: "project",
                  label: "Open project",
                  description: "View the linked project for this app instance.",
                  action: { type: "openProject" },
                },
                {
                  key: "contacts",
                  label: "Review contacts",
                  description: "Open the seeded contacts table.",
                  variant: "outline",
                  action: { type: "openTable", tableKey: "contacts" },
                },
                {
                  key: "clear-sample",
                  label: "Clear sample data",
                  description: "Remove seeded pipeline rows before importing real CRM data.",
                  variant: "secondary",
                  action: { type: "clearSampleData" },
                },
              ],
            },
            {
              type: "linkedAssets",
              title: "Included workflows and profiles",
              showBlueprints: true,
              showProfiles: true,
            },
            {
              type: "scheduleList",
              title: "Automation",
              description: "The review schedule is installed paused until you opt in.",
            },
          ],
        },
        {
          key: "contacts",
          title: "Contacts",
          description: "Prospects and champions.",
          icon: "Users",
          path: "contacts",
          widgets: [
            {
              type: "table",
              title: "Contacts table",
              description: "Prospecting and follow-up context for the installed app instance.",
              tableKey: "contacts",
              columns: ["name", "role", "company", "status", "nextStep"],
              limit: 8,
            },
          ],
        },
        {
          key: "accounts",
          title: "Accounts",
          description: "Target company posture.",
          icon: "Building2",
          path: "accounts",
          widgets: [
            {
              type: "table",
              title: "Accounts table",
              description: "A company-level view of the seeded pipeline.",
              tableKey: "accounts",
              columns: ["company", "segment", "owner", "health", "nextReview"],
              limit: 8,
            },
          ],
        },
        {
          key: "opportunities",
          title: "Opportunities",
          description: "Deal flow and expected value.",
          icon: "CircleDollarSign",
          path: "opportunities",
          widgets: [
            {
              type: "table",
              title: "Opportunities table",
              description: "Track stage movement and expected close timing.",
              tableKey: "opportunities",
              columns: ["name", "account", "stage", "amount", "closeDate"],
              limit: 8,
            },
          ],
        },
      ],
    },
  },
];
