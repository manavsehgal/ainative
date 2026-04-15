import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SavedSearchesManager } from "../saved-searches-manager";
import type { SavedSearch } from "@/hooks/use-saved-searches";

const search = (over: Partial<SavedSearch> = {}): SavedSearch => ({
  id: "s1",
  surface: "task",
  label: "Blocked tasks",
  filterInput: "#status:blocked",
  createdAt: "2026-04-14T00:00:00.000Z",
  ...over,
});

describe("SavedSearchesManager", () => {
  it("lists all saved searches", () => {
    const items = [
      search({ id: "s1", label: "Blocked tasks" }),
      search({ id: "s2", label: "Pdf docs", surface: "document", filterInput: "#type:pdf" }),
    ];
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={items}
        onRename={() => {}}
        onRemove={() => {}}
      />
    );
    expect(screen.getByText("Blocked tasks")).toBeInTheDocument();
    expect(screen.getByText("Pdf docs")).toBeInTheDocument();
  });

  it("renames on blur with non-empty trimmed label", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename blocked tasks/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "  Renamed  " } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith("s1", "Renamed");
  });

  it("rejects empty label with inline error", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename blocked tasks/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
  });

  it("rejects duplicate label within same surface (case-insensitive)", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[
          search({ id: "s1", label: "Blocked tasks" }),
          search({ id: "s2", label: "Another" }),
        ]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename another/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "blocked TASKS" } });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it("rejects label longer than 120 chars", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename blocked tasks/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "x".repeat(121) } });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/too long/i)).toBeInTheDocument();
  });

  it("Escape cancels rename without persisting", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename blocked tasks/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: /rename/i })).toBeNull();
  });

  it("delete requires explicit confirm", () => {
    const onRemove = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={() => {}}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete blocked tasks/i }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));
    expect(onRemove).toHaveBeenCalledWith("s1");
  });
});
