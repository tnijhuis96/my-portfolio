import test from "node:test";
import assert from "node:assert/strict";
import { normalizePostRecord } from "../functions/_lib/db.js";

test("normalizePostRecord maps D1 rows into CMS post objects", () => {
  const result = normalizePostRecord({
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    status: "draft",
  });

  assert.equal(result.slug, "hello-world");
  assert.equal(result.status, "draft");
});
