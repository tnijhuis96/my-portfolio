# MVP5 Tracker

## Status legend
- `not-started`
- `in-progress`
- `blocked`
- `completed`

## Milestone health
- MVP5 overall status: `completed`
- Last updated: `2026-03-20`

## Work item tracker

| ID  | Work Item                                              | Status      | Notes |
|-----|--------------------------------------------------------|-------------|-------|
| W1  | Create `src/pages/now.html`                            | completed   | Manually authored with learning focus, active projects, links |
| W2  | Add `slugify()` utility to `build.js`                  | completed   | |
| W3  | Extract tags during post loop in `build.js`            | completed   | tagMap accumulated per post |
| W4  | Add `{{tags}}` placeholder to `post.html`              | completed   | |
| W5  | Render tag pills on post pages                         | completed   | |
| W6  | Add tag pills to blog index teasers                    | completed   | |
| W7  | Generate tag pages in `build.js`                       | completed   | 9 tag slugs + /tags/ overview |
| W8  | Add `POSTS_PER_PAGE` constant to `build.js`            | completed   | Default 5, env-var override |
| W9  | Refactor blog index generation for pagination          | completed   | Page 1 → /blog/, page 2 → /blog/page/2/ |
| W10 | Install Pagefind and update build script               | completed   | pagefind@1.4.0 devDependency |
| W11 | Add `data-pagefind-body` to `<main>` in `layout.html`  | completed   | |
| W12 | Create `src/pages/search.html` with Pagefind UI        | completed   | |
| W13 | Inject Pagefind CSS in `build.js` for `search.html`    | completed   | |
| W14 | Add search icon button to nav in `layout.html`         | completed   | SVG magnifying glass, aria-label="Search" |
| W15 | Extend sitemap in `build.js`                           | completed   | /now.html, /search.html, /tags/, tag slugs, /blog/page/2/ |
| W16 | Add real tags to existing posts                        | completed   | 7 posts tagged across 9 slugs |
| W17 | CSS additions in `style.css`                           | completed   | tag pills, pagination, tag pages, search page, now page, nav search btn |
| W18 | Verification                                           | completed   | `npm run build` passes; all outputs verified |

## Verification checklist
- [x] `npm run build` succeeds; `dist/pagefind/` directory appears
- [x] 24 pages indexed by Pagefind (773 words)
- [x] `/blog/` shows pagination — page 1 of 2
- [x] `/blog/page/2/` generated with prev-link back to `/blog/`
- [x] Post pages contain tag pill links (`/tags/{slug}/`)
- [x] Tag pills appear on blog index teaser cards
- [x] `/tags/{slug}/index.html` generated for all 9 slugs
- [x] `/tags/index.html` all-tags overview generated
- [x] `/now.html` generated
- [x] `dist/sitemap.xml` includes `/now.html`, `/search.html`, `/tags/`, tag slugs, `/blog/page/2/`
- [x] Pagefind CSS injected into `search.html` head only
- [ ] Manual browser check: search returns results (run `npm run preview:dist`)

## Change control rule
- Any change to locked MVP5 decisions must be recorded first in `docs/mvp5/decisions.md`.
