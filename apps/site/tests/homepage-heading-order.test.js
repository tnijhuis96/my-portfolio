import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pagePath = fileURLToPath(new URL("../src/pages/index.astro", import.meta.url));
const pageSource = readFileSync(pagePath, "utf8");
const heroPath = fileURLToPath(new URL("../src/components/home/Hero.astro", import.meta.url));
const heroSource = readFileSync(heroPath, "utf8");

describe("homepage hero content", () => {
  it("keeps the hero heading before the supporting paragraph", () => {
    const h1Index = heroSource.indexOf("<h1>");
    const paragraphIndex = heroSource.indexOf("<p>{intro}</p>");

    expect(pageSource).toContain('import Hero from "../components/home/Hero.astro"');
    expect(h1Index).toBeGreaterThan(-1);
    expect(paragraphIndex).toBeGreaterThan(-1);
    expect(h1Index).toBeLessThan(paragraphIndex);
  });
});
