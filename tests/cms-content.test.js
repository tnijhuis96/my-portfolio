import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPost,
  normalizePostInput,
  renderPostHtml,
  sanitizePostBody,
} from "../functions/_lib/content.js";
import { buildDeployHeaders, triggerDeploy } from "../functions/_lib/deploy.js";
import { normalizePostRecord } from "../functions/_lib/db.js";
import {
  onRequestGet as onRequestPostGet,
  onRequestPut as onRequestPostPut,
  onRequestDelete as onRequestPostDelete,
} from "../functions/api/admin/posts/[id].js";
import { onRequestPost as onRequestPostPublish } from "../functions/api/admin/posts/[id]/publish.js";
import {
  onRequestGet as onRequestPostsGet,
  onRequestPost as onRequestPostsCreate,
} from "../functions/api/admin/posts/index.js";
import { onRequestPost as onRequestRestoreRevision } from "../functions/api/admin/revisions/[id]/restore.js";

function createContentTestEnv() {
  const state = {
    posts: new Map(),
    revisions: new Map(),
    auditLog: [],
  };

  function findPostBySlug(slug) {
    for (const post of state.posts.values()) {
      if (post.slug === slug) {
        return post;
      }
    }

    return null;
  }

  function normalizeQuery(query) {
    return query.replace(/\s+/g, " ").trim();
  }

  function buildStatement(query, bindings = []) {
    const normalizedQuery = normalizeQuery(query);

    return {
      bind(...nextBindings) {
        return buildStatement(query, nextBindings);
      },
      async first() {
        if (normalizedQuery === "SELECT * FROM cms_posts WHERE id = ? AND deleted_at IS NULL") {
          const [id] = bindings;
          const post = state.posts.get(id) ?? null;
          return post?.deleted_at ? null : post;
        }

        if (normalizedQuery === "SELECT * FROM cms_post_revisions WHERE id = ?") {
          const [id] = bindings;
          return state.revisions.get(id) ?? null;
        }

        throw new Error(`Unsupported first() query: ${normalizedQuery}`);
      },
      async all() {
        if (normalizedQuery === "SELECT id, slug, title, summary, status, published_at, deleted_at, updated_at FROM cms_posts WHERE deleted_at IS NULL ORDER BY updated_at DESC") {
          return {
            results: [...state.posts.values()]
              .filter((post) => post.deleted_at === null)
              .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
              .map((post) => ({
                id: post.id,
                slug: post.slug,
                title: post.title,
                summary: post.summary,
                status: post.status,
                published_at: post.published_at,
                deleted_at: post.deleted_at,
                updated_at: post.updated_at,
              })),
          };
        }

        throw new Error(`Unsupported all() query: ${normalizedQuery}`);
      },
      async run() {
        if (normalizedQuery === "INSERT INTO cms_posts (id, slug, title, summary, body_markdown, sanitized_html, status, published_at, deleted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)") {
          const [id, slug, title, summary, bodyMarkdown, sanitizedHtml, status, publishedAt, deletedAt, updatedAt] = bindings;
          if (findPostBySlug(slug)) {
            throw new Error("UNIQUE constraint failed: cms_posts.slug");
          }

          state.posts.set(id, {
            id,
            slug,
            title,
            summary,
            body_markdown: bodyMarkdown,
            sanitized_html: sanitizedHtml,
            status,
            published_at: publishedAt,
            deleted_at: deletedAt,
            updated_at: updatedAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (
          normalizedQuery === "UPDATE cms_posts SET slug = ?, title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, updated_at = ? WHERE id = ?"
          || normalizedQuery === "UPDATE cms_posts SET slug = ?, title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
        ) {
          const [slug, title, summary, bodyMarkdown, sanitizedHtml, status, updatedAt, id] = bindings;
          const existing = state.posts.get(id);
          if (!existing || (normalizedQuery.endsWith("AND deleted_at IS NULL") && existing.deleted_at !== null)) {
            return { success: true, meta: { changes: 0 } };
          }

          const duplicateSlugPost = findPostBySlug(slug);
          if (duplicateSlugPost && duplicateSlugPost.id !== id) {
            throw new Error("UNIQUE constraint failed: cms_posts.slug");
          }

          state.posts.set(id, {
            ...existing,
            slug,
            title,
            summary,
            body_markdown: bodyMarkdown,
            sanitized_html: sanitizedHtml,
            status,
            updated_at: updatedAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (
          normalizedQuery === "UPDATE cms_posts SET deleted_at = ?, updated_at = ? WHERE id = ?"
          || normalizedQuery === "UPDATE cms_posts SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
        ) {
          const [deletedAt, updatedAt, id] = bindings;
          const existing = state.posts.get(id);
          if (!existing || (normalizedQuery.endsWith("AND deleted_at IS NULL") && existing.deleted_at !== null)) {
            return { success: true, meta: { changes: 0 } };
          }

          state.posts.set(id, {
            ...existing,
            deleted_at: deletedAt,
            updated_at: updatedAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (
          normalizedQuery === "UPDATE cms_posts SET title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, updated_at = ? WHERE id = ?"
          || normalizedQuery === "UPDATE cms_posts SET title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
        ) {
          const [title, summary, bodyMarkdown, sanitizedHtml, status, updatedAt, id] = bindings;
          const existing = state.posts.get(id);
          if (!existing || (normalizedQuery.endsWith("AND deleted_at IS NULL") && existing.deleted_at !== null)) {
            return { success: true, meta: { changes: 0 } };
          }

          state.posts.set(id, {
            ...existing,
            title,
            summary,
            body_markdown: bodyMarkdown,
            sanitized_html: sanitizedHtml,
            status,
            updated_at: updatedAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (
          normalizedQuery === "UPDATE cms_posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ?"
          || normalizedQuery === "UPDATE cms_posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
        ) {
          const [status, publishedAt, updatedAt, id] = bindings;
          const existing = state.posts.get(id);
          if (!existing || (normalizedQuery.endsWith("AND deleted_at IS NULL") && existing.deleted_at !== null)) {
            return { success: true, meta: { changes: 0 } };
          }

          state.posts.set(id, {
            ...existing,
            status,
            published_at: publishedAt,
            updated_at: updatedAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (
          normalizedQuery
          === "INSERT INTO cms_audit_log (id, actor_user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ) {
          const [id, actorUserId, action, targetType, targetId, metadataJson, createdAt] = bindings;
          state.auditLog.push({
            id,
            actor_user_id: actorUserId,
            action,
            target_type: targetType,
            target_id: targetId,
            metadata_json: metadataJson,
            created_at: createdAt,
          });
          return { success: true, meta: { changes: 1 } };
        }

        throw new Error(`Unsupported run() query: ${normalizedQuery}`);
      },
    };
  }

  return {
    env: {
      CMS_DB: {
        prepare(query) {
          return buildStatement(query);
        },
      },
    },
    state,
  };
}

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

test("renderPostHtml converts markdown into safe html", () => {
  const html = renderPostHtml("## Title\n\nParagraph <script>alert(1)</script>");
  assert.match(html, /<h2[^>]*>Title<\/h2>/);
  assert.match(html, /<p>Paragraph &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/p>/);
});

test("renderPostHtml neutralizes dangerous markdown links", () => {
  const html = renderPostHtml("[x](javascript:alert(1)) and [ok](https://example.com)");
  assert.doesNotMatch(html, /href="javascript:alert\(1\)"/);
  assert.match(html, /<a[^>]*href="https:\/\/example\.com"[^>]*>ok<\/a>/);
});

test("renderPostHtml neutralizes entity-obfuscated javascript links", () => {
  const html = renderPostHtml(
    "[x](j&#97;vascript:alert(1)) [y](javascript&#58;alert(1)) and [ok](#section)",
  );
  assert.doesNotMatch(html, /<a[^>]*>x<\/a>/);
  assert.doesNotMatch(html, /<a[^>]*>y<\/a>/);
  assert.doesNotMatch(html, /href="(?:j&#97;vascript:alert\(1\)|javascript&#58;alert\(1\))"/);
  assert.match(html, /<a[^>]*href="#section"[^>]*>ok<\/a>/);
});

test("renderPostHtml preserves markdown code escaping without double encoding", () => {
  const html = renderPostHtml("Use `<script>` safely.");
  assert.match(html, /<code>&lt;script&gt;<\/code>/);
  assert.doesNotMatch(html, /<code>&amp;lt;script&amp;gt;<\/code>/);
});

test("normalizePostInput trims slug/title/summary/status", () => {
  const result = normalizePostInput({
    slug: " hello-world ",
    title: " Hello ",
    summary: " Summary ",
    bodyMarkdown: "# Post",
    status: " draft ",
  });

  assert.equal(result.slug, "hello-world");
  assert.equal(result.title, "Hello");
  assert.equal(result.summary, "Summary");
  assert.equal(result.status, "draft");
});

test("createPost persists normalized markdown content", async () => {
  const { env, state } = createContentTestEnv();

  const post = await createPost(env, {
    slug: " hello-world ",
    title: " Hello ",
    summary: " Summary ",
    bodyMarkdown: "## Title\n\nParagraph <script>alert(1)</script>",
    status: " draft ",
  });

  assert.equal(post.slug, "hello-world");
  assert.match(post.id, /^[0-9a-f-]{36}$/);
  assert.match(post.updated_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(post.body_markdown, "## Title\n\nParagraph <script>alert(1)</script>");
  assert.match(post.sanitized_html, /<h2[^>]*>Title<\/h2>/);
  assert.match(post.sanitized_html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal("bodyMarkdown" in post, false);
  assert.equal(state.posts.size, 1);
});

test("createPost rejects blank required fields after normalization", async () => {
  const { env, state } = createContentTestEnv();

  await assert.rejects(
    () => createPost(env, {
      slug: "   ",
      title: " \n ",
      summary: "Summary",
      bodyMarkdown: "# Draft",
      status: "draft",
    }),
    (error) => {
      assert.equal(error.code, "required_field");
      assert.equal(error.status, 422);
      assert.deepEqual(error.fields, ["slug", "title"]);
      return true;
    },
  );

  assert.equal(state.posts.size, 0);
});

test("posts index routes create and list persisted posts", async () => {
  const { env, state } = createContentTestEnv();

  const createResponse = await onRequestPostsCreate({
    env,
    request: new Request("https://example.com/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: " hello-world ",
        title: " Hello ",
        summary: " Summary ",
        bodyMarkdown: "## Title\n\nParagraph",
        status: " draft ",
      }),
    }),
  });

  assert.equal(createResponse.status, 201);
  const createdBody = await createResponse.json();
  assert.equal(createdBody.ok, true);
  assert.equal(createdBody.post.slug, "hello-world");
  assert.equal(createdBody.post.body_markdown, "## Title\n\nParagraph");
  assert.equal("bodyMarkdown" in createdBody.post, false);
  assert.equal(state.posts.size, 1);

  state.posts.set("post_older", {
    id: "post_older",
    slug: "older-post",
    title: "Older",
    summary: "Older summary",
    body_markdown: "# Older",
    sanitized_html: "<h1>Older</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-01-01T00:00:00.000Z",
  });

  const listResponse = await onRequestPostGet({
    env,
    params: { id: createdBody.post.id },
  });
  assert.equal(listResponse.status, 200);

  const indexResponse = await onRequestPostsGet({ env });
  assert.equal(indexResponse.status, 200);
  assert.deepEqual(await indexResponse.json(), {
    posts: [
      {
        id: createdBody.post.id,
        slug: "hello-world",
        title: "Hello",
        summary: "Summary",
        status: "draft",
        published_at: null,
        deleted_at: null,
        updated_at: createdBody.post.updated_at,
      },
      {
        id: "post_older",
        slug: "older-post",
        title: "Older",
        summary: "Older summary",
        status: "draft",
        published_at: null,
        deleted_at: null,
        updated_at: "2025-01-01T00:00:00.000Z",
      },
    ],
  });
});

test("post routes read, update, delete, and restore revisions from D1 data", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "Summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });
  state.revisions.set("revision_1", {
    id: "revision_1",
    post_id: "post_1",
    title: "Restored title",
    summary: "Restored summary",
    body_markdown: "## Restored\n\n<script>alert(1)</script>",
    sanitized_html: "<script>unsafe</script>",
    status: "published",
    created_at: "2025-04-01T12:00:00.000Z",
  });

  const readResponse = await onRequestPostGet({
    env,
    params: { id: "post_1" },
  });
  assert.equal(readResponse.status, 200);
  assert.equal((await readResponse.json()).post.id, "post_1");

  const updateResponse = await onRequestPostPut({
    env,
    params: { id: "post_1" },
    request: new Request("https://example.com/api/admin/posts/post_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: " updated-post ",
        title: " Updated title ",
        summary: " Updated summary ",
        bodyMarkdown: "## Updated\n\nParagraph <script>alert(1)</script>",
        status: " published ",
      }),
    }),
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(await updateResponse.json(), { ok: true });
  assert.equal(state.posts.get("post_1").slug, "updated-post");
  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").sanitized_html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

  const deleteResponse = await onRequestPostDelete({
    env,
    params: { id: "post_1" },
  });
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(await deleteResponse.json(), { ok: true, deleted: true });
  assert.match(state.posts.get("post_1").deleted_at, /^\d{4}-\d{2}-\d{2}T/);

  state.posts.set("post_1", {
    ...state.posts.get("post_1"),
    deleted_at: null,
  });

  const restoreResponse = await onRequestRestoreRevision({
    env,
    params: { id: "revision_1" },
  });
  assert.equal(restoreResponse.status, 200);
  assert.deepEqual(await restoreResponse.json(), { ok: true, restored: true });
  assert.equal(state.posts.get("post_1").title, "Restored title");
  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").sanitized_html, /<h2[^>]*>Restored<\/h2>/);
  assert.match(state.posts.get("post_1").sanitized_html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(state.posts.get("post_1").sanitized_html, /<script>unsafe<\/script>/);

  const missingResponse = await onRequestRestoreRevision({
    env,
    params: { id: "missing" },
  });
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { ok: false, error: "not_found" });
});

test("restore revision returns not_found when the target post no longer exists", async () => {
  const { env, state } = createContentTestEnv();
  state.revisions.set("revision_missing_post", {
    id: "revision_missing_post",
    post_id: "post_missing",
    title: "Restored title",
    summary: "Restored summary",
    body_markdown: "## Restored",
    sanitized_html: "<h2>unsafe</h2>",
    status: "draft",
    created_at: "2025-04-01T12:00:00.000Z",
  });

  const response = await onRequestRestoreRevision({
    env,
    params: { id: "revision_missing_post" },
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: "not_found" });
  assert.equal(state.posts.size, 0);
});

test("restore revision returns not_found for soft-deleted target posts", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_deleted", {
    id: "post_deleted",
    slug: "deleted-post",
    title: "Deleted",
    summary: "Deleted summary",
    body_markdown: "# Deleted",
    sanitized_html: "<h1>Deleted</h1>",
    status: "draft",
    published_at: null,
    deleted_at: "2025-04-03T12:00:00.000Z",
    updated_at: "2025-04-03T12:00:00.000Z",
  });
  state.revisions.set("revision_deleted_post", {
    id: "revision_deleted_post",
    post_id: "post_deleted",
    title: "Restored title",
    summary: "Restored summary",
    body_markdown: "## Restored",
    sanitized_html: "<h2>unsafe</h2>",
    status: "published",
    created_at: "2025-04-01T12:00:00.000Z",
  });

  const response = await onRequestRestoreRevision({
    env,
    params: { id: "revision_deleted_post" },
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: "not_found" });
  assert.equal(state.posts.get("post_deleted").title, "Deleted");
});

test("post update and delete return not_found for missing or soft-deleted posts", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_deleted", {
    id: "post_deleted",
    slug: "deleted-post",
    title: "Deleted",
    summary: "Deleted summary",
    body_markdown: "# Deleted",
    sanitized_html: "<h1>Deleted</h1>",
    status: "draft",
    published_at: null,
    deleted_at: "2025-04-03T12:00:00.000Z",
    updated_at: "2025-04-03T12:00:00.000Z",
  });

  const missingUpdate = await onRequestPostPut({
    env,
    params: { id: "missing" },
    request: new Request("https://example.com/api/admin/posts/missing", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "missing",
        title: "Missing",
        summary: "Missing summary",
        bodyMarkdown: "# Missing",
        status: "draft",
      }),
    }),
  });
  assert.equal(missingUpdate.status, 404);
  assert.deepEqual(await missingUpdate.json(), { ok: false, error: "not_found" });

  const deletedUpdate = await onRequestPostPut({
    env,
    params: { id: "post_deleted" },
    request: new Request("https://example.com/api/admin/posts/post_deleted", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "should-not-change",
        title: "Should not change",
        summary: "Should not change",
        bodyMarkdown: "# Nope",
        status: "published",
      }),
    }),
  });
  assert.equal(deletedUpdate.status, 404);
  assert.deepEqual(await deletedUpdate.json(), { ok: false, error: "not_found" });
  assert.equal(state.posts.get("post_deleted").slug, "deleted-post");

  const missingDelete = await onRequestPostDelete({
    env,
    params: { id: "missing" },
  });
  assert.equal(missingDelete.status, 404);
  assert.deepEqual(await missingDelete.json(), { ok: false, error: "not_found" });

  const deletedDelete = await onRequestPostDelete({
    env,
    params: { id: "post_deleted" },
  });
  assert.equal(deletedDelete.status, 404);
  assert.deepEqual(await deletedDelete.json(), { ok: false, error: "not_found" });
});

