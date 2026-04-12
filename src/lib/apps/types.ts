import type { ColumnDef } from "@/lib/tables/types";

export const APP_INSTANCE_STATUSES = [
  "installing",
  "bootstrapping",
  "ready",
  "failed",
  "disabled",
  "corrupt",
] as const;

export type AppInstanceStatus = (typeof APP_INSTANCE_STATUSES)[number];

export const APP_SOURCE_TYPES = ["builtin", "marketplace", "file"] as const;
export type AppSourceType = (typeof APP_SOURCE_TYPES)[number];

export const APP_TRUST_LEVELS = [
  "official",
  "verified",
  "community",
  "private",
] as const;

export type AppTrustLevel = (typeof APP_TRUST_LEVELS)[number];

export const APP_DIFFICULTY_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
] as const;

export type AppDifficulty = (typeof APP_DIFFICULTY_LEVELS)[number];

export const APP_PERMISSIONS = [
  "projects:create",
  "tables:create",
  "tables:seed",
  "schedules:create",
  "profiles:link",
  "blueprints:link",
  "triggers:create",
  "documents:create",
  "notifications:create",
  "views:create",
  "env:declare",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export interface AppBundleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: AppDifficulty;
  estimatedSetupMinutes: number;
  icon: string;
  trustLevel: AppTrustLevel;
  permissions: AppPermission[];
  sidebarLabel?: string;
}

export interface AppBlueprintLink {
  id: string;
  label: string;
  description?: string;
}

export interface AppProfileLink {
  id: string;
  label: string;
  description?: string;
}

export interface AppTableTemplate {
  key: string;
  name: string;
  description?: string;
  columns: ColumnDef[];
  sampleRows: Record<string, unknown>[];
}

export interface AppScheduleTemplate {
  key: string;
  name: string;
  description?: string;
  prompt: string;
  cronExpression: string;
  agentProfile?: string;
}

// ── Tier 1 extended primitives ──

export interface AppTriggerTemplate {
  key: string;
  name: string;
  description?: string;
  tableKey: string;
  event: "row_added" | "row_updated" | "row_deleted";
  action: "notify" | "schedule_run" | "webhook";
  actionConfig: Record<string, unknown>;
}

export interface AppDocumentTemplate {
  key: string;
  name: string;
  description?: string;
  globPatterns?: string[];
  maxSizeMb?: number;
}

export interface AppNotificationTemplate {
  key: string;
  title: string;
  body: string;
  type: "info" | "warning" | "success" | "error";
  lifecycle?: "transient" | "persistent" | "actionable";
  triggerKey?: string;
}

export interface AppSavedViewTemplate {
  key: string;
  name: string;
  description?: string;
  tableKey: string;
  filters: Record<string, unknown>;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  visibleColumns?: string[];
}

export interface AppEnvVarDeclaration {
  key: string;
  name: string;
  description: string;
  required: boolean;
  sensitive: boolean;
  defaultValue?: string;
  validationPattern?: string;
}

export interface AppActionBinding {
  key: string;
  label: string;
  description?: string;
  variant?: "default" | "outline" | "secondary";
  action:
    | { type: "openProject" }
    | { type: "openPage"; pageKey: string }
    | { type: "openTable"; tableKey: string }
    | { type: "openSchedules" }
    | { type: "openWorkflows" }
    | { type: "clearSampleData" };
}

export interface AppMetricBinding {
  key: string;
  label: string;
  tableKey: string;
  aggregation: "rowCount" | "sampleCount";
  format?: "number";
}

export type AppWidget =
  | {
      type: "hero";
      title: string;
      description: string;
      eyebrow?: string;
    }
  | {
      type: "stats";
      title?: string;
      metrics: AppMetricBinding[];
    }
  | {
      type: "table";
      title: string;
      description?: string;
      tableKey: string;
      columns?: string[];
      limit?: number;
    }
  | {
      type: "text";
      title?: string;
      markdown: string;
    }
  | {
      type: "actions";
      title: string;
      actions: AppActionBinding[];
    }
  | {
      type: "linkedAssets";
      title: string;
      showProfiles?: boolean;
      showBlueprints?: boolean;
    }
  | {
      type: "scheduleList";
      title: string;
      description?: string;
    };

export interface AppPageDefinition {
  key: string;
  title: string;
  description?: string;
  path?: string;
  icon?: string;
  widgets: AppWidget[];
}

export interface AppUiSchema {
  pages: AppPageDefinition[];
}

export interface AppBundle {
  manifest: AppBundleManifest;
  setupChecklist: string[];
  profiles: AppProfileLink[];
  blueprints: AppBlueprintLink[];
  tables: AppTableTemplate[];
  schedules: AppScheduleTemplate[];
  ui: AppUiSchema;
  triggers?: AppTriggerTemplate[];
  documents?: AppDocumentTemplate[];
  notifications?: AppNotificationTemplate[];
  savedViews?: AppSavedViewTemplate[];
  envVars?: AppEnvVarDeclaration[];
}

// ── SAP (Stagent App Package) manifest types ──

export const SAP_CATEGORIES = [
  "finance",
  "sales",
  "content",
  "dev",
  "automation",
  "general",
] as const;

export type SapCategory = (typeof SAP_CATEGORIES)[number];

export const SAP_PRICING = ["free", "paid"] as const;
export type SapPricing = (typeof SAP_PRICING)[number];

export interface SapAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface SapPlatformRequirement {
  minVersion: string;
  maxVersion?: string;
}

export interface SapMarketplaceMeta {
  category: SapCategory;
  tags: string[];
  difficulty: AppDifficulty;
  pricing: SapPricing;
}

export interface SapSidebar {
  label: string;
  icon: string;
  route: string;
}

export interface SapProvides {
  profiles: string[];
  blueprints: string[];
  tables: string[];
  schedules: string[];
  triggers: string[];
  pages: string[];
}

export interface SapDependencies {
  apps: string[];
  platform: string[];
}

export interface SapManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: SapAuthor;
  license?: string;
  platform: SapPlatformRequirement;
  marketplace: SapMarketplaceMeta;
  sidebar: SapSidebar;
  provides: SapProvides;
  dependencies?: SapDependencies;
  ui?: AppUiSchema;
}

export interface AppResourceMap {
  tables: Record<string, string>;
  schedules: Record<string, string>;
  triggers?: Record<string, string>;
  documents?: Record<string, string>;
  notifications?: Record<string, string>;
  savedViews?: Record<string, string>;
  envVars?: Record<string, string>;
}

export interface AppInstanceRecord {
  id: string;
  appId: string;
  name: string;
  version: string;
  projectId: string | null;
  status: AppInstanceStatus;
  sourceType: AppSourceType;
  bootstrapError: string | null;
  installedAt: Date;
  bootstrappedAt: Date | null;
  updatedAt: Date;
  manifest: AppBundleManifest;
  ui: AppUiSchema;
  resourceMap: AppResourceMap;
  bundle: AppBundle;
}

export interface AppCatalogEntry {
  appId: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: AppDifficulty;
  estimatedSetupMinutes: number;
  icon: string;
  trustLevel: AppTrustLevel;
  permissions: AppPermission[];
  tableCount: number;
  scheduleCount: number;
  profileCount: number;
  blueprintCount: number;
  setupChecklistCount: number;
  installed: boolean;
  installedStatus: AppInstanceStatus | null;
  projectId: string | null;
}

export interface AppSidebarItem {
  title: string;
  href: string;
  icon: string;
}

export interface AppSidebarGroup {
  appId: string;
  label: string;
  icon: string;
  items: AppSidebarItem[];
}
