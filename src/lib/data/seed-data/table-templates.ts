import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { userTableTemplates } from "@/lib/db/schema";
import { eq, and, like } from "drizzle-orm";
import type { PluginTableTemplate } from "@/lib/plugins/sdk/types";

interface TemplateSeed {
  name: string;
  description: string;
  category: "business" | "personal" | "pm" | "finance" | "content";
  icon: string;
  columns: Array<{
    name: string;
    displayName: string;
    dataType: string;
    config?: Record<string, unknown>;
  }>;
  sampleData?: Record<string, unknown>[];
}

const TEMPLATES: TemplateSeed[] = [
  // ── Business ───────────────────────────────────────────────────────
  {
    name: "Customer List",
    description: "Track customers with contact info and status",
    category: "business",
    icon: "Building2",
    columns: [
      { name: "name", displayName: "Name", dataType: "text" },
      { name: "email", displayName: "Email", dataType: "email" },
      { name: "company", displayName: "Company", dataType: "text" },
      { name: "status", displayName: "Status", dataType: "select", config: { options: ["Lead", "Active", "Churned"] } },
      { name: "notes", displayName: "Notes", dataType: "text" },
    ],
    sampleData: [
      { name: "Alice Johnson", email: "alice@example.com", company: "Acme Corp", status: "Active", notes: "" },
      { name: "Bob Smith", email: "bob@example.com", company: "Widget Inc", status: "Lead", notes: "Follow up next week" },
    ],
  },
  {
    name: "Product Inventory",
    description: "Track products, quantities, and pricing",
    category: "business",
    icon: "Package",
    columns: [
      { name: "product", displayName: "Product", dataType: "text" },
      { name: "sku", displayName: "SKU", dataType: "text" },
      { name: "quantity", displayName: "Quantity", dataType: "number" },
      { name: "price", displayName: "Price", dataType: "number" },
      { name: "category", displayName: "Category", dataType: "select", config: { options: ["Electronics", "Clothing", "Food", "Other"] } },
    ],
  },
  {
    name: "Meeting Notes",
    description: "Log meetings with attendees and action items",
    category: "business",
    icon: "Users",
    columns: [
      { name: "date", displayName: "Date", dataType: "date" },
      { name: "title", displayName: "Title", dataType: "text" },
      { name: "attendees", displayName: "Attendees", dataType: "text" },
      { name: "notes", displayName: "Notes", dataType: "text" },
      { name: "action_items", displayName: "Action Items", dataType: "text" },
    ],
  },

  // ── Personal ───────────────────────────────────────────────────────
  {
    name: "Reading List",
    description: "Books and articles to read",
    category: "personal",
    icon: "BookOpen",
    columns: [
      { name: "title", displayName: "Title", dataType: "text" },
      { name: "author", displayName: "Author", dataType: "text" },
      { name: "status", displayName: "Status", dataType: "select", config: { options: ["To Read", "Reading", "Finished"] } },
      { name: "rating", displayName: "Rating", dataType: "number" },
      { name: "notes", displayName: "Notes", dataType: "text" },
    ],
  },
  {
    name: "Habit Tracker",
    description: "Daily habits and streaks",
    category: "personal",
    icon: "Target",
    columns: [
      { name: "habit", displayName: "Habit", dataType: "text" },
      { name: "frequency", displayName: "Frequency", dataType: "select", config: { options: ["Daily", "Weekly", "Monthly"] } },
      { name: "streak", displayName: "Streak", dataType: "number" },
      { name: "completed", displayName: "Completed Today", dataType: "boolean" },
    ],
  },

  // ── Project Management ─────────────────────────────────────────────
  {
    name: "Sprint Board",
    description: "Track sprint tasks with points and assignees",
    category: "pm",
    icon: "KanbanSquare",
    columns: [
      { name: "task", displayName: "Task", dataType: "text" },
      { name: "assignee", displayName: "Assignee", dataType: "text" },
      { name: "status", displayName: "Status", dataType: "select", config: { options: ["Backlog", "In Progress", "Review", "Done"] } },
      { name: "points", displayName: "Points", dataType: "number" },
      { name: "due_date", displayName: "Due Date", dataType: "date" },
    ],
  },
  {
    name: "Bug Tracker",
    description: "Track bugs with severity and reproduction steps",
    category: "pm",
    icon: "Bug",
    columns: [
      { name: "title", displayName: "Title", dataType: "text" },
      { name: "severity", displayName: "Severity", dataType: "select", config: { options: ["Critical", "High", "Medium", "Low"] } },
      { name: "status", displayName: "Status", dataType: "select", config: { options: ["Open", "In Progress", "Fixed", "Closed"] } },
      { name: "reported_by", displayName: "Reported By", dataType: "text" },
      { name: "steps", displayName: "Steps to Reproduce", dataType: "text" },
    ],
  },
  {
    name: "Feature Requests",
    description: "Collect and prioritize feature ideas",
    category: "pm",
    icon: "Lightbulb",
    columns: [
      { name: "feature", displayName: "Feature", dataType: "text" },
      { name: "requester", displayName: "Requester", dataType: "text" },
      { name: "priority", displayName: "Priority", dataType: "select", config: { options: ["P0", "P1", "P2", "P3"] } },
      { name: "votes", displayName: "Votes", dataType: "number" },
      { name: "status", displayName: "Status", dataType: "select", config: { options: ["Proposed", "Approved", "Building", "Shipped"] } },
    ],
  },

  // ── Finance ────────────────────────────────────────────────────────
  {
    name: "Expense Tracker",
    description: "Log expenses with categories and receipts",
    category: "finance",
    icon: "Receipt",
    columns: [
      { name: "date", displayName: "Date", dataType: "date" },
      { name: "description", displayName: "Description", dataType: "text" },
      { name: "amount", displayName: "Amount", dataType: "number" },
      { name: "category", displayName: "Category", dataType: "select", config: { options: ["Food", "Transport", "Software", "Office", "Other"] } },
      { name: "receipt_url", displayName: "Receipt", dataType: "url" },
    ],
  },
  {
    name: "Invoice Log",
    description: "Track invoices and payment status",
    category: "finance",
    icon: "FileText",
    columns: [
      { name: "invoice_number", displayName: "Invoice #", dataType: "text" },
      { name: "client", displayName: "Client", dataType: "text" },
      { name: "amount", displayName: "Amount", dataType: "number" },
      { name: "issued_date", displayName: "Issued", dataType: "date" },
      { name: "status", displayName: "Status", dataType: "select", config: { options: ["Draft", "Sent", "Paid", "Overdue"] } },
    ],
  },

  // ── Content ────────────────────────────────────────────────────────
  {
    name: "Content Calendar",
    description: "Plan and schedule content across channels",
    category: "content",
    icon: "Calendar",
    columns: [
      { name: "title", displayName: "Title", dataType: "text" },
      { name: "channel", displayName: "Channel", dataType: "select", config: { options: ["Blog", "Twitter", "LinkedIn", "Newsletter", "YouTube"] } },
      { name: "publish_date", displayName: "Publish Date", dataType: "date" },
      { name: "status", displayName: "Status", dataType: "select", config: { options: ["Idea", "Drafting", "Review", "Scheduled", "Published"] } },
      { name: "url", displayName: "URL", dataType: "url" },
    ],
  },
  {
    name: "Research Notes",
    description: "Organize research with sources and tags",
    category: "content",
    icon: "Search",
    columns: [
      { name: "topic", displayName: "Topic", dataType: "text" },
      { name: "source", displayName: "Source", dataType: "url" },
      { name: "key_findings", displayName: "Key Findings", dataType: "text" },
      { name: "relevance", displayName: "Relevance", dataType: "select", config: { options: ["High", "Medium", "Low"] } },
      { name: "date_added", displayName: "Date Added", dataType: "date" },
    ],
  },
];

