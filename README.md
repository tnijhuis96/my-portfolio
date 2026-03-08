# My Portfolio + Local CMS Documentation

## Quick navigation
- [MVP2 Status](#mvp2-status)
- [MVP Release Notes](#mvp-release-notes)
- [1) Project purpose](#1-project-purpose)
- [2) High-level architecture (how data flows)](#2-high-level-architecture-how-data-flows)
- [3) File-by-file documentation](#3-file-by-file-documentation)
- [4) Recommended onboarding path for a junior developer](#4-recommended-onboarding-path-for-a-junior-developer)
- [5) Practical notes](#5-practical-notes)
- [6) Local setup and quick start (new developer checklist)](#6-local-setup-and-quick-start-new-developer-checklist)
- [7) CMS API contract examples (important for frontend/backend work)](#7-cms-api-contract-examples-important-for-frontendbackend-work)
- [8) Backup and restore runbook](#8-backup-and-restore-runbook)
- [9) Troubleshooting guide](#9-troubleshooting-guide)
- [10) Maintenance and security checklist](#10-maintenance-and-security-checklist)
- [11) Command cheat sheet](#11-command-cheat-sheet)
- [12) Environment variable reference](#12-environment-variable-reference)
- [13) Current limitations and suggested next improvements](#13-current-limitations-and-suggested-next-improvements)

## MVP2 Status
MVP2 is complete as of `2026-03-08`.

To ensure consistency across models and sessions, MVP2 is governed by repository files (not chat history):

- Definition (source of truth): `docs/mvp2/definition.md`
- Machine-readable contract: `docs/mvp2/definition.json`
- Execution tracker: `docs/mvp2/tracker.md`
- Decision log (required for direction changes): `docs/mvp2/decisions.md`
- Agent guardrails: `AGENTS.md`

### MVP2 implementation outcomes (final)
- Tokenized visual system in `src/css/style.css` (colors, spacing, typography scale, shadows, motion).
- Public layout refresh: compact menu, skip-link, keyboard-close behavior, and responsive nav in `src/templates/layout.html`.
- Homepage tone/copy and hero hierarchy updated in `src/pages/index.html`.
- Projects cards redesigned with metadata and generated GitHub cards improved in `build.js`.
- Blog readability improvements: post description, formatted date, read-time, editorial content rhythm via `src/templates/post.html` and `build.js`.
- Separate admin design language completed in `admin/login.html` and `admin/blog-editor.html`.
- Accessibility baseline hardening: visible focus states, touch-target minimums, reduced-motion handling, live regions, keyboard interaction patterns.
- Verification completed with `npm run build`, `npm run admin`, and `npm run preview:dist`.

## MVP Release Notes
- Canonical index: `docs/releases/README.md`
- Template for new notes: `docs/releases/_template.md`

## 1) Project purpose
This repository contains:
- A static portfolio site generator (`build.js`)
- A local CMS backend (`adminServer.js`) to create/edit/publish blog posts
- Admin frontend pages (`admin/`) for login and blog management
- Local backup automation (`scripts/`) for post safety

The generated site output is written to `dist/`.

---

## 2) High-level architecture (how data flows)
1. You write posts in the CMS (`admin/blog-editor.html`) or directly in `content/posts/*.md`.
2. CMS routes in `adminServer.js` save markdown files into `content/posts`.
3. `build.js` reads markdown + frontmatter, converts markdown to HTML, and builds static pages into `dist/`.
4. `dist/` is what you serve locally (or deploy later).

---

## 3) File-by-file documentation

## Top-level files

### `.env`
**What it does**
- Stores real local environment values (secrets/config).

**Functions called in this file**
- None (configuration only).

---

### `.env.example`
**What it does**
- Template showing which environment variables are required.
- Safe to commit (contains placeholders, not secrets).

**Functions called in this file**
- None (configuration template only).

---

### `.gitignore`
**What it does**
- Prevents commit of generated output (`dist/`), local secrets (`.env`), dependencies (`node_modules/`), and IDE/log files.

**Functions called in this file**
- None.

---

### `about.html`
**What it does**
- Currently empty placeholder file.

**Functions called in this file**
- None.

---

### `build.js`
**What it does**
- Main static site build pipeline.
- Builds pages from templates, converts markdown posts, and generates projects page from GitHub API.

**Functions in this file (junior-friendly)**
- `validateProjectsEnvironment()`
  - Checks required project env vars (`GITHUB_USERNAME`) before fetching repos.
  - Warns if `GITHUB_TOKEN` is missing (build still works but with stricter API limits).

- `assertCanonicalPostSource()`
  - Prevents accidental use of old post location (`src/posts`).
  - Throws an error if markdown files exist there, so only `content/posts` is used.

- `applyLayout(layout, title, content, basePath = "")`
  - Injects page values into `layout.html` placeholders (`{{title}}`, `{{basePath}}`, `{{content}}`).
  - Used by all generated pages.

- `formatDate(dateValue)`
  - Formats dates into readable output (for example `Mar 8, 2026`).
  - Returns `Undated` for missing/invalid values.

- `estimateReadTime(markdownContent)`
  - Estimates reading duration from markdown word count.
  - Used in generated blog metadata.

- `fetchGitHubRepos()`
  - Calls GitHub API to fetch repositories for the configured user.
  - Filters out forks and sorts by latest activity.

- `build()`
  - Orchestrates the full build:
    1. Clears/recreates `dist/`
    2. Copies CSS
    3. Builds static pages from `src/pages`
    4. Converts published markdown posts to `dist/blog/*.html`
    5. Builds blog index page
    6. Builds projects page from GitHub data

- Global `fetch` fallback block
  - If Node runtime has no built-in `fetch`, dynamically loads `node-fetch`.

---

### `adminServer.js`
**What it does**
- Express server for local CMS on port `3001`.
- Handles authentication, post CRUD, publish/delete actions, build trigger, optional deploy trigger.

**Functions in this file (junior-friendly)**
- `validateServerEnvironment()`
  - Validates required runtime config (`SESSION_SECRET`, `CMS_PASSWORD_HASH`, and deploy-mode requirements).

- `ensureBuildEnvironment()`
  - Confirms `GITHUB_USERNAME` is present before running build from CMS actions.

- `runBuild()`
  - Executes `npm run build` and returns a Promise.
  - Rejects with build stderr/stdout details on failure.

- `runDeploy(operation, slug)`
  - Runs deploy logic based on `DEPLOY_MODE`:
    - `none`: no deploy
    - `command`: runs custom shell command
    - `webhook`: calls deploy webhook endpoint

- `runBuildAndRespond(res, { deploy, operation, slug })`
  - Shared helper: runs build, optionally deploys, then returns JSON response.

- `getClientIp(req)`
  - Resolves request IP (supports proxied header `x-forwarded-for`).

- `getRateLimitRecord(ipAddress)`
  - Returns/initializes in-memory login-attempt record for an IP.

- `registerFailedLogin(ipAddress)`
  - Increments failed attempts and sets lockout period when limit is reached.

- `clearLoginFailures(ipAddress)`
  - Clears failed-attempt tracking after successful login.

- `checkLoginRateLimit(req, res, next)`
  - Middleware: blocks login if lockout is active.

- `ensureCsrfToken(req)`
  - Creates/stores CSRF token in session if missing.

- `requireCsrf(req, res, next)`
  - Middleware: validates `x-csrf-token` header against session token.

- `requireAuth(req, res, next)`
  - Middleware: allows only authenticated sessions.

- `getAllPosts()`
  - Reads all markdown files in `content/posts` and returns summary metadata for the CMS list.

**Route handlers (calls being made)**
- `GET /csrf-token`
  - Calls `ensureCsrfToken`.
- `POST /login`
  - Calls `checkLoginRateLimit`, `requireCsrf`, `bcrypt.compare`, `registerFailedLogin`/`clearLoginFailures`.
- `POST /logout`
  - Calls `requireAuth`, `requireCsrf`, and destroys session.
- `GET /posts`
  - Calls `requireAuth`, `getAllPosts`.
- `GET /posts/:slug`
  - Calls `requireAuth`, reads one markdown file.
- `POST /save-post`
  - Calls `requireAuth`, `requireCsrf`, writes markdown, then `ensureBuildEnvironment` + `runBuildAndRespond`.
- `POST /publish/:slug`
  - Calls `requireAuth`, `requireCsrf`, updates frontmatter (`status`, `date`), then build/deploy flow.
- `DELETE /posts/:slug`
  - Calls `requireAuth`, `requireCsrf`, deletes markdown, then build/deploy flow.
- `GET /`
  - Redirects to `/admin` if logged in, otherwise serves login page.
- `GET /admin`
  - Requires authenticated session, serves editor page.

---

### `package.json`
**What it does**
- Defines dependencies and npm scripts.

**Important scripts**
- `build`: run static builder.
- `admin`: run CMS server.
- `preview`: build then serve `dist` locally.
- `preview:dist`: serve already-built `dist`.
- `backup:posts`: one-time backup of markdown posts.
- `backup:weekly:*`: cron-based weekly backup management.
- `backup:weekly:systemd:*`: systemd-timer weekly backup management (supports catch-up).
- `deploy`, `deploy:gh-pages`: deploy-oriented scripts.

**Functions called in this file**
- None (script config only).

---

### `package-lock.json`
**What it does**
- Locks exact dependency versions for reproducible installs.

**Functions called in this file**
- None.

---

## `admin/` folder

### `admin/login.html`
**What it does**
- Simple login UI for CMS.

**Functions in this file**
- `loadCsrfToken()`
  - Calls `/csrf-token` and stores token for secure POST login.

- `login()`
  - Reads password input, validates CSRF token presence, POSTs to `/login`, handles success/failure UI.

---

### `admin/blog-editor.html`
**What it does**
- CMS page to list, edit, save draft, publish, and delete blog posts.

**Functions in this file**
- `loadCsrfToken()`
  - Loads CSRF token from backend.

- `apiFetch(url, options = {})`
  - Wrapper around `fetch`.
  - Auto-attaches CSRF token for mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`).

- `loadPosts()`
  - Fetches `/posts`, renders list with status labels and action buttons.

- `editPost(slug)`
  - Fetches one post and fills editor form fields.

- `savePost()`
  - Sends draft payload to `/save-post`, shows response message, refreshes list.

- `publishPost()`
  - Calls `/publish/:slug`, shows response, refreshes list.

- `deletePost(slug)`
  - Confirms with user, calls delete endpoint, clears form if needed, refreshes list.

- `clearForm()`
  - Resets editor fields for creating a new post.

- `initAdmin()`
  - Startup function that loads token + posts when page opens.

---

## `content/` folder

### `content/posts/*.md`
Files currently in use:
- `first-post.md`
- `post-2.md`
- `fixed-the-cms-integration.md`
- `this-is-my-first-blog-post-via-my-own-blog-cms-system.md`

**What these files do**
- Store blog content in Markdown with frontmatter metadata.

**Frontmatter fields used by the build/CMS**
- `title`: shown on index + post page
- `description`: shown on blog index
- `date`: used for sorting newest-first
- `status`: only `published` posts are rendered into `dist/blog`
- `tags`: optional list metadata (stored and editable)

**Functions called in these files**
- None (content only).

---

## `src/` folder

### `src/pages/index.html`
**What it does**
- Homepage content fragment inserted into the shared layout.

**Functions called in this file**
- None.

---

### `src/pages/projects.html`
**What it does**
- Static projects content fragment.
- Note: build currently generates `dist/projects.html` dynamically from GitHub API, which can override this content.

**Functions called in this file**
- None.

---

### `src/templates/layout.html`
**What it does**
- Shared HTML shell for all pages.
- Placeholders replaced by `applyLayout()` in `build.js`.
- Contains UI-only navigation behavior for mobile menu toggle, Escape-to-close, and active-link (`aria-current`) detection.
- Includes global skip-link + main landmark structure used by generated pages.

**Functions called in this file**
- None directly (template consumed by `applyLayout`).

---

### `src/templates/post.html`
**What it does**
- Blog post content fragment template.
- Receives `{{title}}`, `{{description}}`, `{{date}}`, `{{readingTime}}`, and `{{content}}` from `build.js`.

**Functions called in this file**
- None directly.

---

### `src/css/style.css`
**What it does**
- Token-driven public design system and component styling.
- Includes responsive behavior for 480/768/1024/1280 breakpoints, skip-link/focus states, and reduced-motion fallback.

**Functions called in this file**
- None (CSS only).

---

### `src/posts/`
**What it does**
- Legacy/empty folder.
- Build enforces this folder should not contain markdown files (see `assertCanonicalPostSource`).

---

## `scripts/` folder

### `scripts/backup-posts.js`
**What it does**
- Creates a timestamped full copy of `content/posts` into `backups/posts-backup-YYYYMMDD-HHMMSS`.

**Functions in this file**
- `getTimestamp()`
  - Builds filesystem-safe timestamp string.

- `backupPosts()`
  - Checks source exists, creates backups folder, copies files recursively, prints backup path.

- top-level `try/catch`
  - Runs backup and exits with non-zero status when something fails.

---

### `scripts/weekly-backup-cron.js`
**What it does**
- Manages weekly cron entry for backups.
- Supports `install`, `remove`, `status`.

**Functions in this file**
- `hasCrontab()`
  - Checks if `crontab` exists on system.

- `readCrontab()`
  - Reads existing user crontab entries.

- `writeCrontab(content)`
  - Writes updated crontab content.

- `stripManagedEntries(content)`
  - Removes only this project’s managed cron line.

- `installWeeklyBackup()`
  - Installs/updates weekly backup cron command.

- `removeWeeklyBackup()`
  - Removes managed cron entry.

- `showStatus()`
  - Prints current managed cron entry if present.

- action dispatcher block
  - Routes CLI arg to `install/remove/status` and validates input.

---

### `scripts/weekly-backup-systemd.js`
**What it does**
- Manages weekly systemd user timer for backups with catch-up support (`Persistent=true`).
- Supports `install`, `remove`, `status`.

**Functions in this file**
- `run(command)`
  - Executes shell command and returns output.

- `ensureSystemdUserAvailable()`
  - Checks `systemctl` and user systemd session availability.

- `writeUnits()`
  - Writes service + timer unit files to `~/.config/systemd/user`.

- `installTimer()`
  - Reloads systemd user daemon and enables/starts timer.

- `removeTimer()`
  - Disables timer, removes unit files, reloads daemon.

- `timerStatus()`
  - Shows installed/enabled/active state and next scheduled run.

- action dispatcher block
  - Routes CLI arg to `install/remove/status` and validates input.

---

## Other folders/files

### `backups/`
- Stores generated backup snapshots created by `backup-posts.js`.
- Example: `backups/posts-backup-20260308-120724/`

### `dist/`
- Generated static site output (do not edit manually; regenerated by `npm run build`).
- Current key files:
  - `dist/index.html`
  - `dist/projects.html`
  - `dist/blog/*.html`
  - `dist/css/style.css`

### `images/`
- Intended static image assets folder (currently no listed files).

### `js/script.js`
- Empty placeholder JavaScript file (not currently used by build/layout).

### `.git/`
- Git metadata (internal, never edit manually).

### `node_modules/`
- Installed dependencies (generated by `npm install`, never edit manually).

---

## 4) Recommended onboarding path for a junior developer
1. Read `package.json` scripts first.
2. Read `build.js` to understand static generation pipeline.
3. Read `adminServer.js` to understand CMS API/security flow.
4. Open `admin/login.html` and `admin/blog-editor.html` to see client-side API calls.
5. Create a test post in `content/posts` and run:
   - `npm run build`
   - `npm run admin`
   - `npm run preview`
6. Review backup scripts in `scripts/` to understand reliability tooling.

---

## 5) Practical notes
- Canonical blog source is `content/posts`.
- `status: published` is required for blog output generation.
- Local mode currently uses `DEPLOY_MODE=none`.
- Weekly backup catch-up is handled through systemd user timer scripts.

---

## 6) Local setup and quick start (new developer checklist)
1. Install Node.js 18+ and npm.
2. Clone repository and install dependencies:
   - `npm install`
3. Create local env file:
   - `cp .env.example .env`
4. Fill required values in `.env`:
   - `GITHUB_USERNAME`
   - `SESSION_SECRET`
   - `CMS_PASSWORD_HASH`
5. Build and run:
   - `npm run build`
   - `npm run admin`
6. Open CMS:
   - `http://localhost:3001`
7. Open static site preview in another terminal:
   - `npm run preview:dist`

---

## 7) CMS API contract examples (important for frontend/backend work)

### Auth flow
1. `GET /csrf-token`
   - Response:
   ```json
   { "csrfToken": "<token>" }
   ```

2. `POST /login`
   - Headers:
     - `Content-Type: application/json`
     - `X-CSRF-Token: <token from /csrf-token>`
   - Body:
   ```json
   { "password": "your-password" }
   ```
   - Success response:
   ```json
   { "success": true }
   ```

### Post list
- `GET /posts`
  - Success response (example):
  ```json
  [
    {
      "slug": "first-post",
      "title": "My First Markdown Post",
      "date": "2026-01-10",
      "description": "Why I moved my blog to a custom static generator.",
      "status": "published"
    }
  ]
  ```

### Save draft
- `POST /save-post`
  - Headers:
    - `Content-Type: application/json`
    - `X-CSRF-Token: <token>`
  - Body:
  ```json
  {
    "slug": "optional-existing-slug",
    "title": "Post title",
    "description": "Short summary",
    "tags": "tag1,tag2",
    "content": "# Markdown content",
    "status": "draft"
  }
  ```
  - Success response (local mode):
  ```json
  {
    "success": true,
    "deploy": {
      "triggered": false,
      "mode": "none",
      "message": "Build completed locally."
    }
  }
  ```

### Publish post
- `POST /publish/:slug`
  - Headers:
    - `X-CSRF-Token: <token>`
  - Success response (example):
  ```json
  {
    "success": true,
    "deploy": {
      "triggered": false,
      "mode": "none",
      "message": "Local mode active: build completed, no deploy triggered."
    }
  }
  ```

### Delete post
- `DELETE /posts/:slug`
  - Headers:
    - `X-CSRF-Token: <token>`
  - Success response structure is same as publish/save.

### Common error responses
- `401`: unauthorized session
- `403`: invalid or missing CSRF token
- `404`: post slug not found
- `429`: too many login attempts
- `500`: build/deploy/config problem (`details` field usually included)

---

## 8) Backup and restore runbook

### Manual backup
- Run `npm run backup:posts`
- Output folder: `backups/posts-backup-YYYYMMDD-HHMMSS`

### Automatic weekly backup (recommended)
- Install: `npm run backup:weekly:systemd:install`
- Status: `npm run backup:weekly:systemd:status`
- Remove: `npm run backup:weekly:systemd:remove`

### Restore posts from backup
1. Stop CMS server if running.
2. Pick a backup folder from `backups/`.
3. Copy backup markdown files into `content/posts/`.
4. Run `npm run build`.
5. Restart CMS with `npm run admin`.

---

## 9) Troubleshooting guide

### Build fails with GitHub username error
- Symptom: error about missing `GITHUB_USERNAME`.
- Fix: set `GITHUB_USERNAME` in `.env`.

### CMS login always fails
- Symptom: invalid password for correct password.
- Fix: ensure `CMS_PASSWORD_HASH` is bcrypt hash and corresponds to your intended password.

### 403 Invalid CSRF token in admin UI
- Symptom: save/publish/delete blocked.
- Fix: refresh page to fetch a fresh token and retry.

### 429 Too many login attempts
- Symptom: temporary login lockout.
- Fix: wait for lockout window to expire.

### systemd timer not running
- Check: `npm run backup:weekly:systemd:status`
- If needed: reinstall timer with `npm run backup:weekly:systemd:install`.

### Post not visible on blog
- Check that post frontmatter has `status: published`.
- Rebuild site with `npm run build`.

---

## 10) Maintenance and security checklist
- Never commit `.env` to source control.
- Rotate `SESSION_SECRET` and CMS password hash if leaked.
- Keep dependencies updated (`npm outdated` / `npm update` as needed).
- Keep using `content/posts` as only markdown source.
- Verify backup status periodically (`npm run backup:weekly:systemd:status`).
- Test restore process occasionally to confirm backups are usable.

---

## 11) Command cheat sheet
- Install dependencies: `npm install`
- Build static site: `npm run build`
- Start CMS server: `npm run admin`
- Preview site (build + serve): `npm run preview`
- Preview existing `dist`: `npm run preview:dist`
- Manual post backup: `npm run backup:posts`
- Weekly timer install (catch-up): `npm run backup:weekly:systemd:install`
- Weekly timer status: `npm run backup:weekly:systemd:status`
- Weekly timer remove: `npm run backup:weekly:systemd:remove`

---

## 12) Environment variable reference

### Build and GitHub
- `GITHUB_USERNAME` (required)
  - GitHub username used to fetch repositories for projects page.
- `GITHUB_TOKEN` (optional)
  - Increases API rate limit and avoids frequent unauthenticated throttling.

### CMS security
- `SESSION_SECRET` (required)
  - Secret used to sign session cookies.
- `CMS_PASSWORD_HASH` (required)
  - Bcrypt hash for CMS login password.

### Deploy adapter
- `DEPLOY_MODE` (`none` | `command` | `webhook`)
  - Local-first setup should remain `none`.
- `AUTO_DEPLOY_ON_PUBLISH` (`true`/`false`)
  - If true, publish action attempts deploy.
- `AUTO_DEPLOY_ON_DELETE` (`true`/`false`)
  - If true, delete action attempts deploy.
- `DEPLOY_COMMAND` (required when `DEPLOY_MODE=command`)
  - Shell command to run deploy.
- `DEPLOY_WEBHOOK_URL` (required when `DEPLOY_MODE=webhook`)
  - Endpoint called to trigger deploy.
- `DEPLOY_WEBHOOK_METHOD` (`POST` | `PUT` | `PATCH`)
  - HTTP method used for webhook deploy.
- `DEPLOY_WEBHOOK_SECRET` (optional)
  - Secret sent as `x-deploy-secret` header.

### Backup scheduling
- `WEEKLY_BACKUP_CRON`
  - Cron expression used by cron installer script.
- `SYSTEMD_WEEKLY_BACKUP_ONCALENDAR`
  - systemd `OnCalendar` expression used by systemd timer script.

---

## 13) Current limitations and suggested next improvements
- `projects.html` source mismatch:
  - `src/pages/projects.html` exists, but final `dist/projects.html` is overwritten by GitHub API output during build.
- Local filesystem as CMS database:
  - Works well locally, but internet hosting will require persistent shared storage strategy.
- In-memory login limiter:
  - Rate limit state resets when server restarts.
- Minimal test coverage:
  - No automated tests yet; adding smoke tests for build and CMS routes would reduce regressions.
- Placeholder files:
  - `about.html` and `js/script.js` are currently empty and can be implemented or removed.
