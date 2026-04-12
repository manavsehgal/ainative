export interface SanitizeContext {
  columnName: string;
  rowIndex: number;
  otherColumns: Record<string, unknown>;
  allValues: unknown[];
}

export interface Sanitizer {
  name: string;
  sanitize(
    value: unknown,
    params: Record<string, unknown>,
    context: SanitizeContext
  ): unknown;
}

export interface SanitizationRule {
  strategy: string;
  params?: Record<string, unknown>;
}

export interface TableSanitizationConfig {
  sanitize: Record<string, SanitizationRule>;
}

export interface SeedDataConfig {
  tables: Record<string, TableSanitizationConfig>;
}
