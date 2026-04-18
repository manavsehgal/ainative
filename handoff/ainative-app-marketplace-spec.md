# Stagent App Marketplace — Feature Specification

**Status:** Draft
**Date:** 2026-04-09
**Branch:** wealth-mgr (reference), growth-mgr (reference)
**Platform Version:** 0.9.6+

---

## 1. Problem Statement

Stagent users build powerful domain-specific applications (Wealth Manager, Growth Module, etc.) as compositional layers on top of Stagent's core primitives — Tables, Workflows, Schedules, Profiles, Triggers, and Documents. Today, there is no way to package these applications for distribution. A user who builds a Wealth Manager cannot share it with another Stagent user without manual file copying, and doing so risks leaking private data (real portfolio positions, client contacts, deal pipelines).

**Goals:**
1. Define a standard **Stagent App Package** format that bundles UI, logic, profiles, blueprints, table templates, and sample data into a distributable unit
2. Enable **conflict-free installation** — multiple apps coexist without touching each other's code or data
3. Provide **safe distribution** with synthetic sample data replacing creator's private data
4. Leverage **existing infrastructure** (blueprints, profiles, table templates, marketplace client) rather than building from scratch

---

## 2. Architecture Analysis — What IS a Stagent App?

### 2.1 Evidence from Existing Apps

Analysis of two production apps reveals a consistent compositional pattern:

| Layer | Wealth Manager (wealth-mgr) | Growth Module (growth-mgr) |
|-------|----------------------------|---------------------------|
| UI Pages | 10 pages under `/app/wealth-manager/` | 7 pages under `/app/growth/` |
| Components | 16 TSX files in `/components/wealth-manager/` | 8 TSX files in `/components/growth/` |
| Library | 1 module, 1,936 LOC in `/lib/wealth-manager/` | 8 modules, ~900 LOC in `/lib/growth/` |
| Agent Profiles | 1 profile (YAML + SKILL.md) | 4 profiles (inline + YAML) |
| Workflow Blueprints | 6 workflows defined in spec | 3 YAML blueprint files |
| Table Templates | 11 domain tables | 3 domain tables (Contacts, Accounts, Opportunities) |
| API Routes | 0 custom routes | 1 route (bootstrap) |
| Sidebar Items | 10 navigation links | 6 navigation links |
| New DB Tables | **0** — uses platform `userTables` | **0** — uses platform `userTables` |
| New NPM Deps | **0** | **0** |

### 2.2 Key Architectural Insight

Both apps achieve **zero new database tables** and **zero new npm dependencies**. They are pure compositions of platform primitives:

- **Data** → `userTables` + `userTableRows` (platform-managed SQLite)
- **Automation** → `workflows` + `schedules` + `triggers` (platform orchestration)
- **Intelligence** → `agentProfiles` with domain SKILL.md (platform agent runtime)
- **UI** → Next.js pages + React components (namespaced under app directory)

This composability is what makes marketplace distribution viable without forking or plugin APIs.

### 2.3 Existing Infrastructure to Leverage

| System | Current State | Extension for Apps |
|--------|--------------|-------------------|
| **Blueprint Registry** | YAML blueprints in `builtins/` + `~/.claude/skills/`, variable templating, instantiation | App bundles multiple blueprints under a namespace |
| **Profile Registry** | `builtins/` → copied to `~/.claude/skills/`, scope: builtin/user/project | App profiles install as project-scoped |
| **Table Templates** | System + user scoped, column schemas, optional sample rows | App templates include full synthetic seed data |
| **Marketplace Client** | Browse/import/publish via Supabase Edge Functions, tier-gated | Evolves from single-blueprint to full app packages |
| **Bootstrap Pattern** | Growth module: idempotent `POST /api/growth/bootstrap` | Generalized to `POST /api/apps/[appId]/bootstrap` |
| **Instance Guardrails** | Pre-push hooks, branch protection, consent-based | App install adds to protected entity list |

---

## 3. Stagent App Package Format (`.sap`)

### 3.1 Package Structure

```
wealth-manager/
├── manifest.yaml               # App identity, metadata, platform compatibility
├── README.md                   # Marketplace listing description (markdown)
├── icon.png                    # App icon (256x256, optional)
├── screenshots/                # Marketplace listing screenshots
│   ├── dashboard.png
│   └── positions.png
│
├── seed-data/                  # Synthetic sample data (never creator's real data)
│   ├── positions.csv           # Or .json — realistic but fictional
│   ├── transactions.csv
│   ├── watchlist.csv
│   └── portfolio-snapshots.csv
│
├── profiles/                   # Agent profiles (standard profile format)
│   └── wealth-manager/
│       ├── profile.yaml
│       └── SKILL.md
│
├── blueprints/                 # Workflow blueprints (standard blueprint format)
│   ├── market-open-scan.yaml
│   ├── rebalance-analyzer.yaml
│   └── tax-optimizer.yaml
│
├── templates/                  # Table schema definitions
│   ├── positions.yaml          # Column schemas + data types
│   ├── transactions.yaml
│   ├── watchlist.yaml
│   ├── alerts.yaml
│   └── wash-sales.yaml
│
├── schedules/                  # Pre-configured schedule definitions
│   ├── price-monitor.yaml      # "every 30 minutes"
│   └── daily-snapshot.yaml     # "4:30 PM ET weekdays"
│
├── triggers/                   # Table trigger definitions
│   └── alert-on-threshold.yaml
│
├── src/                        # Source code (namespaced)
│   ├── app/                    # Next.js pages
│   │   └── wealth-manager/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── positions/page.tsx
│   │       └── ...
│   ├── components/             # React components
│   │   └── wealth-manager/
│   │       ├── PortfolioSummaryCards.tsx
│   │       └── ...
│   └── lib/                    # Library modules
│       └── wealth-manager/
│           └── data.ts
│
└── hooks/                      # Lifecycle hooks (optional)
    ├── post-install.ts         # Runs after file copy
    └── post-bootstrap.ts       # Runs after data seeding
```

