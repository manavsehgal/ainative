import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PermissionResponseActions } from "@/components/notifications/permission-response-actions";

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

describe("permission response actions", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends the persisted permission pattern for always-allow approvals", async () => {
    const onResponded = vi.fn();

    render(
      <PermissionResponseActions
        taskId="task-1"
        notificationId="notif-1"
        toolName="Bash"
        toolInput={{ command: "npm run build" }}
        responded={false}
        response={null}
        onResponded={onResponded}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Always Allow" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/tasks/task-1/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: "notif-1",
          behavior: "allow",
          updatedInput: { command: "npm run build" },
          message: undefined,
          alwaysAllow: true,
          permissionPattern: "Bash(command:npm *)",
        }),
      });
      expect(onResponded).toHaveBeenCalled();
    });
  });

  it("renders the resolved state label when a response already exists", () => {
    render(
      <PermissionResponseActions
        taskId="task-1"
        notificationId="notif-1"
        toolName="Bash"
        toolInput={{ command: "npm run build" }}
        responded
        response={JSON.stringify({ behavior: "allow", alwaysAllow: true })}
      />
    );

    expect(screen.getByText("Always allowed")).toBeInTheDocument();
  });
});
