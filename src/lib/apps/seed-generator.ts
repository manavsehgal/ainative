import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getSanitizer, DEFAULT_STRATEGY } from "./sanitizers";
import type { SanitizeContext, SeedDataConfig } from "./sanitizers";
import { scanForPii, type PiiScanResult } from "./pii-scanner";

export interface SeedGeneratorInput {
  tables: Record<string, {
    columns: string[];
    rows: Record<string, unknown>[];
  }>;
  config: SeedDataConfig;
}

export interface SeedGeneratorResult {
  tables: Record<string, Record<string, unknown>[]>;
  piiScan: PiiScanResult;
  stats: {
    tablesProcessed: number;
    totalRows: number;
    columnsRedacted: number;
  };
}

/**
 * Sanitize table data according to per-column rules.
 * Columns not listed in the config default to 'redact'.
 */
export function sanitizeTableData(
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  config: SeedDataConfig
): Record<string, unknown>[] {
  const tableConfig = config.tables[tableName]?.sanitize ?? {};

  // Collect all values per column for context
  const allValuesByColumn: Record<string, unknown[]> = {};
  for (const col of columns) {
    allValuesByColumn[col] = rows.map((r) => r[col]);
  }

  // Process derive columns last (they depend on other sanitized values)
  const regularColumns = columns.filter(
    (col) => (tableConfig[col]?.strategy ?? DEFAULT_STRATEGY) !== "derive"
  );
  const deriveColumns = columns.filter(
    (col) => tableConfig[col]?.strategy === "derive"
  );
  const orderedColumns = [...regularColumns, ...deriveColumns];

  return rows.map((row, rowIndex) => {
    const sanitized: Record<string, unknown> = {};

    for (const col of orderedColumns) {
      const rule = tableConfig[col] ?? { strategy: DEFAULT_STRATEGY };
      const sanitizer = getSanitizer(rule.strategy);
      const context: SanitizeContext = {
        columnName: col,
        rowIndex,
        otherColumns: sanitized, // derive can reference already-sanitized columns
        allValues: allValuesByColumn[col],
      };
      sanitized[col] = sanitizer.sanitize(row[col], rule.params ?? {}, context);
    }

    return sanitized;
  });
}

/**
 * Run the full seed generation pipeline:
 * 1. Sanitize each table's data
 * 2. Run PII scanner on output
 * 3. Return sanitized data + scan results
 */
export function generateSeedData(input: SeedGeneratorInput): SeedGeneratorResult {
  const sanitizedTables: Record<string, Record<string, unknown>[]> = {};
  let totalRows = 0;
  let columnsRedacted = 0;

  for (const [tableName, tableData] of Object.entries(input.tables)) {
    const sanitized = sanitizeTableData(
      tableName,
      tableData.columns,
      tableData.rows,
      input.config
    );
    sanitizedTables[tableName] = sanitized;
    totalRows += sanitized.length;

    // Count redacted columns
    const tableConfig = input.config.tables[tableName]?.sanitize ?? {};
    for (const col of tableData.columns) {
      if ((tableConfig[col]?.strategy ?? DEFAULT_STRATEGY) === "redact") {
        columnsRedacted++;
      }
    }
  }

  const piiScan = scanForPii(sanitizedTables);

  return {
    tables: sanitizedTables,
    piiScan,
    stats: {
      tablesProcessed: Object.keys(sanitizedTables).length,
      totalRows,
      columnsRedacted,
    },
  };
}

/**
 * Write sanitized data as CSV files to a seed-data/ directory.
 */
export function writeSeedCsvs(
  outDir: string,
  tables: Record<string, Record<string, unknown>[]>
): void {
  const seedDir = join(outDir, "seed-data");
  mkdirSync(seedDir, { recursive: true });

  for (const [tableName, rows] of Object.entries(tables)) {
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    const header = columns.join(",");
    const csvRows = rows.map((row) =>
      columns.map((col) => {
        const val = row[col];
        if (val == null) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );
    writeFileSync(join(seedDir, `${tableName}.csv`), [header, ...csvRows].join("\n"));
  }
}

/**
 * Parse a CSV string into rows.
 */
export function parseSeedCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}
