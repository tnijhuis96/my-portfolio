# MVP3 Definition: Cloudflare Hosting & Security Launch

## Status
- Milestone: `MVP3`
- State: `planned`
- Last updated: `2026-03-08`

## Vision
Host the public portfolio securely on Cloudflare Pages with predictable deployment flow, strict edge protections, and clear operational guardrails while keeping the CMS private/local.

## In scope
- Cloudflare Pages project setup for static output (`dist/`)
- Domain cutover and canonical host policy (`urban-explore.com` apex)
- HTTPS enforcement, WAF baseline, and edge rate-limiting baseline
- NL-only country allowlist at the edge
- CI validation for build integrity on PRs and production branch
- Rollback/runbook documentation and go-live checklist
- Documentation and governance updates for MVP3 consistency

## Out of scope
- Public exposure of `adminServer.js`
- CMS migration to Cloudflare Workers/Functions
- Backend/API contract changes unrelated to hosting/security
- Content model migrations unrelated to deployment/security
- CMS-triggered auto-deploy webhooks (deferred)

## Locked decisions
1. Hosting model: `Cloudflare Pages for public static site`
2. Admin model: `CMS remains private/local`
3. Deployment trigger: `Git-based deploys only from master`
4. Preview policy: `Preview deployments for pull requests`
5. Canonical domain: `urban-explore.com apex`
6. Redirect policy: `www -> apex permanent redirect`
7. Security posture: `Strict baseline (HTTPS + WAF + bot/rate protections)`
8. Geo policy: `Allow only NL traffic at launch`
9. Rollback policy: `Immediate rollback to previous successful deploy`
10. Secret handling: `No .env.example dependency; document variable names only`
11. Ownership model: `Single owner operations (Thomas)`
12. Timeline target: `Next weekend launch window`

## Constraints
- Preserve current build pipeline contract (`npm run build` -> `dist/`)
- Preserve CMS runtime behavior (`npm run admin`) without internet exposure
- Keep `.env` local-only and never commit secret values
- Keep implementation changes incremental and auditable through tracker phases
- If a locked MVP3 decision changes, update `docs/mvp3/decisions.md` first

## Definition of done
- MVP3 governance docs exist and are internally consistent (`definition`, `definition.json`, `tracker`, `decisions`, baseline audit)
- Cloudflare Pages config is documented with production branch `master` and preview deployment policy
- Domain, redirect, HTTPS, and edge security policies are documented as executable checklist items
- Verification checklist includes build/admin/preview commands plus Cloudflare deployment/security checks
- Release placeholder (`docs/releases/mvp-003.md`) exists and is linked from release index
- README and AGENTS guardrails reference MVP3 canonically
- No `.env.example` dependency remains in MVP3 governance
