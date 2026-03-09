# MVP3 Phase 2: Cloudflare Foundation Setup

## Status
- Phase: `P2 Cloudflare foundation setup`
- State: `in-progress`
- Started: `2026-03-09`
- Owner: `Thomas`

## Goal
Create and validate the Cloudflare Pages project foundation for this repository using the locked MVP3 decisions.

## Locked inputs
- Domain: `urban-explore.com`
- Canonical host target: `urban-explore.com` (apex)
- Production branch: `master`
- Deploy trigger model: `git-based`
- Preview model: PR previews enabled
- CMS hosting model: private/local only

## Execution checklist
- [x] Confirm Cloudflare zone for `urban-explore.com` is active in Cloudflare dashboard.
- [x] Create or connect a Cloudflare Pages project to this GitHub repository.
- [x] Set Framework preset to `None` (static build pipeline).
- [x] Set build command to `npm ci && npm run build`.
- [x] Set output directory to `dist`.
- [x] Set production branch to `master`.
- [x] Enable preview deployments for pull requests.
- [x] Configure Pages environment variable `GITHUB_USERNAME`.
- [x] Configure Pages secret environment variable `GITHUB_TOKEN`.
- [x] Trigger first production deploy from `master` and confirm success.

## Evidence capture
Record outcomes here as they are completed.

### Cloudflare project details
- Pages project name: `my-portfolio`
- Account/zone: `urban-explore.com` zone active (confirmed)
- Created date: pending capture
- Linked repository: connected via GitHub (confirmed)

### Build configuration proof
- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Production branch: `master` (confirmed by successful deployment from master)
- Preview setting: pending capture

### Environment variable proof
- `GITHUB_USERNAME`: set (`yes`) - build completed and GitHub repos fetched
- `GITHUB_TOKEN`: set (`yes`) - confirmed added in Cloudflare Pages project settings

### First deployment proof
- Deployment ID: `cd9da0a1`
- Commit SHA: pending capture
- Deployment URL: `https://cd9da0a1.my-portfolio-dng.pages.dev/`
- Result: successful Cloudflare Pages deployment from `master`

### Second deployment proof
- Deployment ID: pending capture
- Commit SHA: `670a0459ab0ee8981b8de62062d6a62ec9669862`
- Deployment URL: pending capture
- Result: successful preview deployment from non-master branch (`feature/preview-test`)

## Verification checks
- [x] `npm run build` succeeds locally.
- [x] Cloudflare Pages production deploy from `master` succeeds.
- [x] Preview deployment is created for at least one non-master change.

## Local verification evidence (2026-03-09)
- `npm run build`: succeeded; static pages/posts/projects generated and build completed.
- `npm run admin`: server started successfully at `http://localhost:3001`.
- `npm run preview:dist`: `serve` started at `http://localhost:4173` and was manually stopped after startup confirmation.

## Cloudflare deployment log evidence (Pages run)
- Build environment initialized successfully and dependencies installed.
- Build succeeded with generated pages/posts and `Generated projects from GitHub API`.
- Asset output directory validated and site deployed to Cloudflare's global network.
- Upload completed and deployment finished with `Success: Your site was deployed!`.
- Legacy worker deployment references were removed from this plan after migrating to Pages-only deployment flow.

## Cloudflare deployment log evidence (Preview run)
- Repository cloned at commit `670a0459ab0ee8981b8de62062d6a62ec9669862` from non-master branch context.
- Build completed successfully using `npm ci && npm run build`.
- Pages deployment completed successfully with `Success: Your site was deployed!`.
- Wrangler configuration check reported no config file found, matching Pages-only setup.

## Exit criteria for P2
- Pages project exists and is linked to this repository.
- Build/output settings match MVP3 definition.
- Production branch and preview policy are active.
- Required Pages environment variables are set.
- At least one successful production deployment is documented with evidence.

## Notes and blockers

### Blocker
- None.

### Next actions to close P2
1. Optional: capture preview deployment URL from the Cloudflare dashboard and append it to second deployment proof.
2. Proceed to MVP3 Phase 3 execution (`docs/mvp3/tracker.md`).
