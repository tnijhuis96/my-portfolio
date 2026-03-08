# MVP2 Tracker

## Status legend
- `not-started`
- `in-progress`
- `blocked`
- `completed`

## Milestone health
- MVP2 overall status: `not-started`
- Last updated: `2026-03-08`

## Phase tracker
| Phase | Status | Owner | Date | Notes |
|---|---|---|---|---|
| P1 Baseline audit freeze | not-started | Thomas/Copilot | 2026-03-08 | Capture baseline screenshots and constraints |
| P2 Foundation tokens + typography | not-started | Thomas/Copilot | 2026-03-08 | Add `:root` tokens and type scale |
| P3 Public site layout/components | not-started | Thomas/Copilot | 2026-03-08 | Home/projects/nav/buttons/cards redesign |
| P4 Blog readability pass | not-started | Thomas/Copilot | 2026-03-08 | Blog index + post typography polish |
| P5 Admin separate theme | not-started | Thomas/Copilot | 2026-03-08 | Style `admin/login.html` and `admin/blog-editor.html` |
| P6 Responsive + a11y hardening | not-started | Thomas/Copilot | 2026-03-08 | Breakpoints, focus, keyboard, contrast |

## Verification checklist (run each phase)
- [ ] `npm run build` succeeds
- [ ] `npm run admin` starts and admin screens work
- [ ] `npm run preview:dist` looks correct on mobile + desktop
- [ ] Keyboard focus is visible on links, buttons, inputs
- [ ] No visual regressions in home, projects, blog index, post page

## Change control rule
- Any change to locked design decisions must be recorded first in `docs/mvp2/decisions.md`.
