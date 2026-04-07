import { describe, it, expect } from "vitest";
import { paragraphSeparator, inlineScreenshotMarkdown } from "../engine";

describe("paragraphSeparator", () => {
  it("returns empty string when fullText is empty", () => {
    expect(paragraphSeparator("")).toBe("");
  });

  it("returns two newlines between adjacent text blocks ending without a newline", () => {
    expect(paragraphSeparator("review the app.")).toBe("\n\n");
  });

  it("returns empty string when fullText already ends with a newline", () => {
    expect(paragraphSeparator("first paragraph.\n")).toBe("");
    expect(paragraphSeparator("first paragraph.\n\n")).toBe("");
  });
});

describe("inlineScreenshotMarkdown", () => {
  it("emits markdown image with leading paragraph break when prose precedes it", () => {
    const md = inlineScreenshotMarkdown(
      "Let me take a screenshot of the dashboard.",
      "/screenshots/thumb-1.png"
    );
    expect(md).toBe("\n\n![screenshot](/screenshots/thumb-1.png)\n\n");
  });

  it("omits the leading break when fullText is empty", () => {
    const md = inlineScreenshotMarkdown("", "/screenshots/thumb-1.png");
    expect(md).toBe("![screenshot](/screenshots/thumb-1.png)\n\n");
  });

  it("omits the leading break when fullText already ends with a newline", () => {
    const md = inlineScreenshotMarkdown(
      "intro paragraph.\n\n",
      "/screenshots/thumb-2.png"
    );
    expect(md).toBe("![screenshot](/screenshots/thumb-2.png)\n\n");
  });

  it("simulates a streaming sequence: text → screenshot → text stays well-separated", () => {
    let fullText = "";
    // first text block
    fullText += "Now let me take a screenshot of the dashboard.";
    // screenshot capture
    const inline = inlineScreenshotMarkdown(fullText, "/screenshots/thumb-1.png");
    fullText += inline;
    // next text block (after a tool_use turn break) — engine would inject a
    // paragraph separator on content_block_start before appending.
    fullText += paragraphSeparator(fullText);
    fullText += "Good, I can see the dashboard.";

    expect(fullText).toBe(
      "Now let me take a screenshot of the dashboard.\n\n![screenshot](/screenshots/thumb-1.png)\n\nGood, I can see the dashboard."
    );
  });
});