/**
 * Seed system templates if not already present.
 * Idempotent — checks for existing templates by name + scope='system'.
 */
export async function seedTableTemplates(): Promise<number> {
  let created = 0;
  const now = new Date();

  for (const t of TEMPLATES) {
    const existing = db
      .select()
      .from(userTableTemplates)
      .where(
        and(
          eq(userTableTemplates.name, t.name),
          eq(userTableTemplates.scope, "system")
        )
      )
      .get();

    if (existing) continue;

    const columnsWithPositions = t.columns.map((col, i) => ({
      ...col,
      position: i,
    }));

    await db.insert(userTableTemplates).values({
      id: randomUUID(),
      name: t.name,
      description: t.description,
      category: t.category,
      columnSchema: JSON.stringify(columnsWithPositions),
      sampleData: t.sampleData ? JSON.stringify(t.sampleData) : null,
      scope: "system",
      icon: t.icon,
      createdAt: now,
      updatedAt: now,
    });
    created++;
  }

  return created;
}

const PLUGIN_TABLE_PREFIX = "plugin:";

function pluginTableId(pluginId: string, tableId: string): string {
  return `${PLUGIN_TABLE_PREFIX}${pluginId}:${tableId}`;
}

const MAX_PLUGIN_SAMPLE_ROWS = 10_000;

