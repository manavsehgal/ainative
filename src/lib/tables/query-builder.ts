/**
 * Query builder for user-defined table rows.
 *
 * Translates structured FilterSpec/SortSpec objects into SQL fragments
 * using json_extract() to query the JSON `data` column.
 *
 * SECURITY: Column names are validated against the table's known column
 * schema before being interpolated into json_extract paths. Never pass
 * raw user input as column names without validation.
 */

import { sql, type SQL } from "drizzle-orm";
import type { FilterSpec, SortSpec, ColumnDef } from "./types";

/** Characters allowed in column names — reject anything else */
const SAFE_COLUMN_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

/**
 * Validate that a column name exists in the table's schema and is safe
 * for interpolation into json_extract paths.
 */
function validateColumnName(
  columnName: string,
  validColumns: Set<string>
): void {
  if (!SAFE_COLUMN_NAME.test(columnName)) {
    throw new Error(`Invalid column name: ${columnName}`);
  }
  if (!validColumns.has(columnName)) {
    throw new Error(`Unknown column: ${columnName}`);
  }
}

/**
 * Build a json_extract SQL fragment for a column.
 * Output: json_extract(data, '$.columnName')
 */
function jsonCol(columnName: string): SQL {
  // Column name is already validated — safe to interpolate into the path string
  return sql.raw(`json_extract(data, '$.${columnName}')`);
}

/**
 * Build a WHERE clause fragment from a single filter spec.
 */
function buildFilterClause(
  filter: FilterSpec,
  validColumns: Set<string>
): SQL {
  validateColumnName(filter.column, validColumns);
  const col = jsonCol(filter.column);

  switch (filter.operator) {
    case "eq":
      return sql`${col} = ${filter.value}`;
    case "neq":
      return sql`${col} != ${filter.value}`;
    case "gt":
      return sql`${col} > ${filter.value}`;
    case "gte":
      return sql`${col} >= ${filter.value}`;
    case "lt":
      return sql`${col} < ${filter.value}`;
    case "lte":
      return sql`${col} <= ${filter.value}`;
    case "contains":
      return sql`${col} LIKE ${"%" + String(filter.value) + "%"}`;
    case "starts_with":
      return sql`${col} LIKE ${String(filter.value) + "%"}`;
    case "in": {
      const values = Array.isArray(filter.value) ? filter.value : [String(filter.value)];
      if (values.length === 0) {
        return sql`0 = 1`; // empty IN → always false
      }
      // Build parameterized IN clause
      const placeholders = values.map((v) => sql`${v}`);
      return sql`${col} IN (${sql.join(placeholders, sql`, `)})`;
    }
    case "is_empty":
      // Treat whitespace-only as empty so the filter agrees with the
      // server-side `filterUnpopulatedRows` / `shouldSkipPostActionValue`
      // semantics used by bulk row enrichment.
      return sql`(${col} IS NULL OR TRIM(${col}) = '')`;
    case "is_not_empty":
      return sql`(${col} IS NOT NULL AND TRIM(${col}) != '')`;
    default:
      throw new Error(`Unknown filter operator: ${filter.operator}`);
  }
}

/**
 * Build a complete WHERE clause from multiple filters (AND-joined).
 */
export function buildWhereClause(
  filters: FilterSpec[],
  validColumns: Set<string>
): SQL | undefined {
  if (filters.length === 0) return undefined;

  const clauses = filters.map((f) => buildFilterClause(f, validColumns));
  return sql.join(clauses, sql` AND `);
}

/**
 * Build an ORDER BY clause from sort specs.
 */
export function buildOrderClause(
  sorts: SortSpec[],
  validColumns: Set<string>
): SQL | undefined {
  if (sorts.length === 0) return undefined;

  const clauses = sorts.map((s) => {
    validateColumnName(s.column, validColumns);
    const col = jsonCol(s.column);
    return s.direction === "desc" ? sql`${col} DESC` : sql`${col} ASC`;
  });

  return sql.join(clauses, sql`, `);
}

/**
 * Extract the set of valid column names from a column schema.
 */
export function getValidColumns(columnSchema: ColumnDef[]): Set<string> {
  return new Set(columnSchema.map((c) => c.name));
}

/**
 * Build a full query SQL fragment for row filtering, sorting, and pagination.
 * Returns the WHERE, ORDER BY, LIMIT, and OFFSET fragments.
 */
export function buildRowQuery(
  columnSchema: ColumnDef[],
  options: {
    filters?: FilterSpec[];
    sorts?: SortSpec[];
    limit?: number;
    offset?: number;
  }
): {
  where: SQL | undefined;
  orderBy: SQL | undefined;
  limit: number;
  offset: number;
} {
  const validColumns = getValidColumns(columnSchema);

  return {
    where: options.filters ? buildWhereClause(options.filters, validColumns) : undefined,
    orderBy: options.sorts ? buildOrderClause(options.sorts, validColumns) : undefined,
    limit: options.limit ?? 100,
    offset: options.offset ?? 0,
  };
}
