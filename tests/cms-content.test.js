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

function createContentTestEnv(options = {}) {
  const state = {
    posts: new Map(),
    revisions: new Map(),
    auditLog: [],
    sessions: new Map(),
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

        if (normalizedQuery === "SELECT id, user_id, csrf_token, expires_at FROM cms_sessions WHERE id = ?") {
          const [id] = bindings;
          return state.sessions.get(id) ?? null;
        }

        throw new Error(`Unsupported first() query: ${normalizedQuery}`);
      },
      async all() {
        if (normalizedQuery === "SELECT id, status, created_at, title, summary FROM cms_post_revisions WHERE post_id = ? ORDER BY created_at DESC") {
          const [postId] = bindings;
          return {
            results: [...state.revisions.values()]
              .filter((revision) => revision.post_id === postId)
              .sort((left, right) => right.created_at.localeCompare(left.created_at))
              .map((revision) => ({
                id: revision.id,
                status: revision.status,
                created_at: revision.created_at,
                title: revision.title,
                summary: revision.summary,
              })),
          };
        }

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
        if (typeof options.onRun === "function") {
          await options.onRun({ normalizedQuery, bindings, state });
        }

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
          normalizedQuery === "UPDATE cms_posts SET title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, published_at = ?, updated_at = ? WHERE id = ?"
          || normalizedQuery === "UPDATE cms_posts SET title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
        ) {
          const [title, summary, bodyMarkdown, sanitizedHtml, status, publishedAt, updatedAt, id] = bindings;
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
            published_at: publishedAt,
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

          if (status === "published" && options.publishUpdateChanges === 0) {
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

        if (
          normalizedQuery
          === "INSERT INTO cms_post_revisions (id, post_id, title, summary, body_markdown, sanitized_html, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ) {
          const [id, postId, title, summary, bodyMarkdown, sanitizedHtml, status, createdAt] = bindings;
          state.revisions.set(id, {
            id,
            post_id: postId,
            title,
            summary,
            body_markdown: bodyMarkdown,
            sanitized_html: sanitizedHtml,
            status,
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

const CMS_TEST_SESSION_ID = "session_123";
const CMS_TEST_CSRF_TOKEN = "csrf_123";

function seedCmsSession(state, overrides = {}) {
  const session = {
    id: CMS_TEST_SESSION_ID,
    user_id: "admin@example.com",
    csrf_token: CMS_TEST_CSRF_TOKEN,
    expires_at: "2999-01-01T08:00:00.000Z",
    ...overrides,
  };
  state.sessions.set(session.id, session);
  return session;
}

function withCmsSession(context, options = {}) {
  const method = options.method ?? context.method ?? context.request?.method ?? "GET";
  const csrfRequired = options.csrf ?? !["GET", "HEAD"].includes(String(method).toUpperCase());
  const headers = new Headers(context.request?.headers ?? {});
  headers.set("cookie", `cms_session=${options.sessionId ?? CMS_TEST_SESSION_ID}`);
  if (csrfRequired) {
    headers.set("x-csrf-token", options.csrfToken ?? CMS_TEST_CSRF_TOKEN);
  }

  return {
    ...context,
    request: context.request
      ? new Request(context.request, { headers })
      : new Request(options.url ?? context.url ?? "https://example.com/api/admin/test", { method, headers }),
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

test("admin content routes reject unauthenticated requests and invalid csrf tokens", async () => {
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
    title: "Revision title",
    summary: "Revision summary",
    body_markdown: "# Revision",
    sanitized_html: "<h1>Revision</h1>",
    status: "draft",
    created_at: "2025-04-01T12:00:00.000Z",
  });

  const unauthenticatedResponses = await Promise.all([
    onRequestPostsGet({ env, request: new Request("https://example.com/api/admin/posts") }),
    onRequestPostGet({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1"),
    }),
    onRequestPostsCreate({
      env,
      request: new Request("https://example.com/api/admin/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "new-post",
          title: "New post",
          summary: "Summary",
          bodyMarkdown: "# Post",
          status: "draft",
        }),
      }),
    }),
    onRequestPostPut({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "hello-world",
          title: "Updated",
          summary: "Summary",
          bodyMarkdown: "# Updated",
          status: "draft",
        }),
      }),
    }),
    onRequestPostDelete({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1", { method: "DELETE" }),
    }),
    onRequestPostPublish({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", { method: "POST" }),
    }),
    onRequestRestoreRevision({
      env,
      params: { id: "revision_1" },
      request: new Request("https://example.com/api/admin/revisions/revision_1/restore", { method: "POST" }),
    }),
  ]);

  for (const response of unauthenticatedResponses) {
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, error: "unauthenticated" });
  }

  seedCmsSession(state);

  const invalidCsrfResponses = await Promise.all([
    onRequestPostsCreate(withCmsSession({
      env,
      request: new Request("https://example.com/api/admin/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "new-post",
          title: "New post",
          summary: "Summary",
          bodyMarkdown: "# Post",
          status: "draft",
        }),
      }),
    }, { csrfToken: "wrong-token" })),
    onRequestPostPut(withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "hello-world",
          title: "Updated",
          summary: "Summary",
          bodyMarkdown: "# Updated",
          status: "draft",
        }),
      }),
    }, { csrfToken: "wrong-token" })),
    onRequestPostDelete(withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1", { method: "DELETE" }),
    }, { csrfToken: "wrong-token" })),
    onRequestPostPublish(withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", { method: "POST" }),
    }, { csrfToken: "wrong-token" })),
    onRequestRestoreRevision(withCmsSession({
      env,
      params: { id: "revision_1" },
      request: new Request("https://example.com/api/admin/revisions/revision_1/restore", { method: "POST" }),
    }, { csrfToken: "wrong-token" })),
  ]);

  for (const response of invalidCsrfResponses) {
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_csrf" });
  }
});

