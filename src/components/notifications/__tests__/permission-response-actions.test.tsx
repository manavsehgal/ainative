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

  it("renders option cards for AskUserQuestion with options and posts { answer } on click", async () => {
    const onResponded = vi.fn();
    render(
      <PermissionResponseActions
        taskId="task-42"
        notificationId="notif-q1"
        toolName="AskUserQuestion"
        toolInput={{
          question: "Which version?",
          options: [
            { label: "Keep my version", description: "Use your changes" },
            { label: "Take main's version", description: "Use main's changes" },
          ],
        }}
        responded={false}
        response={null}
        onResponded={onResponded}
      />
    );

    const group = screen.getByRole("radiogroup");
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getByText("Take main's version"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/tasks/task-42/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: "notif-q1",
          behavior: "allow",
          updatedInput: { answer: "Take main's version" },
        }),
      });
      expect(onResponded).toHaveBeenCalled();
    });
  });

  it("renders a textarea for AskUserQuestion without options and posts the typed answer", async () => {
    const onResponded = vi.fn();
    render(
      <PermissionResponseActions
        taskId="task-42"
        notificationId="notif-q2"
        toolName="AskUserQuestion"
        toolInput={{ question: "Move commits to local or abort?" }}
        responded={false}
        response={null}
        onResponded={onResponded}
      />
    );

    const textarea = screen.getByPlaceholderText("Type your reply…");
    fireEvent.change(textarea, { target: { value: "move them to local" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/tasks/task-42/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: "notif-q2",
          behavior: "allow",
          updatedInput: { answer: "move them to local" },
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
