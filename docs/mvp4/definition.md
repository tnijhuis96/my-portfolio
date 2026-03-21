# MVP4 Definition: SEO & Discoverability

## Status
- Milestone: `MVP4`
- State: `completed`
- Last updated: `2026-03-20`

## Vision
Make every published post and page discoverable by search engines and shareable on social — entirely through build-time static output. No new runtime infrastructure.

## In scope
- RSS feed generated at build time (`dist/feed.xml`)
- XML sitemap generated at build time (`dist/sitemap.xml`)
- Open Graph + Twitter card `<meta>` tags on all post pages
- JSON-LD `Article` structured data on all post pages
- `<link rel="canonical">` on all generated pages (posts, blog index, static pages)
- `description` frontmatter: build-time warning when missing; already shown on blog index as subtitle

## Out of scope
- Dynamic sitemaps or server-side rendering
- Open Graph image generation or upload
- Google Search Console registration (manual post-deploy step)
- Social preview image assets
- `about.html` changes (lives outside `src/pages/`, not in current build pipeline)

## Locked decisions
1. Site URL source: `SITE_URL` env var with default `https://urban-explore.com`
2. Description enforcement: warning-only — missing description logs to console, does not fail the build
3. OG image strategy: omit `og:image` at MVP4 (no canonical image asset exists yet)
4. Canonical format for blog index: `${SITE_URL}/blog/`
5. RSS specification: RSS 2.0 with Atom self-link
6. Sitemap specification: sitemap.org 0.9
7. JSON-LD author value: `"Thomas Nijhuis"` (string literal in `build.js`)
8. JSON-LD serialisation: `JSON.stringify()` — no manual string construction (XSS prevention)

## Constraints
- Preserve `npm run build` contract — `SITE_URL` is optional with a safe default
- No new `npm` dependencies — only `build.js` + template changes
- `{{headMeta}}` placeholder in `layout.html` must default to empty string (backwards-safe)

## Work items

### W1 — Add `SITE_URL` constant to `build.js`
- Read `process.env.SITE_URL` with fallback `"https://urban-explore.com"`
- Strip trailing slash
- Place in the constants/paths block near the top of `build.js`

### W2 — Add `{{headMeta}}` placeholder to `layout.html` + update `applyLayout()`
- Add `    {{headMeta}}` on its own line immediately before `</head>` in `src/templates/layout.html`
- Add 5th parameter `headMeta = ""` to `applyLayout()` in `build.js`
- Add `.replace("{{headMeta}}", headMeta)` to the return chain

### W3 — Canonical link for static pages
- In the `pages.forEach` loop, compute `pageUrl` from `SITE_URL` + filename (`index.html` → trailing slash)
- Build `pageHeadMeta = '<link rel="canonical" href="...">'`
- Pass as 5th arg to `applyLayout()`

### W4 — Canonical link for blog index
- Before writing `dist/blog/index.html`, compute canonical `${SITE_URL}/blog/`
- Pass as 5th arg to `applyLayout()`

### W5 — Per-post OG + Twitter card meta
- In the post loop construct `postHeadMeta` containing:
  - `<link rel="canonical" href="...">`
  - `<meta property="og:type" content="article">`
  - `<meta property="og:title" content="...">`
  - `<meta property="og:description" content="...">`
  - `<meta property="og:url" content="...">`
  - `<meta property="og:site_name" content="Thomas Nijhuis">`
  - `<meta name="twitter:card" content="summary">`
  - `<meta name="twitter:title" content="...">`
  - `<meta name="twitter:description" content="...">`
- HTML-escape `&` → `&amp;` and `"` → `&quot;` in attribute values

### W6 — JSON-LD `Article` schema per post
- Append `<script type="application/ld+json">...</script>` to `postHeadMeta`
- Schema fields: `@context`, `@type: Article`, `headline`, `description`, `url`, `datePublished`, `author`
- Use `JSON.stringify()` — never manually construct the JSON string
- `datePublished` uses `new Date(data.date).toISOString()`

### W7 — `description` warning in `build.js`
- In the post loop, after frontmatter parse: `if (!data.description) console.warn(...)`
- Forward guard only — all 6 existing posts have descriptions

### W8 — Extend `postsMeta` entries
- Add `isoDate`, `url` fields to each `postsMeta.push({...})`
- Required by W9 (RSS) and W10 (sitemap)

### W9 — Generate RSS feed
- After `postsMeta` is sorted, build RSS 2.0 XML string
- Channel: title, link, description, language, `atom:link` self-reference
- Items: `<title>` (CDATA), `<link>`, `<guid isPermaLink="true">`, `<pubDate>` (RFC 822 via `.toUTCString()`), `<description>` (CDATA)
- Write to `dist/feed.xml`

### W10 — Generate sitemap
- Static URLs: `/` (priority 1.0), `/projects.html` (0.8), `/blog/` (0.9)
- Post URLs: each post URL (priority 0.7) with `<lastmod>` from ISO date (YYYY-MM-DD)
- Serialise to sitemap.org 0.9 XML
- Write to `dist/sitemap.xml`

### W11 — Verification
- `npm run build` succeeds with no new errors
- `dist/feed.xml` and `dist/sitemap.xml` exist
- Spot-check one post HTML: confirm canonical, OG, Twitter card, JSON-LD in `<head>`
- Spot-check `dist/index.html`: confirm canonical link in `<head>`
- Open `feed.xml` in browser — must parse without XML error

## Definition of done
- `dist/feed.xml` contains all published posts in valid RSS 2.0 format
- `dist/sitemap.xml` contains all public URLs with correct priorities
- Every post page `<head>` has canonical, OG, Twitter card, and JSON-LD
- Every static page `<head>` has a canonical link
- Blog index `<head>` has a canonical link
- `npm run build` succeeds with no new errors
- No new npm dependencies added
- Tracker updated to `completed` and release stub updated
