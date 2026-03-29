---
title: Delivered MVP 3!
description: Cloudflare launch, edge baseline, and a few DNS plot twists
date: '2026-03-09T17:45:00.000Z'
status: published
tags:
  - devlog
  - milestone
  - cloudflare
---

MVP3 was the "ship it to the internet" milestone, where this portfolio graduated from local hero to globally reachable citizen on Cloudflare Pages.

The mission was clear: production deploys from `master`, clean preview deploys from non-main branches, sensible domain policy, edge security baseline, and operations docs that future-me can actually follow at 2 AM.

What we achieved:

- Set up Cloudflare Pages as the hosting path for static output.
- Kept `adminServer.js` private and local-only, exactly as planned.
- Locked governance with canonical MVP3 docs: definition, decisions, tracker, and release notes.
- Verified production deployment from `master` and preview deployment from a feature branch.
- Confirmed apex domain behavior and HTTPS posture.
- Closed MVP3 with explicit documentation, evidence, and change-control discipline.

Now, the fun part: the struggles.

At first, deployment evidence looked suspiciously Wrangler-ish, which was awkward because this milestone is Pages-focused. We corrected that path and cleaned the docs so future us does not accidentally summon Worker ghosts.

Then came the classic combo: missing token moments, DNS propagation mood swings, and the legendary `www` subdomain drama. One check said "cannot resolve host," the next said "hello, 200 OK," but still refused to redirect to apex. In other words, `www` showed up to the party, then ignored the dress code.

Final status: MVP3 is closed, production is live, previews work, governance is solid, and the one known exception (`www -> apex` permanent redirect) is transparently recorded in the tracker.

If MVP1 built the engine and MVP2 painted the car, MVP3 put license plates on it and drove it onto the highway, with a small "check redirect" sticker on the dashboard.