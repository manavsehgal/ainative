import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";

import { ProjectCreateDialog } from "@/components/projects/project-create-dialog";
import { ProjectEditDialog } from "@/components/projects/project-edit-dialog";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function ProjectEditHarness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Edit Alpha
      </button>
      <ProjectEditDialog
        project={{
          id: "project-1",
          name: "Alpha",
          description: "Current project",
          workingDirectory: "/tmp/alpha",
          status: "active",
        }}
        open={open}
        onOpenChange={setOpen}
        onUpdated={() => {}}
        restoreFocusElement={triggerRef.current}
      />
    </>
  );
}

describe("project dialog focus management", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns focus to the create trigger after a successful submit", async () => {
    render(<ProjectCreateDialog onCreated={() => {}} />);

    const trigger = screen.getByRole("button", { name: "New Project" });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Accessibility" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Project" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
      expect(trigger).toHaveFocus();
    });
  });

  it("returns focus to the opener after saving an edited project", async () => {
    render(<ProjectEditHarness />);

    const trigger = screen.getByRole("button", { name: "Edit Alpha" });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
      expect(trigger).toHaveFocus();
    });
  });
});
