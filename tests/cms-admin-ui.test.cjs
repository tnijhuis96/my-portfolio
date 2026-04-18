const test = require("node:test");
const assert = require("node:assert/strict");

test("admin shell includes login form, editor pane, revision pane, and endpoint wiring", async () => {
  const { onRequestGet } = await import("../functions/admin/index.js");
  const response = await onRequestGet();
  const html = await response.text();
  const workspaceShellTag = html.match(/<section(?=[^>]*id="workspace-shell")[^>]*>/)?.[0];

  assert.equal(response.headers.get("cache-control"), "no-store");
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
  assert.match(
    html,
    /<\/main>\s*<script>\s*window\.CMS_ENDPOINTS\s*=/,
    "CMS endpoint script should be emitted after </main>",
  );
});
