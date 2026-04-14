import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheetPath = fileURLToPath(new URL("../src/styles/global.css", import.meta.url));
const stylesheet = readFileSync(stylesheetPath, "utf8");

describe("reading shell styles", () => {
  it("scopes section headings to the reading shell container sections", () => {
    expect(stylesheet).toContain(".reading-shell section.container > h2");
    expect(stylesheet).not.toMatch(/\bsection h2\b/);
  });

  it("does not keep an unused medium radius token", () => {
    expect(stylesheet).not.toContain("--radius-md");
  });
});
