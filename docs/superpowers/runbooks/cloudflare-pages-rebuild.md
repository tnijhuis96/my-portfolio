# Cloudflare Pages Rebuild

## Production branch
- `master`

## Preview branch
- Temporary for the rebuild phase: `feat/analyst-journal-rebuild`

## Build command
- `npm run build:new-site`

## Output directory
- `apps/site/dist`

## Content webhook
- Configure a Sanity webhook to trigger the Cloudflare Pages deploy hook on publish

## Local validation
- `npm run check:new-site`
- `npm run build:new-site`
- `npm run preview --workspace apps/site -- --host 127.0.0.1 --port 4322`

## Cutover checklist
- Confirm the local preview keeps the personal-but-structured homepage voice:
  - eyebrow: `Analyst Journal`
  - hero: `Understanding tools, AI automation, and what they change for small businesses.`
- Confirm the homepage includes `Current focus`, `Topics`, and `Recent writing`
- Confirm featured writing appears on the homepage when published article content is available in Sanity
- Confirm the rebuilt navigation contains `Topics`, `Articles`, `Now`, and `About`
- Confirm `/`, `/articles/`, `/topics/`, `/now/`, and `/about/` render from the rebuilt app
- Confirm there are no project cards or GitHub-fetched sections in the rebuilt preview
- Confirm `npm run check:new-site` and `npm run build:new-site` pass before any preview or production cutover
- Confirm `feat/analyst-journal-rebuild` preview deployment matches the approved design once the branch is connected to Cloudflare Pages
- Confirm Sanity publish triggers a Cloudflare preview rebuild once the deploy hook is configured
- Confirm the current site remains intact on `master` until merge day
- Confirm the new Astro + Sanity publishing path does not depend on `build.js` or `adminServer.js` after cutover, while the legacy path stays intact on `master` until merge day

## Remote checks
- The Cloudflare preview deployment and Sanity deploy-hook flow must be verified against a live preview environment; they cannot be fully proven from the local worktree alone.
