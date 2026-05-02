import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResearchSplitView } from "../research-split-view";

const sources = [
  { id: "src-1", values: { name: "Hacker News", url: "https://news.ycombinator.com" } },
  { id: "src-2", values: { name: "ArXiv", url: "https://arxiv.org" } },
  { id: "src-3", values: { name: "RSS feed", url: "https://example.com/rss" } },
];

const synthesis = "## Digest\n\nThree key points this week...";

const citations = [
  { docId: "d1", sourceRowId: "src-1", sourceLabel: "Hacker News" },
  { docId: "d1", sourceRowId: "src-2", sourceLabel: "ArXiv" },
];

describe("ResearchSplitView", () => {
  it("renders sources DataTable on the left", () => {
    render(
      <ResearchSplitView
        sources={sources}
        synthesis={synthesis}
        citations={citations}
      />
    );
    // Both source names appear in the table; use getAllByText since they also
    // appear in the citation chips rendered below synthesis.
    expect(screen.getAllByText(/hacker news/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/arxiv/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders synthesis markdown on the right", () => {
    render(
      <ResearchSplitView
        sources={sources}
        synthesis={synthesis}
        citations={citations}
      />
    );
    expect(screen.getByText(/digest/i)).toBeInTheDocument();
    expect(screen.getByText(/three key points/i)).toBeInTheDocument();
  });

  it("renders citation chips below the synthesis", () => {
    render(
      <ResearchSplitView
        sources={sources}
        synthesis={synthesis}
        citations={citations}
      />
    );
    const chips = screen.getAllByRole("button", { name: /hacker news|arxiv/i });
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });

  it("highlights matching source row when a citation chip is clicked", () => {
    render(
      <ResearchSplitView
        sources={sources}
        synthesis={synthesis}
        citations={citations}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /hacker news/i }));
    const row = document.querySelector('[data-row-id="src-1"]');
    expect(row?.getAttribute("data-highlighted")).toBe("true");
  });

  it("renders citation chips with data-stale='true' for deleted source rows", () => {
    const citationsWithStale = [
      ...citations,
      { docId: "d1", sourceRowId: "src-deleted", sourceLabel: "Removed" },
    ];
    render(
      <ResearchSplitView
        sources={sources}
        synthesis={synthesis}
        citations={citationsWithStale}
      />
    );
    const stale = document.querySelector('[data-stale="true"]');
    expect(stale).toBeTruthy();
  });

  it("renders empty-state when synthesis is null", () => {
    render(
      <ResearchSplitView
        sources={sources}
        synthesis={null}
        citations={[]}
      />
    );
    expect(screen.getByText(/no synthesis yet/i)).toBeInTheDocument();
  });
});
