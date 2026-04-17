const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

test("CMS ESM files are scoped with nested package metadata", () => {
  assert.deepEqual(readJson("functions/package.json"), { type: "module" });
  assert.deepEqual(readJson("tests/package.json"), { type: "module" });
});
