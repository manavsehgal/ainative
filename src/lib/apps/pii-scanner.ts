export interface PiiFinding {
  table: string;
  column: string;
  rowIndex: number;
  value: string;
  pattern: string;
  severity: "error" | "warning";
  suggestion: string;
}

export interface PiiScanResult {
  clean: boolean;
  findings: PiiFinding[];
}

interface PiiPattern {
  name: string;
  test: (value: string) => boolean;
  severity: "error" | "warning";
  suggestion: string;
}

const REAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com",
  "icloud.com", "mail.com", "protonmail.com", "zoho.com", "yandex.com",
  "live.com", "msn.com", "comcast.net", "att.net", "verizon.net",
]);

const PII_PATTERNS: PiiPattern[] = [
  {
    name: "ssn",
    test: (v) => /\b\d{3}-\d{2}-\d{4}\b/.test(v),
    severity: "error",
    suggestion: "Use the 'redact' or 'hash' strategy for this column.",
  },
  {
    name: "credit_card",
    test: (v) => {
      const digits = v.replace(/[\s-]/g, "");
      if (!/^\d{13,19}$/.test(digits)) return false;
      // Luhn check
      let sum = 0;
      let alt = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i], 10);
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
      }
      return sum % 10 === 0;
    },
    severity: "error",
    suggestion: "Use the 'redact' strategy — credit card numbers must never appear in seed data.",
  },
  {
    name: "real_email",
    test: (v) => {
      const match = v.match(/@([a-z0-9.-]+)/i);
      return match ? REAL_EMAIL_DOMAINS.has(match[1].toLowerCase()) : false;
    },
    severity: "error",
    suggestion: "Use the 'faker' strategy with fakerMethod: 'internet.email' for synthetic emails.",
  },
  {
    name: "phone",
    test: (v) => /\+?[1-9]\d{6,14}/.test(v.replace(/[\s()-]/g, "")),
    severity: "warning",
    suggestion: "Consider using 'redact' or 'faker' — this looks like a phone number.",
  },
  {
    name: "ip_address",
    test: (v) => {
      const match = v.match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
      if (!match) return false;
      const octets = match.slice(1).map(Number);
      if (octets.some((o) => o > 255)) return false;
      // Skip private ranges (10.x, 172.16-31.x, 192.168.x)
      if (octets[0] === 10) return false;
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
      if (octets[0] === 192 && octets[1] === 168) return false;
      return true;
    },
    severity: "warning",
    suggestion: "Use 'redact' or replace with a private IP range.",
  },
  {
    name: "street_address",
    test: (v) => /\d+\s+[A-Z][a-z]+\s+(St|Ave|Blvd|Dr|Ln|Rd|Way|Ct|Pl)\b/i.test(v),
    severity: "warning",
    suggestion: "Use 'faker' with fakerMethod: 'address.city' or 'redact'.",
  },
];

export function scanForPii(
  tableData: Record<string, Record<string, unknown>[]>
): PiiScanResult {
  const findings: PiiFinding[] = [];

  for (const [tableName, rows] of Object.entries(tableData)) {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      for (const [column, value] of Object.entries(row)) {
        if (value == null || column === "_sample") continue;
        const str = String(value);
        if (str.length < 3) continue;

        for (const pattern of PII_PATTERNS) {
          if (pattern.test(str)) {
            findings.push({
              table: tableName,
              column,
              rowIndex,
              value: str.slice(0, 50),
              pattern: pattern.name,
              severity: pattern.severity,
              suggestion: pattern.suggestion,
            });
            break; // one finding per cell is enough
          }
        }
      }
    }
  }

  return {
    clean: findings.filter((f) => f.severity === "error").length === 0,
    findings,
  };
}
