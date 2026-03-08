# MVP2 Tracker

## Status legend
- `not-started`
- `in-progress`
- `blocked`
- `completed`

## Milestone health
- MVP2 overall status: `completed`
- Last updated: `2026-03-08`

## Phase tracker
| Phase | Status | Owner | Date | Notes |
|---|---|---|---|---|
| P1 Baseline audit freeze | completed | Thomas/Copilot | 2026-03-08 | Baseline audit frozen in `docs/mvp2/baseline-audit.md`; command checks completed |
| P2 Foundation tokens + typography | completed | Thomas/Copilot | 2026-03-08 | Token system, typography hierarchy, control baseline, and focus/reduced-motion accessibility foundation completed |
| P3 Public site layout/components | completed | Thomas/Copilot | 2026-03-08 | Implemented compact menu nav, updated hero/story copy, and data-focused project cards for static + generated projects pages |
| P4 Blog readability pass | completed | Thomas/Copilot | 2026-03-08 | Added blog metadata (date/read-time), structured blog index cards, and editorial post typography/content rhythm |
| P5 Admin separate theme | completed | Thomas/Copilot | 2026-03-08 | Implemented separate admin login/editor theme with responsive panel layout and improved control/list styling |
| P6 Responsive + a11y hardening | completed | Thomas/Copilot | 2026-03-08 | Added skip-link + keyboard nav handling, touch-target/focus refinements, extra responsive breakpoints, and admin status/live-region accessibility improvements; verification commands completed |

## Verification checklist (run each phase)
- [x] `npm run build` succeeds
- [x] `npm run admin` starts and admin screens work
- [x] `npm run preview:dist` looks correct on mobile + desktop
- [x] Keyboard focus is visible on links, buttons, inputs
- [x] No visual regressions in home, projects, blog index, post page

## Change control rule
- Any change to locked design decisions must be recorded first in `docs/mvp2/decisions.md`.