test("real cms create update publish and restore flows persist revision history", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);
  env.PAGES_DEPLOY_HOOK_URL = "https://example.com/deploy";

  const createResponse = await onRequestPostsCreate(withCmsSession({
    env,
    request: new Request("https://example.com/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "hello-world",
        title: "Hello world",
        summary: "Summary",
        bodyMarkdown: "# Hello world",
        status: "draft",
      }),
    }),
  }));
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(state.revisions.size, 1);
  const createdRevision = [...state.revisions.values()].find((revision) => revision.post_id === created.post.id);
  assert.equal(createdRevision?.title, "Hello world");
  assert.equal(createdRevision?.status, "draft");

  const updateResponse = await onRequestPostPut(withCmsSession({
    env,
    params: { id: created.post.id },
    request: new Request(`https://example.com/api/admin/posts/${created.post.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "hello-world",
        title: "Updated title",
        summary: "Updated summary",
        bodyMarkdown: "# Updated",
        status: "draft",
      }),
    }),
  }));
  assert.equal(updateResponse.status, 200);
  assert.equal(state.revisions.size, 2);
  assert.ok(
    [...state.revisions.values()].some((revision) => revision.post_id === created.post.id && revision.title === "Updated title"),
  );

  const publishResponse = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: created.post.id },
      request: new Request(`https://example.com/api/admin/posts/${created.post.id}/publish`, {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
    }),
    {
      async fetch() {
        return { ok: true, status: 201 };
      },
    },
  );
  assert.equal(publishResponse.status, 200);
  assert.equal(state.revisions.size, 3);
  assert.ok(
    [...state.revisions.values()].some((revision) => revision.post_id === created.post.id && revision.status === "published"),
  );

  const restoreTarget = createdRevision.id;
  const restoreResponse = await onRequestRestoreRevision(withCmsSession({
    env,
    params: { id: restoreTarget },
    request: new Request(`https://example.com/api/admin/revisions/${restoreTarget}/restore`, {
      method: "POST",
    }),
  }));
  assert.equal(restoreResponse.status, 200);
  assert.equal(state.revisions.size, 4);
  assert.ok(
    [...state.revisions.values()].some((revision) => revision.post_id === created.post.id && revision.title === "Hello world"),
  );
});