### 3.2 Manifest Schema

```yaml
# manifest.yaml
id: wealth-manager                    # Unique identifier (kebab-case)
name: Wealth Manager                  # Display name
version: "1.0.0"                      # Semver
description: >
  Personal portfolio tracker with live prices, tax optimization,
  conviction tracking, and automated market analysis.
author: manavsehgal                   # Creator identifier
license: Apache-2.0                   # Distribution license
repository: https://github.com/...    # Optional source repo

# Platform compatibility
platform:
  minVersion: "0.9.6"                 # Minimum Stagent version
  maxVersion: "1.x"                   # Maximum compatible version

# Marketplace metadata
marketplace:
  category: finance                   # Primary category
  tags: [portfolio, investing, tax, market-analysis]
  difficulty: intermediate            # beginner | intermediate | advanced
  estimatedSetup: "5 minutes"
  pricing: free                       # free | paid (future)

# Sidebar registration (declarative)
sidebar:
  group: Wealth Manager               # Sidebar group label
  icon: TrendingUp                    # Lucide icon name
  items:
    - title: Dashboard
      href: /wealth-manager
      icon: LayoutDashboard
    - title: Positions
      href: /wealth-manager/positions
      icon: Briefcase
    - title: Watchlist
      href: /wealth-manager/watchlist
      icon: Eye
    - title: Transactions
      href: /wealth-manager/transactions
      icon: ArrowLeftRight
    - title: Alerts
      href: /wealth-manager/alerts
      icon: Bell
    - title: Tax Center
      href: /wealth-manager/tax-center
      icon: Calculator
    - title: Reports
      href: /wealth-manager/reports
      icon: FileText
    - title: Conviction
      href: /wealth-manager/conviction
      icon: Target

# Declarations — what the app provides
provides:
  profiles:
    - profiles/wealth-manager/profile.yaml
  blueprints:
    - blueprints/market-open-scan.yaml
    - blueprints/rebalance-analyzer.yaml
    - blueprints/tax-optimizer.yaml
  templates:
    - templates/positions.yaml
    - templates/transactions.yaml
    - templates/watchlist.yaml
    - templates/alerts.yaml
    - templates/wash-sales.yaml
  schedules:
    - schedules/price-monitor.yaml
    - schedules/daily-snapshot.yaml
  triggers:
    - triggers/alert-on-threshold.yaml
  seedData:
    positions: seed-data/positions.csv
    transactions: seed-data/transactions.csv
    watchlist: seed-data/watchlist.csv

# Dependencies on other apps (future)
dependencies: []
```

### 3.3 Namespace Isolation Rules

All app artifacts are namespaced to prevent conflicts:

| Artifact | Namespace Pattern | Example |
|----------|------------------|---------|
| URL routes | `/app/{app-id}/` | `/wealth-manager/positions` |
| Components | `/components/{app-id}/` | `components/wealth-manager/PositionsTable.tsx` |
| Library | `/lib/{app-id}/` | `lib/wealth-manager/data.ts` |
| Profile IDs | `{app-id}--{profile}` | `wealth-manager--analyst` |
| Blueprint IDs | `{app-id}--{blueprint}` | `wealth-manager--tax-optimizer` |
| Template IDs | `{app-id}--{template}` | `wealth-manager--positions` |
| Schedule IDs | `{app-id}--{schedule}` | `wealth-manager--price-monitor` |
| Trigger IDs | `{app-id}--{trigger}` | `wealth-manager--alert-threshold` |
| Project | Created per install | "My Wealth Manager" (user-named) |

**Collision rule**: Two apps cannot claim the same `id`. The marketplace enforces uniqueness globally. Local installs warn on collision.

---

## 4. Distribution Architecture

### 4.1 Hybrid Distribution Model: Supabase Registry + GitHub/Supabase Storage

The distribution architecture separates **registry** (metadata, discovery, monetization) from **storage** (actual `.sap` package files), using the strengths of each platform:

