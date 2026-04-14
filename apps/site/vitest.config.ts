/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["tests/**/*.test.{js,ts}", "src/**/*.test.{js,ts}"]
  }
}, {
  configFile: false,
  site: "https://example.com",
  output: "static"
});
