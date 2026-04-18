const test = require("node:test");
const assert = require("node:assert/strict");

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
