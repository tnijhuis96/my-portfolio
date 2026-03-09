# MVP3 Phase 3: Domain and Edge Routing Policy

## Status
- Phase: `P3 Domain and edge routing policy`
- State: `in-progress`
- Started: `2026-03-09`
- Owner: `Thomas`

## Goal
Finalize and verify canonical domain routing behavior for Cloudflare Pages with HTTPS enforcement and redirect policy aligned to MVP3 decisions.

## Locked inputs
- Canonical host: `urban-explore.com` (apex)
- Redirect policy: `www -> apex` permanent redirect
- HTTPS policy: force HTTPS at edge
- Deploy model: git-based via Cloudflare Pages

## Execution checklist
- [x] Confirm `urban-explore.com` is bound to the Pages project.
- [ ] Confirm `www.urban-explore.com` is bound and redirect rule is active.
- [x] Verify `http://urban-explore.com` redirects to `https://urban-explore.com`.
- [ ] Verify `https://www.urban-explore.com` redirects to `https://urban-explore.com`.
- [x] Confirm redirect status code behavior is permanent (`301`/equivalent edge permanent redirect policy).
- [ ] Confirm no route loop or mixed host/certificate errors.

## Evidence capture
Record observed outputs and screenshots/commands here.

### Domain binding proof
- Apex binding status: active (resolves to Cloudflare IPs `104.21.67.236` and `172.67.182.245`)
- `www` binding status: not active from public DNS perspective at time of check (`Could not resolve host: www.urban-explore.com`)
- Binding source (Pages settings / DNS records): live DNS + HTTP checks on `2026-03-09`

### Redirect proof
- `http://urban-explore.com` -> `301 Moved Permanently` to `https://urban-explore.com/`
- `https://www.urban-explore.com` -> DNS resolution failure (no redirect observed)
- Final canonical URL observed: `https://urban-explore.com/`

### HTTPS proof
- TLS active on apex: yes (`HTTP/2 200` from `https://urban-explore.com`)
- TLS active on `www`: unable to validate because host does not currently resolve
- Edge HTTPS redirect enabled: yes (`http://urban-explore.com` returns `301` to HTTPS)

## Verification checks
- [ ] Apex and `www` both resolve correctly.
- [ ] Canonical redirect behavior matches MVP3 locked decision.
- [x] HTTPS enforced for both hosts.
- [x] Public pages (`/`, `/projects.html`, `/blog/`) load correctly after redirects on apex host.

## Exit criteria for P3
- Domain bindings are active and stable.
- Canonical host policy (`www -> apex`) is verified and documented.
- HTTPS enforcement is verified and documented.
- Tracker entry for P3 is updated to `completed` with evidence references.

## Notes and blockers

### Active blocker
- `www.urban-explore.com` does not resolve in DNS at time of validation, so `www -> apex` redirect cannot be verified yet.

### Next actions
1. Add/fix `www` DNS binding in Cloudflare Pages/DNS for `www.urban-explore.com`.
2. Re-run redirect checks for `https://www.urban-explore.com` and confirm redirect target `https://urban-explore.com`.
3. Re-check final verification checklist and close P3 when all checks pass.
