import { render, screen } from "@testing-library/react";

import { KanbanBoard } from "@/components/tasks/kanban-board";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe("kanban board accessibility", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("exposes a polite live region describing board updates", () => {
    render(
      <KanbanBoard
        initialTasks={[
          {
            id: "task-1",
            title: "Finish accessibility",
            description: "Wrap up the remaining accessibility fixes",
            status: "planned",
            priority: 2,
            assignedAgent: null,
            agentProfile: null,
            projectId: "project-1",
            projectName: "Stagent",
            result: null,
            sessionId: null,
            resumeCount: 0,
            createdAt: new Date("2026-03-12T09:00:00.000Z").toISOString(),
            updatedAt: new Date("2026-03-12T09:00:00.000Z").toISOString(),
          },
        ]}
        projects={[{ id: "project-1", name: "Stagent" }]}
      />
    );

    const announcement = screen.getByText("Showing 1 task on the kanban board.");
    const board = screen.getByRole("region", { name: "Kanban board" });

    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(announcement).toHaveAttribute("aria-atomic", "true");
    expect(board).toHaveAttribute("aria-describedby", announcement.id);
  });
});