```
┌──────────────────────────────────────────────────────────┐
│                   SUPABASE (Registry Layer)               │
│                                                           │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ app_packages │  │ marketplace-     │  │ licenses   │ │
│  │ table        │  │ catalog (Edge Fn)│  │ table      │ │
│  │              │  │                  │  │            │ │
│  │ • title      │  │ • paginated      │  │ • tier     │ │
│  │ • version    │  │   browse         │  │ • gates    │ │
│  │ • category   │  │ • category       │  │ • Stripe   │ │
│  │ • tags       │  │   filter         │  │            │ │
│  │ • download   │  │ • search         │  └──────┬─────┘ │
│  │   Url ──────►│  │                  │         │       │
│  │ • installs   │  └──────────────────┘         │       │
│  │ • price      │                               │       │
│  └──────┬───────┘                               │       │
└─────────┼───────────────────────────────────────┼───────┘
          │  downloadUrl points to ONE of:        │
          ▼                                       │
┌─────────────────────┐  ┌───────────────────────┐│
│  GITHUB RELEASES    │  │  SUPABASE STORAGE     ││
│  (Open-Source Apps)  │  │  (Simple Upload Apps)  ││
│                     │  │                        ││
│  • .sap as release  │  │  • stagent-marketplace ││
│    asset            │  │    storage bucket      ││
│  • Git-native       │  │  • Direct upload from  ││
│    versioning       │  │    CLI                 ││
│  • Community PRs    │  │  • No GitHub account   ││
│  • Stars/social     │  │    needed              ││
│    proof            │  │  • CDN via Supabase    ││
│  • 2GB per asset    │  │                        ││
└─────────────────────┘  └────────────────────────┘│
```

### 4.2 Why Hybrid (Not Pure GitHub or Pure Supabase)

| Concern | GitHub-Only Problem | Supabase-Only Problem | Hybrid Solution |
|---------|--------------------|-----------------------|-----------------|
| **Auth** | Separate auth system from Stagent | ✅ Already wired | Supabase Auth for registry; GitHub tokens optional for source repos |
| **Monetization** | No built-in payments | ✅ Stripe already integrated | Supabase handles billing; package hosted anywhere |
| **Discovery** | GitHub search is noisy | ✅ Structured catalog | Supabase Edge Function for curated browse/search |
| **Open Source** | ✅ PRs, issues, stars | No community workflow | GitHub repos for open-source apps; Supabase just indexes them |
| **Simplicity** | Requires GitHub account | ✅ Upload and done | Creator chooses: easy upload or git-native workflow |
| **Vendor lock-in** | ✅ Portable | Single vendor | Registry is Supabase; storage is pluggable |

### 4.3 How It Extends the Current Marketplace

The existing marketplace (`blueprints` table + `marketplace-catalog` Edge Function + `stagent-sync` Storage bucket) handles individual workflow blueprints as YAML text. The app package system is a **superset**:

```
Current:  blueprints table  → YAML text in column   → single workflow
New:      app_packages table → downloadUrl to .sap   → full app (multiple blueprints + profiles + UI + seed data)
```

The existing marketplace becomes the "Blueprints" tab. Apps become a new "Apps" tab. Both share the same Edge Function pattern, auth, and tier gating.

### 4.4 Registry Schema (`app_packages` Table — Supabase)

```sql
CREATE TABLE app_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL UNIQUE,          -- e.g., "wealth-manager"
  name TEXT NOT NULL,                    -- "Wealth Manager"
  version TEXT NOT NULL,                 -- semver "1.0.0"
  description TEXT,
  author_id UUID REFERENCES auth.users,
  category TEXT NOT NULL,                -- finance, sales, content, dev, etc.
  tags TEXT[],
  difficulty TEXT DEFAULT 'intermediate', -- beginner | intermediate | advanced

  -- Package storage (hybrid: creator picks one)
  download_url TEXT NOT NULL,            -- GitHub release URL or Supabase Storage URL
  storage_type TEXT NOT NULL,            -- 'github' | 'supabase' | 'external'
  file_size_bytes BIGINT,
  checksum_sha256 TEXT NOT NULL,         -- Integrity verification

  -- Marketplace metadata
  icon_url TEXT,
  screenshot_urls TEXT[],
  readme_html TEXT,                      -- Rendered from README.md
  pricing TEXT DEFAULT 'free',           -- free | paid
  price_cents INTEGER,
  stripe_price_id TEXT,

  -- Platform compatibility
  min_platform_version TEXT NOT NULL,
  max_platform_version TEXT,

  -- Stats (updated by Edge Function)
  install_count INTEGER DEFAULT 0,
  rating_avg NUMERIC(2,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,

  -- Audit
  published_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'published'        -- draft | published | unlisted | removed
);

-- RLS: anyone can browse, author can update own, admin can moderate
```

### 4.5 Distribution Channels

#### Channel 1: Marketplace (Cloud) — Primary

Extends the existing Supabase-backed marketplace from single blueprints to full app packages.

```
Marketplace Tabs:
├── Apps          # Full app packages (NEW)
├── Blueprints    # Individual workflow blueprints (existing)
├── Profiles      # Agent profiles (NEW)
└── Templates     # Table templates (NEW)
```

