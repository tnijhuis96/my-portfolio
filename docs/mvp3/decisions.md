# MVP3 Decision Log

Record every MVP3 direction change here before implementation.

## Template
- ID: `MVP3-XXX`
- Date: `YYYY-MM-DD`
- Status: `proposed | accepted | rejected | superseded`
- Decision:
- Rationale:
- Alternatives considered:
- Impacted files:
- Follow-up actions:

---

## Decisions

### MVP3-001
- Date: `2026-03-08`
- Status: `accepted`
- Decision: Lock MVP3 scope and hosting/security direction as documented in `docs/mvp3/definition.md`.
- Rationale: Ensure cross-session and cross-agent consistency while moving from planning into implementation.
- Alternatives considered: Keep MVP3 intent in chat history only.
- Impacted files: `docs/mvp3/definition.md`, `docs/mvp3/definition.json`, `docs/mvp3/tracker.md`, `AGENTS.md`, `README.md`
- Follow-up actions: Use this log for all locked-decision changes before implementation edits.

### MVP3-002
- Date: `2026-03-08`
- Status: `accepted`
- Decision: Keep CMS (`adminServer.js`) private/local and use git-based Cloudflare deployment from `master` only during MVP3.
- Rationale: Minimize public attack surface and reduce operational complexity for first production launch.
- Alternatives considered: Public CMS endpoint behind Zero Trust, CMS deploy webhook automation.
- Impacted files: `docs/mvp3/definition.md`, `docs/mvp3/definition.json`, `docs/mvp3/tracker.md`
- Follow-up actions: Re-evaluate CMS exposure model in a future MVP if remote admin access becomes required.

### MVP3-003
- Date: `2026-03-08`
- Status: `accepted`
- Decision: Remove `.env.example` dependency from MVP3 governance and document required variable names in repository docs without committing secret values.
- Rationale: Align with explicit project decision and avoid implying template-based secret handling as a required dependency.
- Alternatives considered: Continue maintaining `.env.example` as canonical template.
- Impacted files: `docs/mvp3/definition.md`, `docs/mvp3/definition.json`, `README.md`
- Follow-up actions: Keep `.env` local-only and track required variables in documentation sections that never include real values.