test("post update, publish, and restore do not fail after the main mutation when revision snapshot writes fail", async () => {
  const revisionInsertError = new Error("revision insert failed");
  const { env, state } = createContentTestEnv({
    async onRun({ normalizedQuery }) {
      if (
        normalizedQuery
        === "INSERT INTO cms_post_revisions (id, post_id, title, summary, body_markdown, sanitized_html, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ) {
        throw revisionInsertError;
      }
    },
  });
  seedCmsSession(state, { user_id: "editor@example.com" });
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
    body_markdown: "## Restored",
    sanitized_html: "<h2>Restored</h2>",
    status: "published",
    created_at: "2025-04-01T12:00:00.000Z",
  });
  env.PAGES_DEPLOY_HOOK_URL = "https://example.com/deploy";

  const updateResponse = await onRequestPostPut(withCmsSession({
    env,
    params: { id: "post_1" },
    request: new Request("https://example.com/api/admin/posts/post_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "hello-world",
        title: "Updated title",
        summary: "Updated summary",
        bodyMarkdown: "# Updated",
        status: "draft",
      }),
    }),
  }));
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(await updateResponse.json(), { ok: true });
  assert.equal(state.posts.get("post_1").title, "Updated title");

  const publishResponse = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
    }),
    {
      async fetch() {
        return { ok: true, status: 201 };
      },
    },
  );
  assert.equal(publishResponse.status, 200);
  assert.deepEqual(await publishResponse.json(), {
    ok: true,
    publishState: "pending_deploy",
  });
  assert.equal(state.posts.get("post_1").status, "published");

  const restoreResponse = await onRequestRestoreRevision(withCmsSession({
    env,
    params: { id: "revision_1" },
    method: "POST",
    url: "https://example.com/api/admin/revisions/revision_1/restore",
  }));
  assert.equal(restoreResponse.status, 200);
  assert.deepEqual(await restoreResponse.json(), { ok: true, restored: true });
  assert.equal(state.posts.get("post_1").title, "Restored title");
  assert.equal(state.revisions.size, 1);
});

test("post create does not fail after the main mutation when revision snapshot writes fail", async () => {
  const revisionInsertError = new Error("revision insert failed");
  const { env, state } = createContentTestEnv({
    async onRun({ normalizedQuery }) {
      if (
        normalizedQuery
        === "INSERT INTO cms_post_revisions (id, post_id, title, summary, body_markdown, sanitized_html, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ) {
        throw revisionInsertError;
      }
    },
  });
  seedCmsSession(state);

  const response = await onRequestPostsCreate(withCmsSession({
    env,
    request: new Request("https://example.com/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "hello-world",
        title: "Hello world",
        summary: "Summary",
        bodyMarkdown: "# Hello world",
        status: "draft",
      }),
    }),
  }));

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(state.posts.size, 1);
  assert.equal(state.revisions.size, 0);
});

