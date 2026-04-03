export const TABLE_SOURCES = [
  "manual",
  "imported",
  "agent",
  "template",
] as const;

export type TableSource = (typeof TABLE_SOURCES)[number];

export const COLUMN_DATA_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "url",
  "email",
  "relation",
  "computed",
] as const;

export type ColumnDataType = (typeof COLUMN_DATA_TYPES)[number];

export const TABLE_VIEW_TYPES = ["grid", "chart", "joined"] as const;
export type TableViewType = (typeof TABLE_VIEW_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  "one_to_one",
  "one_to_many",
  "many_to_many",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const TEMPLATE_CATEGORIES = [
  "business",
  "personal",
  "pm",
  "finance",
  "content",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const IMPORT_STATUSES = ["pending", "completed", "failed"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** Badge variant mappings for table source */
export const tableSourceVariant: Record<
  TableSource,
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  manual: "outline",
  imported: "secondary",
  agent: "default",
  template: "success",
};

/** Display labels for column data types */
export const columnTypeLabel: Record<ColumnDataType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Checkbox",
  select: "Select",
  url: "URL",
  email: "Email",
  relation: "Relation",
  computed: "Computed",
};
