---
name: screengrab
description: Automated visual documentation — discovers routes dynamically, visits every page, interacts with forms, and captures high-fidelity screenshots. Feature-aware and incremental — reads feature specs for guided capture and only recaptures routes affected by new features. Triggers on "take screenshots", "screengrab", "capture the UI", "update screengrabs", "screenshot all pages", "full screengrab", or visual documentation requests.
---

# Screengrab Skill

Automatically capture screenshots of every page in the app by dynamically discovering routes from the sidebar, visiting each page, interacting with forms and toggles, and saving high-fidelity screenshots. **Zero hardcoded routes or elements** — everything is discovered at runtime via Chrome DevTools accessibility snapshots and targeted JS queries.

**Feature-aware:** Reads `features/` specs to know what UI elements each shipped feature contributes, ensuring captures exercise those features.

**Incremental:** Uses `features/changelog.md` and a `.last-run` timestamp to only recapture routes affected by newly completed features, skipping unchanged pages.

## Sidebar Rule

- **Home `/`** — capture with sidebar **expanded** (this is the hero shot showing full navigation)
- **All other routes** — **collapse the sidebar** before capturing (maximizes content area)

To toggle the sidebar, use `evaluate_script` to click the toggle button directly (no snapshot needed).

## Tools

This skill uses the **Chrome DevTools MCP** tools exclusively:
- `navigate_page` — visit routes (`type: "url"`)
- `take_snapshot` — discover elements; **always use `filePath` to save to file** instead of inline
- `take_screenshot` — capture pages; use `filePath` to save to screengrabs/
- `click` — interact with elements; **always set `includeSnapshot: false`**
- `fill` — populate form fields; **always set `includeSnapshot: false`**
- `resize_page` — set viewport dimensions
- `press_key` — keyboard shortcuts; **always set `includeSnapshot: false`**
- `evaluate_script` — **primary discovery tool**; run targeted JS queries instead of full snapshots
- `new_page` — open initial browser tab
- `select_page` — switch between tabs if needed

## Context Budget Rules

**CRITICAL:** The previous Playwright-based approach consumed 10-50K tokens per snapshot, burning through context in ~20 interactions. These rules prevent that:

1. **NEVER use `take_snapshot` without `filePath`** — always save to `/tmp/snap-{page}.md` and read selectively
2. **ALWAYS set `includeSnapshot: false`** on `click`, `fill`, and `press_key` calls
3. **Prefer `evaluate_script`** for element discovery — returns only the data you need (~200 tokens vs ~15K for a full snapshot)
4. **Use `evaluate_script` for common operations:**

```js
// Discover sidebar links (~200 tokens)
() => Array.from(document.querySelectorAll('[data-slot="sidebar-menu"] a, nav a[href]'))
  .map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') }))
  .filter(a => a.href && a.href.startsWith('/'))

// Toggle sidebar (~50 tokens)
() => {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('Toggle Sidebar'));
  if (btn) { btn.click(); return 'toggled'; }
  return 'not found';
}

// Find create/new buttons (~200 tokens)
() => Array.from(document.querySelectorAll('button, a[role="button"], a'))
  .filter(b => /new |create |add |\+/i.test(b.textContent))
  .map(b => ({ text: b.textContent.trim(), tag: b.tagName, href: b.getAttribute('href') }))

// Find form fields (~300 tokens)
() => Array.from(document.querySelectorAll('input, textarea, select, [role="combobox"]'))
  .map(el => ({
    tag: el.tagName, type: el.type || el.getAttribute('role'),
    name: el.name || el.id, placeholder: el.placeholder,
    label: el.getAttribute('aria-label') || (el.labels?.[0]?.textContent?.trim())
  }))

// Find tabs (~100 tokens)
() => Array.from(document.querySelectorAll('[role="tab"]'))
  .map(t => ({ text: t.textContent.trim(), selected: t.getAttribute('aria-selected') === 'true' }))

// Scroll element into view
(selector) => {
  const el = document.querySelector(selector);
  if (el) { el.scrollIntoView({ behavior: 'instant', block: 'start' }); return 'scrolled'; }
  return 'not found';
}

// Check page title / heading to confirm navigation
() => document.querySelector('h1')?.textContent?.trim() || document.title
```

5. **Use `take_snapshot(filePath)` only when** you need uid references for clicking/filling elements that `evaluate_script` can't handle (e.g., complex comboboxes in the a11y tree). Read the saved file with offset/limit to find the specific uid.

## Smart Capture Rules

Use **element-level screenshots** (`take_screenshot` with `uid`) for focused UI elements, and **viewport screenshots** (no `uid`) for full-page views. This eliminates dark overlay backgrounds, empty whitespace, and irrelevant surrounding content.

### When to use element-level capture (with `uid`)

| UI Element | Why | How to get uid |
|---|---|---|
| **Dialogs/Modals** | Avoids dark backdrop overlay | `take_snapshot(filePath)` → find `[role="dialog"]` uid |
| **Sheets/Side panels** | Focuses on panel content | Find `[data-slot="sheet-content"]` uid |
| **Settings subsections** | Tight crop of each card | Find the section card uid |
| **Popovers** | Captures just the floating element | Find `[role="dialog"]` or popover uid |
| **Command palette** | Focuses on the command dialog | Find command dialog uid |
| **Expanded notifications** | Captures just the notification article | Find `article` uid |
| **Form containers** | Avoids empty space around short forms | Find form or dialog uid |

### When to use viewport capture (no `uid`)

- **Full page views** — default list/grid/kanban views where layout context matters
- **Detail pages** — full-page detail views with breadcrumbs and navigation
- **Home page** — hero shot with sidebar

### Smart form container detection

Before capturing any form screenshot (empty or filled), detect the container type:

