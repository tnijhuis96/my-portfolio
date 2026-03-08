# MVP2 Definition: Visual Design Redesign

## Status
- Milestone: `MVP2`
- State: `Completed`
- Last updated: `2026-03-08`

## Completion note
MVP2 implementation is complete and verified through:
- `npm run build`
- `npm run admin`
- `npm run preview:dist`

## Vision
Create a minimal, sleek, responsive visual redesign for the portfolio + CMS, while preserving all current backend behavior and content flow.

## In scope
- Design system and visual tokens (color, spacing, typography, radius, shadow, motion)
- Public site visual redesign (home, projects, blog index, blog post)
- Admin visual redesign (separate theme from public site)
- Responsive refinements and accessibility baseline
- Light copy tuning only where it improves UI clarity

## Out of scope
- Backend logic changes
- API contract changes
- Deployment architecture changes
- Data model/content migration work unrelated to visual design

## Locked decisions
1. Brand vibe: `Tech-forward + modern`
2. Typography mood: `Geometric modern`
3. Font strategy: `One heading web font + system body`
4. Color direction: `Teal/cyan modern`
5. Contrast level: `Soft contrast`
6. Corner style: `Slightly rounded`
7. Depth style: `Subtle shadows`
8. Motion intensity: `Expressive` (with reduced-motion fallback)
9. Mobile navigation: `Compact menu button`
10. Hero tone: `Personal journey/story`
11. Projects presentation: `Compact and data-focused`
12. Blog reading style: `Editorial readable`
13. Admin styling: `Separate theme`
14. Accessibility priority: `Strong baseline`
15. Scope boundary: `Visual + light copy tuning`

## Visual references
- https://www.anthropic.com/
- https://www.meetjamie.ai/
- https://ellipsus.com/#introduction

## Constraints
- Preserve current routes and core page structure
- Preserve build behavior (`npm run build`) and CMS behavior (`npm run admin`)
- Prefer CSS/markup refinements; avoid JS behavior changes unless strictly UI-only

## Definition of done
- Public site uses a tokenized design system with consistent component styling
- Admin screens are visually redesigned with a separate but coherent theme
- Layout verified at core breakpoints: 360, 768, 1024, 1280
- Keyboard focus states and contrast checks pass baseline accessibility review
- Build and CMS run successfully after redesign changes
- Tracker and decision log are updated for each phase
