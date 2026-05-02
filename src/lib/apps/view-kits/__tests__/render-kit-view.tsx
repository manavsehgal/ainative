import { render, type RenderResult } from "@testing-library/react";
import { KitView } from "@/components/apps/kit-view/kit-view";
import type { AppManifest } from "@/lib/apps/registry";
import type {
  ColumnSchemaRef,
  KitDefinition,
  RuntimeState,
  ViewModel,
} from "@/lib/apps/view-kits/types";

interface RenderKitViewArgs {
  kit: KitDefinition;
  manifest: AppManifest;
  columns?: ColumnSchemaRef[];
  runtime?: Partial<RuntimeState>;
  period?: "mtd" | "qtd" | "ytd";
  rowId?: string | null;
}

/**
 * Drive a kit's resolve + buildModel + <KitView> through React Testing
 * Library to assert end-to-end DOM markers. Caller passes a fake AppManifest
 * + partial runtime overrides; defaults fill the rest.
 */
export function renderKitView(args: RenderKitViewArgs): RenderResult & {
  model: ViewModel;
} {
  const proj = args.kit.resolve({
    manifest: args.manifest,
    columns: args.columns ?? [],
    period: args.period,
    rowId: args.rowId,
  });
  const baseRuntime: RuntimeState = {
    app: {
      id: args.manifest.id,
      name: args.manifest.name,
      description: args.manifest.description ?? null,
      manifest: args.manifest,
      files: [],
      // AppDetail extends AppSummary — fill non-critical fields with safe defaults
      rootDir: "/tmp",
      primitivesSummary: "",
      profileCount: 0,
      blueprintCount: (args.manifest.blueprints ?? []).length,
      tableCount: (args.manifest.tables ?? []).length,
      scheduleCount: (args.manifest.schedules ?? []).length,
      scheduleHuman: null,
      createdAt: 0,
    },
    recentTaskCount: 0,
    scheduleCadence: null,
    ...args.runtime,
  };
  const model = args.kit.buildModel(proj, baseRuntime);
  const result = render(<KitView model={model} />);
  return Object.assign(result, { model });
}
