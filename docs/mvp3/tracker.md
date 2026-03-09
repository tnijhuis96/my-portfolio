# MVP3 Tracker

## Status legend
- `not-started`
- `in-progress`
- `blocked`
- `completed`

## Milestone health
- MVP3 overall status: `planned`
- Last updated: `2026-03-08`

## Phase tracker
| Phase | Status | Owner | Date | Notes |
|---|---|---|---|---|
| P1 Governance scaffolding | completed | Thomas/Copilot | 2026-03-08 | MVP3 canonical docs created in `docs/mvp3/` and linked in governance files |
| P2 Cloudflare foundation setup | not-started | Thomas | TBD | Create/attach Pages project, set production branch `master`, configure preview deploys |
| P3 Domain and edge routing policy | not-started | Thomas | TBD | Canonical apex domain, `www` redirect, HTTPS enforcement, DNS validation |
| P4 Security hardening baseline | not-started | Thomas | TBD | WAF managed rules, bot/rate controls, NL-only country allowlist, security headers |
| P5 CI/CD and rollback readiness | not-started | Thomas | TBD | Build validation workflow, rollback runbook, operational checklist |
| P6 Go-live and post-launch monitoring | not-started | Thomas | TBD | Launch window execution, smoke checks, 48h monitoring and adjustments |

## Verification checklist (run each phase)
- [ ] `npm run build` succeeds
- [ ] `npm run admin` starts and admin screens work locally
- [ ] `npm run preview:dist` serves expected pages on mobile + desktop
- [ ] Cloudflare deployment checks for active phase are documented and verified

## Change control rule
- Any change to locked MVP3 decisions must be recorded first in `docs/mvp3/decisions.md`.
