const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function extractInlineScript(html) {
  return html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
}

function createFakeElement(initial = {}) {
  return {
    tagName: initial.tagName ?? "div",
    hidden: Boolean(initial.hidden),
    textContent: initial.textContent ?? "",
    value: initial.value ?? "",
    disabled: Boolean(initial.disabled),
    children: initial.children ? [...initial.children] : [],
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...children) {
      this.children = children;
      return children[children.length - 1] ?? null;
    },
    click() {
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
  assert.match(html, /async function bootstrapSession\(/);
  assert.match(html, /async function loadPosts\(/);
  assert.match(html, /async function savePost\(/);
  assert.match(html, /async function deletePost\(/);
  assert.match(html, /fetch\(window\.CMS_ENDPOINTS\.session/);
  assert.match(html, /fetch\(window\.CMS_ENDPOINTS\.login/);
  assert.match(html, /fetch\(window\.CMS_ENDPOINTS\.posts/);
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
    bodyMarkdown: "# Hello",
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
        return createJsonResponse({ authenticated: true });
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
        return createJsonResponse({ ok: true });
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
  assert.deepEqual(JSON.parse(saveRequest.options.body), {
    slug: "hello-world",
    title: "Updated Title",
    summary: "First summary",
    bodyMarkdown: "# Hello",
    status: "draft",
  });
  assert.match(elements["editor-status"].textContent, /saved/i);
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
  assert.equal(elements["post-list"].children.length, 0);
  assert.equal(elements.slug.value, "");
  assert.match(elements["editor-status"].textContent, /deleted/i);
});
