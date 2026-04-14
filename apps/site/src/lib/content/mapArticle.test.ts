import { describe, expect, expectTypeOf, it } from "vitest";
import { mapArticle } from "./mapArticle";
import type { SiteArticle } from "./types";

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
    expectTypeOf(result).toEqualTypeOf<SiteArticle>();
  });

  it("falls back optional article fields to content contract defaults", () => {
    const result = mapArticle({
      _id: "article-2",
      title: "Signals Over Noise",
      slug: { current: "signals-over-noise" },
      summary: "Notes from the field"
    });

    expect(result.publishedAt).toBeNull();
    expect(result.topics).toEqual([]);
  });
});
