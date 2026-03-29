# MVP6 Definition: CMS & Authoring UX

## Status
- Milestone: `MVP6`
- State: `completed`
- Last updated: `2026-03-28`

## Vision
Reduce friction in the writing cycle so content output can increase. All improvements stay local to the CMS and static build flow. No production-hosting changes are part of this milestone.

## In scope
- Live markdown preview in `admin/blog-editor.html` using a client-side parser
- Draft support with `status: draft` and explicit admin visibility
- Scheduled publish with `publishAt: YYYY-MM-DD` respected by `build.js`
- Tag autocomplete sourced from existing post tags
- External image URL assist with inline preview in the editor
- Backward-compatible handling for posts that do not yet contain MVP6 frontmatter fields

## Out of scope
- New production infrastructure or runtime services
- Public API contract changes
- Server-side rendering for preview
- Asset upload pipeline or image hosting
- Changes to public URL structure

## Locked decisions
1. Publish model: schedule-aware. Published posts are visible only when `publishAt` is empty or not in the future.
2. Admin information architecture: drafts and scheduled posts appear outside the main published list.
3. Live preview rendering: client-side markdown parsing in the editor.
4. Tag suggestions: fetched from an authenticated admin endpoint.
5. External image support: basic `http`/`https` URL validation only.
6. Legacy compatibility: missing `status` defaults to `published`; missing `publishAt` means no schedule gate.
7. Scheduled date interpretation: compare against the local build-machine date.

## Work items

### W1 — Create MVP6 governance files
- Add `docs/mvp6/definition.md`, `docs/mvp6/tracker.md`, and `docs/mvp6/decisions.md`
- Add MVP6 draft release notes and release-index entry
- Update `AGENTS.md` with MVP6 guardrails

### W2 — Extend admin post metadata model
- Add `status` and `publishAt` support to post read and save flows in `adminServer.js`
- Preserve backward compatibility for legacy posts
- Normalize tags as arrays instead of raw string interpolation

### W3 — Add authenticated tag-autocomplete endpoint
- Aggregate unique tags from `content/posts/*.md`
- Return normalized suggestions to the admin UI

### W4 — Add local markdown preview asset path
- Serve the local `marked` browser bundle to the admin page
- Keep preview parser local; no CDN dependency

### W5 — Rebuild `admin/blog-editor.html` for authoring workflow
- Split published content and drafts/scheduled content into separate lists
- Add post metadata controls: title, description, tags, status, `publishAt`
- Add split editor/preview workspace

### W6 — Add live preview behavior
- Render markdown on input change with debounced updates
- Reflect title, description, and content in preview pane

### W7 — Add tag autocomplete UX
- Suggest existing tags while typing the current tag fragment
- Support click and keyboard selection
- Prevent obvious duplicate tags in the field

### W8 — Add external image URL assist
- Validate `http`/`https` URL format in the editor
- Show inline image preview
- Provide insertion helper for markdown image syntax

### W9 — Improve save and publish semantics
- Save respects selected status and optional schedule date
- Publish Now can force immediate publication even if a future schedule was set
- Editing an existing post preserves existing frontmatter where appropriate

### W10 — Respect drafts and scheduling in `build.js`
- Exclude drafts from generated public output
- Exclude future-scheduled posts from generated public output
- Keep eligible published posts in pagination, tag pages, RSS, and sitemap

### W11 — Verification
- `npm run build`
- `npm run admin`
- `npm run preview:dist`
- Manual checks for draft visibility, schedule gating, autocomplete, image preview, and live preview

## Definition of done
- Admin UI shows separate published and draft/scheduled lists
- Editor has live markdown preview and image preview assist
- Tag autocomplete is sourced from existing post data
- Drafts are excluded from public output
- Future-scheduled posts are excluded from public output until eligible
- Legacy posts without MVP6 fields continue to render and remain editable
- Tracker and release-note stub are updated consistently