# MVP6 Decisions

## Decision log

| # | Date       | Decision | Rationale |
|---|------------|----------|-----------|
| 1 | 2026-03-28 | Publishing is schedule-aware | A post with `status: published` stays out of public output when `publishAt` is in the future, which makes scheduling usable without extra toggles. |
| 2 | 2026-03-28 | Admin separates published content from drafts and scheduled work | Writing-in-progress should be easier to scan without mixing unfinished items into the main published list. |
| 3 | 2026-03-28 | Live preview uses a client-side parser | Keeps preview responsive and local without adding a server render round-trip. |
| 4 | 2026-03-28 | Tag autocomplete is served by an authenticated admin endpoint | Suggestions stay aligned with repository content and avoid stale embedded lists. |
| 5 | 2026-03-28 | External image URLs use basic `http`/`https` validation only | This keeps scope focused on authoring ergonomics without introducing upload or remote MIME inspection complexity. |
| 6 | 2026-03-28 | Missing legacy `status` defaults to `published` | Existing content must not disappear from admin or build output when new fields are introduced. |
| 7 | 2026-03-28 | `publishAt` is interpreted against the local machine date at build time | The site is built locally today, so using local date semantics is the most predictable behavior for this milestone. |