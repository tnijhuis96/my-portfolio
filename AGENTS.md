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