test("post create returns invalid_json for malformed request bodies", async () => {
  const { env, state } = createContentTestEnv();

  const response = await onRequestPostsCreate({
    env,
    request: new Request("https://example.com/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_json" });
  assert.equal(state.posts.size, 0);
});

test("post create returns required_field for blank normalized slug", async () => {
  const { env, state } = createContentTestEnv();

  const response = await onRequestPostsCreate({
    env,
    request: new Request("https://example.com/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "   ",
        title: "Hello",
        summary: "Summary",
        bodyMarkdown: "# Hello",
        status: "draft",
      }),
    }),
  });

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "required_field",
    fields: ["slug"],
  });
  assert.equal(state.posts.size, 0);
});

test("post update returns invalid_json for malformed request bodies", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "Summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });

  const response = await onRequestPostPut({
    env,
    params: { id: "post_1" },
    request: new Request("https://example.com/api/admin/posts/post_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_json" });
  assert.equal(state.posts.get("post_1").title, "Hello world");
});

test("post update returns required_field for blank normalized title", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "Summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });

  const response = await onRequestPostPut({
    env,
    params: { id: "post_1" },
    request: new Request("https://example.com/api/admin/posts/post_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "updated-post",
        title: "   ",
        summary: "Updated summary",
        bodyMarkdown: "# Updated",
        status: "draft",
      }),
    }),
  });

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "required_field",
    fields: ["title"],
  });
  assert.equal(state.posts.get("post_1").slug, "hello-world");
  assert.equal(state.posts.get("post_1").title, "Hello world");
});

