import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizePostBody } from "../functions/_lib/content.js";
import { normalizePostRecord } from "../functions/_lib/db.js";

test("normalizePostRecord maps D1 rows into CMS post objects", () => {
  const result = normalizePostRecord({
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "A short summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "draft",
    published_at: "2025-04-01T12:00:00.000Z",
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });

  assert.deepEqual(result, {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "A short summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "draft",
    published_at: "2025-04-01T12:00:00.000Z",
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });
});

test("normalizePostRecord returns null for missing rows", () => {
  assert.equal(normalizePostRecord(null), null);
});

test("sanitizePostBody strips raw script tags", () => {
  const result = sanitizePostBody("hello <script>alert(1)</script>");
  assert.equal(result.includes("<script>"), false);
});

test("cms_rate_limits migration enforces unique bucket and key pairs", () => {
  const migration = readFileSync(
    new URL("../migrations/0002_cms_rate_limits.sql", import.meta.url),
    "utf8",
  );

  assert.match(
    migration,
    /CREATE UNIQUE INDEX cms_rate_limits_bucket_key_idx\s+ON cms_rate_limits\(bucket, key\);/,
  );
});
