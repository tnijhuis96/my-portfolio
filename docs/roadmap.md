# Portfolio Roadmap

Canonical reference for the long-term feature roadmap of urban-explore.com.
Each entry maps to a dedicated `docs/mvpX/` milestone folder with its own definition, tracker, and decisions.

Updated: 2026-03-20

---

## Completed milestones

| MVP  | Title                              | Status    | Release notes |
|------|------------------------------------|-----------|---------------|
| MVP1 | Local-First CMS & Operations       | released  | [docs/releases/mvp-001.md](releases/mvp-001.md) |
| MVP2 | Visual Redesign & Accessibility    | released  | [docs/releases/mvp-002.md](releases/mvp-002.md) |
| MVP3 | Cloudflare Hosting & Edge Security | completed | [docs/releases/mvp-003.md](releases/mvp-003.md) |

---

## Upcoming milestones

| MVP  | Title                           | Theme                      | Status      |
|------|---------------------------------|----------------------------|-------------|
| MVP4 | SEO & Discoverability           | Build-time SEO foundations | completed   |
| MVP5 | Interactive Features & Search   | Static search, tags, pages | completed   |
| MVP6 | CMS & Authoring UX              | Better writing experience  | not-started |
| MVP7 | Observability & Dynamic Edge    | Analytics, view counters   | not-started |

---

## MVP4 — SEO & Discoverability

**Vision:** Make every published post and page discoverable by search engines and shareable on social media — entirely through build-time static output. No new runtime infrastructure.

**Key deliverables:**
- RSS feed (`/feed.xml`)
- XML sitemap (`/sitemap.xml`)
- OG + Twitter card `<meta>` tags per post
- JSON-LD `Article` structured data per post
- `<link rel="canonical">` on all generated pages
- `description` frontmatter: build-time warning when missing

**Constraints:** No new runtime dependencies. Pure `build.js` + template changes.

**Definition folder:** [docs/mvp4/](mvp4/)

---

## MVP5 — Interactive Features & Search

**Vision:** Let readers find content by topic and keyword, and give the site a richer feel beyond the blog and projects pages.

**Key deliverables:**
- Pagefind static full-text search (post-build step, index in `dist/`)
- Tag system: `tags` frontmatter array → `/tags/[slug]/` index pages at build time
- Blog pagination (configurable `POSTS_PER_PAGE` in `build.js`)
- `/now` page (manually authored, current learning focus)

**Constraints:** 100% static output. Pagefind added as `devDependency`. No server-side search.

---

## MVP6 — CMS & Authoring UX

**Vision:** Reduce friction in the writing cycle so content output can increase. All improvements are local-only — no changes to production hosting.

**Key deliverables:**
- Live markdown preview (split-pane in `blog-editor.html`)
- Draft support (`status: draft` — excluded from build output, visible in admin)
- Tag autocomplete sourced from existing post tags
- Scheduled publish (`publishAt: YYYY-MM-DD` frontmatter respected by `build.js`)
- External image URL input + inline preview in editor

**Constraints:** Local CMS only. No changes to API contracts or public-facing output structure.

---

## MVP7 — Observability & Dynamic Edge

**Vision:** Close the feedback loop with privacy-first analytics, introduce the first Cloudflare edge function, and audit monetisation placement.

**Key deliverables:**
- Cloudflare Web Analytics snippet in layout (free, no cookies)
- Post view counter via Cloudflare Pages Function + KV namespace
- AdSense placement audit after MVP5 layout changes
- `functions/` directory structure established for future edge logic

**Constraints:** Free tier only. No third-party SaaS analytics. KV and Pages Functions only.

---

## Governance rules

- Each MVP follows the same doc structure: `docs/mvpX/{definition,tracker,decisions,baseline-audit}.md`
- AGENTS.md guardrails are updated when a new MVP starts
- `docs/releases/mvp-XXX.md` is created as a stub at MVP start and filled at closeout
- `docs/roadmap.md` (this file) is updated whenever a milestone changes state
- No scope creep: additions go through a decision record in the milestone's `decisions.md` first