test("posts index routes create and list persisted posts", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);

  const createResponse = await onRequestPostsCreate(withCmsSession({
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
  }));

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

  const listResponse = await onRequestPostGet(withCmsSession({
    env,
    params: { id: createdBody.post.id },
    url: `https://example.com/api/admin/posts/${createdBody.post.id}`,
  }));
  assert.equal(listResponse.status, 200);

  const indexResponse = await onRequestPostsGet(withCmsSession({
    env,
    url: "https://example.com/api/admin/posts",
  }));
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
  seedCmsSession(state);
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
  state.revisions.set("revision_2", {
    id: "revision_2",
    post_id: "post_1",
    title: "Older title",
    summary: "Older summary",
    body_markdown: "## Older",
    sanitized_html: "<h2>Older</h2>",
    status: "draft",
    created_at: "2025-03-01T12:00:00.000Z",
  });

  const readResponse = await onRequestPostGet(withCmsSession({
    env,
    params: { id: "post_1" },
    url: "https://example.com/api/admin/posts/post_1",
  }));
  assert.equal(readResponse.status, 200);
  assert.deepEqual(await readResponse.json(), {
    post: {
      ...state.posts.get("post_1"),
      revisions: [
        {
          id: "revision_1",
          status: "published",
          created_at: "2025-04-01T12:00:00.000Z",
          title: "Restored title",
          summary: "Restored summary",
        },
        {
          id: "revision_2",
          status: "draft",
          created_at: "2025-03-01T12:00:00.000Z",
          title: "Older title",
          summary: "Older summary",
        },
      ],
    },
  });

  const updateResponse = await onRequestPostPut(withCmsSession({
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
  }));
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(await updateResponse.json(), { ok: true });
  assert.equal(state.posts.get("post_1").slug, "updated-post");
  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").sanitized_html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

  const deleteResponse = await onRequestPostDelete(withCmsSession({
    env,
    params: { id: "post_1" },
    method: "DELETE",
    url: "https://example.com/api/admin/posts/post_1",
  }));
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(await deleteResponse.json(), { ok: true, deleted: true });
  assert.match(state.posts.get("post_1").deleted_at, /^\d{4}-\d{2}-\d{2}T/);

  state.posts.set("post_1", {
    ...state.posts.get("post_1"),
    deleted_at: null,
  });

  const restoreResponse = await onRequestRestoreRevision(withCmsSession({
    env,
    params: { id: "revision_1" },
    method: "POST",
    url: "https://example.com/api/admin/revisions/revision_1/restore",
  }));
  assert.equal(restoreResponse.status, 200);
  assert.deepEqual(await restoreResponse.json(), { ok: true, restored: true });
  assert.equal(state.posts.get("post_1").title, "Restored title");
  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").sanitized_html, /<h2[^>]*>Restored<\/h2>/);
  assert.match(state.posts.get("post_1").sanitized_html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(state.posts.get("post_1").sanitized_html, /<script>unsafe<\/script>/);

  const missingResponse = await onRequestRestoreRevision(withCmsSession({
    env,
    params: { id: "missing" },
    method: "POST",
    url: "https://example.com/api/admin/revisions/missing/restore",
  }));
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { ok: false, error: "not_found" });
});

test("restore revision returns not_found when the target post no longer exists", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);
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

  const response = await onRequestRestoreRevision(withCmsSession({
    env,
    params: { id: "revision_missing_post" },
    method: "POST",
    url: "https://example.com/api/admin/revisions/revision_missing_post/restore",
  }));

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: "not_found" });
  assert.equal(state.posts.size, 0);
});

test("restore revision returns not_found for soft-deleted target posts", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);
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

  const response = await onRequestRestoreRevision(withCmsSession({
    env,
    params: { id: "revision_deleted_post" },
    method: "POST",
    url: "https://example.com/api/admin/revisions/revision_deleted_post/restore",
  }));

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: "not_found" });
  assert.equal(state.posts.get("post_deleted").title, "Deleted");
});

test("restore revision clears published_at when restoring a draft revision", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Published title",
    summary: "Published summary",
    body_markdown: "# Published",
    sanitized_html: "<h1>Published</h1>",
    status: "published",
    published_at: "2025-04-03T12:00:00.000Z",
    deleted_at: null,
    updated_at: "2025-04-03T12:00:00.000Z",
  });
  state.revisions.set("revision_draft", {
    id: "revision_draft",
    post_id: "post_1",
    title: "Draft title",
    summary: "Draft summary",
    body_markdown: "## Draft body",
    sanitized_html: "<h2>unsafe</h2>",
    status: "draft",
    created_at: "2025-04-01T12:00:00.000Z",
  });

  const response = await onRequestRestoreRevision(withCmsSession({
    env,
    params: { id: "revision_draft" },
    method: "POST",
    url: "https://example.com/api/admin/revisions/revision_draft/restore",
  }));

  assert.equal(response.status, 200);
  assert.equal(state.posts.get("post_1").status, "draft");
  assert.equal(state.posts.get("post_1").published_at, null);
});

