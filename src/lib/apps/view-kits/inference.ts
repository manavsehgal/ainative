import type { AppManifest } from "@/lib/apps/registry";
import type { ColumnSchemaRef, KitId } from "./types";

/**
 * `pickKit` resolves which view kit renders a composed app. If the manifest
 * declares `view.kit` (and it isn't `auto`), that wins. Otherwise a
 * deterministic 7-rule decision table runs top-to-bottom — first match wins,
 * no scoring, no tie-breakers. Every rule is a small named pure predicate.
 *
 * Initial rule implementations are intentionally approximate. Phase 5
 * (`composed-app-auto-inference-hardening`) tightens the column-shape probes
 * against edge cases.
 */
export function pickKit(
  manifest: AppManifest,
  columnSchemas: ColumnSchemaRef[]
): KitId {
  const declared = manifest.view?.kit;
  if (declared && declared !== "auto") {
    return declared as KitId;
  }
  if (rule1_ledger(manifest, columnSchemas)) return "ledger";
  if (rule2_tracker(manifest, columnSchemas)) return "tracker";
  if (rule3_research(manifest)) return "research";
  if (rule4_coach(manifest)) return "coach";
  if (rule5_inbox(manifest)) return "inbox";
  if (rule6_multiBlueprint(manifest)) return "workflow-hub";
  return "workflow-hub";
}

// --- Rule predicates ---------------------------------------------------------

export function rule1_ledger(
  m: AppManifest,
  schemas: ColumnSchemaRef[]
): boolean {
  const heroId = m.tables[0]?.id;
  if (!heroId) return false;
  if (m.blueprints.length < 1) return false;
  const cols = lookupColumns(schemas, heroId);
  return cols !== null && hasCurrency(cols);
}

export function rule2_tracker(
  m: AppManifest,
  schemas: ColumnSchemaRef[]
): boolean {
  const heroId = m.tables[0]?.id;
  if (!heroId) return false;
  if (m.schedules.length < 1) return false;
  const cols = lookupColumns(schemas, heroId);
  if (!cols) return false;
  return hasBoolean(cols) && hasDate(cols);
}

export function rule3_research(m: AppManifest): boolean {
  if (m.schedules.length < 1) return false;
  return m.blueprints.some((b) => DOC_BLUEPRINT_RE.test(b.id));
}

export function rule4_coach(m: AppManifest): boolean {
  if (m.schedules.length < 1) return false;
  if (m.profiles.some((p) => COACH_RE.test(p.id))) return true;
  return m.schedules.some((s) =>
    typeof s.runs === "string" && /^profile:.*-coach\b/i.test(s.runs)
  );
}

export function rule5_inbox(m: AppManifest): boolean {
  return m.blueprints.some((b) => INBOX_BLUEPRINT_RE.test(b.id));
}

export function rule6_multiBlueprint(m: AppManifest): boolean {
  if (m.blueprints.length < 2) return false;
  // "no clear hero table" — interpreted as: no hero table at all.
  return m.tables.length === 0;
}

// --- Column-shape probes -----------------------------------------------------

type Col = ColumnSchemaRef["columns"][number];

const CURRENCY_NAME_RE = /(^|[^a-z])(amount|price|cost|balance|total|revenue|income|spend)([^a-z]|$)/i;
const DATE_NAME_RE = /(^date$|_date$|_at$|^at_)/i;
const BOOLEAN_NAME_RE = /(^|_)(active|completed|done|enabled|verified|is)(_|$)/i;
const COACH_RE = /(^|[-_])coach($|[-_])/i;
const DOC_BLUEPRINT_RE = /(digest|report|summary|brief|synthesis)/i;
const INBOX_BLUEPRINT_RE = /(drafter|inbox|notification|message|follow[-_]?up|triage)/i;

export function hasCurrency(cols: Col[]): boolean {
  return cols.some(
    (c) => c.semantic === "currency" || CURRENCY_NAME_RE.test(c.name)
  );
}

export function hasDate(cols: Col[]): boolean {
  return cols.some(
    (c) =>
      c.type === "date" ||
      c.type === "datetime" ||
      c.semantic === "date" ||
      DATE_NAME_RE.test(c.name)
  );
}

export function hasBoolean(cols: Col[]): boolean {
  return cols.some(
    (c) =>
      c.type === "boolean" ||
      c.semantic === "boolean" ||
      BOOLEAN_NAME_RE.test(c.name)
  );
}

function lookupColumns(
  schemas: ColumnSchemaRef[],
  tableId: string
): Col[] | null {
  const hit = schemas.find((s) => s.tableId === tableId);
  return hit ? hit.columns : null;
}
