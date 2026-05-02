import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThroughputStrip, hasSentimentColumn } from "../throughput-strip";

describe("hasSentimentColumn", () => {
  it("returns true when manifest has a column named sentiment", () => {
    expect(
      hasSentimentColumn([
        { tableId: "queue", columns: [{ name: "sentiment" }, { name: "channel" }] },
      ])
    ).toBe(true);
  });

  it("returns true when a column has semantic 'sentiment'", () => {
    expect(
      hasSentimentColumn([
        { tableId: "queue", columns: [{ name: "score", semantic: "sentiment" }] },
      ])
    ).toBe(true);
  });

  it("returns false when no column matches", () => {
    expect(
      hasSentimentColumn([
        { tableId: "queue", columns: [{ name: "channel" }, { name: "summary" }] },
      ])
    ).toBe(false);
  });
});

describe("ThroughputStrip", () => {
  it("renders the drafts/day MiniBar", () => {
    render(<ThroughputStrip dailyDrafts={[1, 2, 3, 0, 5, 1, 2]} />);
    expect(screen.getByTestId("throughput-mini-bar")).toBeInTheDocument();
  });

  it("renders the sentiment DonutRing only when sentimentBuckets is present", () => {
    render(
      <ThroughputStrip
        dailyDrafts={[1, 2]}
        sentimentBuckets={{ positive: 5, neutral: 3, negative: 1 }}
      />
    );
    expect(screen.getByTestId("throughput-sentiment-ring")).toBeInTheDocument();
  });

  it("does NOT render the sentiment DonutRing when sentimentBuckets is absent", () => {
    render(<ThroughputStrip dailyDrafts={[1]} />);
    expect(screen.queryByTestId("throughput-sentiment-ring")).not.toBeInTheDocument();
  });
});
