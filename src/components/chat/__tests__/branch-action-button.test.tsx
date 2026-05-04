import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BranchActionButton } from "../branch-action-button";

describe("BranchActionButton", () => {
  it("renders the branch action button", () => {
    render(
      <BranchActionButton
        parentConversationId="p1"
        branchedFromMessageId="m1"
        onBranch={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /branch from here/i })
    ).toBeInTheDocument();
  });

  it("opens the dialog with a default title and submits", async () => {
    const onBranch = vi.fn().mockResolvedValue("new-conv-id");
    render(
      <BranchActionButton
        parentConversationId="p1"
        branchedFromMessageId="m1"
        parentTitle="Original"
        onBranch={onBranch}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /branch from here/i })
    );
    const input = (await screen.findByLabelText(
      /branch title/i
    )) as HTMLInputElement;
    expect(input.value).toBe("Original — branch");

    fireEvent.click(screen.getByRole("button", { name: /create branch/i }));
    await waitFor(() => {
      expect(onBranch).toHaveBeenCalledWith({
        parentConversationId: "p1",
        branchedFromMessageId: "m1",
        title: "Original — branch",
      });
    });
  });

  it("uses the user-edited title on submit", async () => {
    const onBranch = vi.fn().mockResolvedValue("new-conv-id");
    render(
      <BranchActionButton
        parentConversationId="p1"
        branchedFromMessageId="m1"
        parentTitle="Original"
        onBranch={onBranch}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /branch from here/i })
    );
    const input = (await screen.findByLabelText(
      /branch title/i
    )) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "My alt path" } });
    fireEvent.click(screen.getByRole("button", { name: /create branch/i }));
    await waitFor(() => {
      expect(onBranch).toHaveBeenCalledWith({
        parentConversationId: "p1",
        branchedFromMessageId: "m1",
        title: "My alt path",
      });
    });
  });
});
