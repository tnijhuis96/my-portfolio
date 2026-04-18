const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function extractInlineScript(html) {
  return html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
}

function toCollection(children) {
  const collection = { length: children.length };
  children.forEach((child, index) => {
    collection[index] = child;
  });
  return collection;
}

function createFakeElement(initial = {}) {
  let childNodes = initial.children ? [...initial.children] : [];
  return {
    tagName: initial.tagName ?? "div",
    hidden: Boolean(initial.hidden),
    textContent: initial.textContent ?? "",
    value: initial.value ?? "",
    disabled: Boolean(initial.disabled),
    get children() {
      return toCollection(childNodes);
    },
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    appendChild(child) {
      childNodes.push(child);
      return child;
    },
    replaceChildren(...children) {
      childNodes = children;
      return children[children.length - 1] ?? null;
    },
    click() {
      if (this.disabled) {
        return undefined;
      }
      return this.listeners.click?.({
        currentTarget: this,
        preventDefault() {},
      });
    },
  };
}

function createHeaders(headers = {}) {
  const values = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );

  return {
    get(name) {
      return values.get(String(name).toLowerCase()) ?? null;
    },
  };
}

function createJsonResponse(body, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: createHeaders({ "content-type": "application/json", ...(init.headers ?? {}) }),
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function createTextResponse(body, init = {}) {
  return {
    ok: init.ok ?? false,
    status: init.status ?? 500,
    headers: createHeaders({ "content-type": "text/plain; charset=utf-8", ...(init.headers ?? {}) }),
    async json() {
      throw new SyntaxError(`Unexpected token ${String(body)[0] ?? ""} in JSON`);
    },
    async text() {
      return String(body);
    },
  };
}

async function flushMicrotasks(count = 6) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

test("admin shell includes login/workspace shells and session bootstrap wiring", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const loginShellTag = html.match(/<section(?=[^>]*id="login-shell")[^>]*>/)?.[0];
  const workspaceShellTag = html.match(/<section(?=[^>]*id="workspace-shell")[^>]*>/)?.[0];

  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(loginShellTag, "login shell should be rendered");
  assert.match(html, /<form[^>]*id="login-form"/);
  assert.ok(workspaceShellTag, "workspace shell should be rendered");
  assert.match(workspaceShellTag, /\shidden(?=[\s>])/);
  assert.match(html, /<aside[^>]*id="post-list-pane"/);
  assert.match(html, /<section[^>]*id="editor-pane"/);
  assert.match(html, /<aside[^>]*id="revisions-pane"/);
  assert.match(html, /<textarea[^>]*id="bodyMarkdown"/);
  assert.match(html, /window\.CMS_ENDPOINTS\s*=\s*\{/);
  assert.match(html, /session:\s*"\/api\/admin\/session"/);
  assert.match(html, /login:\s*"\/api\/admin\/login"/);
  assert.match(html, /logout:\s*"\/api\/admin\/logout"/);
  assert.match(html, /posts:\s*"\/api\/admin\/posts"/);
  assert.match(html, /id="login-shell"/);
  assert.match(html, /id="workspace-shell"/);
  assert.match(html, /id="new-post"/);
  assert.match(html, /id="post-list"/);
  assert.match(html, /id="save-post"/);
  assert.match(html, /id="delete-post"/);
  assert.match(html, /id="publish-post"/);
  assert.match(html, /id="revisions-list"/);
  assert.match(html, /async function bootstrapSession\(/);
  assert.match(html, /async function loadPosts\(/);
  assert.match(html, /async function loadRevisions\(/);
  assert.match(html, /async function savePost\(/);
  assert.match(html, /async function deletePost\(/);
  assert.match(html, /async function restoreRevision\(/);
  assert.match(html, /async function publishPost\(/);
  assert.match(html, /fetch\(window\.CMS_ENDPOINTS\.session/);
  assert.match(html, /fetch\(window\.CMS_ENDPOINTS\.login/);
  assert.match(html, /fetch\(window\.CMS_ENDPOINTS\.posts/);
  assert.match(html, /\/publish/);
  assert.match(html, /\/restore/);
  assert.match(
    html,
    /<\/main>\s*<script>\s*window\.CMS_ENDPOINTS\s*=/,
    "CMS endpoint script should be emitted after </main>",
  );
});

test("admin inline script keeps login shell active and shows retry-after lockout message on 429 login", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  assert.ok(script, "admin shell should include an inline script");

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "post-list": createFakeElement(),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement(),
    title: createFakeElement(),
    summary: createFakeElement(),
    bodyMarkdown: createFakeElement(),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
    password: createFakeElement({ value: "secret-password" }),
  };

  const fetchCalls = [];
  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });

      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: false });
      }

      if (url === "/api/admin/login") {
        return createTextResponse("Too many requests", {
          status: 429,
          headers: { "retry-after": "90" },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks();

  assert.equal(elements["login-shell"].hidden, false);
  assert.equal(elements["workspace-shell"].hidden, true);
  assert.equal(elements["login-status"].textContent, "Please log in.");

  let prevented = false;
  await elements["login-form"].listeners.submit({
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(elements["workspace-shell"].hidden, true);
  assert.equal(elements["login-shell"].hidden, false);
  assert.match(elements["login-status"].textContent, /try again in 90 seconds/i);
  assert.deepEqual(
    fetchCalls.map(({ url, options }) => [url, options.method ?? "GET"]),
    [
      ["/api/admin/session", "GET"],
      ["/api/admin/login", "POST"],
    ],
  );
});

test("admin inline script returns to login when content loading gets an auth failure", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "post-list": createFakeElement(),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true, csrfToken: "csrf-123" });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ ok: false, error: "unauthenticated" }, { ok: false, status: 401 });
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  assert.equal(elements["login-shell"].hidden, false);
  assert.equal(elements["workspace-shell"].hidden, true);
  assert.equal(elements["post-list"].children.length, 0);
  assert.equal(elements["editor-status"].textContent, "");
  assert.match(elements["login-status"].textContent, /session expired.*sign in again/i);
});

test("admin inline script wires post list, save, delete, and reset actions for the editor", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "post-list": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  const fetchCalls = [];
  let listResponse = [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      summary: "First summary",
      status: "draft",
      updated_at: "2025-01-01T00:00:00.000Z",
      published_at: null,
      deleted_at: null,
    },
  ];
  let detailResponse = {
    id: "post-1",
    slug: "hello-world",
    title: "Hello World",
    summary: "First summary",
    body_markdown: "# Hello",
    status: "draft",
  };

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });

      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true, csrfToken: "csrf-123" });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ posts: listResponse });
      }

      if (url === "/api/admin/posts/post-1" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ post: detailResponse });
      }

      if (url === "/api/admin/posts/post-1" && options.method === "PUT") {
        const body = JSON.parse(options.body);
        detailResponse = { ...detailResponse, ...body };
        listResponse = [{ ...listResponse[0], ...body }];
        return createJsonResponse({
          ok: true,
          revisionState: "degraded",
          warnings: [
            {
              code: "revision_snapshot_failed",
              message: "Revision history warning: latest snapshot could not be stored.",
              operation: "update",
            },
          ],
        });
      }

      if (url === "/api/admin/posts/post-1" && options.method === "DELETE") {
        listResponse = [];
        return createJsonResponse({ ok: true, deleted: true });
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  assert.equal(elements["login-shell"].hidden, true);
  assert.equal(elements["workspace-shell"].hidden, false);
  assert.equal(elements["post-list"].children.length, 1);
  assert.equal(elements["post-list"].children[0].textContent, "Hello World");

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);

  assert.equal(elements.slug.value, "hello-world");
  assert.equal(elements.title.value, "Hello World");
  assert.equal(elements.summary.value, "First summary");
  assert.equal(elements.bodyMarkdown.value, "# Hello");

  elements.title.value = "Updated Title";
  await elements["save-post"].click();
  await flushMicrotasks(10);

  const saveRequest = fetchCalls.find(({ url, options }) => url === "/api/admin/posts/post-1" && options.method === "PUT");
  assert.ok(saveRequest, "save should update the active post");
  assert.equal(saveRequest.options.headers["x-csrf-token"], "csrf-123");
  assert.deepEqual(JSON.parse(saveRequest.options.body), {
    slug: "hello-world",
    title: "Updated Title",
    summary: "First summary",
    bodyMarkdown: "# Hello",
    status: "draft",
  });
  assert.match(elements["editor-status"].textContent, /saved/i);
  assert.match(elements["editor-status"].textContent, /revision history warning/i);
  assert.equal(elements.title.value, "Updated Title");

  await elements["new-post"].click();
  await flushMicrotasks(4);

  assert.equal(elements.slug.value, "");
  assert.equal(elements.title.value, "");
  assert.equal(elements.summary.value, "");
  assert.equal(elements.bodyMarkdown.value, "");
  assert.equal(elements["editor-status"].textContent, "");
  assert.equal(elements["revisions-list"].textContent, "Select or create a post to view history.");

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);
  await elements["delete-post"].click();
  await flushMicrotasks(10);

  assert.ok(
    fetchCalls.some(({ url, options }) => url === "/api/admin/posts/post-1" && options.method === "DELETE"),
    "delete should remove the active post",
  );
  const deleteRequest = fetchCalls.find(({ url, options }) => url === "/api/admin/posts/post-1" && options.method === "DELETE");
  assert.equal(deleteRequest.options.headers["x-csrf-token"], "csrf-123");
  assert.equal(elements["post-list"].children.length, 0);
  assert.equal(elements.slug.value, "");
  assert.match(elements["editor-status"].textContent, /deleted/i);
});

