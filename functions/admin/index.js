export async function onRequestGet() {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>CMS Admin</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { margin: 0; }
      .layout { display: grid; grid-template-columns: 18rem minmax(0, 1fr) 16rem; min-height: 100vh; }
      .pane { padding: 1rem; border-right: 1px solid #d0d7de; }
      .pane:last-child { border-right: 0; }
      .stack { display: grid; gap: 0.75rem; }
      input, textarea, button, select { width: 100%; box-sizing: border-box; }
      textarea { min-height: 18rem; resize: vertical; }
      [hidden] { display: none !important; }
      .status { min-height: 1.5rem; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <main>
      <section id="login-shell" class="stack">
        <h1>CMS Admin</h1>
        <form id="login-form" class="stack">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password">
          <button type="submit">Log in</button>
          <p id="login-status" class="status" aria-live="polite"></p>
        </form>
      </section>

      <section id="workspace-shell" class="layout" hidden>
        <aside id="post-list-pane" class="pane stack">
          <button id="new-post" type="button">New post</button>
          <div id="post-list" class="stack"></div>
        </aside>

        <section id="editor-pane" class="pane stack">
          <div class="stack">
            <label for="slug">Slug</label>
            <input id="slug" name="slug">
            <label for="title">Title</label>
            <input id="title" name="title">
            <label for="summary">Summary</label>
            <textarea id="summary" name="summary"></textarea>
            <label for="bodyMarkdown">Body</label>
            <textarea id="bodyMarkdown" name="bodyMarkdown"></textarea>
          </div>
          <div style="display:flex;gap:0.75rem">
            <button id="save-post" type="button">Save draft</button>
            <button id="delete-post" type="button">Delete</button>
            <button id="publish-post" type="button">Publish</button>
          </div>
          <p id="editor-status" class="status" aria-live="polite"></p>
        </section>

        <aside id="revisions-pane" class="pane stack">
          <h2>Revisions</h2>
          <div id="revisions-list">Select or create a post to view history.</div>
        </aside>
      </section>

    </main>
    <script>
      window.CMS_ENDPOINTS = {
        session: "/api/admin/session",
        login: "/api/admin/login",
        logout: "/api/admin/logout",
        posts: "/api/admin/posts"
      };

      const state = {
        session: null
      };

      const loginShell = document.getElementById("login-shell");
      const workspaceShell = document.getElementById("workspace-shell");
      const loginForm = document.getElementById("login-form");
      const loginStatus = document.getElementById("login-status");
      const editorStatus = document.getElementById("editor-status");
      const passwordInput = document.getElementById("password");

      function showLogin(message = "") {
        state.session = null;
        loginShell.hidden = false;
        workspaceShell.hidden = true;
        loginStatus.textContent = message;
        editorStatus.textContent = "";
      }

      function showWorkspace(message = "") {
        loginShell.hidden = true;
        workspaceShell.hidden = false;
        loginStatus.textContent = "";
        editorStatus.textContent = message;
      }

      async function bootstrapSession(message) {
        try {
          const response = await fetch(window.CMS_ENDPOINTS.session, {
            method: "GET",
            credentials: "same-origin",
            headers: {
              accept: "application/json"
            }
          });
          const session = await response.json();
          state.session = session;

          if (session.authenticated) {
            showWorkspace(message || "Signed in.");
            return;
          }

          showLogin(message || "Please log in.");
        } catch {
          showLogin("Unable to verify the current session.");
        }
      }

      async function handleLogin(event) {
        event.preventDefault();
        loginStatus.textContent = "Signing in...";

        try {
          const response = await fetch(window.CMS_ENDPOINTS.login, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
              accept: "application/json"
            },
            body: JSON.stringify({
              password: passwordInput.value
            })
          });
          const result = await response.json();

          if (!response.ok || !result.ok || !result.authenticated) {
            showLogin("Incorrect password. Try again.");
            return;
          }

          passwordInput.value = "";
          await bootstrapSession("Signed in.");
        } catch {
          showLogin("Unable to sign in right now.");
        }
      }

      loginForm.addEventListener("submit", handleLogin);
      bootstrapSession();
    </script>
  </body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
