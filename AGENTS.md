# AGENTS

## MVP2 Guardrails
When working on MVP2 tasks in this repository:

1. Use `docs/mvp2/definition.md` as the canonical source of truth.
2. Keep implementation within MVP2 scope:
- visual design, responsive behavior, accessibility baseline, and light copy tuning only.
3. Do not change backend logic or API contracts unless explicitly requested by the user.
4. If a locked design decision changes, update `docs/mvp2/decisions.md` first, then proceed with implementation.
5. Update `docs/mvp2/tracker.md` whenever phase status changes.
6. Ensure verification commands succeed after meaningful visual changes:
- `npm run build`
- `npm run admin`
- `npm run preview:dist`

## MVP3 Guardrails
When working on MVP3 tasks in this repository:

1. Use `docs/mvp3/definition.md` as the canonical source of truth.
2. Keep implementation within MVP3 scope:
- Cloudflare Pages hosting setup for static output
- domain/routing policy
- edge security baseline
- CI/CD and launch operations documentation
3. Do not change backend logic or API contracts unless explicitly requested by the user.
4. Keep `adminServer.js` private/local for MVP3; do not expose admin endpoints publicly as part of this milestone.
5. If a locked MVP3 decision changes, update `docs/mvp3/decisions.md` first, then proceed with implementation.
6. Update `docs/mvp3/tracker.md` whenever phase status changes.
7. Ensure verification commands succeed after meaningful MVP3 changes:
- `npm run build`
- `npm run admin`
- `npm run preview:dist`
8. Include Cloudflare verification evidence in MVP3 docs for relevant phases:
- production deploy from `master`
- `www` -> apex redirect behavior
- HTTPS/WAF/rate-limit posture
- NL-only geo policy behavior
9. Do not reintroduce `.env.example` dependency for MVP3; document variable names in docs without committing secret values.

## MVP Release Notes Governance
When closing any MVP in this repository:

1. Use `docs/releases/` as the canonical release-notes location.
2. Maintain required release files:
- `docs/releases/README.md` for release index and navigation
- `docs/releases/mvp-XXX.md` for per-MVP release notes
- `docs/releases/_template.md` as the source template for new release notes
3. Follow mandatory closeout flow before calling an MVP complete:
- Create or update the relevant `docs/releases/mvp-XXX.md`
- Link the MVP release note from `docs/releases/README.md`
- Ensure the corresponding `docs/mvpX/tracker.md` reflects the same completion state
4. If release documentation structure changes, update top-level `README.md` quick links in the same change.
