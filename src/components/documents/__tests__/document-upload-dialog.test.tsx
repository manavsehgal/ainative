import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";

import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function DocumentUploadHarness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Upload documents
      </button>
      <DocumentUploadDialog
        open={open}
        onClose={() => setOpen(false)}
        onUploaded={() => {}}
        restoreFocusElement={triggerRef.current}
      />
    </>
  );
}

describe("document upload dialog accessibility", () => {
  it("returns focus to the opener when the dialog closes", async () => {
    render(<DocumentUploadHarness />);

    const trigger = screen.getByRole("button", { name: "Upload documents" });
    fireEvent.click(trigger);

    const doneButton = await screen.findByRole("button", { name: "Done" });
    fireEvent.click(doneButton);

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