/**
 * Install (or replace) a plugin's table templates as user_table_templates rows.
 * Idempotent — running twice with the same pluginId leaves the same row count.
 * Plugin tables ride scope: "system" with a composite id "plugin:<id>:<table>".
 */
export function installPluginTables(pluginId: string, tables: PluginTableTemplate[]): void {
  const now = new Date();
  for (const t of tables) {
    const id = pluginTableId(pluginId, t.id);
    const columnsWithPositions = t.columns.map((col, i) => ({ ...col, position: i }));
    const sampleData = t.sampleRows && t.sampleRows.length > 0
      ? JSON.stringify(t.sampleRows.slice(0, MAX_PLUGIN_SAMPLE_ROWS))
      : null;
    // Suffix the display name with the plugin id so a plugin shipping a
    // table whose name collides with a builtin (e.g., "Customer List")
    // doesn't produce two indistinguishable rows in the picker UI.
    // The builtin row stays untouched; the plugin row is visually disambiguated.
    const displayName = `${t.name} (${pluginId})`;
    const existing = db.select({ id: userTableTemplates.id }).from(userTableTemplates).where(eq(userTableTemplates.id, id)).get();
    if (existing) {
      db.update(userTableTemplates)
        .set({
          name: displayName,
          description: t.description,
          category: t.category,
          columnSchema: JSON.stringify(columnsWithPositions),
          sampleData,
          icon: t.icon,
          updatedAt: now,
        })
        .where(eq(userTableTemplates.id, id))
        .run();
    } else {
      db.insert(userTableTemplates)
        .values({
          id,
          name: displayName,
          description: t.description,
          category: t.category,
          columnSchema: JSON.stringify(columnsWithPositions),
          sampleData,
          scope: "system",
          icon: t.icon,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
}

/** Delete all DB rows that belong to this plugin. */
export function removePluginTables(pluginId: string): void {
  const prefix = `${PLUGIN_TABLE_PREFIX}${pluginId}:%`;
  db.delete(userTableTemplates).where(like(userTableTemplates.id, prefix)).run();
}

/** Test/introspection — list plugin-owned table ids for a given plugin. */
export function listPluginTableIds(pluginId: string): string[] {
  const prefix = `${PLUGIN_TABLE_PREFIX}${pluginId}:%`;
  return db
    .select({ id: userTableTemplates.id })
    .from(userTableTemplates)
    .where(like(userTableTemplates.id, prefix))
    .all()
    .map((r) => r.id);
}
