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

describe("kanban board persistence", () => {
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

  it("resets stale project filter to 'all'", () => {
    // Pre-set a project ID that doesn't exist in the projects list
    localStorage.setItem("stagent-project-filter", "deleted-project-999");

    render(
      <KanbanBoard
        initialTasks={[makeTask()]}
        projects={defaultProjects}
      />
    );

    // The task should be visible (not filtered out by a stale project ID)
    expect(screen.getByText("Test task")).toBeInTheDocument();
  });

  it("includes ?project= in New Task link when project is filtered", () => {
    localStorage.setItem("stagent-project-filter", "project-1");

    render(
      <KanbanBoard
        initialTasks={[makeTask()]}
        projects={defaultProjects}
      />
    );

    const newTaskLink = screen.getByRole("link", { name: /new task/i });
    expect(newTaskLink).toHaveAttribute("href", "/tasks/new?project=project-1");
  });

  it("has plain /tasks/new link when filter is 'all'", () => {
    render(
      <KanbanBoard
        initialTasks={[makeTask()]}
        projects={defaultProjects}
      />
    );

    const newTaskLink = screen.getByRole("link", { name: /new task/i });
    expect(newTaskLink).toHaveAttribute("href", "/tasks/new");
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