test("admin inline script returns to login when a mutation gets an auth failure", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "post-list": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  let detailResponse = {
    id: "post-1",
    slug: "hello-world",
    title: "Hello World",
    summary: "First summary",
    body_markdown: "# Hello",
    status: "draft",
    revisions: [],
  };

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true, csrfToken: "csrf-123" });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({
          posts: [{
            id: "post-1",
            slug: "hello-world",
            title: "Hello World",
            summary: "First summary",
            status: "draft",
            updated_at: "2025-01-01T00:00:00.000Z",
            published_at: null,
            deleted_at: null,
          }],
        });
      }

      if (url === "/api/admin/posts/post-1" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ post: detailResponse });
      }

      if (url === "/api/admin/posts/post-1" && options.method === "PUT") {
        return createJsonResponse({ ok: false, error: "invalid_csrf" }, { ok: false, status: 403 });
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);
  elements.title.value = "Updated Title";

  await elements["save-post"].click();
  await flushMicrotasks(10);

  assert.equal(elements["login-shell"].hidden, false);
  assert.equal(elements["workspace-shell"].hidden, true);
  assert.equal(elements.slug.value, "");
  assert.equal(elements.title.value, "");
  assert.equal(elements["revisions-list"].textContent, "Select or create a post to view history.");
  assert.equal(elements["editor-status"].textContent, "");
  assert.match(elements["login-status"].textContent, /session expired.*sign in again/i);
});

