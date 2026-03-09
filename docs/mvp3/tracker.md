# MVP3 Tracker

## Status legend
- `not-started`
- `in-progress`
- `blocked`
- `completed`

## Milestone health
- MVP3 overall status: `in-progress`
- Last updated: `2026-03-09`

## Phase tracker
| Phase | Status | Owner | Date | Notes |
|---|---|---|---|---|
| P1 Governance scaffolding | completed | Thomas/Copilot | 2026-03-08 | MVP3 canonical docs created in `docs/mvp3/` and linked in governance files |
| P2 Cloudflare foundation setup | completed | Thomas/Copilot | 2026-03-09 | Pages production deployment from `master` captured (`cd9da0a1.my-portfolio-dng.pages.dev`), zone activation confirmed, and non-master preview deployment succeeded at commit `670a0459ab0ee8981b8de62062d6a62ec9669862` |
| P3 Domain and edge routing policy | in-progress | Thomas/Copilot | 2026-03-09 | Apex redirect/HTTPS validation captured; blocker remains because `www.urban-explore.com` does not currently resolve, preventing `www -> apex` redirect verification |
| P4 Security hardening baseline | not-started | Thomas | TBD | WAF managed rules, bot/rate controls, NL-only country allowlist, security headers |
| P5 CI/CD and rollback readiness | not-started | Thomas | TBD | Build validation workflow, rollback runbook, operational checklist |
| P6 Go-live and post-launch monitoring | not-started | Thomas | TBD | Launch window execution, smoke checks, 48h monitoring and adjustments |

## Verification checklist (run each phase)
- [x] `npm run build` succeeds
- [x] `npm run admin` starts and admin screens work locally
- [x] `npm run preview:dist` serves expected pages on mobile + desktop
- [x] Cloudflare deployment checks for active phase are documented and verified

## Change control rule
- Any change to locked MVP3 decisions must be recorded first in `docs/mvp3/decisions.md`.
