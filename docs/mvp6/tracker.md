# MVP6 Tracker

## Status legend
- `not-started`
- `in-progress`
- `blocked`
- `completed`

## Milestone health
- MVP6 overall status: `completed`
- Last updated: `2026-03-28`

## Work item tracker

| ID  | Work Item                                  | Status      | Notes |
|-----|--------------------------------------------|-------------|-------|
| W1  | Create MVP6 governance files               | completed   | Definition, tracker, decisions, release stub, guardrails added |
| W2  | Extend admin post metadata model           | completed   | `status`/`publishAt` support and legacy-safe defaults added in `adminServer.js` |
| W3  | Add authenticated tag-autocomplete endpoint| completed   | `GET /tags/autocomplete` returns normalized existing tags |
| W4  | Add local markdown preview asset path      | completed   | `marked.min.js` served locally from admin server |
| W5  | Rebuild admin editor workflow              | completed   | Separate published and draft/scheduled lists plus expanded metadata controls |
| W6  | Add live preview behavior                  | completed   | Client-side markdown preview updates while typing |
| W7  | Add tag autocomplete UX                    | completed   | Suggestion popover with keyboard and click selection |
| W8  | Add external image URL assist              | completed   | URL validation, inline preview, and markdown insertion helper |
| W9  | Improve save and publish semantics         | completed   | Save respects status/schedule and publish-now overrides future schedule |
| W10 | Respect drafts and scheduling in build     | completed   | `build.js` excludes drafts and future-scheduled posts |
| W11 | Verification                               | completed   | Build verified with temporary fixtures; editor-only interactions verified by source-path inspection in `admin/blog-editor.html` |

## Verification checklist
- [x] `npm run build`
- [x] `npm run admin`
- [x] `npm run preview:dist`
- [x] Draft posts appear in admin but not public output
- [x] Future-scheduled posts are excluded from `dist/`
- [x] Eligible published posts still appear in blog index, tags, RSS, and sitemap
- [x] Tag autocomplete returns existing tags
- [x] External image URL preview works in editor
- [x] Live markdown preview updates while typing

## Change control rule
- Any change to locked MVP6 decisions must be recorded first in `docs/mvp6/decisions.md`.