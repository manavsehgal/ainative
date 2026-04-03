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
      createdAt: new Date(now - 14 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
    {
      id: crypto.randomUUID(),
      surface: "tasks",
      name: "Running & Failed",
      filters: JSON.stringify([
        { column: "status", operator: "in", value: ["running", "failed"] },
      ]),
      sorting: JSON.stringify([{ id: "updatedAt", desc: true }]),
      columns: null,
      density: "compact",
      isDefault: false,
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      surface: "documents",
      name: "Output Reports",
      filters: JSON.stringify([
        { column: "direction", operator: "eq", value: "output" },
      ]),
      sorting: JSON.stringify([{ id: "updatedAt", desc: true }]),
      columns: null,
      density: "comfortable",
      isDefault: false,
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      surface: "workflows",
      name: "Active Pipelines",
      filters: JSON.stringify([
        { column: "status", operator: "eq", value: "active" },
      ]),
      sorting: JSON.stringify([{ id: "updatedAt", desc: true }]),
      columns: null,
      density: "compact",
      isDefault: true,
      createdAt: new Date(now - 12 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    },
    {
      id: crypto.randomUUID(),
      surface: "schedules",
      name: "Heartbeat Monitors",
      filters: JSON.stringify([
        { column: "type", operator: "eq", value: "heartbeat" },
      ]),
      sorting: JSON.stringify([{ id: "lastFiredAt", desc: true }]),
      columns: null,
      density: "comfortable",
      isDefault: false,
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 1 * DAY),
    },
    {
      id: crypto.randomUUID(),
      surface: "notifications",
      name: "Pending Approvals",
      filters: JSON.stringify([
        { column: "type", operator: "eq", value: "permission_required" },
        { column: "response", operator: "is_empty" },
      ]),
      sorting: JSON.stringify([{ id: "createdAt", desc: true }]),
      columns: null,
      density: "comfortable",
      isDefault: false,
      createdAt: new Date(now - 8 * DAY),
      updatedAt: new Date(now - 2 * DAY),
    },
  ];
}
