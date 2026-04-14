import { describe, expect, it } from "vitest";
import { blocksToParagraphs, blocksToPlainText } from "./portableText";

describe("portableText helpers", () => {
  const blocks = [
    {
      children: [{ text: "  First" }, { text: " paragraph  " }]
    },
    {
      children: [{ text: " " }]
    },
    {
      children: [{ text: "Second" }, { text: " paragraph" }]
    }
  ];

  it("returns trimmed non-empty paragraphs", () => {
    expect(blocksToParagraphs(blocks)).toEqual(["Firstparagraph", "Secondparagraph"]);
  });

  it("joins paragraphs into plain text", () => {
    expect(blocksToPlainText(blocks)).toBe("Firstparagraph Secondparagraph");
  });
});