test("restore revision refreshes published_at when restoring a published revision", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Draft title",
    summary: "Draft summary",
    body_markdown: "# Draft",
    sanitized_html: "<h1>Draft</h1>",
    status: "draft",
    published_at: null,
    deleted_at: null,
    updated_at: "2025-04-03T12:00:00.000Z",
  });
  state.revisions.set("revision_published", {
    id: "revision_published",
    post_id: "post_1",
    title: "Published title",
    summary: "Published summary",
    body_markdown: "## Published body",
    sanitized_html: "<h2>unsafe</h2>",
    status: "published",
    created_at: "2025-04-01T12:00:00.000Z",
  });

  const response = await onRequestRestoreRevision(withCmsSession({
    env,
    params: { id: "revision_published" },
    method: "POST",
    url: "https://example.com/api/admin/revisions/revision_published/restore",
  }));

  assert.equal(response.status, 200);
  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").published_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(state.posts.get("post_1").updated_at, state.posts.get("post_1").published_at);
});

test("post update and delete return not_found for missing or soft-deleted posts", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);
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

  const missingUpdate = await onRequestPostPut(withCmsSession({
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
  }));
  assert.equal(missingUpdate.status, 404);
  assert.deepEqual(await missingUpdate.json(), { ok: false, error: "not_found" });

  const deletedUpdate = await onRequestPostPut(withCmsSession({
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
  }));
  assert.equal(deletedUpdate.status, 404);
  assert.deepEqual(await deletedUpdate.json(), { ok: false, error: "not_found" });
  assert.equal(state.posts.get("post_deleted").slug, "deleted-post");

  const missingDelete = await onRequestPostDelete(withCmsSession({
    env,
    params: { id: "missing" },
    method: "DELETE",
    url: "https://example.com/api/admin/posts/missing",
  }));
  assert.equal(missingDelete.status, 404);
  assert.deepEqual(await missingDelete.json(), { ok: false, error: "not_found" });

  const deletedDelete = await onRequestPostDelete(withCmsSession({
    env,
    params: { id: "post_deleted" },
    method: "DELETE",
    url: "https://example.com/api/admin/posts/post_deleted",
  }));
  assert.equal(deletedDelete.status, 404);
  assert.deepEqual(await deletedDelete.json(), { ok: false, error: "not_found" });
});

test("post create returns invalid_json for malformed request bodies", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);

  const response = await onRequestPostsCreate(withCmsSession({
    env,
    request: new Request("https://example.com/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_json" });
  assert.equal(state.posts.size, 0);
});

test("post create returns required_field for blank normalized slug", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);

  const response = await onRequestPostsCreate(withCmsSession({
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
  }));

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
  seedCmsSession(state);
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

  const response = await onRequestPostPut(withCmsSession({
    env,
    params: { id: "post_1" },
    request: new Request("https://example.com/api/admin/posts/post_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_json" });
  assert.equal(state.posts.get("post_1").title, "Hello world");
});

test("post update returns required_field for blank normalized title", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);
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

  const response = await onRequestPostPut(withCmsSession({
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
  }));

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
  seedCmsSession(state);
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

  const response = await onRequestPostsCreate(withCmsSession({
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
  }));

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: "duplicate_slug" });
  assert.equal(state.posts.size, 1);
});

test("post update returns conflict for duplicate slugs", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state);
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

  const response = await onRequestPostPut(withCmsSession({
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
  }));

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

test("triggerDeploy returns a clean failed result when the deploy hook fetch throws", async () => {
  const response = await triggerDeploy(
    {
      PAGES_DEPLOY_HOOK_URL: "https://example.com/deploy",
    },
    {
      async fetch() {
        throw new Error("network down");
      },
    },
  );

  assert.deepEqual(response, { ok: false, status: 0 });
});

