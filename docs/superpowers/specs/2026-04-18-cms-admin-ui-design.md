# Cloudflare CMS Admin UI Design

## Goal

Turn the protected `/admin` route into a usable one-admin CMS shell for the existing Cloudflare-native backend: login, post selection, markdown editing, revision restore visibility, save, and publish.

## Scope

This design only covers the admin UI shell and its browser-side behavior. It assumes the existing backend routes already exist for:

- session lookup
- login/logout
- post create/update/delete/read/list
- publish + deploy trigger
- revision restore

It does not introduce a separate frontend app, a framework runtime, live preview, autosave, or any new backend contracts.

## Chosen direction

### Layout

The admin UI will use a **split workspace**:

1. **Left rail:** post list and “new post” action
2. **Center pane:** markdown editor form
3. **Right rail:** revision drawer for the currently selected post

This was chosen over a pure writing-focused single pane and over a dashboard-style stacked layout because it keeps navigation visible while preserving direct editing focus.

### Editing behavior

- **Manual save only**
- No autosave while typing
- Clicking a post in the left list immediately loads it into the center editor
- Revisions are visible beside the editor rather than hidden behind a modal

### Implementation style

The admin route stays **server-rendered with a small inline script**. The page is HTML-first and uses lightweight browser-side fetch/state coordination only.

## Architecture

`functions/admin/index.js` will return a complete HTML page containing:

- a login form shell
- the three-column admin layout
- a small inline script that drives authentication state, list loading, editor population, revision loading, and button actions

No additional frontend bundle or app shell is introduced. This keeps the admin aligned with the rest of the Pages Functions implementation and avoids creating a second frontend architecture just for the CMS.

The script will use the existing backend routes:

- `GET /api/admin/session`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/posts`
- `POST /api/admin/posts`
- `GET /api/admin/posts/:id`
- `PUT /api/admin/posts/:id`
- `DELETE /api/admin/posts/:id`
- `POST /api/admin/posts/:id/publish`
- `POST /api/admin/revisions/:id/restore`

## UI structure

### 1. Login state

On initial load, the script calls `GET /api/admin/session`.

- If unauthenticated, the login form is visible and the workspace remains hidden.
- If authenticated, the login form is hidden and the workspace is shown.

The login form only needs a password field and submit button because Cloudflare Access is already the outer gate.

### 2. Left rail: post list

The left rail shows:

- a “new post” action
- a compact list of posts from `GET /api/admin/posts`
- post title
- post status

Selecting a post loads that post into the editor pane. Creating a new post clears the editor into a draft-ready state.

The left rail does not need advanced filtering, search, or pagination in this phase.

### 3. Center pane: editor

The editor pane contains:

- `slug`
- `title`
- `summary`
- `bodyMarkdown`
- `Save draft` button
- `Delete` button
- `Publish` button
- inline status/message region

Saving a new post creates it through `POST /api/admin/posts`.
Saving an existing post updates it through `PUT /api/admin/posts/:id`.

Typing alone never writes data. All persistence is driven by explicit button actions.

### 4. Right rail: revisions

The right rail shows revision history for the active post only.

- If no post is selected, it shows an empty state.
- If a post is selected, it renders revision entries with enough metadata to make restore decisions clear.
- Each revision can trigger restore through `POST /api/admin/revisions/:id/restore`.

The revision rail is visible by default rather than hidden behind a secondary interaction.

## Data flow

### Initial load

1. Request session state
2. If authenticated, load post list
3. Render either blank draft state or selected post state

### Selecting a post

1. Fetch `GET /api/admin/posts/:id`
2. Populate center editor fields
3. Load matching revisions into right rail

### Creating a post

1. Read form values
2. Submit `POST /api/admin/posts`
3. Replace form state with returned saved post
4. Refresh post list

### Updating a post

1. Read form values
2. Submit `PUT /api/admin/posts/:id`
3. Refresh current post state if needed
4. Refresh revisions and post list

### Deleting a post

1. Submit `DELETE /api/admin/posts/:id`
2. Clear editor to empty draft state
3. Clear revision rail
4. Refresh post list

### Publishing a post

1. Submit `POST /api/admin/posts/:id/publish`
2. Keep the editor on the same post
3. Surface publish result exactly as returned by backend:
   - success: deploy triggered / pending deploy
   - deploy failed: publish failed and state restored
   - rollback failed: show explicit warning
4. Refresh current post state and list after response

### Restoring a revision

1. Submit `POST /api/admin/revisions/:id/restore`
2. Reload the active post into the editor
3. Refresh revision rail
4. Refresh post list

## Error handling

The UI should treat the API as authoritative and display outcomes directly.

### Authentication

- Invalid or missing session: show login form
- Login failure: show inline error near password form

### Editor actions

- Invalid JSON is not expected from the browser shell itself, but network/action failures should still surface as inline errors
- Validation errors such as required fields and duplicate slug should render as inline status messages in the editor pane

### Publish

Publish handling must preserve backend truth:

- `pending_deploy` means the deploy hook was accepted
- `deploy_failed` means the attempted publish was rolled back
- explicit rollback failure signaling must be shown as a higher-severity warning

The UI must not invent optimistic “published” states beyond what the backend returns.

## Testing

Task 4 should add `tests/cms-admin-ui.test.cjs` and verify the admin shell contract rather than pixel-level markup.

The test should assert the rendered page includes:

- the login form
- the markdown editor textarea
- the revision area
- endpoint wiring for session/login/posts
- no-store behavior on the admin HTML response

This keeps the test stable while still proving the admin shell is real and wired to the current backend.

## Out of scope

This phase does not add:

- live markdown preview
- autosave
- tags UI
- search/filter UI for posts
- image uploads
- a standalone frontend application
- keyboard shortcuts
- drag-and-drop interactions

## Implementation notes

- Keep the page simple and legible rather than highly styled
- Favor straightforward DOM updates over abstraction-heavy client code
- Reuse existing API response shapes rather than reshaping the backend for the UI
- Keep the admin shell honest to the one-admin workflow already chosen for the project
