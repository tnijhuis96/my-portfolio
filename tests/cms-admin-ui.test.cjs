const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function extractInlineScript(html) {
  return html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
}

function createFakeElement(initial = {}) {
  return {
    hidden: Boolean(initial.hidden),
    textContent: initial.textContent ?? "",
    value: initial.value ?? "",
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
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
  assert.match(html, /async function bootstrapSession\(/);
  assert.match(html, /fetch\(window\.CMS_ENDPOINTS\.session/);
  assert.match(html, /fetch\(window\.CMS_ENDPOINTS\.login/);
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