```js
// Detect form container for element-level screenshot
() => {
  const dialog = document.querySelector('[role="dialog"], [data-slot="dialog-content"]');
  if (dialog) return { type: 'dialog', selector: '[role="dialog"]' };
  const sheet = document.querySelector('[data-slot="sheet-content"]');
  if (sheet) return { type: 'sheet', selector: '[data-slot="sheet-content"]' };
  const main = document.querySelector('main form, main [role="form"]');
  if (main) return { type: 'form', selector: 'main form, main [role="form"]' };
  return { type: 'viewport', selector: null };
}
```

**Workflow for form screenshots:**
1. Run container detection JS
2. If `dialog` or `sheet` → `take_snapshot(filePath: "/tmp/form-snap.md")`, find the container uid, use `take_screenshot(uid: ..., element: "form dialog", filePath: ...)`
3. If `form` (full-page) → use `take_screenshot(filePath: ...)` as viewport (form fills the page anyway)
4. If `viewport` → fallback to viewport screenshot

## Error Detection

**CRITICAL:** Run this check AFTER every `navigate_page` and BEFORE every `take_screenshot`. Never capture a Next.js error page as a valid screenshot.

```js
// Detect Next.js errors, 404s, 500s, hydration issues
() => {
  const nextjsOverlay = document.querySelector(
    '[data-nextjs-dialog], [data-nextjs-dialog-overlay], nextjs-portal'
  );
  const h1 = document.querySelector('h1');
  const isErrorPage = h1 && /error|500|404|unhandled|application error/i.test(h1.textContent);
  const hydrationToast = document.querySelector('[data-nextjs-toast]');
  const redBox = document.querySelector('[style*="background: #e11"]'); // Next.js red error box
  return {
    hasError: !!(nextjsOverlay || isErrorPage || redBox),
    hasHydrationWarning: !!hydrationToast,
    errorText: nextjsOverlay?.textContent?.substring(0, 300)
      || (isErrorPage ? h1.textContent : null)
      || (redBox ? redBox.textContent?.substring(0, 300) : null),
    url: window.location.href
  };
}
```

### Error recovery flow

1. If `hasError` is true after navigation:
   a. **Log** the error: `"ERROR on {url}: {errorText}"`
   b. **Do NOT capture** — skip this screenshot
   c. **Attempt recovery:**
      - Try `navigate_page(type: "reload")` — sometimes transient hydration errors clear on reload
      - Wait 2 seconds
      - Re-run error check
   d. If recovered → proceed with capture
   e. If still erroring:
      - Capture error state as `screengrabs/{page}-error.png` for debugging
      - Log: `"PERSISTENT ERROR on {page} — captured error state, moving on"`
      - Navigate away to `/` to reset, then continue to next route

2. If `hasError` is true after form submission:
   a. The form submission likely triggered a server error
   b. Capture as `screengrabs/{page}-create-form-error.png`
   c. Try to navigate back to the form's parent route and continue

