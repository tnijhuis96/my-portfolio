# MVP3 Phase 1 Baseline Audit Freeze

## Status
- Phase: `P1 Governance scaffolding`
- Date: `2026-03-08`
- State: `completed`

## Purpose
Freeze the pre-hosting baseline so Cloudflare deployment and security hardening can be measured against a stable starting point.

## Non-negotiables (locked for MVP3)
- Preserve current route behavior and core page structure.
- Preserve `npm run build` output contract (`dist/`).
- Preserve CMS behavior under `npm run admin` with private/local operation only.
- Restrict MVP3 implementation to hosting, deployment, security hardening, and operational governance.
- Do not rely on `.env.example`; document variable names only and keep secrets local.

## Baseline source files reviewed
- `build.js`
- `adminServer.js`
- `package.json`
- `AGENTS.md`
- `README.md`
- `docs/releases/README.md`

## Hosting/security baseline summary

### Hosting architecture (current)
- Static output generated to `dist/` via `npm run build`.
- No Cloudflare Pages project wired yet.
- Existing deploy helper scripts are local/GitHub-pages oriented, not Cloudflare-targeted.

### CMS exposure model (current)
- `adminServer.js` is local Express server on port `3001`.
- Authentication and CSRF controls exist; current model is local/private operation.

### Security and operations baseline (current)
- Build and admin commands verified historically in terminal context.
- No MVP3 Cloudflare edge policies are yet implemented in repository governance docs.
- Release governance exists and currently includes MVP1/MVP2 only.

## Readiness checklist (pre-implementation)
- [x] MVP3 scope and constraints documented
- [x] MVP3 decision log initialized
- [x] MVP3 phase tracker initialized
- [ ] Cloudflare Pages project created and linked
- [ ] Domain/routing policies validated in Cloudflare
- [ ] WAF/rate/geo policies configured and tested
- [ ] Rollback runbook validated

## Verification commands for baseline snapshot
- `npm run build`
- `npm run admin`
- `npm run preview:dist`

## Exit criteria for P1
- Baseline audit document exists in repo.
- Phase tracker reflects P1 completion.
- Scope constraints and policy locks are clearly recorded.
- MVP3 governance is linked from AGENTS, README, and release index.
