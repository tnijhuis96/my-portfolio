# MVP4 Tracker

## Status legend
- `not-started`
- `in-progress`
- `blocked`
- `completed`

## Milestone health
- MVP4 overall status: `completed`
- Last updated: `2026-03-20`

## Work item tracker

| ID  | Work Item                                       | Status      | Notes |
|-----|-------------------------------------------------|-------------|-------|
| W1  | Add `SITE_URL` constant to `build.js`           | completed   | |
| W2  | Add `{{headMeta}}` to `layout.html` + `applyLayout()` | completed | |
| W3  | Canonical link for static pages                 | completed   | |
| W4  | Canonical link for blog index                   | completed   | |
| W5  | Per-post OG + Twitter card meta                 | completed   | |
| W6  | JSON-LD Article schema per post                 | completed   | |
| W7  | `description` warning in `build.js`             | completed   | |
| W8  | Extend `postsMeta` entries (`isoDate`, `url`)   | completed   | |
| W9  | Generate RSS feed (`dist/feed.xml`)             | completed   | |
| W10 | Generate sitemap (`dist/sitemap.xml`)           | completed   | |
| W11 | Verification                                    | completed   | Build passes, all outputs verified |

## Verification checklist
- [x] `npm run build` succeeds with no new errors
- [x] `dist/feed.xml` present and opens without XML error in browser
- [x] `dist/sitemap.xml` present and valid
- [x] Post page `<head>` contains canonical, OG, Twitter card, JSON-LD
- [x] Static page `<head>` contains canonical link
- [x] Blog index `<head>` contains canonical link

## Change control rule
- Any change to locked MVP4 decisions must be recorded first in `docs/mvp4/decisions.md`.
