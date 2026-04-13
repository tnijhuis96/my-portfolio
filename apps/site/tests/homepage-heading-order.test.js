import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pagePath = fileURLToPath(new URL("../src/pages/index.astro", import.meta.url));
const pageSource = readFileSync(pagePath, "utf8");

describe("homepage placeholder content", () => {
  it("places the h1 before the supporting paragraph", () => {
    const h1Index = pageSource.indexOf("<h1>");
    const paragraphIndex = pageSource.indexOf("<p>");

    expect(h1Index).toBeGreaterThan(-1);
    expect(paragraphIndex).toBeGreaterThan(-1);
    expect(h1Index).toBeLessThan(paragraphIndex);
  });
});
