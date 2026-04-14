import { describe, expect, it } from "vitest";
import { mapArticle } from "./mapArticle";

describe("mapArticle", () => {
  it("maps Sanity article data into the site article model", () => {
    const result = mapArticle({
      _id: "article-1",
      title: "AI for SMEs",
      slug: { current: "ai-for-smes" },
      summary: "A practical overview",
      publishedAt: "2026-04-01T09:00:00.000Z",
      topics: [{ title: "AI Automation", slug: { current: "ai-automation" } }]
    });

    expect(result.slug).toBe("ai-for-smes");
    expect(result.topics[0].slug).toBe("ai-automation");
  });
});
