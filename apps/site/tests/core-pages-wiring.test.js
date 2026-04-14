import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../src/", import.meta.url));
const queryPath = `${srcDir}lib/sanity/queries.ts`;
const querySource = readFileSync(queryPath, "utf8");

function pageSource(relativePath) {
  const fullPath = `${srcDir}pages/${relativePath}`;
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

describe("core publication page wiring", () => {
  it("exports the Sanity queries needed for the new pages", () => {
    expect(querySource).toContain("export const homeQuery");
    expect(querySource).toContain("export const articleDetailQuery");
    expect(querySource).toContain("export const topicListQuery");
    expect(querySource).toContain("export const topicDetailQuery");
    expect(querySource).toContain("export const nowPageQuery");
    expect(querySource).toContain("export const aboutPageQuery");
  });

  it("adds the archive and singleton page routes", () => {
    expect(existsSync(`${srcDir}pages/articles/index.astro`)).toBe(true);
    expect(existsSync(`${srcDir}pages/topics/index.astro`)).toBe(true);
    expect(existsSync(`${srcDir}pages/now.astro`)).toBe(true);
    expect(existsSync(`${srcDir}pages/about.astro`)).toBe(true);
  });

  it("adds dynamic article and topic routes with static path generation", () => {
    const articleSource = pageSource("articles/[slug].astro");
    const topicSource = pageSource("topics/[slug].astro");

    expect(articleSource).toContain("export async function getStaticPaths()");
    expect(articleSource).toContain("Astro.params");
    expect(topicSource).toContain("export async function getStaticPaths()");
    expect(topicSource).toContain("Astro.params");
  });

  it("rewires the homepage to the Sanity-backed home components", () => {
    const source = pageSource("index.astro");

    expect(source).toContain('import Hero from "../components/home/Hero.astro"');
    expect(source).toContain('import CurrentFocus from "../components/home/CurrentFocus.astro"');
    expect(source).toContain('import FeaturedArticle from "../components/home/FeaturedArticle.astro"');
    expect(source).toContain('import TopicGrid from "../components/home/TopicGrid.astro"');
    expect(source).toContain('import ArticleList from "../components/articles/ArticleList.astro"');
    expect(source).toContain("sanityClient.fetch<HomeData>(homeQuery)");
  });
});
