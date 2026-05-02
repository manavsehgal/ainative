import type { ReactNode } from "react";
import type { AppDetail, AppManifest } from "@/lib/apps/registry";

/**
 * Frozen contracts for the composed-app view-kit registry.
 *
 * Phase 1.1 lands these types and a single `placeholder` kit. Later phases
 * (Phase 2 onward) populate the registry with domain-aware kits — Tracker,
 * Workflow Hub, Coach, Ledger, Inbox, Research — that consume the same
 * `KitDefinition` shape. The shape is contract-frozen at this point.
 */

export type KitId =
  | "placeholder"
  | "tracker"
  | "workflow-hub"
  | "coach"
  | "ledger"
  | "inbox"
  | "research";

/**
 * Minimal per-table column descriptor passed into kit selection. In Phase 1.1
 * this is always an empty array; Phase 1.2 (`composed-app-manifest-view-field`)
 * wires real column shapes for the `pickKit` decision table.
 */
export interface ColumnSchemaRef {
  tableId: string;
  columns: { name: string; type?: string; semantic?: string }[];
}

export interface ResolveInput {
  manifest: AppManifest;
  columns: ColumnSchemaRef[];
}

/**
 * `KitProjection` is whatever a kit's `resolve` step extracts from the
 * manifest + columns to feed `buildModel`. Each kit defines its own internal
 * shape; the registry only sees `unknown` here so kits remain decoupled.
 */
export type KitProjection = Record<string, unknown>;

/**
 * Server-only runtime state assembled by `data.ts` once per request and
 * passed through to `buildModel`. Phase 1.1 keeps this minimal; Phase 2+
 * extends it with recent runs, schedule windows, and KPI source rows.
 */
export interface RuntimeState {
  app: AppDetail;
  recentTaskCount?: number;
  scheduleCadence?: string | null;
}

// --- Slot types (consumed by `<KitView/>`) -----------------------------------

export interface HeaderSlot {
  title: string;
  description?: string;
  status?: "running" | "queued" | "completed" | "failed" | "planned";
  /** Right-aligned actions; rendered as ReactNode so kits can compose. */
  actions?: ReactNode;
}

export interface KpiTile {
  id: string;
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat";
}

export interface HeroSlot {
  kind: "table" | "markdown" | "list" | "custom";
  /** Rendered directly when present; kits may also provide a `data` payload. */
  content: ReactNode;
}

export interface SecondarySlot {
  id: string;
  title?: string;
  content: ReactNode;
}

export interface ActivityFeedSlot {
  /** Stub in Phase 1.1; Phase 2+ wires `RunHistoryTimeline`. */
  content: ReactNode;
}

/**
 * The "View manifest ▾" sheet content. The header slot's button opens this;
 * the footer slot mounts the actual sheet body.
 */
export interface ManifestPaneSlot {
  appId: string;
  appName: string;
  manifestYaml?: string;
  /** Composition cards (profiles, blueprints, tables, schedules) + files list. */
  body: ReactNode;
}

export interface ViewModel {
  header: HeaderSlot;
  kpis?: KpiTile[];
  hero?: HeroSlot;
  secondary?: SecondarySlot[];
  activity?: ActivityFeedSlot;
  footer?: ManifestPaneSlot;
}

/**
 * The frozen kit contract. A kit is a pair of pure projection functions:
 *
 *   - `resolve` reads the manifest + column schemas and produces a kit-internal
 *     projection (no React, no fetching).
 *   - `buildModel` combines the projection with server-loaded `RuntimeState`
 *     to produce a `ViewModel` ready for `<KitView/>`.
 *
 * Kits never own React state and never fetch data themselves.
 */
export interface KitDefinition {
  id: KitId;
  resolve: (input: ResolveInput) => KitProjection;
  buildModel: (proj: KitProjection, runtime: RuntimeState) => ViewModel;
}
