# MVP2 Phase 1 Baseline Audit Freeze

## Status
- Phase: `P1 Baseline audit freeze`
- Date: `2026-03-08`
- State: `completed`

## Purpose
Freeze the pre-redesign visual baseline so MVP2 changes can be measured against a stable reference.

## Non-negotiables (locked for MVP2)
- Preserve route behavior and core page structure.
- Preserve `npm run build` output behavior.
- Preserve CMS behavior and API contracts under `npm run admin`.
- Restrict MVP2 changes to visual design, responsive behavior, accessibility baseline, and light copy tuning.

## Baseline source files reviewed
- `src/css/style.css`
- `src/templates/layout.html`
- `src/templates/post.html`
- `src/pages/index.html`
- `src/pages/projects.html`
- `admin/login.html`
- `admin/blog-editor.html`

## Visual baseline summary

### Public site
- Typography: system-ui stack, limited scale (hero-heavy, sparse hierarchy).
- Color: blue primary with neutral gray background/surfaces.
- Components: basic buttons, project cards with subtle shadows, plain blog article styling.
- Layout: single container width (`900px`) and one major responsive breakpoint (`768px`).
- Navigation: horizontal desktop links, stacked links on smaller screens.

### Admin UI
- Login page: unstyled bare HTML.
- Blog editor: inline CSS with standalone visual language (Arial, simple controls, minimal state styling).
- Public/admin design systems are currently inconsistent.

## CSS architecture baseline (current)

### Existing section structure in `src/css/style.css`
1. Reset
2. Layout container
3. Navigation
4. Hero section
5. Buttons
6. Blog preview
7. Footer
8. Project grid/cards
9. Responsive media query (`max-width: 768px`)

### Current architecture constraints
- Hardcoded values (colors/spacing/radius) instead of tokens.
- Limited focus-state and accessibility affordances.
- No dedicated component state model (active/disabled/loading).
- Single-breakpoint responsive strategy.

## Screenshot checklist (manual capture required)
Screenshots should be captured at minimum widths: `360`, `768`, `1280`.

- [ ] Home page (`dist/index.html`) desktop/mobile
- [ ] Projects page (`dist/projects.html`) desktop/mobile
- [ ] Blog index (`dist/blog/index.html`) desktop/mobile
- [ ] One blog post page (`dist/blog/*.html`) desktop/mobile
- [ ] Admin login (`http://localhost:3001/`) desktop/mobile
- [ ] Admin editor (`http://localhost:3001/admin`) desktop/mobile

## Verification commands for baseline snapshot
- `npm run build`
- `npm run admin`
- `npm run preview:dist`

## Exit criteria for P1
- Baseline audit document exists in repo.
- Phase tracker reflects P1 progress.
- Screenshot checklist is prepared for capture.
- Constraints and non-negotiables are clearly recorded.
