# Cloudflare CMS Security Runbook

## Access boundary
- Cloudflare Access must protect both `/admin` and `/api/admin/*`.
- Restrict the Access policy to Thomas's identity.
- Access is the first gate only; the CMS still requires its own password login after Access succeeds.
- Protected requests should carry Cloudflare Access identity headers such as `cf-access-authenticated-user-email`.

## Required bindings and variables
- `CMS_DB` D1 binding
- `CMS_SESSION_SECRET`
- `CMS_PASSWORD_HASH`
- `PAGES_DEPLOY_HOOK_URL`
- `PAGES_DEPLOY_HOOK_SECRET` (recommended when the deploy hook is secret-backed; the deploy helper also accepts the legacy `DEPLOY_WEBHOOK_SECRET` fallback)

## Real admin flow
1. Open `/admin`.
2. Complete the Cloudflare Access challenge.
3. Confirm the CMS app still shows its own password form.
4. Sign in with the CMS password.
5. Let the app bootstrap `/api/admin/session`; it should switch from `authenticated: false` before login to `authenticated: true` after login.
6. Load the post list from `/api/admin/posts`.
7. Save a draft:
   - new post: `POST /api/admin/posts`
   - existing post: `PUT /api/admin/posts/:id`
8. Delete a post with `DELETE /api/admin/posts/:id`.
9. Restore a revision with `POST /api/admin/revisions/:id/restore`.
10. Publish with `POST /api/admin/posts/:id/publish`.

## Backend outcomes surfaced by the UI

### Session checks
- `GET /api/admin/session`
  - returns `{ "authenticated": false }` when the app session cookie is missing or expired
  - returns `{ "authenticated": true, "userId": "...", "csrfToken": "..." }` when the app session is valid
- The response is `Cache-Control: no-store`.

### Content mutations
- Save/create uses the existing posts routes and refreshes the editor with `Draft saved.` on success.
- Delete uses the existing post delete route and refreshes the list with `Post deleted.` on success.
- Restore rewrites the live post title, summary, markdown body, sanitized HTML, status, and `published_at` from the stored revision, then reloads the editor with `Revision restored.`

### Publish outcomes
- Successful publish returns `200` with `publishState: "pending_deploy"` and the UI shows `Publish accepted. Deploy triggered.`
- Failed deploy returns `502` with `publishState: "deploy_failed"`.
- If rollback succeeds, the UI shows `Publish failed and the previous state was restored.`
- If rollback also fails, the response also includes `rollbackState: "failed"` and the UI shows `Publish failed. Rollback needs attention.`

## Operator verification commands
- Run CMS tests: `npm run cms:test`
- Apply local CMS migrations: `npm run cms:migrate`
- Run the full verification path: `npm run cms:verify`
  - expects `GITHUB_USERNAME` to already be configured in the environment because the site build fetches GitHub projects data

## Operator verification checks
- Anonymous/incognito request to `/admin` is blocked by Cloudflare Access before the CMS login form is reachable.
- Anonymous/incognito request to `/api/admin/session` is blocked by Cloudflare Access for the same reason.
- After passing Access but before CMS login, `/api/admin/session` returns `authenticated: false`.
- After CMS login, `/api/admin/session` returns `authenticated: true` plus `userId` and `csrfToken`.
- Saving a draft creates or updates the post through the existing posts routes and the post list reloads.
- Deleting a post soft-deletes it through the existing delete route and removes it from the list after reload.
- Restoring a revision rewrites the current post from stored history and reloads the editor with the restored content.
- Publishing returns either `pending_deploy` or `deploy_failed`; investigate immediately if the UI reports rollback attention is needed.