test("admin inline script renders revision states and refreshes after restoring a revision", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "post-list": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  const fetchCalls = [];
  let listResponse = [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      summary: "First summary",
      status: "draft",
      updated_at: "2025-01-01T00:00:00.000Z",
      published_at: null,
      deleted_at: null,
    },
  ];
  let detailResponse = {
    id: "post-1",
    slug: "current-slug",
    title: "Hello World",
    summary: "First summary",
    body_markdown: "# Hello",
    status: "draft",
    revisions: [],
  };

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });

      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true, csrfToken: "csrf-123" });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ posts: listResponse });
      }

      if (url === "/api/admin/posts/post-1" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ post: detailResponse });
      }

      if (url === "/api/admin/revisions/revision-2/restore" && options.method === "POST") {
        detailResponse = {
          ...detailResponse,
          slug: "restored-slug",
          title: "Restored title",
          summary: "Restored summary",
          body_markdown: "## Restored",
          status: "published",
          revisions: [
            {
              id: "revision-3",
              status: "published",
              created_at: "2025-01-03T00:00:00.000Z",
              title: "Post-restore snapshot",
              summary: "Newest revision",
            },
          ],
        };
        listResponse = [{ ...listResponse[0], title: "Restored title", status: "published" }];
        return createJsonResponse({
          ok: true,
          restored: true,
          revisionState: "degraded",
          warnings: [
            {
              code: "revision_snapshot_failed",
              message: "Revision history warning: latest snapshot could not be stored.",
              operation: "restore",
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  assert.equal(elements["revisions-list"].textContent, "Select or create a post to view history.");

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);

  assert.equal(elements["revisions-list"].textContent, "No revisions yet.");

  detailResponse = {
    ...detailResponse,
    revisions: [
      {
        id: "revision-2",
        status: "draft",
        created_at: "2025-01-02T00:00:00.000Z",
        title: "Second revision",
        summary: "Second summary",
      },
      {
        id: "revision-1",
        status: "published",
        created_at: "2025-01-01T00:00:00.000Z",
        title: "First revision",
        summary: "First summary",
      },
    ],
  };

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);

  assert.equal(elements["revisions-list"].children.length, 2);
  assert.match(elements["revisions-list"].children[0].children[0].textContent, /Second revision/);
  assert.match(elements["revisions-list"].children[0].children[1].textContent, /restore/i);

  await elements["revisions-list"].children[0].children[1].click();
  await flushMicrotasks(10);

  assert.ok(
    fetchCalls.some(({ url, options }) => url === "/api/admin/revisions/revision-2/restore" && options.method === "POST"),
    "restore should post to the revision restore endpoint",
  );
  const restoreRequest = fetchCalls.find(({ url, options }) => url === "/api/admin/revisions/revision-2/restore" && options.method === "POST");
  assert.equal(restoreRequest.options.headers["x-csrf-token"], "csrf-123");
  assert.equal(elements.slug.value, "restored-slug");
  assert.equal(elements.title.value, "Restored title");
  assert.equal(elements["post-list"].children[0].textContent, "Restored title");
  assert.match(elements["editor-status"].textContent, /revision restored/i);
  assert.match(elements["editor-status"].textContent, /revision history warning/i);
  assert.equal(elements["revisions-list"].children.length, 1);
  assert.match(elements["revisions-list"].children[0].children[0].textContent, /Post-restore snapshot/);
});

test("admin inline script blocks selection changes during in-flight save and delete actions", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "post-list": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  const postsById = {
    "post-1": {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      summary: "First summary",
      body_markdown: "# Hello",
      status: "draft",
      revisions: [],
    },
    "post-2": {
      id: "post-2",
      slug: "second-post",
      title: "Second Post",
      summary: "Second summary",
      body_markdown: "# Second",
      status: "draft",
      revisions: [],
    },
  };
  let listResponse = [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      summary: "First summary",
      status: "draft",
      updated_at: "2025-01-02T00:00:00.000Z",
      published_at: null,
      deleted_at: null,
    },
    {
      id: "post-2",
      slug: "second-post",
      title: "Second Post",
      summary: "Second summary",
      status: "draft",
      updated_at: "2025-01-01T00:00:00.000Z",
      published_at: null,
      deleted_at: null,
    },
  ];
  let post2Loads = 0;
  const saveDeferred = createDeferred();
  const deleteDeferred = createDeferred();

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true, csrfToken: "csrf-123" });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ posts: listResponse });
      }

      if (url === "/api/admin/posts/post-1" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ post: postsById["post-1"] });
      }

      if (url === "/api/admin/posts/post-2" && (options.method ?? "GET") === "GET") {
        post2Loads += 1;
        return createJsonResponse({ post: postsById["post-2"] });
      }

      if (url === "/api/admin/posts/post-1" && options.method === "PUT") {
        return saveDeferred.promise;
      }

      if (url === "/api/admin/posts/post-1" && options.method === "DELETE") {
        return deleteDeferred.promise;
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);

  elements.title.value = "Updated Title";
  const savePromise = elements["save-post"].click();
  await flushMicrotasks(4);
  assert.equal(elements["new-post"].disabled, true);
  assert.equal(elements["post-list"].children[1].disabled, true);
  await elements["post-list"].children[1].click();
  await flushMicrotasks(10);

  postsById["post-1"] = {
    ...postsById["post-1"],
    title: "Updated Title",
  };
  listResponse = [
    { ...listResponse[0], title: "Updated Title" },
    listResponse[1],
  ];
  saveDeferred.resolve(createJsonResponse({ ok: true }));
  await savePromise;
  await flushMicrotasks(10);

  assert.equal(post2Loads, 0);
  assert.equal(elements.title.value, "Updated Title");
  assert.match(elements["editor-status"].textContent, /saved/i);

  await elements["post-list"].children[1].click();
  await flushMicrotasks(10);
  assert.equal(post2Loads, 1);
  assert.equal(elements.title.value, "Second Post");

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);

  const deletePromise = elements["delete-post"].click();
  await flushMicrotasks(4);
  assert.equal(elements["new-post"].disabled, true);
  assert.equal(elements["post-list"].children[1].disabled, true);
  await elements["new-post"].click();
  await flushMicrotasks(4);
  await elements["post-list"].children[1].click();
  await flushMicrotasks(10);

  listResponse = [listResponse[1]];
  deleteDeferred.resolve(createJsonResponse({ ok: true, deleted: true }));
  await deletePromise;
  await flushMicrotasks(10);

  assert.equal(post2Loads, 1);
  assert.equal(elements.title.value, "");
  assert.match(elements["editor-status"].textContent, /deleted/i);

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);
  assert.equal(post2Loads, 2);
  assert.equal(elements.title.value, "Second Post");
});