3. If `hasHydrationWarning` (not a blocking error):
   a. Log: `"HYDRATION WARNING on {page} — proceeding (non-blocking)"`
   b. Proceed with capture (hydration warnings don't affect visual output)

---

## Phase 1: Setup

1. **Determine capture mode** from the user's request:
   - If the user said "full screengrab" or "screengrab all" → set **force-full mode** (skip incremental detection in Phase 1.6)
   - Otherwise → proceed normally (incremental detection will decide)

2. **Ensure `screengrabs/` directory exists:**
   ```bash
   mkdir -p screengrabs
   ```
   Do NOT `rm -rf screengrabs/*` here — incremental mode may preserve existing files. Cleaning happens later based on the determined mode.

3. **Ensure dev server is running** at `localhost:3000`:
   ```bash
   lsof -i :3000
   ```
   - If nothing returned, start the dev server: `npm run dev` (run in background)
   - Wait a few seconds for startup, then verify with `lsof -i :3000` again

4. **Set viewport** to 1440x900 via `resize_page`

5. **Open a new tab** via `new_page` with URL `http://localhost:3000` and wait for load

6. **Confirm rendering** via `evaluate_script` — check that an `<h1>` or `<main>` element exists:
   ```js
   () => ({ title: document.title, h1: document.querySelector('h1')?.textContent?.trim(), ready: !!document.querySelector('main') })
   ```

---

## Phase 1.5: Feature Scan

Read the `features/` directory to build a **Feature Capture Checklist** that guides later phases.

### 1.5a. Read Roadmap

1. Read `features/roadmap.md`
2. Extract all features with `status: completed` (ignore `planned`, `started`, `deferred`)
3. Build a list of completed feature slugs (e.g., `document-manager`, `micro-visualizations`)

### 1.5b. Read Feature Specs

For each completed feature, read its spec file at `features/{slug}.md` and extract:

- **Route** — any UI route mentioned like `/documents`, `/workflows`, `/schedules` (skip `/api/` routes)
- **Key UI elements** — look for mentions of: tables, grids, kanban boards, detail sheets/panels, dialogs, upload buttons, tabs, toggles, filters, search, forms, sparklines, charts, cards, badges
- **Form fields** — field names and types described in the spec (for realistic data generation)

### 1.5c. Classify Features

Classify each feature into a tier:

| Tier | Definition | Example |
|------|-----------|---------|
| **Route** | Owns a dedicated UI route accessible from sidebar | `document-manager` → `/documents` |
| **Component** | Enhances another route's page (no own route) | `micro-visualizations` → enhances dashboard |
| **Backend** | No UI surface at all | `database-schema`, `cli-bootstrap` |

### 1.5d. Build Checklist

Assemble the **Feature Capture Checklist** — a mental table tracking:

| Feature | Tier | Route | Key UI Elements | Captured? |
|---------|------|-------|-----------------|-----------|

Initialize all `Captured?` columns to `No`. This checklist is updated as captures proceed and reported at the end.

---

## Phase 1.6: Incremental Detection

Determine whether this run should be **full** or **incremental**.

### Decision Logic

1. If **force-full mode** was set in Phase 1 → **full mode**. Clean the output folder:
   ```bash
   rm -rf screengrabs/* && mkdir -p screengrabs
   ```

2. Check if `screengrabs/` has existing screenshot files (`.png` files from a previous run):
   ```bash
   ls screengrabs/*.png 2>/dev/null | head -1
   ```

3. If no existing screenshots → **full mode**. Clean and capture everything.

4. If existing screenshots found → check for a timestamp file:
   ```bash
   cat screengrabs/.last-run 2>/dev/null
   ```

5. If `.last-run` exists → **incremental mode**:
   a. Read `features/changelog.md`
   b. Find all changelog entries dated **after** the `.last-run` timestamp
   c. From those entries, extract feature slugs mentioned under `### Completed`, `### Enhancement`, and `### Ship Verification` sections
   d. Map each changed feature → its affected route(s) using the Feature Capture Checklist from Phase 1.5
   e. Build the **affected-routes list** — only these routes will be recaptured
   f. If no changed features map to any routes → log "No UI changes since last run" and skip to Phase 7 (completion report only)

6. If `.last-run` does not exist but screenshots exist → **full mode** (can't determine what's stale)

### Log the Decision

Always log the mode decision clearly:
- **Full mode**: "Full capture — N route features, M component features to cover"
- **Incremental mode**: "Incremental capture — N routes affected by changes since {last-run-date}: {list of affected routes}"
- **No changes**: "No UI changes detected since {last-run-date} — generating report only"

---

## Phase 2: Route Discovery (Dynamic)

1. Run `evaluate_script` to extract sidebar links:
   ```js
   () => Array.from(document.querySelectorAll('[data-slot="sidebar-menu"] a, nav a[href]'))
     .map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') }))
     .filter(a => a.href && a.href.startsWith('/'))
   ```
2. Each link has:
   - **Visible text** (used as page name for filenames)
   - **href** (the route path)
3. Build the route list from the JS query results
4. Include Home `/` as the first route (captured with sidebar expanded)
5. Log the discovered routes before proceeding

**Critical rule:** Never assume specific routes exist. Only visit routes found via the JS query.

### Cross-Reference with Feature Checklist

After building the route list, compare it against the Feature Capture Checklist:

1. **Missing routes** — For each Route-tier feature in the checklist, check if its route appears in the sidebar. If not, log a warning:
   > "WARNING: Feature '{feature}' expects route '{route}' but it was not found in sidebar (possible regression)"

2. **Undocumented routes** — For each sidebar route, check if any feature spec references it. If not, log an info note:
   > "INFO: Route '{route}' found in sidebar but not referenced in any feature spec (undocumented)"

3. **Annotate routes** — For each discovered route, note which features and expected UI elements (from the checklist) are associated with it. This annotation is used in Phase 4 for guided element discovery.

---

## Phase 3: Home Capture (Sidebar Expanded)

The Home `/` route is special — it's the only page captured with the sidebar visible.

**Incremental skip:** If incremental mode AND Home `/` is not in the affected-routes list → skip this phase, log "Home: unchanged, skipping".

1. **Ensure sidebar is expanded** — use `evaluate_script` to check and toggle if needed
2. `take_screenshot(filePath: "screengrabs/home-list.png")` → captures home with sidebar
3. Scroll down to capture below-the-fold content if present:
   - Use `evaluate_script` to scroll: `() => { window.scrollTo(0, document.body.scrollHeight); return 'scrolled'; }`
   - `take_screenshot(filePath: "screengrabs/home-below-fold.png")`
4. **Collapse the sidebar** via `evaluate_script` toggle — it stays collapsed for all remaining routes

---

## Phase 4: Per-Route Capture Loop

For each remaining discovered route (skip Home), derive a kebab-case `{page}` slug from the visible link text (e.g., "Cost & Usage" → `cost-usage`).

**Pre-check:** Sidebar must be collapsed before each capture. If it somehow re-expands, toggle it closed.

**Incremental skip:** If incremental mode AND this route is NOT in the affected-routes list → skip, log "{page}: unchanged, skipping". Do not delete or recapture any files for this route.

**Incremental recapture:** If incremental mode AND this route IS in the affected-routes list → delete existing screenshots for this page before capturing fresh:
```bash
rm -f screengrabs/{page}-*.png
```

### 4a. Default View
1. `navigate_page(type: "url", url: ...)` to the route
2. Wait 2 seconds for content to render (use `evaluate_script` to confirm `h1` exists)
3. Run **error detection** JS — if error detected, follow the recovery flow before continuing
4. Collapse sidebar via `evaluate_script` toggle (it re-expands on every navigation)
5. `take_screenshot(filePath: "screengrabs/{page}-list.png")`

### 4b. Discover Interactive Elements

Run `evaluate_script` with targeted queries to find:

| Element Type | How to Identify |
|---|---|
| **Create/New buttons** | Text containing "New", "Create", "Add", or "+" |
| **View toggles** | Groups of toggle buttons (table/grid/list icons) |
| **Clickable entities** | Links or cards pointing to detail pages (href pattern like `/{page}/[id]`) |
| **Tabs** | Tab elements or tab-like navigation within the page |
| **Kanban columns** | Grouped card columns with status headers |
| **Stat cards** | Clickable summary cards with metrics |
| **Action buttons** | Buttons like "Run", "Execute", "Approve", "Reject" |
| **Router-push entities** | Buttons or generic elements whose text matches entity names on list pages (profile cards, schedule cards, document table rows) — these navigate via `router.push`, not `<a href>` |
| **Select mode buttons** | "Enter select mode" buttons in kanban column headers |
| **Card edit buttons** | "Edit {taskname}" buttons on kanban task cards |

**Feature-guided hints:** Before scanning, consult the Feature Capture Checklist for this route's annotated UI elements. Use these as additional hints:
- If checklist says **"table/grid toggle"** → specifically look for view toggle buttons even if they aren't obvious
- If checklist says **"upload dialog"** → look for upload/attach buttons
- If checklist says **"detail sheet"** → look for clickable rows/cards that open side panels
- If checklist says **"sparklines" or "charts"** → note their presence (they'll be captured in the default screenshot)
- If checklist says **"kanban"** → look for column-based card layouts
- If checklist says **"filters" or "search"** → look for filter dropdowns or search inputs
- If checklist says **"trust tier badge"** → look for trust tier button in sidebar footer
- If checklist says **"command palette"** → trigger Meta+K keyboard shortcut
- If checklist says **"density toggle"** → look for 3-button density group in table toolbar
- If checklist says **"view switcher"** → look for saved-views bookmark dropdown
- If checklist says **"filter bar"** → look for filter controls with active count badge
- If checklist says **"expandable result"** → look for expand/collapse toggles on content items
- If checklist says **"detail pane"** → check if clicking entities opens a 420px right-rail panel
- If checklist says **"blueprint gallery"** → look for "From Blueprint" action buttons linking to sub-routes
- If checklist says **"bulk select"** → look for "Enter select mode" buttons in kanban column headers
- If checklist says **"card edit"** → look for "Edit {taskname}" buttons on kanban cards

### 4b½. Action Button Sub-Routes

Some pages have action buttons that navigate to sub-routes not in the sidebar (e.g., "From Blueprint" → `/workflows/blueprints`). After default view capture:

1. Run `evaluate_script` to find action buttons with navigation hrefs:
   ```js
   () => Array.from(document.querySelectorAll('a[href], button'))
     .filter(el => {
       const href = el.getAttribute('href');
       return href && href.startsWith('/') && !el.closest('nav') && !el.closest('[data-slot="sidebar"]');
     })
     .map(el => ({ text: el.textContent.trim(), href: el.getAttribute('href') }))
   ```
2. For each sub-route found (that isn't already in the main route list):
   - Navigate to the sub-route
   - Collapse sidebar
   - `take_screenshot` → `screengrabs/{page}-{sub-route-slug}.png` (e.g., `workflows-blueprints.png`)
3. Navigate back to the parent route

**Known sub-routes:** `/workflows/blueprints` (via "From Blueprint" button on workflows page).

### 4c. View Toggles
If view toggles found:
1. Click the alternate view toggle (not the currently active one)
2. Wait 1 second
3. `take_screenshot` → `screengrabs/{page}-{view}.png` (e.g., `grid`, `table`)
4. Click back to the original view

### 4d. Clickable Entities / Detail Views

**Router-push entities:** Some entities (profiles, schedules, documents) use button clicks with `router.push` instead of `<a href>` links. To discover these:
- Look for buttons whose accessible name contains entity-specific text (e.g., "API Tester work...", "Daily Standup Summary active...")
- Look for table rows with `cursor-pointer` styling
- Use `take_snapshot(filePath)` and look for `button` or `generic` elements that represent entity cards
- Click the first entity button/row and check if the URL changed to a `/{page}/[id]` pattern

If clickable entities (detail links/cards/buttons) found:
1. Click the **first** entity
2. Wait 2 seconds
3. **Right-rail detection:** Check whether the detail appeared as a 420px right-rail panel alongside the list (DetailPane pattern) or as a full-page navigation:
   - If right-rail panel visible → `take_screenshot` → `screengrabs/{page}-detail-pane.png` (captures split layout: list + detail side-by-side)
   - In either case, also capture: `take_screenshot` → `screengrabs/{page}-detail.png`
4. Explore the detail view:
   - Run `take_snapshot(filePath)` or `evaluate_script` to discover detail-level interactions (tabs, sections, actions)
   - If the detail has tabs, capture each tab: `screengrabs/{page}-detail-{tab-name}.png`
   - If the detail has action buttons (edit, delete, execute), note them but do NOT click destructive actions
5. `navigate_page` back to the route (don't rely on browser back)

**Exhaustive coverage:** Ensure detail views are captured for ALL routes that have `[id]` or `[slug]` sub-routes. Key entities: tasks, projects, workflows, documents, profiles, schedules, playbook articles. If a route has entities but no detail link was found, log a warning.

### 4e. Tabs
If tabs found:
1. For each tab (skip the already-active one):
   - Click the tab
   - Wait 1 second
   - `take_screenshot` → `screengrabs/{page}-{tab-name}.png`
2. Derive `{tab-name}` as kebab-case from the tab's visible text

### 4f. Kanban / Card Interactions
If the page has a kanban board or card-based layout:
1. Click the **first card** in the first column
2. Wait 1 second for any detail panel/sheet to appear
3. `take_screenshot` → `screengrabs/{page}-card-detail.png`
4. Close the panel if needed (Escape key or close button)
5. **Kanban card edit dialog:**
   - Find "Edit {task}" buttons on task cards (visible in the card toolbar via snapshot):
     ```js
     () => Array.from(document.querySelectorAll('button'))
       .filter(b => /^Edit /i.test(b.textContent?.trim()))
       .map(b => ({ text: b.textContent.trim() }))
     ```
   - Click the first "Edit" button
   - Wait 1 second for the TaskEditDialog to appear
   - Use **element-level capture**: `take_snapshot(filePath)` → find `[role="dialog"]` uid → `take_screenshot(uid: ..., filePath: "screengrabs/dashboard-card-edit.png")`
   - Press Escape to close the dialog

### 4g. Overlay & Popup Interactions

Capture UI elements that float above the page and require explicit interaction to reveal. These are captured **once per run** (not per-route).

1. **TrustTierBadge Popover** — On the Home page (sidebar expanded for best visibility):
   - Find a clickable element in the sidebar footer area with text matching "Observer", "Collaborator", or "Autonomous" (or aria-label containing "Trust tier")
   - Click it to open the popover
   - Wait 1 second for the popover to render
   - Use **element-level capture**: `take_snapshot(filePath)` → find popover uid → `take_screenshot(uid: ..., element: "trust tier popover", filePath: "screengrabs/trust-tier-popover.png")`
   - Click away or press Escape to dismiss

2. **Command Palette** — On any page:
   - Press `Meta+k` (macOS) via `press_key`
   - Wait 1 second for the command dialog to render
   - Use **element-level capture**: `take_snapshot(filePath)` → find command dialog uid → `take_screenshot(uid: ..., element: "command palette", filePath: "screengrabs/command-palette-empty.png")`
   - Type a search term (e.g., "dashboard") to show filtered results
   - Wait 500ms
   - Reuse same uid → `take_screenshot(uid: ..., element: "command palette with search", filePath: "screengrabs/command-palette-search.png")`
   - Press Escape to dismiss

### 4h. Table Toolbar Interactions

On pages with data tables (identified by density toggle or column headers):

1. **Density Toggle** — Find 3-button density group (icons for Compact/Comfortable/Spacious):
   - Click **Compact** → wait 500ms → `take_screenshot` → `screengrabs/{page}-density-compact.png`
   - Click **Spacious** → wait 500ms → `take_screenshot` → `screengrabs/{page}-density-spacious.png`
   - Click **Comfortable** to restore default

2. **Saved Views (ViewSwitcher)** — Find a bookmark/star icon dropdown near view toggles:
   - Click to open the saved views menu
   - `take_screenshot` → `screengrabs/{page}-saved-views.png`
   - Close the dropdown (click away or Escape)

### 4i. Filtered State Captures

On pages with a FilterBar (horizontal filter controls, typically with dropdown selectors):

1. Identify filter dropdowns in the FilterBar area
2. Apply 1-2 filters (e.g., select a status filter, a type/direction filter)
3. Wait 500ms for the table/list to re-render
4. Verify the "N active" badge appears on the filter bar
5. `take_screenshot` → `screengrabs/{page}-filtered.png`
6. Click the "Clear" button to reset all filters

### 4j. Settings Deep Captures

The Settings page (`/settings`) has multiple card sections. After the default `settings-list.png` capture, capture each section individually using **element-level screenshots** for tight crops:

For each section:
1. Use `evaluate_script` to scroll the section into view
2. Use `take_snapshot(filePath: "/tmp/settings-snap.md")` to get the section card's uid
3. Use `take_screenshot(uid: ..., element: "section name", filePath: ...)` for a tight crop

Sections to capture:
1. **Auth config** → `screengrabs/settings-auth.png`
2. **Runtime config** → `screengrabs/settings-runtime.png`
3. **Cost guardrails** → `screengrabs/settings-budget.png`
4. **Permission presets** (with risk badges and enable/disable toggles) → `screengrabs/settings-presets.png`
5. **Tool permissions** → `screengrabs/settings-permissions.png`
6. **Data management** → `screengrabs/settings-data.png`

Skip this sub-phase for non-Settings routes.

### 4k. Inbox Expanded Content

On the Inbox page (`/inbox`), after the default capture:

1. Click the first expandable notification to reveal its content
2. Wait 1 second for the ExpandableResult to render
3. `take_screenshot` → `screengrabs/inbox-expanded.png`
4. If a "Show more" button is visible (progressive disclosure / `.mask-fade-bottom` gradient), click it to expand fully
5. `take_screenshot` → `screengrabs/inbox-fully-expanded.png`
6. Collapse the notification before moving on

### 4l. Kanban Bulk Select

On the Dashboard kanban board, after all other kanban interactions:

1. Find "Enter select mode" buttons in column headers:
   ```js
   () => Array.from(document.querySelectorAll('button'))
     .filter(b => b.textContent?.trim() === 'Enter select mode')
     .map(b => ({ text: b.textContent.trim() }))
   ```
2. Click the first "Enter select mode" button (Planned column)
3. Wait 500ms for select mode to activate (checkboxes appear on cards)
4. Select 2-3 task cards by clicking their "Select {task}" buttons
5. Verify the bulk action toolbar is visible (shows "N sel." count, Queue/Delete buttons)
6. `take_screenshot` → `screengrabs/dashboard-bulk-select.png`
7. Click "Exit select mode" to restore normal kanban view

**Collect all create/new buttons** discovered in 4b — process them in Phase 5.

**After capturing a route**, mark all features associated with it as `Captured? = Yes` in the Feature Capture Checklist.

---

## Phase 5: Form Interaction (Dynamic)

For each create/new button discovered during Phase 4:

### 5a. Open the Form
1. Navigate back to the button's parent route
2. Click the create/new button
3. Wait 1-2 seconds for the form to appear

### 5b. Capture Empty Form
1. Run **error detection** JS — if error, recover before proceeding
2. Run **form container detection** JS to determine capture mode
3. If dialog/sheet → `take_snapshot(filePath: "/tmp/form-snap.md")`, find container uid, then `take_screenshot(uid: ..., element: "form container", filePath: "screengrabs/{page}-create-form-empty.png")`
4. If full-page form → `take_screenshot(filePath: "screengrabs/{page}-create-form-empty.png")`

### 5c. Discover Form Fields
Run `evaluate_script` to find all form fields:
```js
() => Array.from(document.querySelectorAll('input, textarea, select, [role="combobox"]'))
  .map(el => ({
    tag: el.tagName, type: el.type || el.getAttribute('role'),
    name: el.name || el.id, placeholder: el.placeholder,
    label: el.getAttribute('aria-label') || (el.labels?.[0]?.textContent?.trim())
  }))
```
If the JS query doesn't return enough info (e.g., for complex comboboxes), use `take_snapshot(filePath: "/tmp/form-snap.md")` and read selectively for uids.

Detect form container type:
- **Dialog** — modal overlay visible in snapshot
- **Sheet** — side panel (SheetContent element)
- **Full-page** — URL changed to include `/new` or `/create`

### 5d. Generate Realistic Data

**IMPORTANT:** Every form field MUST be filled with realistic, contextually appropriate data before capturing the filled state. Do not leave any field empty or with placeholder text.

**Feature-guided data:** Before falling back to generic data, check if the Feature Capture Checklist has spec-derived field descriptions for this route. For example:
- If the spec describes an "interval picker" → look for and interact with interval/frequency fields specifically
- If the spec describes a "profile selector" → ensure the profile dropdown is opened and a non-default profile selected
- If the spec describes specific field names → use those names to generate more contextually appropriate data

Fill fields based on label context:

| Field Label Contains | Data to Enter |
|---|---|
| name, title | Descriptive name relevant to page context (e.g., "API Integration Suite", "Weekly Status Report") |
| description, details | 1-2 realistic sentences about the entity |
| prompt, instructions | A realistic agent prompt (e.g., "Review the codebase for security vulnerabilities and generate a report") |
| directory, path | `/Users/dev/projects/my-app` |
| interval, frequency | Pick a middle option if dropdown, or "30m" / "1h" for text |
| priority | "High" (visually more interesting than default) |
| complexity | "Medium" |
| status | Leave as default (don't change) |
| url, link | `https://example.com/resource` |
| email | `team@example.com` |
| tags, labels | Contextually relevant tag |
| project | Select the first available project from dropdown |
| profile, agent | Select a non-default profile if available |
| cron, schedule | `0 9 * * 1-5` (weekdays at 9am) |
| task | Select the first available task from dropdown |

**Persona-based data:** When filling forms, use data that maps to the 4 journey personas for consistency with doc-generator:

| Persona | Project Name | Task Title | Description Theme |
|---------|-------------|------------|-------------------|
| Personal | "Side Project Tracker" | "Refactor auth module" | Solo dev productivity |
| Work | "Q2 Marketing Campaign" | "Review brand guidelines" | Team collaboration |
| Power User | "ML Pipeline Orchestrator" | "Train model v3.2" | Complex automation |
| Developer | "Stagent Plugin Dev" | "Add custom tool integration" | API/CLI/extension |

Rotate through personas across different forms so screenshots show varied, realistic data.

**For dropdowns/comboboxes:** Always click to open, snapshot to see options, then select a meaningful choice — never leave at the default placeholder.

### 5e. Fill the Form
- **Text fields**: Use `fill(uid, value, includeSnapshot: false)` — one field at a time
- **Dropdowns/Comboboxes**: Use `click(uid, includeSnapshot: false)` to open, then `evaluate_script` to find options, then `click` the option
- **Checkboxes/Radios**: Use `click(uid, includeSnapshot: false)`
- **Textareas**: Use `fill(uid, value, includeSnapshot: false)` with multi-sentence content
- **To find uids**: Use `take_snapshot(filePath: "/tmp/form-snap.md")` and read the file selectively

### 5f. Capture Filled Form
1. Verify all visible fields have values via `evaluate_script`:
   ```js
   () => Array.from(document.querySelectorAll('input, textarea'))
     .map(el => ({ name: el.name || el.placeholder, value: el.value, empty: !el.value }))
   ```
2. Run **error detection** JS — if error appeared during filling, recover first
3. Use **same element-level capture** as 5b: detect form container, use `uid` for dialog/sheet, viewport for full-page

### 5f½. Task Form — AI Assist (Task creation only)

When capturing the **task creation form** (`/tasks/new` or the New Task page), trigger the AI Assist feature after filling the form:

1. After filling title and description fields, run `take_snapshot(filePath)` or `evaluate_script` to find the "AI Assist" button (has a sparkles icon, text contains "AI Assist")
2. Click the "AI Assist" button
3. Wait for the AI response — poll with `take_snapshot(filePath)` or `evaluate_script` every 3 seconds, looking for:
   - The "Analyzing..." spinner to disappear
   - "AI Suggestions" text to appear in the snapshot (indicates the result panel rendered)
   - An error message (if the API call fails — capture the error state and move on)
4. Once "AI Suggestions" is visible, wait 1 additional second for animations to settle
5. `take_screenshot` → `screengrabs/dashboard-create-form-ai-assist.png`
6. Look for an "Apply" button in the AI Suggestions panel — if found, click it to apply the improved description
7. `take_screenshot` → `screengrabs/dashboard-create-form-ai-applied.png` (shows the form with AI-improved description applied)

**The filled form screenshot (`dashboard-create-form-filled.png`) should be taken AFTER the AI Assist flow completes**, so the final filled state reflects the AI-improved content. Sequence:
1. Fill title + description with initial realistic data
2. Trigger AI Assist → wait for result → capture `dashboard-create-form-ai-assist.png`
3. Click "Apply" on improved description → capture `dashboard-create-form-ai-applied.png`
4. This final state IS the filled form — save as `dashboard-create-form-filled.png` as well

**If AI Assist fails** (network error, API not configured, timeout after 30 seconds): capture the error state as `dashboard-create-form-ai-error.png`, then proceed with the manually-filled form as the filled screenshot.

### 5f¾. Workflow from AI Assist Confirmation

After the AI Assist flow in Phase 5f½ completes (or if AI Assist was skipped), capture the workflow confirmation view:

1. **Seed sessionStorage** with the assist result via `evaluate_script`. Use the actual AI Assist result if available, or realistic hardcoded data (5-step security audit workflow):
   ```js
   () => {
     const state = {
       assistResult: {
         improvedDescription: "Conduct a comprehensive security audit of the API layer including authentication flows, input validation, rate limiting, and CORS configuration.",
         breakdown: [
           { title: "Map API endpoints and auth flows", description: "Catalog all API routes and authentication mechanisms" },
           { title: "Test input validation", description: "Fuzz all input parameters for injection vulnerabilities" },
           { title: "Audit rate limiting and CORS", description: "Verify rate limiting and CORS headers are configured" },
           { title: "Review session management", description: "Check token expiry and session fixation protections" },
           { title: "Generate security report", description: "Compile findings with severity ratings and remediation steps" }
         ],
         recommendedPattern: "sequence",
         complexity: "complex",
         needsCheckpoint: true,
         reasoning: "Multiple sequential analysis steps where each builds on previous findings."
       },
       formState: {
         title: "API Security Audit",
         description: "Review API endpoints for security vulnerabilities",
         projectId: "",
         priority: "high",
         agentProfile: "code-reviewer",
         assignedAgent: "claude"
       }
     };
     sessionStorage.setItem("stagent:workflow-from-assist", JSON.stringify(state));
     return "seeded";
   }
   ```
2. Navigate to `/workflows/from-assist`
3. Collapse sidebar
4. Verify the page loaded with "Create Workflow from AI Assist" heading
5. `take_screenshot` → `screengrabs/dashboard-workflow-confirm.png`
6. Navigate back (do NOT submit — this is a capture-only step)

### 5g. Submit
1. Find and click the submit/save/create button
2. Wait 2 seconds for the result
3. `take_screenshot` → `screengrabs/{page}-new-entity.png`

If submission triggers a validation error:
- `take_screenshot` → `screengrabs/{page}-create-form-error.png`
- Try to fix the validation error (fill missing required fields), re-capture, and submit again
- If still failing, move on to the next route

### 5h. Edit Form Captures

For routes with edit functionality (discovered via "Edit" button in detail views during Phase 4d):

1. Navigate to a detail view that has an "Edit" button or link
2. Click the Edit button/link
3. Wait 1-2 seconds for the edit form to appear
4. `take_screenshot` → `screengrabs/{page}-edit-form.png`
5. Modify 1-2 fields to show the form is interactive (e.g., change description text, select a different dropdown value)
6. `take_screenshot` → `screengrabs/{page}-edit-form-modified.png`
7. Navigate back **without saving** (click Cancel, press Escape, or navigate away) to avoid corrupting existing data

**Known edit routes:** `/workflows/[id]/edit`, `/profiles/[id]/edit`. Other entities (tasks, projects) may use inline edit dialogs — capture those if discovered in Phase 4d.

---

## Phase 6: User Journeys

After completing individual route captures, capture key cross-route journeys that demonstrate the app's workflow:

**Incremental note:** In incremental mode, only run journey steps that involve at least one affected route. Skip journeys where all involved routes are unchanged.

### 6a. Task Lifecycle Journey
1. Navigate to Dashboard → click "New Task" → fill form → submit
2. Capture the new task appearing in the kanban: `screengrabs/journey-task-created.png`
3. Click the new task → capture detail: `screengrabs/journey-task-detail.png`

### 6b. Project Drill-Down Journey
1. Navigate to Projects → click first project
2. Capture the project detail with task list: `screengrabs/journey-project-tasks.png`
3. If the project detail has tabs or sections, capture them

### 6c. Notification/Inbox Journey
1. Navigate to Inbox → click first notification
2. Capture any detail/action view: `screengrabs/journey-inbox-action.png`

**Skip any journey step that would duplicate an already-captured screenshot.**

---

## Phase 7: Completion

### 7a. File Report

1. Run `ls -la screengrabs/` to report:
   - Total screenshot count
   - Full file list with sizes
2. Summarize what was captured per route in a table:
   | Route | Screenshots | Notes |
   |---|---|---|
   | Home | home-list.png | Sidebar expanded |
   | Dashboard | dashboard-list.png, ... | Sidebar collapsed |
3. Note any skipped pages or errors encountered
4. If incremental mode, note which routes were skipped as unchanged

### 7b. Feature Coverage Report

Generate a Feature Coverage Report from the Feature Capture Checklist:

```
| Feature | Tier | Route | Screenshots | Status |
|---------|------|-------|-------------|--------|
| Document Manager | Route | /documents | documents-list, documents-grid, documents-detail | COVERED |
| Micro-Visualizations | Component | (dashboard) | — | MISSED |
| Database Schema | Backend | — | — | N/A |
```

Status values:
- **COVERED** — feature's route was captured and expected UI elements were found
- **MISSED** — feature has UI elements but they were not captured (investigate why)
- **N/A** — backend feature with no UI surface
- **SKIPPED** — incremental mode, route unchanged since last run

**Summary line:** `X/Y route features covered, X/Y component features covered, Z backend excluded, N missed`

If any features are MISSED, note them as items to investigate — either the feature isn't wired into the UI, or the element discovery missed them.

### 7b½. Write Screengrab Manifest

Write `screengrabs/manifest.json` — a machine-readable inventory of all captures for consumption by doc-generator and other tools:

```json
{
  "generated": "ISO-timestamp",
  "viewport": "1440x900",
  "mode": "full|incremental",
  "screenshots": [
    {
      "file": "dashboard-list.png",
      "page": "dashboard",
      "view": "list",
      "route": "/dashboard",
      "type": "default|form|detail|journey|alternate",
      "features": ["task-board", "kanban-board-operations"],
      "description": "Dashboard default kanban view with task cards"
    }
  ],
  "coverage": {
    "routesCaptured": 11,
    "formsCaptured": 7,
    "journeysCaptured": 3
  }
}
```

Build this from the Feature Capture Checklist data already assembled during the run:

1. **List all `.png` files** in `screengrabs/`
2. **For each screenshot**, create an entry with:
   - `file` — filename (e.g., `dashboard-list.png`)
   - `page` — page slug extracted from filename prefix (e.g., `dashboard`)
   - `view` — view type from filename suffix (`list`, `grid`, `detail`, `create-form-empty`, etc.)
   - `route` — the route path from route discovery (e.g., `/dashboard`)
   - `type` — classify as `default` (list/grid views), `form` (create-form-*), `detail` (detail views), `journey` (journey-* files), or `alternate` (tabs, toggles, below-fold)
   - `features` — array of feature slugs from the Feature Capture Checklist that map to this page
   - `description` — human-readable description for use as alt-text in documentation (e.g., "Dashboard default kanban view with task cards")
3. **Compute coverage counts**: `routesCaptured` (unique routes with at least one screenshot), `formsCaptured` (screenshots with type `form`), `journeysCaptured` (screenshots with type `journey`)
4. **Write** the JSON to `screengrabs/manifest.json`

### 7c. Write Timestamp

Write the `.last-run` timestamp file for the next incremental run:
```bash
date -u +"%Y-%m-%dT%H:%M:%SZ" > screengrabs/.last-run
```

This file is used by Phase 1.6 in the next run to determine what has changed.

---

## Error Recovery

| Scenario | Action |
|---|---|
| Page fails to load (timeout/error) | Capture error state screenshot, log it, move to next route |
| Form validation error on submit | Capture as `{page}-create-form-error.png`, try to fix and resubmit once |
| Button click has no visible effect after 3s | Skip the interaction, log it |
| App becomes unresponsive | Navigate to root `/` to reset, then continue |
| Snapshot returns empty/minimal content | Wait 3s and retry once, then skip |
| Element not found after snapshot | Log the missing element, continue with next action |
| Sidebar re-expands unexpectedly | Toggle it closed before next capture |
| Feature spec file not found | Log warning, skip that feature in checklist |
| Changelog parse error | Fall back to full mode |

---

## Naming Convention

```
home-list.png                  # Home with sidebar expanded (hero shot)
home-below-fold.png            # Home scrolled down
{page}-list.png                # Default/list view (sidebar collapsed)
{page}-{view}.png              # Alternate view (grid, table, cards)
{page}-detail.png              # First entity's detail view
{page}-detail-{tab}.png        # Tab within a detail view
{page}-card-detail.png         # Card click-through (kanban/cards)
{page}-create-form-empty.png   # Empty creation form
{page}-create-form-filled.png  # Form with all fields populated
dashboard-create-form-ai-assist.png  # Task form after AI Assist returns suggestions
dashboard-create-form-ai-applied.png # Task form after applying AI-improved description
{page}-new-entity.png          # Result after form submission
{page}-create-form-error.png   # Validation error state
{page}-{tab-name}.png          # Tab variant within a page
journey-{name}.png             # Cross-route user journey captures
{page}-detail-pane.png            # Detail as right-rail panel (split layout)
{page}-density-{value}.png        # Table with density toggle applied
{page}-saved-views.png            # View Switcher dropdown open
{page}-filtered.png               # List/table with filters applied
{page}-edit-form.png              # Edit form for existing entity
{page}-edit-form-modified.png     # Edit form with changes
trust-tier-popover.png            # TrustTierBadge popover (sidebar footer)
command-palette-empty.png         # Command palette open, no search
command-palette-search.png        # Command palette with search results
settings-{section}.png            # Individual settings subsection
inbox-expanded.png                # Expanded notification content
inbox-fully-expanded.png          # Fully expanded (Show More clicked)
{page}-blueprints.png             # Blueprint gallery sub-route
dashboard-card-edit.png           # Task edit dialog from kanban card (element-level)
dashboard-bulk-select.png         # Kanban in select mode with bulk action toolbar
dashboard-workflow-confirm.png    # Workflow confirmation from AI Assist
.last-run                         # ISO timestamp of last completed run
manifest.json                     # Machine-readable inventory of all captures
```

All filenames use kebab-case, derived from the visible text in the UI.

---

## Checklist

- [ ] Dev server running at localhost:3000
- [ ] Viewport set to 1440x900
- [ ] Feature specs scanned from features/
- [ ] Feature Capture Checklist built (route/component/backend tiers)
- [ ] Incremental vs full mode determined
- [ ] Output folder prepared (clean for full, selective delete for incremental)
- [ ] Home captured with sidebar expanded
- [ ] Sidebar collapsed for all remaining routes
- [ ] Routes discovered dynamically from sidebar
- [ ] Routes cross-referenced against feature checklist
- [ ] Each route: default screenshot captured
- [ ] Each route: interactive elements discovered and exercised
- [ ] Feature-guided element hints used during capture
- [ ] Detail views: entity drill-downs captured
- [ ] Forms: opened, ALL fields filled with realistic data, submitted
- [ ] Dropdowns/comboboxes: opened and selection made (not left at placeholder)
- [ ] Task form: AI Assist triggered, result captured, improved description applied
- [ ] User journeys: key cross-route workflows captured
- [ ] Feature coverage report generated
- [ ] manifest.json written with screenshot inventory
- [ ] `.last-run` timestamp written
- [ ] Completion summary with file list
- [ ] TrustTierBadge popover captured
- [ ] Command Palette captured (empty + search)
- [ ] Density toggle variations captured on at least one table
- [ ] FilterBar with active filters captured
- [ ] Detail pane right-rail layout captured
- [ ] Edit forms captured for routes with editing
- [ ] Settings subsections individually captured
- [ ] Inbox expanded notification captured
- [ ] Saved views dropdown captured
- [ ] Sub-route pages captured (e.g., /workflows/blueprints)
- [ ] Kanban card edit dialog captured
- [ ] Kanban bulk select mode captured
- [ ] Workflow from AI Assist confirmation captured
- [ ] Router-push detail pages captured (profiles, schedules, documents)