**Publishing Flow (Operator+ tier):**
1. Creator runs `stagent app pack` CLI command in their instance
2. CLI validates manifest, strips private data, packages into `.sap` archive
3. Creator reviews package contents (especially seed data)
4. Creator chooses storage target:
   - **Supabase Storage** (default): `stagent app publish` uploads `.sap` to `stagent-marketplace` bucket
   - **GitHub Release**: Creator pushes `.sap` as release asset, provides URL to `stagent app publish --url <github-release-url>`
5. Marketplace stores metadata in `app_packages` table with `download_url` pointing to chosen storage

**Browse & Install Flow (Solo+ tier):**
1. User opens `/marketplace/apps` or runs `stagent app browse`
2. Browse by category, search by name/tags
3. Preview: screenshots, description, what's included (profiles, blueprints, tables)
4. Click "Install" → approval gate (requires confirmation)
5. Platform downloads `.sap` from `download_url` (GitHub or Supabase), validates checksum, installs

#### Channel 2: Local File Import

For offline distribution, private teams, or development:

```bash
# Export from creator's instance
stagent app pack --app wealth-manager --output ./wealth-manager-1.0.0.sap

# Import on another instance
stagent app install ./wealth-manager-1.0.0.sap
```

#### Channel 3: Git Repository Import

For open-source apps distributed via GitHub:

```bash
stagent app install https://github.com/user/stagent-wealth-manager
```

The repo must have a `manifest.yaml` at root following the `.sap` structure. The CLI clones the repo, validates, and installs — equivalent to downloading a `.sap` but from source.

#### Channel 4: Official Apps (Stagent GitHub Org)

Built-in/official apps (wealth-mgr, growth-mgr) live as repos under the `stagent` GitHub org, dogfooding the distribution model:

```
github.com/stagent/app-wealth-manager   → registered in Supabase marketplace
github.com/stagent/app-growth-module    → registered in Supabase marketplace
```

These serve as reference implementations and always carry a "Verified" badge in the marketplace.

---

## 5. Installation Flow

### 5.1 Pre-Install Validation

```
1. Parse manifest.yaml
2. Check platform version compatibility (minVersion/maxVersion)
3. Check namespace collisions (any existing app with same id?)
4. Check dependency satisfaction (if app depends on other apps)
5. Estimate disk/database impact
6. Present summary to user for approval
```

### 5.2 File Installation

```
1. Copy src/app/{app-id}/ → project src/app/{app-id}/
2. Copy src/components/{app-id}/ → project src/components/{app-id}/
3. Copy src/lib/{app-id}/ → project src/lib/{app-id}/
4. Register profiles in profile registry (project-scoped)
5. Register blueprints in blueprint registry
6. Register table templates in template registry
7. Register sidebar items in app registry (NEW — see §6.1)
8. Record installation in `installed_apps` table (NEW — see §6.2)
```

### 5.3 Bootstrap (First Access)

On first navigation to any app route, or explicitly via API:

```
1. Create Project (if user hasn't selected one)
2. Create Tables from templates
3. Seed sample data into tables (only on fresh install, never overwrite)
4. Create Schedules (paused by default — user activates when ready)
5. Register Triggers on tables
6. Mark bootstrap complete
```

### 5.4 Post-Install

```
1. App appears in sidebar
2. User navigates to app dashboard
3. Sample data is visible in all tables
4. Schedules are listed (paused)
5. Blueprints are available in workflow gallery
6. Profiles are available in agent selector
7. User replaces sample data with their own
```

---

## 6. Platform Changes Required

### 6.1 Dynamic Sidebar Registration

**Current**: Sidebar items are hardcoded in `app-sidebar.tsx`. Each app modifies this file.

**Proposed**: Sidebar reads from a registry. Apps declare their sidebar items in `manifest.yaml`, and the platform renders them dynamically.

```typescript
// New: src/lib/apps/sidebar-registry.ts
interface AppSidebarGroup {
  appId: string;
  group: string;
  icon: string;
  items: { title: string; href: string; icon: string }[];
  order: number; // Position in sidebar
}

function getInstalledAppSidebars(projectId: string): AppSidebarGroup[]
```

**Impact**: `app-sidebar.tsx` changes from static imports to dynamic rendering. Core platform items (Dashboard, Tasks, Workflows, etc.) remain hardcoded. App items are appended dynamically.

### 6.2 App Registry Table

New database table to track installed apps:

```sql
CREATE TABLE installed_apps (
  id TEXT PRIMARY KEY,           -- manifest id
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  manifestJson TEXT NOT NULL,    -- Full manifest for reference
  installedAt TEXT NOT NULL,
  bootstrappedAt TEXT,           -- NULL until bootstrap completes
  status TEXT NOT NULL DEFAULT 'installed', -- installed | bootstrapped | disabled | error
  projectId TEXT,                -- Associated project (set during bootstrap)
  sourceType TEXT NOT NULL,      -- marketplace | file | git
  sourceUrl TEXT,                -- Origin URL for updates
  FOREIGN KEY (projectId) REFERENCES projects(id)
);
```

### 6.3 App Bootstrap API

Generalized bootstrap endpoint replacing per-app bootstrap routes:

```
POST /api/apps/[appId]/bootstrap
  Body: { projectId?: string, seedData?: boolean }
  Response: { projectId, tables: [...], profiles: [...], schedules: [...] }
```

