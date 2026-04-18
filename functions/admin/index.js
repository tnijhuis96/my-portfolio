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
        session: null,
        activePostId: null,
        posts: []
      };

      const EMPTY_REVISIONS_MESSAGE = "Select or create a post to view history.";
      const loginShell = document.getElementById("login-shell");
      const workspaceShell = document.getElementById("workspace-shell");
      const loginForm = document.getElementById("login-form");
      const loginStatus = document.getElementById("login-status");
      const editorStatus = document.getElementById("editor-status");
      const passwordInput = document.getElementById("password");
      const newPostButton = document.getElementById("new-post");
      const postList = document.getElementById("post-list");
      const slugInput = document.getElementById("slug");
      const titleInput = document.getElementById("title");
      const summaryInput = document.getElementById("summary");
      const bodyMarkdownInput = document.getElementById("bodyMarkdown");
      const savePostButton = document.getElementById("save-post");
      const deletePostButton = document.getElementById("delete-post");
      const revisionsList = document.getElementById("revisions-list");

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

      function parseRetryAfterSeconds(value) {
        const seconds = Number.parseInt(value || "", 10);
        return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
      }

      function getLoginFailureMessage(response, result) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfterSeconds(response.headers?.get("retry-after"));
          if (retryAfter) {
            return "Too many login attempts. Try again in "
              + retryAfter
              + " second"
              + (retryAfter === 1 ? "" : "s")
              + ".";
          }

          return "Too many login attempts. Try again shortly.";
        }

        if (result?.error === "invalid_credentials") {
          return "Incorrect password. Try again.";
        }

        return "Unable to sign in right now.";
      }

      function getEditorPayload() {
        return {
          slug: slugInput.value.trim(),
          title: titleInput.value.trim(),
          summary: summaryInput.value.trim(),
          bodyMarkdown: bodyMarkdownInput.value.trim(),
          status: "draft"
        };
      }

      function resetEditor() {
        state.activePostId = null;
        slugInput.value = "";
        titleInput.value = "";
        summaryInput.value = "";
        bodyMarkdownInput.value = "";
        editorStatus.textContent = "";
        revisionsList.textContent = EMPTY_REVISIONS_MESSAGE;
      }

      function getEditorFailureMessage(result, fallbackMessage) {
        if (result?.error === "required_field") {
          const fields = Array.isArray(result.fields) && result.fields.length
            ? result.fields.join(", ")
            : "all required fields";
          return "Complete the required fields: " + fields + ".";
        }

        if (result?.error === "duplicate_slug") {
          return "This slug is already in use. Choose a different slug.";
        }

        if (result?.error === "not_found") {
          return "This post could not be found.";
        }

        return fallbackMessage;
      }

      function renderPostList() {
        const buttons = state.posts.map((post) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = post.title || post.slug || "Untitled draft";
          button.addEventListener("click", () => loadPost(post.id));
          return button;
        });

        postList.replaceChildren(...buttons);
      }

      async function readJsonBody(response) {
        const contentType = response.headers?.get("content-type") || "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return null;
        }

        try {
          return await response.json();
        } catch {
          return null;
        }
      }

      async function loadPosts() {
        try {
          const response = await fetch(window.CMS_ENDPOINTS.posts, {
            method: "GET",
            credentials: "same-origin",
            headers: {
              accept: "application/json"
            }
          });
          const result = await readJsonBody(response);

          if (!response.ok) {
            editorStatus.textContent = "Unable to load posts right now.";
            return [];
          }

          state.posts = Array.isArray(result?.posts) ? result.posts : [];
          renderPostList();
          return state.posts;
        } catch {
          editorStatus.textContent = "Unable to load posts right now.";
          return [];
        }
      }

      async function loadPost(id, options = {}) {
        editorStatus.textContent = "Loading post...";

        try {
          const response = await fetch(window.CMS_ENDPOINTS.posts + "/" + encodeURIComponent(id), {
            method: "GET",
            credentials: "same-origin",
            headers: {
              accept: "application/json"
            }
          });
          const result = await readJsonBody(response);

          if (!response.ok || !result?.post) {
            if (result?.error === "not_found") {
              await loadPosts();
              resetEditor();
              editorStatus.textContent = "This post could not be found.";
              return null;
            }

            editorStatus.textContent = "Unable to load this post right now.";
            return null;
          }

          state.activePostId = result.post.id;
          slugInput.value = result.post.slug || "";
          titleInput.value = result.post.title || "";
          summaryInput.value = result.post.summary || "";
          bodyMarkdownInput.value = result.post.bodyMarkdown || "";
          revisionsList.textContent = EMPTY_REVISIONS_MESSAGE;
          editorStatus.textContent = options.statusMessage || "";
          return result.post;
        } catch {
          editorStatus.textContent = "Unable to load this post right now.";
          return null;
        }
      }

      async function savePost() {
        const payload = getEditorPayload();
        const isUpdate = Boolean(state.activePostId);
        const method = isUpdate ? "PUT" : "POST";
        const url = isUpdate
          ? window.CMS_ENDPOINTS.posts + "/" + encodeURIComponent(state.activePostId)
          : window.CMS_ENDPOINTS.posts;

        editorStatus.textContent = "Saving draft...";

        try {
          const response = await fetch(url, {
            method,
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
              accept: "application/json"
            },
            body: JSON.stringify(payload)
          });
          const result = await readJsonBody(response);

          if (!response.ok) {
            if (result?.error === "not_found") {
              await loadPosts();
              resetEditor();
            }

            editorStatus.textContent = getEditorFailureMessage(result, "Unable to save this post right now.");
            return;
          }

          const postId = isUpdate ? state.activePostId : result?.post?.id;
          await loadPosts();

          if (postId) {
            await loadPost(postId, { statusMessage: "Draft saved." });
            return;
          }

          editorStatus.textContent = "Draft saved.";
        } catch {
          editorStatus.textContent = "Unable to save this post right now.";
        }
      }

      async function deletePost() {
        if (!state.activePostId) {
          editorStatus.textContent = "Select a post before deleting it.";
          return;
        }

        editorStatus.textContent = "Deleting post...";

        try {
          const response = await fetch(window.CMS_ENDPOINTS.posts + "/" + encodeURIComponent(state.activePostId), {
            method: "DELETE",
            credentials: "same-origin",
            headers: {
              accept: "application/json"
            }
          });
          const result = await readJsonBody(response);

          if (!response.ok) {
            if (result?.error === "not_found") {
              await loadPosts();
              resetEditor();
            }

            editorStatus.textContent = getEditorFailureMessage(result, "Unable to delete this post right now.");
            return;
          }

          resetEditor();
          await loadPosts();
          editorStatus.textContent = "Post deleted.";
        } catch {
          editorStatus.textContent = "Unable to delete this post right now.";
        }
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
            await loadPosts();
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
          const result = await readJsonBody(response);

          if (!response.ok) {
            showLogin(getLoginFailureMessage(response, result));
            return;
          }

          if (!result?.ok || !result.authenticated) {
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
      newPostButton.addEventListener("click", resetEditor);
      savePostButton.addEventListener("click", savePost);
      deletePostButton.addEventListener("click", deletePost);
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