test("triggerDeploy returns a clean failed result when the deploy hook URL is missing", async () => {
  const response = await triggerDeploy({});
  assert.deepEqual(response, { ok: false, status: 0 });
});

test("post publish route publishes the post, records audit, and triggers deploy", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state, { user_id: "editor@example.com" });
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

  const requests = [];
  const runtime = {
    async fetch(url, init) {
      requests.push({ url, init });
      return { ok: true, status: 201 };
    },
  };
  const postPublish = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
      runtime: {
        async fetch() {
          throw new Error("route should use explicit runtime injection");
        },
      },
    }),
    runtime,
  );

  assert.equal(postPublish.status, 200);
  assert.deepEqual(await postPublish.json(), {
    ok: true,
    publishState: "pending_deploy",
  });

  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").published_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(state.posts.get("post_1").updated_at, state.posts.get("post_1").published_at);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "publish");
  assert.equal(state.auditLog[0].actor_user_id, "editor@example.com");
  assert.equal(state.auditLog[0].target_type, "post");
  assert.equal(state.auditLog[0].target_id, "post_1");
  assert.deepEqual(JSON.parse(state.auditLog[0].metadata_json), {
    outcome: "deploy_triggered",
    deployStatus: 201,
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/deploy");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    event: "cms-publish",
    timestamp: JSON.parse(requests[0].init.body).timestamp,
  });
});

test("post publish route still returns success when the post-decision audit write fails", async () => {
  const auditError = new Error("audit write failed");
  const { env, state } = createContentTestEnv({
    async onRun({ normalizedQuery }) {
      if (
        normalizedQuery
        === "INSERT INTO cms_audit_log (id, actor_user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ) {
        throw auditError;
      }
    },
  });
  seedCmsSession(state, { user_id: "editor@example.com" });
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

  const postPublish = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
    }),
    {
      async fetch() {
        return { ok: true, status: 201 };
      },
    },
  );

  assert.equal(postPublish.status, 200);
  assert.deepEqual(await postPublish.json(), {
    ok: true,
    publishState: "pending_deploy",
  });
  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").published_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(state.posts.get("post_1").updated_at, state.posts.get("post_1").published_at);
  assert.equal(state.auditLog.length, 0);
});

test("post publish route returns deploy_failed when the deploy hook call fails", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state, { user_id: "editor@example.com" });
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "Summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "published",
    published_at: "2025-04-01T12:00:00.000Z",
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });

  env.PAGES_DEPLOY_HOOK_URL = "https://example.com/deploy";

  const postPublish = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
      runtime: {
        async fetch() {
          throw new Error("route should use explicit runtime injection");
        },
      },
    }),
    {
      async fetch() {
        return { ok: false, status: 503 };
      },
    },
  );

  assert.equal(postPublish.status, 502);
  assert.deepEqual(await postPublish.json(), {
    ok: false,
    publishState: "deploy_failed",
  });

  assert.equal(state.posts.get("post_1").status, "published");
  assert.equal(state.posts.get("post_1").published_at, "2025-04-01T12:00:00.000Z");
  assert.equal(state.posts.get("post_1").updated_at, "2025-04-02T12:00:00.000Z");
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "publish");
  assert.equal(state.auditLog[0].actor_user_id, "editor@example.com");
  assert.deepEqual(JSON.parse(state.auditLog[0].metadata_json), {
    outcome: "deploy_failed",
    deployStatus: 503,
  });
});

test("post publish route rolls back and returns deploy_failed when the deploy hook fetch throws", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state, { user_id: "editor@example.com" });
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

  const postPublish = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
      runtime: {
        async fetch() {
          throw new Error("route should use explicit runtime injection");
        },
      },
    }),
    {
      async fetch() {
        throw new Error("network down");
      },
    },
  );

  assert.equal(postPublish.status, 502);
  assert.deepEqual(await postPublish.json(), {
    ok: false,
    publishState: "deploy_failed",
  });

  assert.equal(state.posts.get("post_1").status, "draft");
  assert.equal(state.posts.get("post_1").published_at, null);
  assert.equal(state.posts.get("post_1").updated_at, "2025-04-02T12:00:00.000Z");
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "publish");
  assert.equal(state.auditLog[0].actor_user_id, "editor@example.com");
  assert.deepEqual(JSON.parse(state.auditLog[0].metadata_json), {
    outcome: "deploy_failed",
    deployStatus: 0,
  });
});