test("post create returns conflict for duplicate slugs", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_existing", {
    id: "post_existing",
    slug: "hello-world",
    title: "Existing",
    summary: "Existing summary",
    body_markdown: "# Existing",
    sanitized_html: "<h1>Existing</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });

  const response = await onRequestPostsCreate({
    env,
    request: new Request("https://example.com/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "hello-world",
        title: "Duplicate",
        summary: "Duplicate summary",
        bodyMarkdown: "# Duplicate",
        status: "draft",
      }),
    }),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: "duplicate_slug" });
  assert.equal(state.posts.size, 1);
});

test("post update returns conflict for duplicate slugs", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "Summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });
  state.posts.set("post_2", {
    id: "post_2",
    slug: "taken-slug",
    title: "Taken",
    summary: "Taken summary",
    body_markdown: "# Taken",
    sanitized_html: "<h1>Taken</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-03T12:00:00.000Z",
  });

  const response = await onRequestPostPut({
    env,
    params: { id: "post_1" },
    request: new Request("https://example.com/api/admin/posts/post_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "taken-slug",
        title: "Updated title",
        summary: "Updated summary",
        bodyMarkdown: "# Updated",
        status: "draft",
      }),
    }),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: "duplicate_slug" });
  assert.equal(state.posts.get("post_1").slug, "hello-world");
});

