export interface ViewSeed {
  id: string;
  surface: string;
  name: string;
  filters: string | null;
  sorting: string | null;
  columns: string | null;
  density: "compact" | "comfortable" | "spacious";
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function createViews(): ViewSeed[] {
  const now = Date.now();
  const DAY = 86_400_000;

  return [
    {
      id: crypto.randomUUID(),
      surface: "tasks",
      name: "High Priority",
      filters: JSON.stringify([
        { column: "priority", operator: "lte", value: 1 },
      ]),
      sorting: JSON.stringify([{ id: "priority", desc: false }]),
      columns: null,
      density: "comfortable",
      isDefault: false,
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      surface: "documents",
      name: "Ready Documents",
      filters: JSON.stringify([
        { column: "status", operator: "eq", value: "ready" },
      ]),
      sorting: JSON.stringify([{ id: "updatedAt", desc: true }]),
      columns: null,
      density: "comfortable",
      isDefault: false,
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      surface: "workflows",
      name: "All Workflows",
      filters: null,
      sorting: JSON.stringify([{ id: "updatedAt", desc: true }]),
      columns: null,
      density: "compact",
      isDefault: true,
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
  ];
}