### 6.4 App Pack CLI

New CLI commands for app creators:

```bash
# Validate manifest and package structure
stagent app validate

# Package app into .sap archive (strips private data)
stagent app pack --output ./my-app-1.0.0.sap

# Publish to marketplace
stagent app publish

# Install from file, URL, or marketplace
stagent app install <source>

# List installed apps
stagent app list

# Uninstall (removes files, keeps user data in tables)
stagent app uninstall <app-id>

# Update to new version
stagent app update <app-id>
```

### 6.5 Seed Data Sanitization

When packing an app, the CLI ensures no private data leaks through a two-layer approach:

**Layer 1 — Automated sanitization** (see §7.2 for full details):
```
1. Creator declares per-column sanitization rules in manifest.yaml
2. `stagent app seed` snapshots live tables (read-only) and applies rules:
   keep | randomize | shift | faker | derive | redact | hash
3. CLI runs PII detection pass on sanitized output
4. Creator reviews diff preview before writing seed files
```

**Layer 2 — Pack-time validation** (`stagent app pack`):
```
1. Table templates contain ONLY column schemas (no row data)
2. Seed data files must be explicitly declared in manifest
3. PII scanner runs again on final package contents
4. CLI blocks pack if undeclared files exist in seed-data/
5. Creator must confirm: "This seed data will be public. Continue? [y/N]"
6. No database files (.db, .sqlite) or env files allowed in package
```

---

## 7. Sample Data Strategy

### 7.1 Principles

1. **Realistic but fictional** — Sample data should feel real enough to demonstrate the app, but contain no private information
2. **Internally consistent** — Transactions should reference positions that exist, contacts should reference accounts that exist
3. **Minimal but complete** — Enough rows to populate all views (10-20 per table), not thousands
4. **Clearly marked** — Sample data rows have a `_sample: true` flag for easy bulk deletion
5. **Automated from live data** — Creators don't manually curate CSVs; the CLI snapshots their real tables and sanitizes them

### 7.2 Automated Seed Data Generation

The `stagent app seed` command automates the export → sanitize → write flow so creators never have to manually curate CSV files. The creator declares sanitization rules in `manifest.yaml`, and the CLI does the rest.

#### 7.2.1 Sanitization Rules in Manifest

```yaml
# manifest.yaml — seedData section
seedData:
  autoGenerate: true
  source: project              # snapshot from creator's active project
  rowLimit: 15                 # max rows per table (default 15)
  sanitization:
    positions:
      ticker: keep             # AAPL, NVDA are public — fine to ship
      name: keep               # "Apple Inc" is public
      shares: randomize        # replace with random realistic values
        range: [5, 200]
        step: 5
      costBasis: randomize
        range: [50.00, 500.00]
      currentPrice: derive     # recalculate from ticker (public data)
      notes: redact            # remove entirely — may contain private thesis
      predictionMarketUrl: redact

    transactions:
      ticker: keep
      action: keep             # BUY/SELL are structural
      shares: randomize
        range: [5, 100]
      amount: randomize
        range: [1000.00, 25000.00]
      date: shift              # shift all dates by random offset, preserve relative order
        window: 90d            # shift by up to 90 days
      notes: redact

    watchlist:
      ticker: keep
      targetPrice: randomize
      conviction: keep         # high/medium/low are categorical
      notes: redact

    contacts:                  # growth-mgr example
      name: faker              # generate synthetic names (faker.js-style)
      email: faker             # generate matching synthetic emails
      company: faker           # synthetic company names
      phone: faker
      dealValue: randomize
        range: [10000, 500000]
      linkedinUrl: redact
      notes: redact
```

#### 7.2.2 Sanitization Strategies

| Strategy | Behavior | Use For |
|----------|----------|---------|
| `keep` | Ship the value as-is | Public data (tickers, categories, status enums) |
| `randomize` | Replace with random value within range/type | Numeric values (shares, prices, amounts) |
| `shift` | Shift by random offset, preserve relative order | Dates and timestamps |
| `faker` | Generate synthetic values using faker patterns | Names, emails, companies, addresses, phone numbers |
| `derive` | Recalculate from other fields or public sources | Prices from tickers, totals from quantity × price |
| `redact` | Remove entirely (set to null or empty string) | Notes, URLs, private commentary |
| `hash` | One-way hash preserving uniqueness | IDs that need referential integrity but are sensitive |

#### 7.2.3 CLI Seed Generation Flow

```bash
# Generate seed data for all tables declared in manifest
stagent app seed

# Generate for a specific table with custom row count
stagent app seed --table positions --rows 20

# Dry-run: show what would be generated without writing files
stagent app seed --dry-run

# Preview sanitization: show before/after for 3 sample rows
stagent app seed --preview --table contacts
```

**What the CLI does internally:**