test("triggerDeploy posts the cms publish payload and returns success details", async () => {
  const requests = [];
  const response = await triggerDeploy(
    {
      PAGES_DEPLOY_HOOK_URL: "https://example.com/deploy",
      PAGES_DEPLOY_HOOK_SECRET: "  deploy-secret  ",
    },
    {
      async fetch(url, init) {
        requests.push({ url, init });
        return { ok: true, status: 202 };
      },
    },
  );

  assert.deepEqual(response, { ok: true, status: 202 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/deploy");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers["content-type"], "application/json");
  assert.equal(requests[0].init.headers["x-deploy-secret"], "deploy-secret");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    event: "cms-publish",
    timestamp: JSON.parse(requests[0].init.body).timestamp,
  });
  assert.match(JSON.parse(requests[0].init.body).timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("triggerDeploy returns failed status details when the deploy hook fails", async () => {
  const response = await triggerDeploy(
    {
      PAGES_DEPLOY_HOOK_URL: "https://example.com/deploy",
    },
    {
      async fetch() {
        return { ok: false, status: 500 };
      },
    },
  );

  assert.deepEqual(response, { ok: false, status: 500 });
});

test("post publish route publishes the post, records audit, and triggers deploy", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "Summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });

  env.PAGES_DEPLOY_HOOK_URL = "https://example.com/deploy";
  env.PAGES_DEPLOY_HOOK_SECRET = "hook-secret";

  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, status: 201 };
  };

  try {
    const postPublish = await onRequestPostPublish({
      env,
      params: { id: "post_1" },
    });

    assert.equal(postPublish.status, 200);
    assert.deepEqual(await postPublish.json(), {
      ok: true,
      publishState: "pending_deploy",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").published_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(state.posts.get("post_1").updated_at, state.posts.get("post_1").published_at);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "publish");
  assert.equal(state.auditLog[0].target_type, "post");
  assert.equal(state.auditLog[0].target_id, "post_1");
  assert.deepEqual(JSON.parse(state.auditLog[0].metadata_json), { stage: "attempted" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/deploy");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    event: "cms-publish",
    timestamp: JSON.parse(requests[0].init.body).timestamp,
  });
});

test("post publish route returns deploy_failed when the deploy hook call fails", async () => {
  const { env, state } = createContentTestEnv();
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "Summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });

  env.PAGES_DEPLOY_HOOK_URL = "https://example.com/deploy";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });

  try {
    const postPublish = await onRequestPostPublish({
      env,
      params: { id: "post_1" },
    });

    assert.equal(postPublish.status, 502);
    assert.deepEqual(await postPublish.json(), {
      ok: false,
      publishState: "deploy_failed",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").published_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "publish");
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

test("buildDeployHeaders returns content type and optional deploy secret", () => {
  const headers = buildDeployHeaders({ PAGES_DEPLOY_HOOK_SECRET: "secret" });
  assert.equal(headers["content-type"], "application/json");
  assert.equal(headers["x-deploy-secret"], "secret");

  const headersWithoutSecret = buildDeployHeaders({});
  assert.equal(headersWithoutSecret["content-type"], "application/json");
  assert.equal("x-deploy-secret" in headersWithoutSecret, false);
});

test("buildDeployHeaders tolerates missing env and falls back to legacy secret", () => {
  const headersWithoutEnv = buildDeployHeaders();
  assert.equal(headersWithoutEnv["content-type"], "application/json");
  assert.equal("x-deploy-secret" in headersWithoutEnv, false);

  const headersWithBlankPrimarySecret = buildDeployHeaders({
    PAGES_DEPLOY_HOOK_SECRET: "",
    DEPLOY_WEBHOOK_SECRET: "legacy-secret",
  });
  assert.equal(
    headersWithBlankPrimarySecret["x-deploy-secret"],
    "legacy-secret",
  );

  const headersWithLegacySecret = buildDeployHeaders({
    DEPLOY_WEBHOOK_SECRET: "legacy-secret",
  });
  assert.equal(headersWithLegacySecret["content-type"], "application/json");
  assert.equal(headersWithLegacySecret["x-deploy-secret"], "legacy-secret");

  const headersWithTrimmedSecret = buildDeployHeaders({
    PAGES_DEPLOY_HOOK_SECRET: "  secret  ",
  });
  assert.equal(headersWithTrimmedSecret["x-deploy-secret"], "secret");
});
