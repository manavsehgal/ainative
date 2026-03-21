import { render, screen } from "@testing-library/react";
import { KanbanBoard, compareTasks } from "@/components/tasks/kanban-board";
import type { TaskItem } from "@/components/tasks/task-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const makeTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: "task-1",
  title: "Test task",
  description: "A test task",
  status: "planned",
  priority: 2,
  assignedAgent: null,
  agentProfile: null,
  projectId: "project-1",
  projectName: "Project A",
  workflowId: null,
  scheduleId: null,
  result: null,
  sessionId: null,
  resumeCount: 0,
  createdAt: new Date("2026-03-12T09:00:00Z").toISOString(),
  updatedAt: new Date("2026-03-12T09:00:00Z").toISOString(),
  ...overrides,
});

const defaultProjects = [
  { id: "project-1", name: "Project A" },
  { id: "project-2", name: "Project B" },
];

describe("kanban board rendering", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders tasks correctly with filter props from parent", () => {
    render(
      <KanbanBoard
        initialTasks={[makeTask()]}
        projects={defaultProjects}
        projectFilter="all"
        statusFilter="all"
        sortOrder="priority"
      />
    );

    // The task should be visible
    expect(screen.getByText("Test task")).toBeInTheDocument();
  });

  it("filters tasks by project when projectFilter is set", () => {
    render(
      <KanbanBoard
        initialTasks={[
          makeTask({ id: "t1", title: "Task in P1", projectId: "project-1" }),
          makeTask({ id: "t2", title: "Task in P2", projectId: "project-2" }),
        ]}
        projects={defaultProjects}
        projectFilter="project-1"
        statusFilter="all"
        sortOrder="priority"
      />
    );

    expect(screen.getByText("Task in P1")).toBeInTheDocument();
    expect(screen.queryByText("Task in P2")).not.toBeInTheDocument();
  });
});

describe("compareTasks", () => {
  const taskA = makeTask({ id: "a", title: "Alpha", priority: 0, createdAt: new Date("2026-03-10").toISOString() });
  const taskB = makeTask({ id: "b", title: "Bravo", priority: 2, createdAt: new Date("2026-03-12").toISOString() });

  it("sorts by priority ascending", () => {
    expect(compareTasks(taskA, taskB, "priority")).toBeLessThan(0);
    expect(compareTasks(taskB, taskA, "priority")).toBeGreaterThan(0);
  });

  it("sorts by created-desc (newer first)", () => {
    expect(compareTasks(taskB, taskA, "created-desc")).toBeLessThan(0);
    expect(compareTasks(taskA, taskB, "created-desc")).toBeGreaterThan(0);
  });

  it("sorts by created-asc (older first)", () => {
    expect(compareTasks(taskA, taskB, "created-asc")).toBeLessThan(0);
    expect(compareTasks(taskB, taskA, "created-asc")).toBeGreaterThan(0);
  });

  it("sorts by title-asc (alphabetical)", () => {
    expect(compareTasks(taskA, taskB, "title-asc")).toBeLessThan(0);
    expect(compareTasks(taskB, taskA, "title-asc")).toBeGreaterThan(0);
  });
});