test("post publish route still returns deploy_failed when rollback-path audit write fails", async () => {
  const auditError = new Error("audit write failed");
  const { env, state } = createContentTestEnv({
    async onRun({ normalizedQuery }) {
      if (
        normalizedQuery
        === "INSERT INTO cms_audit_log (id, actor_user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ) {
        throw auditError;
      }
    },
  });
  seedCmsSession(state, { user_id: "editor@example.com" });
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

  const postPublish = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
    }),
    {
      async fetch() {
        throw new Error("network down");
      },
    },
  );

  assert.equal(postPublish.status, 502);
  assert.deepEqual(await postPublish.json(), {
    ok: false,
    publishState: "deploy_failed",
  });
  assert.equal(state.posts.get("post_1").status, "draft");
  assert.equal(state.posts.get("post_1").published_at, null);
  assert.equal(state.posts.get("post_1").updated_at, "2025-04-02T12:00:00.000Z");
  assert.equal(state.auditLog.length, 0);
});

test("post publish route reports rollback failure and still returns deploy_failed when rollback update throws", async () => {
  const rollbackError = new Error("rollback write failed");
  const { env, state } = createContentTestEnv({
    async onRun({ normalizedQuery, bindings }) {
      if (
        normalizedQuery === "UPDATE cms_posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
        && bindings[0] === "draft"
      ) {
        throw rollbackError;
      }
    },
  });
  seedCmsSession(state, { user_id: "editor@example.com" });
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

  const postPublish = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
      runtime: {
        async fetch() {
          throw new Error("route should use explicit runtime injection");
        },
      },
    }),
    {
      async fetch() {
        throw new Error("network down");
      },
    },
  );

  assert.equal(postPublish.status, 502);
  assert.deepEqual(await postPublish.json(), {
    ok: false,
    publishState: "deploy_failed",
    rollbackState: "failed",
  });

  assert.equal(state.posts.get("post_1").status, "published");
  assert.match(state.posts.get("post_1").published_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "publish");
  assert.equal(state.auditLog[0].actor_user_id, "editor@example.com");
  assert.deepEqual(JSON.parse(state.auditLog[0].metadata_json), {
    outcome: "deploy_failed",
    deployStatus: 0,
    rollbackStatus: "failed",
    rollbackError: "rollback write failed",
  });
});

test("post publish route reports rollback failure when rollback update is a no-op", async () => {
  const { env, state } = createContentTestEnv({
    async onRun({ normalizedQuery, bindings, state: dbState }) {
      if (
        normalizedQuery === "UPDATE cms_posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
        && bindings[0] === "draft"
      ) {
        dbState.posts.get(bindings[3]).deleted_at = "2025-04-03T12:00:00.000Z";
      }
    },
  });
  seedCmsSession(state, { user_id: "editor@example.com" });
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

  const postPublish = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
      runtime: {
        async fetch() {
          throw new Error("route should use explicit runtime injection");
        },
      },
    }),
    {
      async fetch() {
        throw new Error("network down");
      },
    },
  );

  assert.equal(postPublish.status, 502);
  assert.deepEqual(await postPublish.json(), {
    ok: false,
    publishState: "deploy_failed",
    rollbackState: "failed",
  });

  assert.equal(state.posts.get("post_1").status, "published");
  assert.equal(state.auditLog.length, 1);
  assert.equal(state.auditLog[0].action, "publish");
  assert.equal(state.auditLog[0].actor_user_id, "editor@example.com");
  assert.deepEqual(JSON.parse(state.auditLog[0].metadata_json), {
    outcome: "deploy_failed",
    deployStatus: 0,
    rollbackStatus: "failed",
    rollbackError: "rollback update affected 0 rows",
  });
});

