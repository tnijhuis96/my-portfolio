# MVP5 Definition: Interactive Features & Search

## Status
- Milestone: `MVP5`
- State: `completed`
- Last updated: `2026-03-20`

## Vision
Let readers find content by topic and keyword, and give the site a richer feel beyond the blog and projects pages. All output is 100% static — no new runtime infrastructure.

## In scope
- Pagefind static full-text search: post-build step, UI at `/search.html`, index in `dist/pagefind/`
- Tag system: `tags` frontmatter array → `/tags/[slug]/` index pages generated at build time + `/tags/` all-tags overview
- Blog pagination: configurable `POSTS_PER_PAGE` (default 5) in `build.js`, page 2+ at `/blog/page/{n}/`
- `/now` page: manually authored `src/pages/now.html`, built into `dist/now.html`
- Search icon button (SVG, no label) added to nav bar linking to `/search.html`
- Tag pills added to post pages and blog index teaser cards
- Sitemap extended with `/now.html`, `/search.html`, `/tags/`, tag slugs, paginated blog URLs

## Out of scope
- Server-side or dynamic search
- Tag autocomplete in the CMS editor (MVP6 scope)
- RSS feed per tag
- Draft post filtering (MVP6 scope)
- CMS integration for the /now page
- og:image on any new pages

## Locked decisions
1. Search nav placement: icon-only SVG magnifying glass button (no text label), 44px min touch target
2. `/now` page: URL-only access — no main nav link
3. `POSTS_PER_PAGE` default: 5 (configurable via `process.env.POSTS_PER_PAGE`)
4. Tag pills shown on blog index teaser cards as well as post pages
5. Tag URL structure: `/tags/{slug}/` with trailing slash (index.html pattern)
6. Paginated blog URLs: `/blog/` (page 1), `/blog/page/2/` (page 2+)
7. Blog teaser post links: use absolute `post.url` — required so links work from nested pagination paths
8. Pagefind: added as `devDependency`, self-hosted from `dist/pagefind/`, no CDN
9. Tag slugification: `tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`
10. No new runtime dependencies — `pagefind` as devDependency only

## Work items

### W1 — Create `src/pages/now.html`
- Manually authored page: current learning focus, projects in flight, useful links
- Picked up automatically by the existing `pages.forEach` loop
- Add `/now.html` to `staticUrls` array in sitemap block of `build.js`

### W2 — Add `slugify()` utility to `build.js`
- Pure function: lowercase → spaces→hyphens → strip non-`[a-z0-9-]`
- Used by tag map generation and tag URL construction

### W3 — Extract tags during post loop in `build.js`
- Read `data.tags` from frontmatter (default `[]`)
- Add `tags` (string[]) and `tagSlugs` (string[]) to each `postsMeta.push({...})`
- Accumulate `tagMap: { [slug]: { label: string, posts: PostMeta[] } }` after the loop

### W4 — Add `{{tags}}` placeholder to `src/templates/post.html`
- Insert `{{tags}}` after the `.blog-post-meta` div and before `.blog-post-content`

### W5 — Render tag pills on post pages
- Build `<div class="post-tags">` with `<a class="tag-pill">` per tag
- Inject into `{{tags}}` before writing post HTML
- Empty string when no tags

### W6 — Add tag pills to blog index teasers
- Append tag pill row to each teaser card HTML in `build.js` blog index generation

### W7 — Generate tag pages
- After blog index: loop `tagMap`:
  - `dist/tags/{slug}/index.html` — post list for that tag, basePath `"../../"`
  - Canonical: `${SITE_URL}/tags/{slug}/`
- Generate `dist/tags/index.html` — overview of all tags (count badge per tag), basePath `"../"`
  - Canonical: `${SITE_URL}/tags/`
- Collect all tag URLs into `additionalSitemapUrls[]`

### W8 — Add `POSTS_PER_PAGE` constant to `build.js`
- `const POSTS_PER_PAGE = parseInt(process.env.POSTS_PER_PAGE || "5", 10);`
- Place with existing SEO constants

### W9 — Refactor blog index generation for pagination
- Split `postsMeta` into chunks of `POSTS_PER_PAGE`
- Page 1 → `dist/blog/index.html` (basePath `"../"`, canonical `${SITE_URL}/blog/`)
- Page N → `dist/blog/page/{n}/index.html` (basePath `"../../../"`, canonical `${SITE_URL}/blog/page/{n}/`)
- Each page includes `<nav class="pagination" aria-label="Blog page navigation">` with prev/next links
- Switch teaser "Read Article" href to absolute `post.url`
- Collect page 2+ canonical URLs into `additionalSitemapUrls[]`

### W10 — Install Pagefind and update build script
- `npm install -D pagefind`
- Update build script in `package.json`: `"node build.js && npx pagefind --site dist"`

### W11 — Add `data-pagefind-body` to `<main>` in `layout.html`
- Ensures Pagefind indexes only the main content region, not nav/footer

### W12 — Create `src/pages/search.html` with Pagefind UI
- `<section class="search-page"><div class="container"><h1>Search</h1><div id="search"></div></div></section>`
- Pagefind UI init script inline
- No inline `<link>` for Pagefind CSS — injected by `build.js` for `search.html` only

### W13 — Inject Pagefind CSS in `build.js` for `search.html`
- In `pages.forEach`, append `<link href="/pagefind/pagefind-ui.css" rel="stylesheet">` to `pageHeadMeta` when `page === "search.html"`

### W14 — Add search icon button to nav in `layout.html`
- SVG magnifying-glass icon, `aria-label="Search"`, href `/search.html`
- Class `nav-search-btn`, placed after Blog link in `.nav-links`

### W15 — Extend sitemap in `build.js`
- Add `/now.html` to `staticUrls`
- Add `/search.html` to `staticUrls`
- Add `/tags/` to `staticUrls`
- Spread `additionalSitemapUrls[]` (tag slug pages + paginated blog pages) into sitemap entries

### W16 — Add real tags to existing posts
- Add `tags` frontmatter values to at least 4 posts so tag pages are non-empty at verification time

### W17 — CSS additions in `style.css`
- `.tag-pill` — rounded pill, primary accent colour, hover state
- `.post-tags` / `.blog-teaser-tags` — flex containers for tag pills
- `.pagination` / `.pagination-btn` / `.pagination-btn[aria-disabled]` — prev/next controls
- `.tag-index-page` / `.all-tags-index` — tag listing page styles
- `.search-page` — search page section wrapper
- `.nav-search-btn` — 44 px icon-only touch target in nav (SVG icon button)

### W18 — Verification
- `npm run build` succeeds; `dist/pagefind/` directory appears
- `npm run preview:dist` spot-check:
  - `/search.html` loads with search bar, typing returns results
  - `/blog/` shows ≤5 posts with pagination next-link
  - `/blog/page/2/` shows remaining posts with prev-link
  - Post with tags shows pill links; clicking → `/tags/{slug}/`
  - `/tags/` shows all-tags overview
  - `/now.html` loads correctly
- `dist/sitemap.xml` includes all new URLs

## Definition of done
- `npm run build` succeeds end-to-end including Pagefind indexing
- Full-text search returns results on `/search.html`
- Blog index shows pagination when > 5 posts
- Tag pages exist for every unique tag across published posts
- `/now.html` is live and correct
- Nav has search icon button linking to `/search.html`
- Sitemap updated with all new URLs
- Tracker updated to `completed`
