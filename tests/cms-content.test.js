import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizePostInput,
  sanitizePostBody,
} from "../functions/_lib/content.js";
import { buildDeployHeaders } from "../functions/_lib/deploy.js";
import { normalizePostRecord } from "../functions/_lib/db.js";
import {
  onRequestGet as onRequestPostGet,
  onRequestPut as onRequestPostPut,
  onRequestDelete as onRequestPostDelete,
} from "../functions/api/admin/posts/[id].js";
import { onRequestPost as onRequestPostsCreate } from "../functions/api/admin/posts/index.js";
import { onRequestPost as onRequestRestoreRevision } from "../functions/api/admin/revisions/[id]/restore.js";

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
  assert.equal(result, "hello &lt;script&gt;alert(1)&lt;/script&gt;");
});

test("sanitizePostBody escapes raw HTML attributes", () => {
  const result = sanitizePostBody('<img src=x onerror="alert(1)">');
  assert.equal(
    result,
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
});

test("normalizePostInput handles missing input and trims status", () => {
  assert.deepEqual(normalizePostInput(), {
    slug: "",
    title: "",
    summary: "",
    bodyMarkdown: "",
    status: "draft",
  });

  assert.deepEqual(
    normalizePostInput({
      slug: " hello-world ",
      title: " Title ",
      summary: " Summary ",
      bodyMarkdown: " Body stays raw ",
      status: " published ",
    }),
    {
      slug: "hello-world",
      title: "Title",
      summary: "Summary",
      bodyMarkdown: " Body stays raw ",
      status: "published",
    },
  );
});

test("placeholder mutation routes return not implemented responses", async () => {
  const postCreate = await onRequestPostsCreate();
  assert.equal(postCreate.status, 501);
  assert.deepEqual(await postCreate.json(), {
    ok: false,
    error: "not_implemented",
    message: "Post creation is not implemented in Task 5.",
  });

  const postUpdate = await onRequestPostPut();
  assert.equal(postUpdate.status, 501);
  assert.deepEqual(await postUpdate.json(), {
    ok: false,
    error: "not_implemented",
    message: "Post updates are not implemented in Task 5.",
  });

  const postDelete = await onRequestPostDelete();
  assert.equal(postDelete.status, 501);
  assert.deepEqual(await postDelete.json(), {
    ok: false,
    error: "not_implemented",
    message: "Post deletion is not implemented in Task 5.",
  });

  const revisionRestore = await onRequestRestoreRevision();
  assert.equal(revisionRestore.status, 501);
  assert.deepEqual(await revisionRestore.json(), {
    ok: false,
    error: "not_implemented",
    message: "Revision restore is not implemented in Task 5.",
  });
});

test("placeholder read routes remain successful", async () => {
  const postRead = await onRequestPostGet();
  assert.equal(postRead.status, 200);
  assert.deepEqual(await postRead.json(), { post: null });
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

test("buildDeployHeaders keeps deploy secret server-side", () => {
  const headers = buildDeployHeaders({ PAGES_DEPLOY_HOOK_SECRET: "secret" });
  assert.equal(headers["x-deploy-secret"], "secret");
});
