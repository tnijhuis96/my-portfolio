import { experimental_AstroContainer as AstroContainer } from "astro/container";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  articleSlugListQuery,
  topicSlugListQuery
} from "../src/lib/sanity/queries";

type FetchImpl = (query: string, params?: Record<string, string>) => unknown;

async function loadArticleRoute(fetchImpl: FetchImpl) {
  vi.resetModules();
  const fetchMock = vi.fn(fetchImpl);

  vi.doMock("../src/lib/sanity/client.ts", () => ({
    hasSanityConfig: true,
    sanityClient: { fetch: fetchMock }
  }));

  const module = await import("../src/pages/articles/[slug].astro");
  return { ...module, fetchMock };
}

async function loadTopicRoute(fetchImpl: FetchImpl) {
  vi.resetModules();
  const fetchMock = vi.fn(fetchImpl);

  vi.doMock("../src/lib/sanity/client.ts", () => ({
    hasSanityConfig: true,
    sanityClient: { fetch: fetchMock }
  }));

  const module = await import("../src/pages/topics/[slug].astro");
  return { ...module, fetchMock };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("dynamic publication routes", () => {
  it("builds article static paths from fetched slugs", async () => {
    const { getStaticPaths, fetchMock } = await loadArticleRoute(() => [{ slug: "ai-for-smes" }]);

    await expect(getStaticPaths()).resolves.toEqual([{ params: { slug: "ai-for-smes" } }]);
    expect(fetchMock).toHaveBeenCalledWith(articleSlugListQuery);
  });

  it("renders article detail content from the Sanity boundary", async () => {
    const { default: ArticlePage } = await loadArticleRoute(() => ({
      title: "AI for SMEs",
      summary: "A practical overview",
      body: [
        { children: [{ text: "Field note one." }] },
        { children: [{ text: "Field note two." }] }
      ],
      topics: [{ title: "AI Automation", slug: { current: "ai-automation" } }]
    }));
    const container = await AstroContainer.create();

    const html = await container.renderToString(ArticlePage as unknown as AstroComponentFactory, {
      params: { slug: "ai-for-smes" },
      request: new Request("https://example.com/articles/ai-for-smes/"),
      partial: false
    });

    expect(html).toContain("<title>AI for SMEs</title>");
    expect(html).toMatch(/<h1[^>]*>AI for SMEs<\/h1>/);
    expect(html).toContain("A practical overview");
    expect(html).toContain('href="/topics/ai-automation/"');
    expect(html).toContain("AI Automation");
    expect(html).toContain("Field note one.");
    expect(html).toContain("Field note two.");
  });

  it("builds topic static paths from fetched slugs", async () => {
    const { getStaticPaths, fetchMock } = await loadTopicRoute(() => [{ slug: "ai-automation" }]);

    await expect(getStaticPaths()).resolves.toEqual([{ params: { slug: "ai-automation" } }]);
    expect(fetchMock).toHaveBeenCalledWith(topicSlugListQuery);
  });

  it("renders topic detail content from the Sanity boundary", async () => {
    const { default: TopicPage } = await loadTopicRoute(() => ({
      title: "AI Automation",
      description: "Practical systems for smaller teams.",
      articles: [
        {
          _id: "article-1",
          title: "AI for SMEs",
          slug: { current: "ai-for-smes" },
          summary: "A practical overview",
          publishedAt: "2026-04-01T09:00:00.000Z",
          topics: [{ title: "AI Automation", slug: { current: "ai-automation" } }]
        }
      ]
    }));
    const container = await AstroContainer.create();

    const html = await container.renderToString(TopicPage as unknown as AstroComponentFactory, {
      params: { slug: "ai-automation" },
      request: new Request("https://example.com/topics/ai-automation/"),
      partial: false
    });

    expect(html).toContain("<title>AI Automation</title>");
    expect(html).toMatch(/<h1[^>]*>AI Automation<\/h1>/);
    expect(html).toContain("Practical systems for smaller teams.");
    expect(html).toContain('href="/articles/ai-for-smes/"');
    expect(html).toContain("AI for SMEs");
    expect(html).toContain("A practical overview");
  });
});