test("admin inline script shows inline failures for restore and publish outcomes", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "post-list": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  const fetchCalls = [];
  let listResponse = [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      summary: "First summary",
      status: "draft",
      updated_at: "2025-01-01T00:00:00.000Z",
      published_at: null,
      deleted_at: null,
    },
  ];
  let detailResponse = {
    id: "post-1",
    slug: "hello-world",
    title: "Hello World",
    summary: "First summary",
    body_markdown: "# Hello",
    status: "draft",
    revisions: [
      {
        id: "revision-1",
        status: "draft",
        created_at: "2025-01-01T00:00:00.000Z",
        title: "First revision",
        summary: "First summary",
      },
    ],
  };
  const publishResponses = [
    {
      ok: true,
      status: 200,
      body: {
        ok: true,
        publishState: "pending_deploy",
        revisionState: "degraded",
        warnings: [
          {
            code: "revision_snapshot_failed",
            message: "Revision history warning: latest snapshot could not be stored.",
            operation: "publish",
          },
        ],
      },
      nextPost: { ...detailResponse, status: "published" },
      nextList: [{ ...listResponse[0], status: "published" }],
    },
    {
      ok: false,
      status: 502,
      body: { ok: false, publishState: "deploy_failed" },
      nextPost: { ...detailResponse, status: "draft" },
      nextList: [{ ...listResponse[0], status: "draft" }],
    },
    {
      ok: false,
      status: 502,
      body: { ok: false, publishState: "deploy_failed", rollbackState: "failed" },
      nextPost: { ...detailResponse, status: "published" },
      nextList: [{ ...listResponse[0], status: "published" }],
    },
  ];

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });

      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true, csrfToken: "csrf-123" });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ posts: listResponse });
      }

      if (url === "/api/admin/posts/post-1" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ post: detailResponse });
      }

      if (url === "/api/admin/revisions/revision-1/restore" && options.method === "POST") {
        return createJsonResponse({ ok: false, error: "not_found" }, { ok: false, status: 404 });
      }

      if (url === "/api/admin/posts/post-1/publish" && options.method === "POST") {
        const scenario = publishResponses.shift();
        detailResponse = scenario.nextPost;
        listResponse = scenario.nextList;
        return createJsonResponse(scenario.body, { ok: scenario.ok, status: scenario.status });
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  await elements["publish-post"].click();
  await flushMicrotasks(4);
  assert.match(elements["editor-status"].textContent, /save the post before publishing/i);

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);

  await elements["revisions-list"].children[0].children[1].click();
  await flushMicrotasks(6);
  assert.match(elements["editor-status"].textContent, /unable to restore this revision right now|could not be found/i);

  await elements["publish-post"].click();
  await flushMicrotasks(10);
  assert.ok(
    fetchCalls.some(({ url, options }) => url === "/api/admin/posts/post-1/publish" && options.method === "POST"),
    "publish should post to the post publish endpoint",
  );
  const publishRequest = fetchCalls.find(({ url, options }) => url === "/api/admin/posts/post-1/publish" && options.method === "POST");
  assert.equal(publishRequest.options.headers["x-csrf-token"], "csrf-123");
  assert.match(elements["editor-status"].textContent, /publish accepted|deploy triggered/i);
  assert.match(elements["editor-status"].textContent, /revision history warning/i);

  await elements["publish-post"].click();
  await flushMicrotasks(10);
  assert.match(elements["editor-status"].textContent, /publish failed.*restored/i);

  await elements["publish-post"].click();
  await flushMicrotasks(10);
  assert.match(elements["editor-status"].textContent, /rollback needs attention/i);
});