```
1. Read manifest.yaml sanitization rules
2. Query userTables for the source project (READ-ONLY — never mutates)
3. For each declared table:
   a. Export up to rowLimit rows
   b. Apply sanitization strategy per column
   c. Run PII detection pass on output:
      - Flag real email domains (not @example.com)
      - Flag phone number patterns
      - Flag SSN/tax ID patterns
      - Flag URLs pointing to real services
   d. Show creator a diff preview:
      "positions.ticker: AAPL → AAPL (kept)"
      "positions.shares: 150 → 45 (randomized)"
      "positions.notes: 'My NVDA thesis...' → '' (redacted)"
   e. Write to seed-data/{table}.csv
4. Creator reviews and confirms: "This seed data will be public. Continue? [y/N]"
```

#### 7.2.4 How This Avoids Conflicting with Creator's Real Data

| Concern | How It's Handled |
|---------|-----------------|
| Creator's real data leaks into package | Column-level sanitization rules + PII detection pass |
| Export mutates creator's database | Read-only snapshot — source tables are never modified |
| Installer's existing data overwritten | Apps install into a new Project; seed only runs on fresh install |
| Creator updates app, re-publishes | Re-run `stagent app seed` to re-snapshot and re-sanitize |
| Relational integrity breaks | `shift` preserves relative date order; `hash` preserves foreign key uniqueness; `derive` recalculates dependent values |

### 7.3 Example: Wealth Manager Seed Data (After Sanitization)

```csv
# seed-data/positions.csv (auto-generated, sanitized)
symbol,name,category,shares,cost_basis,current_price,allocation_target
AAPL,Apple Inc,Large-Cap Tech,50,142.50,178.30,0.08
MSFT,Microsoft Corp,Large-Cap Tech,30,285.00,412.15,0.06
VTI,Vanguard Total Stock Market,Index ETF,100,198.75,225.40,0.15
BND,Vanguard Total Bond,Bond ETF,200,72.30,74.50,0.10
GLD,SPDR Gold Trust,Commodities,40,175.00,193.20,0.05
```

```csv
# seed-data/transactions.csv (auto-generated, sanitized)
date,symbol,action,shares,price,total,tax_treatment,conviction_level,notes
2026-01-15,AAPL,BUY,25,145.00,3625.00,long-term,high,
2026-02-01,MSFT,BUY,30,285.00,8550.00,long-term,high,
2026-03-10,AAPL,BUY,25,140.00,3500.00,long-term,medium,
```

*Note: `shares` and `price` were randomized within realistic ranges. `notes` were redacted. `ticker` and `action` were kept as public/structural data.*

### 7.4 Sample Data Lifecycle

```
Install → Seed data loaded (marked _sample: true)
  → User explores app with sample data
  → User imports their real data (CSV upload or manual entry)
  → User bulk-deletes sample rows (button: "Clear sample data")
  → App now runs on real data
```

---

## 8. Conflict Resolution & Safety

### 8.1 Namespace Conflicts

| Conflict Type | Detection | Resolution |
|--------------|-----------|------------|
| Same app ID | Pre-install check | Block install, suggest update |
| URL route overlap | Manifest route scan | Block install, report conflict |
| Profile ID collision | Registry lookup | Prefix with app namespace |
| Blueprint ID collision | Registry lookup | Prefix with app namespace |
| Table template collision | Template registry lookup | Prefix with app namespace |

### 8.2 Platform Version Incompatibility

```yaml
# manifest.yaml
platform:
  minVersion: "0.9.6"
  maxVersion: "1.x"
```

- If current Stagent version < minVersion → block install with upgrade prompt
- If current Stagent version > maxVersion → warn but allow (may have breaking changes)
- Marketplace shows compatibility badge per app

### 8.3 Data Safety

- **Install never overwrites** — if tables with matching names exist, bootstrap skips seeding
- **Uninstall preserves data** — removing app code keeps all user-created table data
- **Update is additive** — new version adds new tables/columns, never drops existing

### 8.4 Git Safety

- App source files install into the working tree but are gitignored by default
- Users can choose to track app files in git (for customization)
- App updates check for local modifications and warn before overwriting

---

## 9. Marketplace UI

### 9.1 App Listing Page (`/marketplace/apps`)

