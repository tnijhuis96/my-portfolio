---
title: 'MVP4: SEO & Discoverability — Shipped'
description: Upgraded the site with SEO & Discoverability
date: '2026-03-21T17:02:21.513Z'
status: published
tags: []
---

The site just leveled up in a big way. MVP4 was all about making sure the work we're putting out actually gets found — and we delivered it entirely at build time, zero new infrastructure, pure lean execution.

Here's what got built:

Every published post now ships with a full Open Graph and Twitter card payload baked straight into the <head>. Share a link on social and the title, description, and site name render cleanly in the preview — no more blank cards. We also injected JSON-LD Article structured data on every post, giving search engines a strongly-typed signal: here's the headline, here's the author, here's when it was published. That's the foundation for rich results in Google Search.

Canonical links landed across the entire site — posts, static pages, the blog index — making sure there's zero ambiguity about which URL owns which content. A small but important hygiene win that compounds over time.

Two brand new output files now live in dist on every build. The RSS feed at /feed.xml is a fully valid RSS 2.0 document with an Atom self-link — any feed reader on the planet can subscribe to this blog right now. And /sitemap.xml maps every public URL with priorities and last-modified dates, ready to drop straight into Google Search Console.

The build itself stayed clean — no new npm dependencies, no new required environment variables, no breaking changes. Just build.js doing more work and layout.html getting a single {{headMeta}} placeholder that unlocks per-page head injection going forward.

MVP4 sets the table for everything that follows. Tags, pagination, search — all of that in MVP5 — now has a discoverability layer underneath it from day one. The content was always good. Now the internet can actually find it.