test("admin inline script blocks selection changes during in-flight restore and publish actions", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "post-list": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  const postsById = {
    "post-1": {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      summary: "First summary",
      body_markdown: "# Hello",
      status: "draft",
      revisions: [
        {
          id: "revision-1",
          status: "draft",
          created_at: "2025-01-01T00:00:00.000Z",
          title: "First revision",
          summary: "First summary",
        },
      ],
    },
    "post-2": {
      id: "post-2",
      slug: "second-post",
      title: "Second Post",
      summary: "Second summary",
      body_markdown: "# Second",
      status: "draft",
      revisions: [],
    },
  };
  let listResponse = [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      summary: "First summary",
      status: "draft",
      updated_at: "2025-01-02T00:00:00.000Z",
      published_at: null,
      deleted_at: null,
    },
    {
      id: "post-2",
      slug: "second-post",
      title: "Second Post",
      summary: "Second summary",
      status: "draft",
      updated_at: "2025-01-01T00:00:00.000Z",
      published_at: null,
      deleted_at: null,
    },
  ];

  const restoreDeferred = createDeferred();
  const publishDeferred = createDeferred();

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ posts: listResponse });
      }

      if (url === "/api/admin/posts/post-1" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ post: postsById["post-1"] });
      }

      if (url === "/api/admin/posts/post-2" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ post: postsById["post-2"] });
      }

      if (url === "/api/admin/revisions/revision-1/restore" && options.method === "POST") {
        return restoreDeferred.promise;
      }

      if (url === "/api/admin/posts/post-2/publish" && options.method === "POST") {
        return publishDeferred.promise;
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);
  const restorePromise = elements["revisions-list"].children[0].children[1].click();
  await flushMicrotasks(4);

  assert.equal(elements["new-post"].disabled, true);
  assert.equal(elements["post-list"].children[1].disabled, true);
  await elements["post-list"].children[1].click();
  await flushMicrotasks(10);
  restoreDeferred.resolve(createJsonResponse({ ok: true, restored: true }));
  await restorePromise;
  await flushMicrotasks(10);

  assert.equal(elements.title.value, "Hello World");
  assert.equal(elements["revisions-list"].children.length, 1);

  await elements["post-list"].children[1].click();
  await flushMicrotasks(10);
  assert.equal(elements.title.value, "Second Post");
  assert.equal(elements["revisions-list"].textContent, "No revisions yet.");

  const publishPromise = elements["publish-post"].click();
  await flushMicrotasks(4);
  assert.equal(elements["new-post"].disabled, true);
  assert.equal(elements["post-list"].children[0].disabled, true);
  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);
  publishDeferred.resolve(createJsonResponse({ ok: true, publishState: "pending_deploy" }));
  await publishPromise;
  await flushMicrotasks(10);

  assert.equal(elements.title.value, "Second Post");
  assert.equal(elements["revisions-list"].textContent, "No revisions yet.");

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);
  assert.equal(elements.title.value, "Hello World");
  assert.equal(elements["revisions-list"].children.length, 1);
});