```
┌─────────────────────────────────────────────────────┐
│  App Marketplace                      [Search...]    │
│                                                      │
│  Categories: All | Finance | Sales | Content | Dev   │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 📈           │  │ 🚀           │  │ 📝         │ │
│  │ Wealth Mgr   │  │ Growth Mgr   │  │ Content    │ │
│  │              │  │              │  │ Studio     │ │
│  │ Portfolio     │  │ Revenue ops  │  │ Editorial  │ │
│  │ tracker with  │  │ with CRM,   │  │ calendar,  │ │
│  │ tax optim...  │  │ sequences..  │  │ drafts...  │ │
│  │              │  │              │  │            │ │
│  │ ★★★★☆  142  │  │ ★★★★★  89   │  │ ★★★★☆  67 │ │
│  │ [Install]    │  │ [Install]    │  │ [Install]  │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 9.2 App Detail Page (`/marketplace/apps/[id]`)

```
┌──────────────────────────────────────────────────────┐
│  ← Back to Marketplace                               │
│                                                      │
│  📈 Wealth Manager                        v1.0.0     │
│  by manavsehgal | Finance | ★★★★☆ (142 installs)   │
│                                                      │
│  [Screenshot carousel]                               │
│                                                      │
│  Personal portfolio tracker with live prices, tax    │
│  optimization, conviction tracking, and automated    │
│  market analysis.                                    │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ What's Included                                 │ │
│  │                                                 │ │
│  │ 📊 5 Table Templates                           │ │
│  │    Positions • Transactions • Watchlist         │ │
│  │    Alerts • Wash Sales                          │ │
│  │                                                 │ │
│  │ 🤖 1 Agent Profile                             │ │
│  │    Wealth Manager Analyst                       │ │
│  │                                                 │ │
│  │ ⚡ 3 Workflow Blueprints                        │ │
│  │    Market Open Scan • Rebalance • Tax Optimizer │ │
│  │                                                 │ │
│  │ 🕐 2 Schedules                                  │ │
│  │    Price Monitor (30m) • Daily Snapshot (4:30p) │ │
│  │                                                 │ │
│  │ 📄 10 UI Pages                                  │ │
│  │    Dashboard, Positions, Watchlist, Alerts...   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Platform: v0.9.6+ | Setup: ~5 min | Difficulty: ◉◉◎│
│                                                      │
│  [Install App]                                       │
└──────────────────────────────────────────────────────┘
```

### 9.3 Installed Apps Page (`/settings/apps`)

```
┌──────────────────────────────────────────────────────┐
│  Installed Apps                                      │
│                                                      │
│  📈 Wealth Manager  v1.0.0   ● Active               │
│     Project: My Portfolio | Installed: Apr 1, 2026   │
│     [Open] [Disable] [Uninstall]                     │
│                                                      │
│  🚀 Growth Module   v1.0.0   ● Active               │
│     Project: Sales Ops | Installed: Mar 15, 2026     │
│     [Open] [Disable] [Uninstall]                     │
│                                                      │
│  [Browse Marketplace]                                │
└──────────────────────────────────────────────────────┘
```

---

## 10. CLI Commands

### 10.1 For App Creators

```bash
# Initialize app package structure in current directory
stagent app init
# → Creates manifest.yaml, seed-data/, profiles/, blueprints/, templates/

# Validate package structure and manifest
stagent app validate
# → Checks: manifest schema, file references, namespace rules,
#    seed data format, profile/blueprint validity

# Generate seed data from current tables (automated sanitization)
stagent app seed
# → Reads sanitization rules from manifest.yaml
# → Snapshots live tables (read-only), applies per-column rules
# → Runs PII detection, shows diff preview, writes seed-data/*.csv
#
# Options:
#   --table positions    # Generate for specific table only
#   --rows 20            # Override rowLimit from manifest
#   --dry-run            # Show what would be generated without writing
#   --preview            # Show before/after for 3 sample rows

# Package into distributable archive
stagent app pack
# → Validates, strips git history, creates wealth-manager-1.0.0.sap

# Publish to marketplace
stagent app publish
# → Uploads .sap to marketplace, requires Operator+ tier
```

### 10.2 For App Users

```bash
# Browse marketplace
stagent app browse [--category finance]

# Install from marketplace
stagent app install wealth-manager

# Install from local file
stagent app install ./wealth-manager-1.0.0.sap

# Install from git repo
stagent app install https://github.com/user/stagent-wealth-manager

# List installed apps
stagent app list

# Check for updates
stagent app outdated

# Update specific app
stagent app update wealth-manager

# Disable without removing
stagent app disable wealth-manager

# Re-enable
stagent app enable wealth-manager

# Uninstall (preserves user data)
stagent app uninstall wealth-manager

# Uninstall and remove data
stagent app uninstall wealth-manager --purge
```

---

## 11. Implementation Phases

### Phase 1 — Package Format & Local Install (MVP)

**Goal**: Creator can pack an app, another user can install it from a file.

- [ ] Define manifest.yaml JSON Schema (Zod validator)
- [ ] `stagent app init` — scaffold package structure
- [ ] `stagent app validate` — check manifest + file references
- [ ] `stagent app pack` — create .sap archive (tarball)
- [ ] `stagent app install <file>` — unpack and install files
- [ ] `installed_apps` database table
- [ ] Dynamic sidebar rendering from app registry
- [ ] Generalized bootstrap API (`/api/apps/[appId]/bootstrap`)
- [ ] Seed data loading (CSV → table rows with `_sample` flag)
- [ ] `stagent app list` / `stagent app uninstall`

**Deliverables**: wealth-manager.sap and growth-module.sap packages that install cleanly on a fresh Stagent instance.

### Phase 2 — Marketplace Distribution

**Goal**: Users can browse, install, and publish apps via the cloud marketplace.

- [ ] Marketplace "Apps" tab UI (`/marketplace/apps`)
- [ ] App detail page with screenshots and contents preview
- [ ] `stagent app publish` — upload to Supabase Storage
- [ ] `stagent app install <marketplace-id>` — download and install
- [ ] App ratings and install counts
- [ ] Installed apps management page (`/settings/apps`)
- [ ] Version compatibility checking
- [ ] Tier gating (Solo+ install, Operator+ publish)

### Phase 3 — Updates & Dependencies

**Goal**: Apps can be updated safely and declare dependencies on other apps.

- [ ] `stagent app update` — download new version, apply migrations
- [ ] `stagent app outdated` — check for available updates
- [ ] App dependency resolution (app A requires app B)
- [ ] Migration hooks (post-update scripts for schema changes)
- [ ] Local modification detection (warn before overwriting customized files)
- [ ] Rollback support (keep previous version for recovery)

### Phase 4 — Advanced Features

- [ ] Paid apps (Stripe integration for app purchases)
- [ ] App forking (install and customize, publish as derivative)
- [ ] App analytics for creators (install count, usage, ratings)
- [ ] Private marketplace (team-only distribution)
- [ ] App bundles (install multiple related apps at once)

---

## 12. Migration Path for Existing Apps

### 12.1 Wealth Manager (wealth-mgr branch)

```bash
# From the wealth-mgr branch:
cd /Users/manavsehgal/Developer/stagent-wealth

