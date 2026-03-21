# MVP4 Decisions

## Decision log

| #  | Date       | Decision | Rationale |
|----|------------|----------|-----------|
| 1  | 2026-03-20 | `SITE_URL` defaults to `https://urban-explore.com` | Avoids build failure on local runs without .env; safe to override in CI |
| 2  | 2026-03-20 | `description` enforcement is warning-only | All 6 existing posts have descriptions; hard failure would block the build unnecessarily |
| 3  | 2026-03-20 | No `og:image` at MVP4 | No canonical image asset exists yet; an empty or placeholder `og:image` is worse than omitting it |
| 4  | 2026-03-20 | RSS 2.0 with Atom self-link | Broadest feed reader compatibility; Atom self-link is best practice per RSS 2.0 spec |
| 5  | 2026-03-20 | `JSON.stringify()` for JSON-LD serialisation | Prevents XSS and malformed JSON from special characters in title/description values |
| 6  | 2026-03-20 | No new npm dependencies for MVP4 | All required functionality is achievable with Node built-ins and existing `build.js` patterns |