test("admin inline script prevents duplicate publish requests and resets on publish not found", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "post-list": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  let publishRequests = 0;
  let postListRequests = 0;
  const publishDeferred = createDeferred();

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        postListRequests += 1;
        return createJsonResponse({
          posts: postListRequests > 1
            ? []
            : [
                {
                  id: "post-1",
                  slug: "hello-world",
                  title: "Hello World",
                  summary: "First summary",
                  status: "draft",
                  updated_at: "2025-01-01T00:00:00.000Z",
                  published_at: null,
                  deleted_at: null,
                },
              ],
        });
      }

      if (url === "/api/admin/posts/post-1" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({
          post: {
            id: "post-1",
            slug: "hello-world",
            title: "Hello World",
            summary: "First summary",
            body_markdown: "# Hello",
            status: "draft",
            revisions: [],
          },
        });
      }

      if (url === "/api/admin/posts/post-1/publish" && options.method === "POST") {
        publishRequests += 1;
        if (publishRequests === 1) {
          return publishDeferred.promise;
        }

        throw new Error("duplicate publish request should not happen");
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);

  const firstPublish = elements["publish-post"].click();
  const secondPublish = elements["publish-post"].click();
  await flushMicrotasks(4);

  assert.equal(elements["publish-post"].disabled, true);
  assert.equal(publishRequests, 1);

  publishDeferred.resolve(createJsonResponse({ ok: false, error: "not_found" }, { ok: false, status: 404 }));
  await Promise.all([firstPublish, secondPublish]);
  await flushMicrotasks(10);

  assert.equal(elements["publish-post"].disabled, false);
  assert.equal(elements["post-list"].children.length, 0);
  assert.equal(elements.title.value, "");
  assert.match(elements["editor-status"].textContent, /could not be found/i);
});