# 1. Initialize app package structure
stagent app init --id wealth-manager --name "Wealth Manager"

# 2. Move files into package layout (already namespaced correctly)
#    src/app/wealth-manager/ → package src/app/wealth-manager/
#    src/components/wealth-manager/ → package src/components/wealth-manager/
#    src/lib/wealth-manager/ → package src/lib/wealth-manager/

# 3. Extract profile into package format
#    src/lib/agents/profiles/builtins/wealth-manager/ → package profiles/

# 4. Create table template YAMLs from existing table definitions
stagent app extract-templates --tables positions,transactions,watchlist,alerts,wash_sales

# 5. Generate synthetic seed data
stagent app seed --table positions --rows 15 --output seed-data/positions.csv
stagent app seed --table transactions --rows 20 --output seed-data/transactions.csv

# 6. Define blueprints from existing workflow specs
#    (manual: convert feature spec workflows to blueprint YAML)

# 7. Validate and pack
stagent app validate
stagent app pack
```

### 12.2 Growth Module (growth-mgr branch)

```bash
# From the growth-mgr branch:
cd /Users/manavsehgal/Developer/stagent-growth

# Growth is already well-structured for packaging:
# - Bootstrap is idempotent (src/lib/growth/bootstrap.ts)
# - Templates are defined (Contacts, Accounts, Opportunities)
# - Blueprints exist as YAML (3 files)
# - Profiles are defined inline (4 profiles)

# 1. Initialize and extract
stagent app init --id growth-module --name "Growth Module"

# 2. Convert inline profiles to YAML files
stagent app extract-profiles --source src/lib/growth/profiles.ts

# 3. Generate seed data from templates
stagent app seed --table contacts --rows 15
stagent app seed --table accounts --rows 10
stagent app seed --table opportunities --rows 12

# 4. Pack
stagent app validate
stagent app pack
```

---

## 13. Security & Privacy Considerations

### 13.1 Data Sanitization Checklist

Before publishing, the `stagent app pack` command runs these checks:

- [ ] No `.env` or `.env.local` files in package
- [ ] No API keys, tokens, or credentials in any file
- [ ] Seed data passes PII detection (no real emails with corporate domains, phone numbers, SSNs)
- [ ] No database files (`.db`, `.sqlite`) in package
- [ ] No `node_modules/` or build artifacts
- [ ] No git history (`.git/` excluded)
- [ ] All seed data files are explicitly declared in manifest
- [ ] Creator confirms seed data review before pack

### 13.2 Install-Time Safety

- App code is sandboxed to its namespace (cannot access other apps' routes/components)
- Bootstrap API runs in user context with standard permissions
- Schedules install as paused (user must explicitly activate)
- Triggers require user approval on first fire
- Lifecycle hooks (post-install, post-bootstrap) run with audit logging

### 13.3 Supply Chain

- Marketplace packages are signed with creator's account
- Install shows creator identity and verification status
- Users can inspect package contents before installing
- Platform logs all app installs for audit

---

## 14. Open Questions

1. **Hot reload vs restart**: Can apps be installed without restarting the Stagent server? Next.js dynamic routes may require a rebuild.
2. **Shared CSS**: Should apps be restricted to Tailwind utility classes, or can they ship custom CSS? (Both current apps only add minimal CSS.)
3. **API route convention**: Should apps be allowed to add custom API routes, or must they exclusively use platform APIs? (Growth uses 1 custom route; Wealth uses 0.)
4. **Table template inheritance**: Should app templates support "extends" for common patterns (e.g., all CRM apps share a base Contact schema)?
5. **Multi-project install**: Can the same app be installed into multiple projects (e.g., managing two separate portfolios)?
6. **Offline-first marketplace**: Should there be a curated set of "featured apps" bundled with Stagent for offline discovery?

---

## 15. Success Metrics

- **Creator experience**: Pack an existing app in < 30 minutes
- **User experience**: Browse → Install → Working app in < 5 minutes
- **Zero conflicts**: Installing 3+ apps simultaneously with no namespace collisions
- **Safe distribution**: Zero incidents of private data leakage in marketplace packages
- **Adoption**: 10+ community apps published within 3 months of marketplace launch
