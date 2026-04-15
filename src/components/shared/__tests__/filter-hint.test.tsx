import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { FilterHint } from "../filter-hint";

const KEY = "stagent.filter-hint.dismissed";

describe("FilterHint", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it("renders when input is empty and not dismissed", () => {
    render(<FilterHint inputValue="" storageKey={KEY} />);
    expect(screen.getByText(/#key:value/i)).toBeInTheDocument();
  });

  it("renders when input has no # character", () => {
    render(<FilterHint inputValue="some search" storageKey={KEY} />);
    expect(screen.getByText(/#key:value/i)).toBeInTheDocument();
  });

  it("hides when input contains #", () => {
    render(<FilterHint inputValue="#status:blocked" storageKey={KEY} />);
    expect(screen.queryByText(/#key:value/i)).toBeNull();
  });

  it("sets dismissal flag and hides when input parses a valid clause", async () => {
    render(<FilterHint inputValue="#type:pdf" storageKey={KEY} />);
    expect(localStorage.getItem(KEY)).toBe("1");
    await waitFor(() => {
      expect(screen.queryByText(/#key:value/i)).toBeNull();
    });
  });

  it("stays hidden on subsequent mounts once dismissed", () => {
    localStorage.setItem(KEY, "1");
    render(<FilterHint inputValue="" storageKey={KEY} />);
    expect(screen.queryByText(/#key:value/i)).toBeNull();
  });
});
