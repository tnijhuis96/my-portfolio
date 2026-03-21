# MVP5 Decisions

## Decision log

| #  | Date       | Decision | Rationale |
|----|------------|----------|-----------|
| 1  | 2026-03-20 | Search nav placement: icon-only SVG button, no text label | Saves nav space; consistent with common design patterns. Use `aria-label="Search"` for accessibility. |
| 2  | 2026-03-20 | `/now` page: URL-only, no main nav link | Keeps the primary nav focused; `/now` is a supplementary page referenced from content/footer. |
| 3  | 2026-03-20 | `POSTS_PER_PAGE` default: 5 | Gives immediate pagination visibility with 8 current posts; easily overridden via env var. |
| 4  | 2026-03-20 | Tag pills shown on blog index teaser cards | Readers can filter by topic from the index without clicking into each post. |
| 5  | 2026-03-20 | Tag URL structure: `/tags/{slug}/` with trailing-slash index.html | Consistent with `/blog/` pattern; avoids redirect chains on Cloudflare Pages. |
| 6  | 2026-03-20 | Paginated blog URLs: `/blog/` (page 1), `/blog/page/2/` (page 2+) | Page 1 stays at the canonical `/blog/` URL; pagination is discoverable and SEO-safe. |
| 7  | 2026-03-20 | Blog teaser links switch to absolute `post.url` | Relative slugs break from nested pagination paths (`/blog/page/2/`). Absolute URLs are depth-safe. |
| 8  | 2026-03-20 | Pagefind as devDependency, self-hosted | No CDN dependency; output stays fully static; free. |
| 9  | 2026-03-20 | Tag slugification: lowercase → spaces→hyphens → strip non-`[a-z0-9-]` | Simple, deterministic, URL-safe; matches blog post slug pattern. |
| 10 | 2026-03-20 | No new runtime dependencies | `pagefind` runs only at build time and produces static assets. |
