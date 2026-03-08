export const TASK_STATUSES = [
  "planned",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const COLUMN_ORDER: TaskStatus[] = [
  "planned",
  "queued",
  "running",
  "completed",
  "failed",
];

// Valid status transitions (system/agent can do these)
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  planned: ["queued", "cancelled"],
  queued: ["running", "planned", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: ["planned"],
  failed: ["planned", "queued", "running"],
  cancelled: ["planned", "running"],
};

// Transitions a user can trigger via drag-and-drop
export const USER_DRAG_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  planned: ["queued"],
  queued: ["planned"],
  running: [],
  completed: ["planned"],
  failed: ["planned"],
  cancelled: ["planned"],
};

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isValidDragTransition(from: TaskStatus, to: TaskStatus): boolean {
  return USER_DRAG_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Maximum number of times a task can be resumed before requiring a fresh start */
export const MAX_RESUME_COUNT = 3;