test("post publish route returns not_found when the publish update races with a soft-delete", async () => {
  const { env, state } = createContentTestEnv({ publishUpdateChanges: 0 });
  seedCmsSession(state, { user_id: "editor@example.com" });
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

  let fetchCalls = 0;
  const runtime = {
    async fetch() {
      fetchCalls += 1;
      return { ok: true, status: 201 };
    },
  };

  const response = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      request: new Request("https://example.com/api/admin/posts/post_1/publish", {
        method: "POST",
        headers: {
          "cf-access-authenticated-user-email": "editor@example.com",
        },
      }),
    }),
    runtime,
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: "not_found" });
  assert.equal(fetchCalls, 0);
  assert.equal(state.auditLog.length, 0);
  assert.deepEqual(state.posts.get("post_1"), {
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
});

test("post publish route returns not_found for missing or soft-deleted posts without auditing or deploying", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state, { user_id: "editor@example.com" });
  state.posts.set("post_deleted", {
    id: "post_deleted",
    slug: "deleted-post",
    title: "Deleted post",
    summary: "Summary",
    body_markdown: "# Deleted",
    sanitized_html: "<h1>Deleted</h1>",
    status: "draft",
    published_at: null,
    deleted_at: "2025-04-03T12:00:00.000Z",
    updated_at: "2025-04-03T12:00:00.000Z",
  });

  env.PAGES_DEPLOY_HOOK_URL = "https://example.com/deploy";

  let fetchCalls = 0;
  const runtime = {
    async fetch() {
      fetchCalls += 1;
      return { ok: true, status: 201 };
    },
  };

  const missingResponse = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_missing" },
      method: "POST",
      url: "https://example.com/api/admin/posts/post_missing/publish",
    }),
    runtime,
  );
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { ok: false, error: "not_found" });

  const deletedResponse = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_deleted" },
      method: "POST",
      url: "https://example.com/api/admin/posts/post_deleted/publish",
    }),
    runtime,
  );
  assert.equal(deletedResponse.status, 404);
  assert.deepEqual(await deletedResponse.json(), { ok: false, error: "not_found" });

  assert.equal(fetchCalls, 0);
  assert.equal(state.auditLog.length, 0);
});

test("post publish route returns deploy_failed when the deploy hook URL is missing", async () => {
  const { env, state } = createContentTestEnv();
  seedCmsSession(state, { user_id: "editor@example.com" });
  state.posts.set("post_1", {
    id: "post_1",
    slug: "hello-world",
    title: "Hello world",
    summary: "Summary",
    body_markdown: "# Hello world",
    sanitized_html: "<h1>Hello world</h1>",
    status: "published",
    published_at: "2025-04-01T12:00:00.000Z",
    deleted_at: null,
    updated_at: "2025-04-02T12:00:00.000Z",
  });

  env.PAGES_DEPLOY_HOOK_URL = " ";

  let fetchCalls = 0;
  const postPublish = await onRequestPostPublish(
    withCmsSession({
      env,
      params: { id: "post_1" },
      method: "POST",
      url: "https://example.com/api/admin/posts/post_1/publish",
    }),
    {
      async fetch() {
        fetchCalls += 1;
        return { ok: true, status: 201 };
      },
    },
  );

  assert.equal(postPublish.status, 502);
  assert.deepEqual(await postPublish.json(), {
    ok: false,
    publishState: "deploy_failed",
  });
  assert.equal(fetchCalls, 0);
  assert.equal(state.posts.get("post_1").status, "published");
  assert.equal(state.posts.get("post_1").published_at, "2025-04-01T12:00:00.000Z");
  assert.equal(state.posts.get("post_1").updated_at, "2025-04-02T12:00:00.000Z");
  assert.equal(state.auditLog.length, 1);
  assert.deepEqual(JSON.parse(state.auditLog[0].metadata_json), {
    outcome: "deploy_failed",
    deployStatus: 0,
  });
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
