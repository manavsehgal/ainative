import { describe, it, expect } from "vitest";
import {
  TASK_STATUSES,
  COLUMN_ORDER,
  VALID_TRANSITIONS,
  USER_DRAG_TRANSITIONS,
  isValidTransition,
  isValidDragTransition,
} from "@/lib/constants/task-status";
import type { TaskStatus } from "@/lib/constants/task-status";

describe("TASK_STATUSES", () => {
  it("contains all 6 statuses", () => {
    expect(TASK_STATUSES).toHaveLength(6);
    expect(TASK_STATUSES).toContain("planned");
    expect(TASK_STATUSES).toContain("queued");
    expect(TASK_STATUSES).toContain("running");
    expect(TASK_STATUSES).toContain("completed");
    expect(TASK_STATUSES).toContain("failed");
    expect(TASK_STATUSES).toContain("cancelled");
  });
});

describe("COLUMN_ORDER", () => {
  it("excludes cancelled from visible columns", () => {
    expect(COLUMN_ORDER).not.toContain("cancelled");
  });

  it("has 5 columns in display order", () => {
    expect(COLUMN_ORDER).toEqual(["planned", "queued", "running", "completed", "failed"]);
  });
});

describe("VALID_TRANSITIONS", () => {
  it("defines transitions for every status", () => {
    for (const status of TASK_STATUSES) {
      expect(VALID_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
    }
  });

  it("allows planned → queued and planned → cancelled", () => {
    expect(VALID_TRANSITIONS.planned).toContain("queued");
    expect(VALID_TRANSITIONS.planned).toContain("cancelled");
  });

  it("does not allow running → queued (no backward skip)", () => {
    expect(VALID_TRANSITIONS.running).not.toContain("queued");
  });

  it("allows failed → planned (retry path)", () => {
    expect(VALID_TRANSITIONS.failed).toContain("planned");
  });

  it("allows failed → queued (direct re-queue)", () => {
    expect(VALID_TRANSITIONS.failed).toContain("queued");
  });

  it("allows failed → running (resume path)", () => {
    expect(VALID_TRANSITIONS.failed).toContain("running");
  });

  it("allows cancelled → running (resume path)", () => {
    expect(VALID_TRANSITIONS.cancelled).toContain("running");
  });
});

describe("isValidTransition", () => {
  it("returns true for valid transitions", () => {
    expect(isValidTransition("planned", "queued")).toBe(true);
    expect(isValidTransition("queued", "running")).toBe(true);
    expect(isValidTransition("running", "completed")).toBe(true);
    expect(isValidTransition("running", "failed")).toBe(true);
  });

  it("returns true for resume transitions", () => {
    expect(isValidTransition("failed", "running")).toBe(true);
    expect(isValidTransition("cancelled", "running")).toBe(true);
  });

  it("returns false for invalid transitions", () => {
    expect(isValidTransition("planned", "completed")).toBe(false);
    expect(isValidTransition("completed", "running")).toBe(false);
    expect(isValidTransition("running", "queued")).toBe(false);
  });

  it("returns false for same-status transitions", () => {
    for (const status of TASK_STATUSES) {
      expect(isValidTransition(status, status)).toBe(false);
    }
  });
});

describe("isValidDragTransition", () => {
  it("allows planned ↔ queued drag", () => {
    expect(isValidDragTransition("planned", "queued")).toBe(true);
    expect(isValidDragTransition("queued", "planned")).toBe(true);
  });

  it("prevents dragging from running", () => {
    expect(USER_DRAG_TRANSITIONS.running).toEqual([]);
    for (const target of TASK_STATUSES) {
      expect(isValidDragTransition("running", target)).toBe(false);
    }
  });

  it("allows completed → planned (reset)", () => {
    expect(isValidDragTransition("completed", "planned")).toBe(true);
  });

  it("allows failed → planned (retry via drag)", () => {
    expect(isValidDragTransition("failed", "planned")).toBe(true);
  });

  it("prevents dragging to non-adjacent columns", () => {
    expect(isValidDragTransition("planned", "running")).toBe(false);
    expect(isValidDragTransition("planned", "completed")).toBe(false);
  });
});