test("admin inline script serializes mutating actions while publish is pending", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const script = extractInlineScript(html);

  const elements = {
    "login-shell": createFakeElement(),
    "workspace-shell": createFakeElement({ hidden: true }),
    "login-form": createFakeElement(),
    "login-status": createFakeElement(),
    "editor-status": createFakeElement(),
    "post-list": createFakeElement(),
    "new-post": createFakeElement({ tagName: "button" }),
    "save-post": createFakeElement({ tagName: "button" }),
    "delete-post": createFakeElement({ tagName: "button" }),
    "publish-post": createFakeElement({ tagName: "button" }),
    slug: createFakeElement({ value: "" }),
    title: createFakeElement({ value: "" }),
    summary: createFakeElement({ value: "" }),
    bodyMarkdown: createFakeElement({ value: "" }),
    password: createFakeElement({ value: "secret-password" }),
    "revisions-list": createFakeElement({ textContent: "Select or create a post to view history." }),
  };

  const fetchCalls = [];
  let detailResponse = {
    id: "post-1",
    slug: "hello-world",
    title: "Hello World",
    summary: "First summary",
    body_markdown: "# Hello",
    status: "draft",
    revisions: [
      {
        id: "revision-1",
        status: "draft",
        created_at: "2025-01-01T00:00:00.000Z",
        title: "First revision",
        summary: "First summary",
      },
    ],
  };
  let listResponse = [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      summary: "First summary",
      status: "draft",
      updated_at: "2025-01-01T00:00:00.000Z",
      published_at: null,
      deleted_at: null,
    },
  ];
  const publishDeferred = createDeferred();

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
      createElement(tagName) {
        return createFakeElement({ tagName });
      },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });

      if (url === "/api/admin/session") {
        return createJsonResponse({ authenticated: true });
      }

      if (url === "/api/admin/posts" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ posts: listResponse });
      }

      if (url === "/api/admin/posts/post-1" && (options.method ?? "GET") === "GET") {
        return createJsonResponse({ post: detailResponse });
      }

      if (url === "/api/admin/posts/post-1/publish" && options.method === "POST") {
        return publishDeferred.promise;
      }

      if (url === "/api/admin/posts/post-1" && options.method === "PUT") {
        throw new Error("save should not run while publish is pending");
      }

      if (url === "/api/admin/posts/post-1" && options.method === "DELETE") {
        throw new Error("delete should not run while publish is pending");
      }

      if (url === "/api/admin/revisions/revision-1/restore" && options.method === "POST") {
        throw new Error("restore should not run while publish is pending");
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
    console,
    setTimeout,
    clearTimeout,
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.fetch = context.fetch;
  context.window.console = console;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;

  vm.runInNewContext(script, context);
  await flushMicrotasks(10);

  await elements["post-list"].children[0].click();
  await flushMicrotasks(10);

  const restoreButton = elements["revisions-list"].children[0].children[1];
  const postSelectionButton = elements["post-list"].children[0];
  const publishPromise = elements["publish-post"].click();
  await flushMicrotasks(4);

  assert.equal(elements["new-post"].disabled, true);
  assert.equal(postSelectionButton.disabled, true);
  assert.equal(elements["save-post"].disabled, true);
  assert.equal(elements["delete-post"].disabled, true);
  assert.equal(elements["publish-post"].disabled, true);
  assert.equal(restoreButton.disabled, true);

  await elements["new-post"].click();
  await postSelectionButton.click();
  await elements["save-post"].click();
  await elements["delete-post"].click();
  await restoreButton.click();
  await flushMicrotasks(4);

  assert.deepEqual(
    fetchCalls
      .filter(({ options }) => ["PUT", "DELETE", "POST"].includes(options.method ?? "GET"))
      .map(({ url, options }) => [url, options.method]),
    [["/api/admin/posts/post-1/publish", "POST"]],
  );

  detailResponse = {
    ...detailResponse,
    status: "published",
    revisions: [
      {
        id: "revision-2",
        status: "published",
        created_at: "2025-01-02T00:00:00.000Z",
        title: "Published snapshot",
        summary: "Published summary",
      },
    ],
  };
  listResponse = [{ ...listResponse[0], status: "published" }];
  publishDeferred.resolve(createJsonResponse({ ok: true, publishState: "pending_deploy" }));
  await publishPromise;
  await flushMicrotasks(10);

  assert.equal(elements["new-post"].disabled, false);
  assert.equal(elements["post-list"].children[0].disabled, false);
  assert.equal(elements["save-post"].disabled, false);
  assert.equal(elements["delete-post"].disabled, false);
  assert.equal(elements["publish-post"].disabled, false);
  assert.equal(elements["revisions-list"].children[0].children[1].disabled, false);
});
